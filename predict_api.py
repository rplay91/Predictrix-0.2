from openai import OpenAI
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Literal
import asyncio
import time
import re
from collections import Counter, OrderedDict
import json
from datetime import datetime, timezone
import numpy as np
import os
import hashlib
import threading
from functools import partial
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sentence_transformers import SentenceTransformer
from graphRAG.global_search import search_graph

from api_config import GPT_API_KEY
from behavior_log_api import log_prompt_snapshot, log_debug_event
client = OpenAI(api_key=GPT_API_KEY)
_OPENAI_PARSE = client.beta.chat.completions.parse

_PROMPT_CACHE_ENABLED = str(os.environ.get("ENABLE_PROMPT_CACHE", "1")).strip().lower() not in {
    "0",
    "false",
    "no",
    "off",
}
_PROMPT_CACHE_MAX_SIZE = max(int(os.environ.get("PROMPT_CACHE_MAX_SIZE", "512")), 1)
_PROMPT_CACHE: "OrderedDict[str, Dict[str, Any]]" = OrderedDict()
_PROMPT_CACHE_LOCK = threading.Lock()


def _collect_debug_log(
    *,
    sid: Optional[str],
    eid: Optional[int],
    stage: str,
    message: str,
    elapsed_s: Optional[float],
    collector: List[Dict[str, Any]],
    extra: Optional[Dict[str, Any]] = None,
) -> None:
    elapsed_ms = None
    if elapsed_s is not None:
        try:
            elapsed_ms = int(round(elapsed_s * 1000))
        except Exception:
            elapsed_ms = None
    collector.append(
        {
            "sid": sid,
            "eid": eid,
            "stage": stage,
            "message": message,
            "elapsed_ms": elapsed_ms,
            "extra": extra,
        }
    )


def _build_debug_summary(events: List[Dict[str, Any]]) -> str:
    if not events:
        return "No stage events recorded."
    parts: List[str] = []
    for event in events:
        stage = event.get("stage") or "unknown"
        elapsed_ms = event.get("elapsed_ms")
        message = event.get("message") or ""
        if elapsed_ms is None:
            parts.append(f"{stage}={message}")
        else:
            parts.append(f"{stage}={message} ({elapsed_ms} ms)")
    return " | ".join(parts)


def _read_int_env(name: str, default: int, minimum: int = 1) -> int:
    raw = os.environ.get(name)
    try:
        parsed = int(raw) if raw is not None else default
    except (TypeError, ValueError):
        parsed = default
    return max(parsed, minimum)


WRITING_PATTERN_BATCH_CHARS = _read_int_env("WRITING_PATTERN_BATCH_CHARS", 6000, minimum=1500)
WRITING_PATTERN_BATCH_CONCURRENCY = _read_int_env("WRITING_PATTERN_BATCH_CONCURRENCY", 3, minimum=1)


class _CachedParsedMessage:
    def __init__(self, parsed: Any) -> None:
        self.parsed = parsed


class _CachedParsedChoice:
    def __init__(self, parsed: Any) -> None:
        self.message = _CachedParsedMessage(parsed)


class _CachedParsedResponse:
    def __init__(self, parsed_items: List[Any]) -> None:
        self.choices = [_CachedParsedChoice(item) for item in parsed_items]


def _normalize_cache_value(value: Any) -> Any:
    if isinstance(value, type):
        try:
            if issubclass(value, BaseModel):
                return {"__pydantic_model__": f"{value.__module__}.{value.__qualname__}"}
        except TypeError:
            pass
        return str(value)
    if isinstance(value, BaseModel):
        return value.model_dump(mode="json")
    if isinstance(value, dict):
        return {
            str(k): _normalize_cache_value(v)
            for k, v in sorted(value.items(), key=lambda item: str(item[0]))
        }
    if isinstance(value, (list, tuple)):
        return [_normalize_cache_value(item) for item in value]
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    return str(value)


def _build_prompt_cache_key(endpoint: str, payload: Dict[str, Any]) -> str:
    normalized_payload = _normalize_cache_value(payload)
    encoded_payload = json.dumps(
        normalized_payload,
        ensure_ascii=True,
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(f"{endpoint}:{encoded_payload}".encode("utf-8")).hexdigest()


def _prompt_cache_get(cache_key: str) -> Optional[Dict[str, Any]]:
    with _PROMPT_CACHE_LOCK:
        cached = _PROMPT_CACHE.get(cache_key)
        if cached is None:
            return None
        _PROMPT_CACHE.move_to_end(cache_key)
        return cached


def _prompt_cache_set(cache_key: str, payload: Dict[str, Any]) -> None:
    with _PROMPT_CACHE_LOCK:
        _PROMPT_CACHE[cache_key] = payload
        _PROMPT_CACHE.move_to_end(cache_key)
        while len(_PROMPT_CACHE) > _PROMPT_CACHE_MAX_SIZE:
            _PROMPT_CACHE.popitem(last=False)


def _restore_cached_parsed_item(payload: Dict[str, Any], response_model: Any) -> Any:
    data = payload.get("data")
    if isinstance(response_model, type):
        try:
            if issubclass(response_model, BaseModel):
                return response_model.model_validate(data)
        except Exception:
            pass
    return data


def _cached_chat_parse(*, use_cache: bool = True, **kwargs):
    response_model = kwargs.get("response_format")
    should_cache = _PROMPT_CACHE_ENABLED and use_cache and bool(kwargs.get("messages"))
    cache_key: Optional[str] = None

    if should_cache:
        cache_key = _build_prompt_cache_key("chat.completions.parse", kwargs)
        cached = _prompt_cache_get(cache_key)
        if cached is not None:
            cached_items = [
                _restore_cached_parsed_item(item, response_model)
                for item in cached.get("choices", [])
            ]
            return _CachedParsedResponse(cached_items)

    request_kwargs = dict(kwargs)
    try:
        response = _OPENAI_PARSE(**request_kwargs)
    except Exception as exc:
        # Some models/endpoints reject reasoning_effort; retry without it.
        if (
            "Unrecognized request argument supplied: reasoning_effort" in str(exc)
            and "reasoning_effort" in request_kwargs
        ):
            request_kwargs.pop("reasoning_effort", None)
            response = _OPENAI_PARSE(**request_kwargs)
        else:
            raise

    if should_cache and cache_key is not None:
        cached_choices: List[Dict[str, Any]] = []
        for choice in getattr(response, "choices", []):
            parsed = getattr(getattr(choice, "message", None), "parsed", None)
            cached_choices.append({"data": _normalize_cache_value(parsed)})
        _prompt_cache_set(cache_key, {"choices": cached_choices})

    return response

MAX_FEEDBACK_RETRY = 3
FEEDBACK_LOG_PATH = "feedback_iterations.jsonl"
_FEEDBACK_STATE: Dict[str, Dict[str, Any]] = {}

RUBRIC_WEIGHTS: Dict[str, float] = {
    "topic_relevance": 0.22,
    "fluency": 0.20,
    "redundancy_check": 0.18,
    "logical_accuracy": 0.20,
    "contextual_consistency": 0.20,
}

RUBRIC_CATEGORIES = list(RUBRIC_WEIGHTS.keys())

JUDGE_PROMPT_TEMPLATE = """Judul Esai:
{title}

Informasi Kontekstual:
{contextual_information}

Teks sekitar sebelum [PREDICTED SENTENCE] (2-4 kalimat terakhir):
{prev_sentences}

Kalimat setelah [PREDICTED SENTENCE]:
{next_sentence}

Kalimat prediksi kandidat:
{candidate}

Rubrik:

Relevansi Topik
- Kesesuaian Topik: mendukung topik inti esai dari judul/konteks.
- Kejelasan Peran: perannya jelas (memperkenalkan ide, bukti, transisi, ringkasan).
- Relevansi: menghindari ide yang menyimpang.
Skor 0-10.

Kelancaran
- Keterhubungan Mulus: terhubung dengan kalimat di sekitarnya.
- Kualitas Transisi: frasa transisi membantu alur.
- Koherensi: menjaga perkembangan logis.
Skor 0-10.

Pemeriksaan Redundansi
- Keunikan: menghindari pengulangan/parafrasa ide yang sudah ada.
- Orisinalitas Semantik: menghindari duplikasi makna.
- Nilai Tambah: memberi konten baru yang bermakna.
Skor 0-10.

Akurasi Logis
- Akurasi Fakta: tidak ada klaim salah/tidak didukung.
- Konsistensi: tidak bertentangan dengan fakta dalam esai.
- Presisi Detail: detail penting tetap akurat.
Skor 0-10.

Konsistensi Kontekstual
- Kesesuaian Latar: sesuai dengan latar dan nada yang sudah ditetapkan.
- Penggunaan Informasi Kontekstual: menggunakan konteks secara tepat.
- Konsistensi Lingkungan: menghormati konteks yang sudah terbentuk.
Skor 0-10.

Kembalikan JSON saja berisi:
- scores (5 kategori)
- issues (kelemahan spesifik)
- prompt_revision_goal (satu tujuan ringkas)
"""

SELF_IMPROVER_PROMPT_TEMPLATE = """prompt_snapshot saat ini:
<<<
{prompt_snapshot}
>>>

Kalimat prediksi dari prompt_snapshot saat ini:
{predicted_sentence}

JSON penilaian:
{judge_json}

Tugas:
- Revisi HANYA prompt snapshot yang dipakai untuk generasi kalimat berikutnya.
- JANGAN menulis ulang kalimat prediksi secara langsung.
- Pertahankan fakta esai, jangan tambah klaim/statistik faktual baru.
- Terapkan edit terarah berdasarkan issues dari penilai dan prompt_revision_goal.
- Kembalikan JSON ketat saja dengan:
  - revised_prompt_snapshot (teks)
  - diff_summary (daftar ringkas perubahan)
"""


class RubricScores(BaseModel):
    topic_relevance: float = Field(ge=0, le=10)
    fluency: float = Field(ge=0, le=10)
    redundancy_check: float = Field(ge=0, le=10)
    logical_accuracy: float = Field(ge=0, le=10)
    contextual_consistency: float = Field(ge=0, le=10)


class JudgeIssue(BaseModel):
    category: Literal[
        "topic_relevance",
        "fluency",
        "redundancy_check",
        "logical_accuracy",
        "contextual_consistency",
    ]
    severity: Literal["high", "medium", "low"]
    reason: str
    fix_hint: str


class JudgeOutput(BaseModel):
    scores: RubricScores
    issues: List[JudgeIssue] = Field(default_factory=list)
    prompt_revision_goal: str


class SelfImproverOutput(BaseModel):
    revised_prompt_snapshot: str
    diff_summary: List[str] = Field(default_factory=list)


## add the reasoning Prompt for the component
# generate the reasoning from history essays
# construct the output to Pydantic


def reasoning_component(essay_context: str, previous_sentence: str, current_sentence: str) -> dict:
    """
    Single-request reasoning component (no cache).
    """
    class ReasoningOutput(BaseModel):
        abstract_concept: str
        forward_reasoning: str
        semantic_goal: str
        writing_style: str
        tone: str
        structure: str
        reasoning_summary: str

    reasoning_prompt = f"""
    Anda adalah agen penalaran Step-Back.

    Konteks Esai: {essay_context}
    Kalimat Sebelumnya: {previous_sentence}
    Kalimat Saat Ini: {current_sentence}

    Tugas (dalam SATU proses penalaran):
    1. Lakukan step back -> rangkum ide abstraknya.
    2. Lakukan penalaran maju -> jelaskan logika kelanjutan kalimat.
    3. Tentukan tujuan semantik kalimat berikutnya.
    4. Tentukan gaya penulisan: writing_style, tone, structure.
    5. Ringkas menjadi reasoning_summary singkat.

    Kembalikan JSON valid dengan field persis:
    - abstract_concept
    - forward_reasoning
    - semantic_goal
    - writing_style
    - tone
    - structure
    - reasoning_summary
    """

    response = _cached_chat_parse(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": reasoning_prompt}],
        response_format=ReasoningOutput,
        reasoning_effort="minimal",
        use_cache=False,
    )
    parsed = response.choices[0].message.parsed

    return {
        "stepback_reasoning": {
            "abstract_concept": parsed.abstract_concept,
            "forward_reasoning": parsed.forward_reasoning,
        },
        "semantic_goal": parsed.semantic_goal,
        "writing_style": {
            "writing_style": parsed.writing_style,
            "tone": parsed.tone,
            "structure": parsed.structure,
        },
        "reasoning_summary": parsed.reasoning_summary,
    }

# Identify the writing purpose
def identify_writing_purpose(current_writing_content):
    user_prompt = f"""# Instruksi:
Anda adalah asisten AI tingkat lanjut yang ahli dalam penulisan bahasa Indonesia. Tugas Anda adalah menganalisis tujuan penulisan dari kalimat prediksi dalam esai bahasa Indonesia. Berpikirlah langkah demi langkah.

# Struktur Input:
Pengguna memberikan isi esai:
Isi Esai:
{current_writing_content}

Selain itu, pengguna menentukan paragraf yang berisi kalimat prediksi dan menandai posisinya menggunakan [PREDICTED SENTENCE] di dalam teks paragraf.

# Tugas Anda:
1. Pahami Konteks: Analisis konten yang diberikan dan tentukan peran kalimat prediksi.
2. Identifikasi Tujuan Penulisan: Pertimbangkan apakah kalimat prediksi harus memperkenalkan ide, memberikan bukti, memberikan transisi, atau merangkum poin.
3. Keluarkan hanya tujuan kalimat prediksi yang Anda analisis."""

    # Output format
    class WritingPurposes(BaseModel):
        writing_purposes: str

    # Prepare request payload for the language model
    messages=[
        {"role": "user", "content": user_prompt}
    ]

    # Send request
    response = _cached_chat_parse(
        model="gpt-5-nano",
        reasoning_effort="minimal",
        messages=messages,
        response_format=WritingPurposes,
        n=5 # generate five different text
    )

    #  Output result: writing purposes list
    writing_purposes_list = []

    for choice in response.choices:
        writing_purposes_list.append(choice.message.parsed.writing_purposes)

    # Return the list of candidate writing purposes
    return writing_purposes_list

# Voting: choose the best writing purpose
def _resolve_vote_option(selection: str, options: List[str]) -> Optional[int]:
    """Convert model vote output into 1-based index position, if possible."""
    if not selection:
        return None
    cleaned = selection.strip()
    if cleaned.isdigit():
        idx = int(cleaned)
        return idx if 1 <= idx <= len(options) else None

    digit_match = re.search(r"\d+", cleaned)
    if digit_match:
        idx = int(digit_match.group())
        if 1 <= idx <= len(options):
            return idx

    lowered = cleaned.lower()
    for idx, option in enumerate(options, start=1):
        if lowered == option.strip().lower():
            return idx

    for idx, option in enumerate(options, start=1):
        option_lower = option.strip().lower()
        if option_lower in lowered or lowered in option_lower:
            return idx

    return None

def vote_writing_purpose(current_writing_content, writing_purposes_list):
    # Format candidate purposes for voting
    writing_purposes_options_list = "\n".join([f"{i+1}. {response}" for i, response in enumerate(writing_purposes_list)])
    # Build voting prompt for the language model
    user_prompt = f"""# Instruksi:
Anda adalah asisten AI tingkat lanjut yang ahli dalam penulisan bahasa Indonesia. Tugas Anda adalah menganalisis kalimat prediksi dalam esai bahasa Indonesia dan menentukan mana dari tiga tujuan penulisan yang paling sesuai dengan fungsinya. Selain itu, Anda harus mempertimbangkan apakah tujuan penulisan tersebut selaras dengan konteks esai bahasa Indonesia. Berpikirlah langkah demi langkah.

# Struktur Input:
Pengguna memberikan isi esai:
Isi Esai:
{current_writing_content}

Selain itu, pengguna menentukan paragraf yang berisi kalimat prediksi dan menandai posisinya menggunakan [PREDICTED SENTENCE] di dalam teks paragraf.

Tiga Tujuan Penulisan:{writing_purposes_options_list}

# Tugas Anda:
1. Analisis Konteks: Pahami alur logis esai dan peran kalimat prediksi.
2. Evaluasi Tujuan Penulisan: Bandingkan fungsi yang diharapkan dari kalimat prediksi dengan tiga tujuan penulisan yang diberikan, lalu nilai apakah sesuai dengan konteks deskripsi situasi.
3. Pilih yang Paling Sesuai: Tentukan dan jelaskan tujuan penulisan yang paling selaras dengan peran kalimat prediksi dan konteks esai bahasa Indonesia. (Jawab dengan angka: 1, 2, 3, 4, atau 5)
4. Jelaskan Pilihan Anda: Berikan penjelasan singkat yang mendukung pilihan berdasarkan struktur esai dan koherensi logis."""

    # Output format
    class BestMatchWritingPurposes(BaseModel):
        best_match_writing_purpose: str
        best_match_writing_purpose_reason: str

    # Prepare voting request payload for the language model
    messages=[
        {"role": "user", "content": user_prompt}
    ]

    # Ask the model to evaluate each candidate purpose
    response = _cached_chat_parse(
        model="gpt-5-nano",
        reasoning_effort="minimal",
        messages=messages,
        response_format=BestMatchWritingPurposes,
        n=5
    )

    # Output results: vote results
    best_match_writing_purpose_vote_results = []
    for choice in response.choices:
        selection = _resolve_vote_option(
            choice.message.parsed.best_match_writing_purpose,
            writing_purposes_list
        )
        if selection is None:
            return "", "Unable to interpret voting result for writing purpose."
        best_match_writing_purpose_vote_results.append(selection)

    # Check if there is a tie
    best_match_writing_purpose_vote_counts = Counter(best_match_writing_purpose_vote_results)
    best_match_writing_purpose_highest_vote_result = max(best_match_writing_purpose_vote_counts.values())
    best_match_writing_purpose_winning_options = [option for option, count in best_match_writing_purpose_vote_counts.items() if count == best_match_writing_purpose_highest_vote_result]

    # Re-voting prompt: choose the final result
    if len(best_match_writing_purpose_winning_options) > 1:
        # Prepare tie-breaking options for a second voting round
        # (previous debug prints removed because they contained non-English text)
        re_writing_purposes_options_list = ""  # Holds formatted candidate purposes for re-voting
        for i, option in enumerate(best_match_writing_purpose_winning_options, start=1):
            writing_purpose = writing_purposes_list[option - 1]
            re_writing_purposes_options_list += f"{i}. {writing_purpose}\n"
        
        # Build instruction prompt for the tie-breaking round
        user_prompt = f"""# Instruksi:
Anda adalah asisten AI tingkat lanjut yang ahli dalam penulisan bahasa Indonesia. Tugas Anda adalah menganalisis kalimat prediksi dalam esai bahasa Indonesia dan menentukan mana dari dua tujuan penulisan yang paling sesuai dengan fungsinya. Selain itu, Anda harus mempertimbangkan apakah tujuan penulisan tersebut selaras dengan konteks esai bahasa Indonesia. Berpikirlah langkah demi langkah.

# Struktur Input:
Pengguna memberikan isi esai:
Isi Esai:
{current_writing_content}

Selain itu, pengguna menentukan paragraf yang berisi kalimat prediksi dan menandai posisinya menggunakan [PREDICTED SENTENCE] di dalam teks paragraf.

Dua Tujuan Penulisan:{re_writing_purposes_options_list}

# Tugas Anda:
1. Analisis Konteks: Pahami alur logis esai dan peran kalimat prediksi.
2. Evaluasi Tujuan Penulisan: Bandingkan fungsi yang diharapkan dari kalimat prediksi dengan dua tujuan penulisan yang diberikan, lalu nilai apakah sesuai dengan konteks deskripsi situasi.
3. Pilih yang Paling Sesuai: Tentukan dan jelaskan tujuan penulisan yang paling selaras dengan peran kalimat prediksi dan konteks esai bahasa Indonesia. (Jawab dengan angka: 1, 2, 3, 4, atau 5)
4. Jelaskan Pilihan Anda: Berikan penjelasan singkat yang mendukung pilihan berdasarkan struktur esai dan koherensi logis."""
        # Output format
        class BestMatchWritingPurposes(BaseModel):
            best_match_writing_purpose: str
            best_match_writing_purpose_reason: str
        # Prepare tie-breaking request payload
        messages=[
            {"role": "user", "content": user_prompt}
        ]
        # Ask the model to resolve the tie between purposes
        response = _cached_chat_parse(
            model="gpt-5-nano",
            reasoning_effort="minimal",
            messages=messages,
            response_format=BestMatchWritingPurposes,
            n=3
        )
        # Output results: re-voting
        re_best_match_writing_purpose_vote_results = []
        tie_option_indices = best_match_writing_purpose_winning_options[:]
        tie_option_texts = [writing_purposes_list[idx - 1] for idx in tie_option_indices]
        for choice in response.choices:
            selection = _resolve_vote_option(
                choice.message.parsed.best_match_writing_purpose,
                tie_option_texts
            )
            if selection is None or not (1 <= selection <= len(tie_option_indices)):
                return "", "Unable to interpret tie-breaking vote result for writing purpose."
            re_best_match_writing_purpose_vote_results.append(tie_option_indices[selection - 1])
            # print("Number:" + choice.message.parsed.best_match_writing_purpose)
            # print("Reason:" + choice.message.parsed.best_match_writing_purpose_reason + "\n")
        # Count votes again
        best_match_writing_purpose_vote_counts = Counter(re_best_match_writing_purpose_vote_results)
        best_match_writing_purpose_highest_vote_result = max(best_match_writing_purpose_vote_counts.values())
        best_match_writing_purpose_winning_options = [option for option, count in best_match_writing_purpose_vote_counts.items() if count == best_match_writing_purpose_highest_vote_result]
        best_match_writing_purpose_winning_option = best_match_writing_purpose_winning_options[0]
        best_match_writing_purpose = writing_purposes_list[best_match_writing_purpose_winning_option - 1]
    else:
        best_match_writing_purpose_winning_option = best_match_writing_purpose_winning_options[0]
        best_match_writing_purpose = writing_purposes_list[best_match_writing_purpose_winning_option - 1]

    return best_match_writing_purpose, ""

# Generate queries (max 3)
def generate_question(current_writing_content, best_match_writing_purpose):
    user_prompt = f"""# Instruksi:
Anda adalah asisten AI tingkat lanjut yang ahli dalam analisis penulisan bahasa Indonesia. Tugas Anda adalah meningkatkan kalimat prediksi dalam esai bahasa Indonesia dengan merumuskan query database yang efektif. Kalimat prediksi memiliki tujuan penulisan tertentu yang akan diberikan sebagai input. Tujuan akhir Anda adalah menghasilkan TEPAT TIGA pertanyaan yang terarah, tajam, dan dapat mengambil informasi relevan dari database untuk menyempurnakan kalimat prediksi.

# Struktur Input:
Pengguna memberikan isi esai:
Isi Esai:
{current_writing_content}

Selain itu, pengguna menentukan paragraf yang berisi kalimat prediksi dan menandai posisinya menggunakan [PREDICTED SENTENCE] di dalam teks paragraf.

Tujuan penulisan kalimat prediksi: {best_match_writing_purpose}

# Tugas Anda:
1. Pahami alur logis esai dan peran kalimat prediksi.
2. Berdasarkan tujuan penulisan kalimat prediksi, hasilkan TEPAT TIGA pertanyaan yang singkat, konkret, dan ramah untuk pencarian database.
3. Pertanyaan harus berfokus pada pengambilan informasi faktual atau deskriptif, bukan analisis sastra."""

    # Response schema for generated questions
    class WritingQuerys(BaseModel):
        query: List[str]

    # Prepare question-generation payload
    messages=[
        {"role": "user", "content": user_prompt}
    ]

    # Request the model to generate research questions
    query = _cached_chat_parse(
        model="gpt-5-nano",
        reasoning_effort="minimal",
        messages=messages,
        response_format=WritingQuerys
    )

    # Result: generated questions
    query_list = query.choices[0].message.parsed.query

    return query_list

# Result: generated questions
async def answer_from_history(query):
    # Build prompt for retrieving factual answers from historical data
    user_prompt = f"""# Instruksi:
Anda adalah asisten AI yang bertugas mengekstrak informasi akurat dari subgraf Knowledge Graph yang diberikan. Tujuan utama Anda adalah menjawab pertanyaan pengguna secara ketat hanya berdasarkan fakta yang ada pada Knowledge Graph di bawah. Jika jawaban tidak direpresentasikan secara eksplisit atau tidak dapat disimpulkan langsung dari relasi graf, balas dengan "No related information." Hindari asumsi, penambahan pengetahuan eksternal, atau jawaban spekulatif. Berpikirlah langkah demi langkah.

# Struktur Input:
Pertanyaan: {query}

# Tugas Anda:
1. Tinjau subgraf Knowledge Graph dengan cermat untuk menentukan apakah ada jawaban langsung atas pertanyaan.
2. Jika jawaban direpresentasikan secara eksplisit atau dapat disimpulkan langsung melalui satu atau lebih relasi graf, berikan jawaban yang ringkas dan akurat.
3. Jika subgraf Knowledge Graph tidak memuat informasi yang diminta, balas secara ketat dengan: "No related information."
4. Jangan sertakan pengetahuan eksternal atau asumsi di luar yang ada pada subgraf Knowledge Graph yang diberikan.
"""
    cache_key = _build_prompt_cache_key("graph_search", {"prompt": user_prompt})
    cached = _prompt_cache_get(cache_key)
    if cached is not None and "answer" in cached:
        return str(cached["answer"])

    # GraphRAG retrieval search
    try:
        # Kirim user_prompt ke NodeRAG search engine
        result = await search_graph(user_prompt)
        if result and hasattr(result, "answer"):
            print(result.answer)
            answer_text = str(result.answer)
            _prompt_cache_set(cache_key, {"answer": answer_text})
            return answer_text
        print("no related info")
        answer_text = "No related information."
        _prompt_cache_set(cache_key, {"answer": answer_text})
        return answer_text
    except Exception as e:
        return f"Error during RAG search: {str(e)}"


async def answer_from_history_batch(queries: List[str]) -> Dict[str, str]:
    """Run historical retrieval for multiple queries concurrently."""
    if not queries:
        return {}
    tasks = [answer_from_history(query) for query in queries]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    output: Dict[str, str] = {}
    for query, result in zip(queries, results):
        if isinstance(result, Exception):
            output[query] = f"Error during RAG search: {str(result)}"
        else:
            output[query] = str(result)
    return output
    
    ## REASONING COMPONENT ###
 
# Answer questions using the current essay content
def answer_from_current(current_writing_content, query):
    user_prompt = f"""
# Instruksi:
Anda adalah asisten AI yang bertugas mengekstrak informasi akurat dari esai yang diberikan. Tujuan utama Anda adalah menjawab pertanyaan pengguna secara ketat berdasarkan teks yang tersedia. Jika jawaban tidak dinyatakan secara eksplisit atau tidak dapat disimpulkan langsung dari esai, balas dengan "No related information." Hindari asumsi, penambahan pengetahuan eksternal, atau jawaban spekulatif. Berpikirlah langkah demi langkah.

# Struktur Input:
Pengguna memberikan isi esai:
Isi Esai:
{current_writing_content}

Pertanyaan: {query}

# Tugas Anda:
1. Analisis esai dengan cermat untuk menentukan apakah esai memuat jawaban langsung atas pertanyaan.
2. Jika jawaban dinyatakan secara eksplisit atau dapat disimpulkan langsung dari esai, berikan jawaban yang ringkas dan akurat.
3. Jika esai tidak memuat informasi yang diminta, balas secara ketat dengan: "No related information."
4. Jangan sertakan pengetahuan eksternal atau asumsi di luar yang diberikan dalam esai.
"""
    user_prompt = user_prompt.replace("[PREDICTED SENTENCE]", "")

    # Response schema for answers drawn from the current essay
    class Answer(BaseModel):
        answer: str

    # Prepare payload for the current-essay answer step
    messages=[
        {"role": "user", "content": user_prompt}
    ]

    # Query the model for answers based on the current essay
    answer = _cached_chat_parse(
        model="gpt-5-nano",
        reasoning_effort="minimal",
        messages=messages,
        response_format=Answer
    )

    # Extract the parsed answer text
    query_answer_from_current = answer.choices[0].message.parsed.answer

    print(query_answer_from_current)
    return str(query_answer_from_current)


async def answer_from_current_batch(current_writing_content: str, queries: List[str]) -> Dict[str, str]:
    """Run current-essay answer extraction for multiple queries concurrently."""
    if not queries:
        return {}
    tasks = [
        asyncio.to_thread(answer_from_current, current_writing_content, query)
        for query in queries
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    output: Dict[str, str] = {}
    for query, result in zip(queries, results):
        if isinstance(result, Exception):
            output[query] = f"Error during current essay search: {str(result)}"
        else:
            output[query] = str(result)
    return output

# Identify sentence patterns using current and historical essays
def identify_sentence_pattern_and_style(current_writing_content, history_content, best_match_writing_purpose):
    current_text = str(current_writing_content or "").strip()
    history_text = str(history_content or "").strip()
    purpose_text = str(best_match_writing_purpose or "").strip()

    if not current_text and not history_text:
        default_pattern = (
            "Type: Deklaratif informatif\n"
            "Explanation: Kalimat langsung untuk menyampaikan informasi inti secara jelas.\n"
            "Example: Kalimat menyatakan poin utama tanpa struktur kompleks.\n"
            "Pattern: [Subjek] + [Predikat] + [Objek/Keterangan]\n"
            "Function: Menjaga kejelasan ide utama dan kesinambungan paragraf."
        )
        return default_pattern, "", ""

    user_prompt = f"""# Instruksi:
Anda adalah analis gaya penulisan bahasa Indonesia.
Tugas Anda: (1) pilih SATU pola kalimat terbaik untuk kalimat prediksi, dan (2) analisis pola serta fitur gaya penulisan pengguna.

Gunakan ringkasan gaya dari esai saat ini sebagai prioritas utama, lalu sesuaikan dengan riwayat jika relevan.
Jangan membuat banyak opsi. Kembalikan satu jawaban final saja untuk pola kalimat.

# Input:
[CURRENT ESSAY]
{current_text}

[HISTORY ESSAY]
{history_text}

[PREDICTION PURPOSE]
{purpose_text}
"""

    class WritingPattern(BaseModel):
        writing_pattern_type: str
        explanation: str
        pattern: str
        example: str

    class WritingFeature(BaseModel):
        writing_feature_type: str
        explanation: str
        example: str
        preferred_words: str
        preferred_syntax: str

    class PatternAndStyle(BaseModel):
        sentence_pattern: str
        writing_patterns: list[WritingPattern]
        writing_features: list[WritingFeature]

    messages = [
        {
            "role": "system",
            "content": (
                "Kamu menjawab ringkas, konsisten, dan mengikuti format output. "
                "Field sentence_pattern HARUS tepat 5 baris berikut:\n"
                "Type: ...\n"
                "Explanation: ...\n"
                "Example: ...\n"
                "Pattern: ...\n"
                "Function: ..."
            ),
        },
        {"role": "user", "content": user_prompt},
    ]

    response = _cached_chat_parse(
        model="gpt-4o-mini",
        reasoning_effort="minimal",
        messages=messages,
        response_format=PatternAndStyle,
        use_cache=True,
    )
    parsed = response.choices[0].message.parsed

    writing_patterns_formatted = []
    for idx, pattern in enumerate(parsed.writing_patterns, start=1):
        writing_patterns_formatted.append(
            f"Pattern {idx}:\n"
            f"Type: {pattern.writing_pattern_type}\n"
            f"Explanation: {pattern.explanation}\n"
            f"Pattern: {pattern.pattern}\n"
            f"Example: {pattern.example}\n"
        )
    writing_patterns_formatted_output = "\n".join(writing_patterns_formatted)

    writing_features_formatted = []
    for idx, feature in enumerate(parsed.writing_features, start=1):
        writing_features_formatted.append(
            f"Feature {idx}:\n"
            f"Type: {feature.writing_feature_type}\n"
            f"Explanation: {feature.explanation}\n"
            f"Example: {feature.example}\n"
            f"Preferred Words: {feature.preferred_words}\n"
            f"Preferred Syntax: {feature.preferred_syntax}\n"
        )
    writing_features_formatted_output = "\n".join(writing_features_formatted)

    return parsed.sentence_pattern, writing_patterns_formatted_output, writing_features_formatted_output

def _split_history_content_batches(history_content: str, max_chars: int) -> List[str]:
    text = str(history_content or "").strip()
    if not text:
        return []

    sections = [chunk.strip() for chunk in re.split(r"\n\s*\n+", text) if chunk and chunk.strip()]
    if not sections:
        return [text]

    batches: List[str] = []
    current_batch: List[str] = []
    current_len = 0

    for section in sections:
        section_len = len(section)
        extra_len = 2 if current_batch else 0
        if current_batch and current_len + extra_len + section_len > max_chars:
            batches.append("\n\n".join(current_batch))
            current_batch = [section]
            current_len = section_len
        else:
            current_batch.append(section)
            current_len += extra_len + section_len

    if current_batch:
        batches.append("\n\n".join(current_batch))

    return batches


def _identify_writing_pattern_single(history_content: str) -> tuple[str, str]:
    # Build prompt for writing pattern analysis
    user_prompt = f"""# Instruksi:
Anda adalah AI analisis tulisan yang dirancang untuk membantu pengguna memahami gaya menulis mereka. Tugas Anda adalah menghasilkan gaya menulis pengguna berdasarkan esai bahasa Indonesia yang diberikan pengguna.

# Detail Tugas:
- Analisis dan temukan pola serta fitur penulisan mendasar yang mencerminkan kebiasaan menulis personal pengguna, seperti kosakata yang disukai, struktur kalimat, dan perangkat retorika.
Jangan terlalu khawatir tentang kesalahan tata bahasa atau ejaan. Fokuslah pada identifikasi dan karakterisasi kecenderungan gaya pengguna.

# Struktur Output:
Writing Pattern
- writing pattern type: mendefinisikan kategori pola (mis. naratif, ekspositori, argumentatif, dll.)
- explanation: fitur utama pola, seperti cara informasi diorganisasi, kebiasaan ekspresi umum, nada, dll.
- pattern: cara umum dalam menyusun paragraf atau konten
example: berikan contoh representatif dari pola tersebut

Writing Feature
- writing feature type: mendefinisikan fitur penulisan (mis. kosakata, struktur kalimat, urutan kata, retorika, dll.)
- explanation: menjelaskan gaya ekspresi umum pengguna, termasuk sintaks yang disukai, kosakata, konjungsi, dll.
- example: berikan contoh bagaimana fitur tersebut muncul dalam teks
- preferred words: kata dan frasa yang disukai pengguna
- preferred syntax: struktur kalimat yang disukai pengguna, seperti kalimat sederhana, kalimat panjang, pola kalimat repetitif, dll.

# Input
Beberapa esai bahasa Indonesia:
{history_content}

# Tugas Anda:
1. Analisis esai yang diberikan untuk mengidentifikasi pola dan fitur penulisan.
2. Kembalikan hasil analisis dalam struktur output, pastikan setiap bagian lengkap dan dijelaskan dengan baik."""
    
    # Format writing pattern descriptions
    class WritingPattern(BaseModel):
        writing_pattern_type: str
        explanation: str
        pattern: str
        example: str
    class WritingFeature(BaseModel):
        writing_feature_type: str
        explanation: str
        example: str
        preferred_words: str
        preferred_syntax: str
    class WritingPatternAnalysis(BaseModel):
        writing_patterns: list[WritingPattern]
        writing_features: list[WritingFeature]
    # Format writing feature descriptions
    messages=[
        {"role": "user", "content": user_prompt},
    ]
    # Build prompt for generating the predicted sentence
    writing_pattern_analysis = _cached_chat_parse(
            model="gpt-4o-mini",
            reasoning_effort="minimal",
            messages=messages,
            response_format=WritingPatternAnalysis,
            use_cache=False,
        )
    writing_patterns = writing_pattern_analysis.choices[0].message.parsed.writing_patterns
    writing_features = writing_pattern_analysis.choices[0].message.parsed.writing_features

    # Format writing pattern descriptions
    writing_patterns_formatted = []
    for idx, pattern in enumerate(writing_patterns, start=1):
        writing_patterns_formatted.append(
            f"Pattern {idx}:\n"
            f"Type: {pattern.writing_pattern_type}\n"
            f"Explanation: {pattern.explanation}\n"
            f"Pattern: {pattern.pattern}\n"
            f"Example: {pattern.example}\n"
        )
    writing_patterns_formatted_output = "\n".join(writing_patterns_formatted)

    # Format writing feature descriptions
    writing_features_formatted = []
    for idx, feature in enumerate(writing_features, start=1):
        writing_features_formatted.append(
            f"Feature {idx}:\n"
            f"Type: {feature.writing_feature_type}\n"
            f"Explanation: {feature.explanation}\n"
            f"Example: {feature.example}\n"
            f"Preferred Words: {feature.preferred_words}\n"
            f"Preferred Syntax: {feature.preferred_syntax}\n"
        )
    writing_features_formatted_output = "\n".join(writing_features_formatted)

    
    return writing_patterns_formatted_output, writing_features_formatted_output


# Identify overall writing patterns from historical essays
async def identify_writing_pattern(history_content: str) -> tuple[str, str]:
    text = str(history_content or "").strip()
    if not text:
        return "", ""
    # Single request only (no batching).
    return await asyncio.to_thread(_identify_writing_pattern_single, text)


# Predict the final sentence using collected context
def predict_sentence(
    title,
    context_info,
    current_writing_content,
    best_match_writing_purpose,
    answer_from_current,
    answer_from_history,
    best_match_sentence_pattern,
    writing_patterns_formatted_output,
    writing_features_formatted_output,
    #vocabulary_info  # new
):
    # Run Step-Back Reasoning Component
    # reasoning_output = reasoning_component(
    # essay_context=context_info,
    # previous_sentence=answer_from_history,
    # current_sentence=current_writing_content)
    
    # Extracted Vocabulary Context:
# Vocabulary Words: {', '.join(vocabulary_info.get('vocabulary', []))}
# Common Words: {', '.join(vocabulary_info.get('common_words', []))}
    # Build prompt for generating the predicted sentence
    user_prompt = f"""# Instruksi:
Anda adalah asisten penulisan AI yang khusus memprediksi sebuah kalimat di dalam esai bahasa Indonesia pengguna.
Tugas Anda adalah menghasilkan SATU kalimat prediksi berdasarkan konteks lengkap yang diberikan.
Kalimat tersebut harus selaras dengan **topik inti** esai, sebagaimana didefinisikan oleh Judul dan Konteks, dan tidak boleh menyimpang dari subjek utama.
Berpikirlah langkah demi langkah!

# Detail Input:
- Judul Esai: Judul mendefinisikan topik inti esai dan menetapkan arah keseluruhan.
- Informasi Kontekstual: Deskripsi latar dan kata kunci yang mewakili maksud esai serta perspektif audiens.
- Isi Esai: Teks esai lengkap, dengan satu paragraf yang berisi penanda [PREDICTED SENTENCE], yaitu lokasi penyisipan kalimat.
- Tujuan Penulisan: Niat atau tujuan penambahan kalimat prediksi.
- Pola Penulisan: Struktur pengorganisasian esai.
- Fitur Penulisan: Nada stilistika dan linguistik.
- Pola Kalimat: Struktur gramatikal kalimat yang ditetapkan.
- Detail Peningkatan: Detail tambahan penulisan yang diambil dari draf saat ini dan draf sebelumnya.
- Konteks Kosakata Terekstrak: Kata dan ungkapan yang sering muncul dalam esai, mencerminkan nada dan konsistensi leksikal.

# Struktur Input:
Judul Esai:
{title}

Informasi Kontekstual:
{context_info}

Informasi Kontekstual:
{context_info}

Informasi Kontekstual:
{context_info}

Isi Esai:
{current_writing_content}

Tujuan Penulisan:
{best_match_writing_purpose}

Pola Penulisan:
{writing_patterns_formatted_output}

Fitur Penulisan:
{writing_features_formatted_output}

Pola Kalimat:
{best_match_sentence_pattern}

Detail Peningkatan:
{answer_from_current}

{answer_from_history}



# Tugas Anda:
1. **Fokus pada Topik Inti:**
   - Pastikan kalimat prediksi secara langsung mendukung topik inti esai sesuai Judul dan Informasi Kontekstual.
   - Identifikasi peran kalimat prediksi (memperkenalkan ide, memberikan bukti, memberi transisi, atau merangkum poin).
   - Hindari memasukkan ide yang tidak terkait atau menyimpang.

2. **Perkuat Alur Logis:**
   - Kalimat prediksi harus terhubung mulus dengan kalimat sebelum dan sesudahnya.
   - Gunakan kata atau frasa transisi jika diperlukan untuk memperbaiki alur.

3. **Hindari Redundansi:**
   - JANGAN mengulang atau memparafrase ide yang sudah ada di esai.
   - Periksa kemiripan semantik (bukan hanya teks permukaan).

4. **Pertahankan Akurasi Logis:**
   - Kalimat prediksi TIDAK BOLEH memperkenalkan informasi yang salah atau kontradiktif.

5. **Konsistensi Kontekstual:**
   - Selaraskan kalimat Anda dengan latar, nada, dan implikasi dunia nyata yang sudah ditetapkan dalam esai.
   - Gunakan informasi kontekstual dan kosakata terekstrak untuk menjaga kohesi leksikal.

6. **Integrasi Alami:**
   - Kalimat harus memperkuat alur paragraf, menghubungkan ide secara logis, dan terdengar alami.

7. **Jaga Konsistensi Gaya:**
   - Samakan nada dan pilihan leksikal yang digunakan dalam esai.
   - Hindari pergeseran figuratif atau emosional kecuali memang sudah ada.

8. **Keluarkan hanya SATU Kalimat.**

Sederhanakan kalimat PASTIKAN kalimatnya ringkas dan tidak terlalu panjang.
"""

    # Response schema for the predicted sentence
    class PredictSentence(BaseModel):
        predict_sentence: str

    # Prepare payload
    messages = [{"role": "user", "content": user_prompt}]

    # Send request to model
    predict_sentence = _cached_chat_parse(
        model="gpt-5",  # or gpt-4o-mini, etc.
        reasoning_effort="low",
        messages=messages,
        response_format=PredictSentence
    )

    # Extract predicted sentence
    final_predict_sentence = predict_sentence.choices[0].message.parsed.predict_sentence

    return final_predict_sentence, user_prompt



# prediction check
def get_or_create_sentence_pattern_and_style(sid, eid, current_content, history_content, purpose):
    # Keep sid/eid in signature for compatibility with existing callers.
    _ = (sid, eid)
    pattern, writing_patterns, writing_features = identify_sentence_pattern_and_style(
        current_content,
        history_content,
        purpose,
    )
    return normalize_pattern_string(pattern), writing_patterns, writing_features


def normalize_pattern_string(value: str) -> str:  # normalize "type:" from llm
    """
    Membersihkan pola keluaran LLM seperti:
    '3. Type: Cultural ...'
    '3.Type:...'
    'Pattern: Pattern: ...'
    'Type: Type: ...'
    menjadi format standar:
    'Type: <pattern description>'
    """
    if not isinstance(value, str):
        return value

    v = value.strip()
    if not v:
        return v

    # 1. Hilangkan angka prefix misalnya "3." atau "4. "
    if v[0].isdigit() and "." in v:
        v = v.split(".", 1)[1].strip()

    # 2. Hilangkan duplicate "Type: Type:" yang sering muncul di LLM
    while v.lower().startswith("type: type:"):
        v = v[5:].strip()  # hapus satu "Type:"

    # 3. Hilangkan prefix "Pattern:" jika muncul
    if v.lower().startswith("pattern:"):
        v = v[len("pattern:") :].strip()

    # 4. Pastikan final string diawali dengan "Type:"
    if not v.lower().startswith("type:"):
        v = "Type: " + v

    return v



# Execute prediction
async def _run_blocking(func, /, *args, **kwargs):
    """Run blocking code in a worker thread to keep FastAPI event loop responsive."""
    return await asyncio.to_thread(partial(func, *args, **kwargs))


async def get_predict_sentence(
    sid: str,
    eid: int,
    current_essay_content: str,
    history_essay_content: str,
    images_info: List[dict],
    title: str,
) -> tuple[str, str, Dict[str, Any]]:
    start_time = time.time()  # Start time
    debug_events: List[Dict[str, Any]] = []
    try:
        timeout = 100  # seconds

        # Combine image information into a string
        context_info = ""
        for idx, img in enumerate(images_info, 1):
            context_info += f"Context Infomation {idx}:\n"
            context_info += f"Keywords: {', '.join(img['keywords'])}\n"
            context_info += f"Description: {img['description']}\n\n"

        async def predict_with_timeout():
            # 1. Identify writing purposes
            purpose_start = time.time()
            writing_purposes_list = identify_writing_purpose(current_essay_content)
            if not writing_purposes_list:
                raise ValueError("Failed to identify a writing purpose for the current essay.")
            purpose_elapsed = time.time() - purpose_start
            _collect_debug_log(
                sid=sid,
                eid=eid,
                stage="writing_purpose_identification",
                message=f"Writing-purpose identification took {purpose_elapsed:.2f} s",
                elapsed_s=purpose_elapsed,
                collector=debug_events,
            )

            # 2. Vote for the best writing purpose
            vote_start = time.time()
            best_match_writing_purpose, error_msg = vote_writing_purpose(current_essay_content, writing_purposes_list)
            if error_msg:
                raise ValueError(f"Voting error while selecting writing purpose: {error_msg}")
            vote_elapsed = time.time() - vote_start
            _collect_debug_log(
                sid=sid,
                eid=eid,
                stage="writing_purpose_voting",
                message=f"Writing-purpose voting took {vote_elapsed:.2f} s",
                elapsed_s=vote_elapsed,
                collector=debug_events,
            )

            # 3. Generate guiding questions
            query_start = time.time()
            query_list = generate_question(current_essay_content, best_match_writing_purpose)
            if not query_list:
                raise ValueError("Failed to generate guiding questions for retrieval.")
            query_elapsed = time.time() - query_start
            _collect_debug_log(
                sid=sid,
                eid=eid,
                stage="question_generation",
                message=f"Question generation took {query_elapsed:.2f} s",
                elapsed_s=query_elapsed,
                collector=debug_events,
            )

            # 4 & 5. Retrieve history/current answers concurrently (batch)
            batch_start = time.time()
            history_task = asyncio.create_task(answer_from_history_batch(query_list))
            current_task = asyncio.create_task(answer_from_current_batch(current_essay_content, query_list))
            history_answers, current_answers = await asyncio.gather(history_task, current_task)

            answer_from_history_list = ""
            for query in query_list:
                query_answer_from_history = history_answers.get(query, "No related information.")
                if query_answer_from_history not in {
                    "I am sorry but I am unable to answer this question given the provided data.",
                    "No related information.",
                }:
                    answer_from_history_list += f"Question: {query}\nAnswer: {query_answer_from_history}\n\n"

            answer_from_current_list = ""
            for query in query_list:
                query_answer_from_current = current_answers.get(query, "No related information.")
                if query_answer_from_current != "No related information.":
                    answer_from_current_list += f"Question: {query}\nAnswer: {query_answer_from_current}\n\n"

            elapsed = time.time() - batch_start
            _collect_debug_log(
                sid=sid,
                eid=eid,
                stage="batch_retrieval",
                message=f"Batch retrieval (history + current) took {elapsed:.2f} s",
                elapsed_s=elapsed,
                collector=debug_events,
            )

            # 6 & 7. Sentence pattern lookup + writing-style analysis (single call)
            pattern_style_start = time.time()
            pattern_style_task = asyncio.to_thread(
                get_or_create_sentence_pattern_and_style,
                sid,
                eid,
                current_essay_content,
                history_essay_content,
                best_match_writing_purpose,
            )
            (
                best_match_sentence_pattern,
                writing_patterns_formatted_output,
                writing_features_formatted_output,
            ) = await pattern_style_task

            if not best_match_sentence_pattern:
                raise ValueError("Unable to obtain a sentence pattern for the prediction step.")
            if not writing_patterns_formatted_output or not writing_features_formatted_output:
                raise ValueError("Failed to identify writing patterns or features.")
            pattern_style_elapsed = time.time() - pattern_style_start
            _collect_debug_log(
                sid=sid,
                eid=eid,
                stage="sentence_pattern_and_style",
                message=(
                    "Sentence-pattern lookup + writing-style analysis took "
                    f"{pattern_style_elapsed:.2f} s"
                ),
                elapsed_s=pattern_style_elapsed,
                collector=debug_events,
            )

            # 8ï¸ NEW: Vocabulary Extraction (for lexical insight)
            # vocab_start = time.time()
            # vocabulary_info = extract_vocabulary_features(current_essay_content)
            # print(f"[DEBUG] Vocabulary extraction took {time.time() - vocab_start:.2f} s")
            # print(f"[INFO] Extracted vocabulary info: {vocabulary_info}")

            # 9. Generate predicted sentence
            predict_start = time.time()  
            final_predict_sentence, user_prompt = predict_sentence(
                title,
                context_info,
                current_essay_content,
                best_match_writing_purpose,
                answer_from_current_list,
                answer_from_history_list,
                best_match_sentence_pattern,
                writing_patterns_formatted_output,
                writing_features_formatted_output,
                # vocabulary_info  # âœ… new feature
            )
            if not final_predict_sentence:
                raise ValueError("Model did not return a predicted sentence.")
            predict_elapsed = time.time() - predict_start
            _collect_debug_log(
                sid=sid,
                eid=eid,
                stage="sentence_prediction",
                message=f"Sentence prediction took {predict_elapsed:.2f} s",
                elapsed_s=predict_elapsed,
                collector=debug_events,
            )

            context_summary = {
                "title": title,
                "writing_purpose": best_match_writing_purpose,
                "current_window": current_essay_content,
                "wsm_patterns": writing_patterns_formatted_output,
                "wsm_features": writing_features_formatted_output,
                "iem_snippets": {
                    "from_current": answer_from_current_list,
                    "from_history": answer_from_history_list,
                },
                "contextual_information": context_info,
            }
            self_improve_result = run_prompt_self_improve(
                context=context_summary,
                prompt_snapshot_v0=user_prompt,
                initial_prediction=final_predict_sentence,
            )
            final_predict_sentence = self_improve_result["best_predicted_sentence"]
            user_prompt = self_improve_result["best_prompt_snapshot"]

            _collect_debug_log(
                sid=sid,
                eid=eid,
                stage="prompt_self_improve",
                message=(
                    "Prompt self-improve selected prediction "
                    f"with weighted_total={self_improve_result['best_score_summary']['weighted_total']:.4f} "
                    f"verdict={self_improve_result['best_score_summary']['verdict']}"
                ),
                elapsed_s=None,
                collector=debug_events,
            )
            _append_feedback_log(
                {
                    "essay_id": str(eid),
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "event": "prompt_self_improve",
                    "result": self_improve_result,
                }
            )
            _cache_feedback_state(
                essay_id=str(eid),
                predicted_sentence=final_predict_sentence,
                pcp_prompt=user_prompt,
                context_summary=context_summary,
                self_improve_result=self_improve_result,
            )

            log_prompt_snapshot(
                sid=str(sid),
                eid=int(eid),
                prompt_snapshot=user_prompt,
                predicted_sentence=final_predict_sentence,
                model="gpt-5",
                self_improve_result=self_improve_result,
            )

            return final_predict_sentence, user_prompt, self_improve_result

        # Run all steps with timeout protection
        final_predict_sentence, user_prompt, self_improve_result = await asyncio.wait_for(
            predict_with_timeout(), timeout=timeout
        )
        total_elapsed = time.time() - start_time
        _collect_debug_log(
            sid=sid,
            eid=eid,
            stage="total_prediction",
            message=f"Total prediction time: {total_elapsed:.2f} s",
            elapsed_s=total_elapsed,
            collector=debug_events,
        )

        try:
            log_debug_event(
                sid=str(sid),
                eid=int(eid),
                stage="prediction_run",
                message=_build_debug_summary(debug_events),
                elapsed_ms=int(round(total_elapsed * 1000)),
                extra={"events": debug_events},
            )
        except Exception as exc:
            print(f"[WARNING] Debug log insert failed: {exc}")

        return final_predict_sentence, user_prompt, self_improve_result

    except asyncio.TimeoutError:
        timeout_elapsed = time.time() - start_time
        _collect_debug_log(
            sid=sid,
            eid=eid,
            stage="prediction_timeout",
            message=f"Prediction timed out after {timeout_elapsed:.2f} s",
            elapsed_s=timeout_elapsed,
            collector=debug_events,
        )
        try:
            log_debug_event(
                sid=str(sid),
                eid=int(eid),
                stage="prediction_timeout",
                message=_build_debug_summary(debug_events),
                elapsed_ms=int(round(timeout_elapsed * 1000)),
                extra={"events": debug_events},
            )
        except Exception as exc:
            print(f"[WARNING] Debug log insert failed: {exc}")
        raise TimeoutError("Prediction workflow exceeded the allowed time.")
    except Exception as e:
        fail_elapsed = time.time() - start_time
        _collect_debug_log(
            sid=sid,
            eid=eid,
            stage="prediction_error",
            message=f"Prediction failed after {fail_elapsed:.2f} s: {str(e)}",
            elapsed_s=fail_elapsed,
            collector=debug_events,
        )
        try:
            log_debug_event(
                sid=str(sid),
                eid=int(eid),
                stage="prediction_error",
                message=_build_debug_summary(debug_events),
                elapsed_ms=int(round(fail_elapsed * 1000)),
                extra={"events": debug_events},
            )
        except Exception as exc:
            print(f"[WARNING] Debug log insert failed: {exc}")
        raise e


def _cache_feedback_state(
    essay_id: str,
    predicted_sentence: str,
    pcp_prompt: str,
    context_summary: Dict[str, Any],
    self_improve_result: Optional[Dict[str, Any]] = None,
) -> None:
    _FEEDBACK_STATE[str(essay_id)] = {
        "predicted_sentence": predicted_sentence,
        "pcp_prompt": pcp_prompt,
        "context_summary": context_summary,
        "self_improve_result": self_improve_result,
        "iteration": 0,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


def _append_feedback_log(record: Dict[str, Any]) -> None:
    try:
        with open(FEEDBACK_LOG_PATH, "a", encoding="utf-8") as handle:
            handle.write(json.dumps(record, ensure_ascii=True) + "\n")
    except Exception as exc:
        print(f"[WARNING] Failed to persist feedback iteration: {exc}")


def _split_sentences(text: str) -> List[str]:
    if not text:
        return []
    chunks = re.split(r"(?<=[.!?])\s+", text.strip())
    return [chunk.strip() for chunk in chunks if chunk and chunk.strip()]


def _extract_surrounding_text(current_window: str) -> Dict[str, str]:
    marker = "[PREDICTED SENTENCE]"
    alt_marker = "[PREDICTED_SENTENCE]"
    if marker in current_window:
        before_text, after_text = current_window.split(marker, 1)
    elif alt_marker in current_window:
        before_text, after_text = current_window.split(alt_marker, 1)
    else:
        prev_sentences = _split_sentences(current_window)[-4:]
        return {
            "prev_sentences": "\n".join(f"- {s}" for s in prev_sentences) if prev_sentences else "No previous sentences.",
            "next_sentence": "no next sentence",
        }
    
    prev_sentences_list = _split_sentences(before_text)[-4:]
    next_sentences_list = _split_sentences(after_text)
    next_sentence = next_sentences_list[0] if next_sentences_list else "no next sentence"

    return {
        "prev_sentences": "\n".join(f"- {s}" for s in prev_sentences_list) if prev_sentences_list else "No previous sentences.",
        "next_sentence": next_sentence,
    }


def _compute_weighted_total(scores: Dict[str, float]) -> float:
    total = 0.0
    for category, weight in RUBRIC_WEIGHTS.items():
        total += float(scores.get(category, 0.0)) * weight
    return round(total, 4)


def _derive_verdict(scores: Dict[str, float], weighted_total: float) -> str:
    any_below_7 = any(float(scores.get(category, 0.0)) < 7.0 for category in RUBRIC_CATEGORIES)
    if weighted_total < 7.0 or float(scores.get("logical_accuracy", 0.0)) < 6.0:
        return "reject"
    if weighted_total >= 8.2 and not any_below_7:
        return "accept"
    return "revise"


def _normalize_judge_payload(payload: JudgeOutput) -> Dict[str, Any]:
    scores = payload.scores.model_dump()
    weighted_total = _compute_weighted_total(scores)
    verdict = _derive_verdict(scores, weighted_total)

    normalized_issues = []
    for issue in payload.issues:
        normalized_issues.append(
            {
                "category": issue.category,
                "severity": issue.severity,
                "reason": issue.reason.strip(),
                "fix_hint": issue.fix_hint.strip(),
            }
        )

    prompt_revision_goal = payload.prompt_revision_goal.strip() or "Perbaiki kelemahan rubrik sambil mempertahankan topik dan konsistensi gaya."
    return {
        "scores": scores,
        "weighted_total": weighted_total,
        "verdict": verdict,
        "issues": normalized_issues,
        "prompt_revision_goal": prompt_revision_goal,
    }


def _call_structured_with_retry(
    *,
    system_prompt: str,
    user_prompt: str,
    response_model: Any,
    model: str = "gpt-5-nano",
):
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

    last_error: Optional[Exception] = None
    for attempt in range(2):
        try:
            response = _cached_chat_parse(
                model=model,
                reasoning_effort="low",
                messages=messages,
                response_format=response_model,
            )
            parsed = response.choices[0].message.parsed
            if parsed is None:
                raise ValueError("Structured response is empty.")
            return parsed
        except Exception as exc:
            last_error = exc
            if attempt == 0:
                messages.append({"role": "user", "content": "Kembalikan hanya JSON yang valid."})
                continue
    raise RuntimeError(f"Structured model call failed: {last_error}")


def judge_prediction(context: Dict[str, Any], predicted_sentence: str) -> Dict[str, Any]:
    """Evaluate a candidate predicted sentence using structured rubric output."""
    title = str(context.get("title", "")).strip()
    contextual_information = str(context.get("contextual_information", "")).strip()
    current_window = str(context.get("current_window", "")).strip()
    extracted = _extract_surrounding_text(current_window)

    user_prompt = JUDGE_PROMPT_TEMPLATE.format(
        title=title or "Tanpa Judul",
        contextual_information=contextual_information or "Tidak ada informasi kontekstual yang diberikan.",
        prev_sentences=extracted["prev_sentences"],
        next_sentence=extracted["next_sentence"],
        candidate=predicted_sentence.strip(),
    )

    system_prompt = (
        "Anda adalah evaluator rubrik yang ketat untuk prediksi kalimat berikutnya pada esai EFL. "
        "Kembalikan hanya JSON yang persis mengikuti skema."
    )

    raw = _call_structured_with_retry(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        response_model=JudgeOutput,
    )
    normalized = _normalize_judge_payload(raw)
    return normalized


def revise_prompt_snapshot(prompt_snapshot: str, judge_json: Dict[str, Any]) -> Dict[str, Any]:
    """Revise only the prompt snapshot based on rubric feedback."""
    judge_payload = dict(judge_json)
    predicted_sentence = str(judge_payload.pop("_predicted_sentence", "")).strip()
    judge_text = json.dumps(judge_payload, ensure_ascii=True, indent=2)

    user_prompt = SELF_IMPROVER_PROMPT_TEMPLATE.format(
        prompt_snapshot=prompt_snapshot,
        predicted_sentence=predicted_sentence,
        judge_json=judge_text,
    )
    system_prompt = (
        "Anda merevisi prompt snapshot yang digunakan oleh generator kalimat berikutnya. "
        "Anda TIDAK menulis ulang kalimatnya. Kembalikan hanya JSON."
    )

    def _forced_delta_snapshot(base_prompt: str, judge_data: Dict[str, Any], revision_label: str) -> Dict[str, Any]:
        goal = str(judge_data.get("prompt_revision_goal", "")).strip()
        issues = judge_data.get("issues", [])
        hints: List[str] = []
        if isinstance(issues, list):
            for issue in issues[:3]:
                if isinstance(issue, dict):
                    hint = str(issue.get("fix_hint", "")).strip()
                    if hint:
                        hints.append(hint)
        extra_lines = [f"- Label revisi: {revision_label}"]
        if goal:
            extra_lines.append(f"- Tujuan prioritas: {goal}")
        for idx, hint in enumerate(hints, start=1):
            extra_lines.append(f"- Petunjuk perbaikan {idx}: {hint}")

        forced_block = (
            "\n\n# Fokus Revisi\n"
            "Terapkan batasan terarah berikut pada generasi berikutnya:\n"
            + "\n".join(extra_lines)
            + "\n"
        )
        revised = base_prompt.rstrip() + forced_block
        return {
            "revised_prompt_snapshot": revised,
            "diff_summary": [
                "Menambahkan blok fokus revisi eksplisit untuk memaksa perubahan prompt yang terarah.",
                f"Menyematkan label revisi: {revision_label}.",
            ],
        }

    try:
        raw = _call_structured_with_retry(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            response_model=SelfImproverOutput,
        )
        revised_prompt_snapshot = raw.revised_prompt_snapshot.strip()
        diff_summary = raw.diff_summary
        if not revised_prompt_snapshot:
            raise ValueError("Missing revised_prompt_snapshot.")
        if revised_prompt_snapshot == prompt_snapshot.strip():
            fallback = _forced_delta_snapshot(prompt_snapshot, judge_payload, "auto-forced-change")
            fallback["diff_summary"].insert(0, "Model mengembalikan prompt tanpa perubahan; diterapkan delta terarah minimal secara paksa.")
            return fallback
        clean_diff_summary = [str(item).strip() for item in diff_summary if str(item).strip()]
        if not clean_diff_summary:
            clean_diff_summary = ["Prompt snapshot direvisi dengan batasan terarah berdasarkan umpan balik rubrik."]
        return {
            "revised_prompt_snapshot": revised_prompt_snapshot,
            "diff_summary": clean_diff_summary,
        }
    except Exception as exc:
        print(f"[WARNING] SelfImprover failed, creating forced revision block: {exc}")
        fallback = _forced_delta_snapshot(prompt_snapshot, judge_payload, "fallback-after-error")
        fallback["diff_summary"].insert(0, "Fallback due to JSON/parse failure.")
        return fallback


def _prediction_rank_key(candidate: Dict[str, Any]) -> tuple:
    judge = candidate["judge"]
    scores = judge["scores"]
    return (
        float(judge.get("weighted_total", 0.0)),
        float(scores.get("topic_relevance", 0.0)),
        float(scores.get("contextual_consistency", 0.0)),
        float(scores.get("logical_accuracy", 0.0)),
    )


def run_prompt_self_improve(
    context: Dict[str, Any],
    prompt_snapshot_v0: str,
    initial_prediction: Optional[str] = None,
) -> Dict[str, Any]:
    """
    One-shot self-improvement:
    revise the initial predicted sentence in a single model request.
    """
    if not prompt_snapshot_v0 or not prompt_snapshot_v0.strip():
        raise ValueError("prompt_snapshot_v0 is required.")

    base_prediction = initial_prediction.strip() if initial_prediction else _predict_from_pcp_prompt(prompt_snapshot_v0)
    surrounding = _extract_surrounding_text(str(context.get("current_window", "")))
    title = str(context.get("title", "")).strip() or "Tanpa Judul"
    writing_purpose = str(context.get("writing_purpose", "")).strip()
    contextual_information = str(context.get("contextual_information", "")).strip()

    class OneShotSelfImproveOutput(BaseModel):
        improved_sentence: str
        short_reason: str = ""

    user_prompt = f"""Anda adalah editor kalimat prediksi esai.
Perbaiki SATU kalimat prediksi agar:
- relevan dengan topik dan tujuan penulisan,
- tidak redundan,
- alami dengan kalimat sebelum/sesudahnya,
- tidak menambah fakta baru yang tidak didukung konteks.
- Sederhanakan kalimat PASTIKAN kalimatnya ringkas dan tidak terlalu panjang.

Judul:
{title}

Tujuan Penulisan:
{writing_purpose}

Informasi Kontekstual:
{contextual_information}

Kalimat sebelum:
{surrounding.get("prev_sentences", "")}

Kalimat sesudah:
{surrounding.get("next_sentence", "")}

Kalimat awal:
{base_prediction}

Kembalikan JSON valid dengan key:
- improved_sentence
- short_reason
"""

    improved_sentence = base_prediction
    short_reason = "Fallback to initial prediction."
    try:
        response = _cached_chat_parse(
            model="gpt-4o-mini",
            reasoning_effort="low",
            messages=[{"role": "user", "content": user_prompt}],
            response_format=OneShotSelfImproveOutput,
            use_cache=False,
        )
        parsed = response.choices[0].message.parsed
        candidate = str(parsed.improved_sentence).strip()
        if candidate:
            improved_sentence = candidate
        reason_text = str(parsed.short_reason).strip()
        if reason_text:
            short_reason = reason_text
    except Exception as exc:
        print(f"[WARNING] One-shot self-improve failed; using initial prediction: {exc}")

    zero_scores = {category: 0.0 for category in RUBRIC_CATEGORIES}
    return {
        "best_predicted_sentence": improved_sentence,
        "best_score_summary": {
            "scores": zero_scores,
            "weighted_total": 0.0,
            "verdict": "one_shot",
        },
        "best_prompt_snapshot": prompt_snapshot_v0,
        "debug_log": {
            "mode": "one_shot",
            "base_prediction": base_prediction,
            "short_reason": short_reason,
        },
    }

## user judgement ###
class SimilarityEvaluatorBgeM3:
    """Evaluate similarity using BGE-M3 embeddings with a TF-IDF fallback."""

    def __init__(self, model_name_or_path: str = "BAAI/bge-m3", cache_size: int = 256) -> None:
        self._cache: Dict[str, np.ndarray] = {}
        self._cache_size = max(cache_size, 1)
        model_path = os.environ.get("BGE_M3_MODEL_PATH", model_name_or_path)
        try:
            self._model = SentenceTransformer(model_path, local_files_only=True)
            self._use_fallback = False
            self.embedding_model = "bge-m3"
        except Exception as exc:
            print(f"[WARNING] BGE-M3 load failed, using TF-IDF fallback: {exc}")
            self._model = None
            self._use_fallback = True
            self.embedding_model = "tf-idf-fallback"

    def _cache_embedding(self, text: str, embedding: np.ndarray) -> None:
        if text in self._cache:
            return
        if len(self._cache) >= self._cache_size:
            self._cache.pop(next(iter(self._cache)))
        self._cache[text] = embedding

    def _get_embedding(self, text: str) -> np.ndarray:
        cached = self._cache.get(text)
        if cached is not None:
            return cached
        embedding = self._model.encode([text], convert_to_numpy=True, normalize_embeddings=True)[0]
        self._cache_embedding(text, embedding)
        return embedding

    def _tfidf_score(self, a: str, b: str) -> float:
        vectorizer = TfidfVectorizer()
        matrix = vectorizer.fit_transform([a, b])
        score = cosine_similarity(matrix[0], matrix[1])[0][0]
        return float(max(0.0, min(1.0, score)))

    def score(self, a: str, b: str) -> float:
        if not a or not b:
            return 0.0
        if self._use_fallback:
            return self._tfidf_score(a, b)

        try:
            emb_a = self._get_embedding(a)
            emb_b = self._get_embedding(b)
            denom = (np.linalg.norm(emb_a) * np.linalg.norm(emb_b))
            if denom == 0:
                return 0.0
            score = float(np.dot(emb_a, emb_b) / denom)
            return max(0.0, min(1.0, score))
        except Exception as exc:
            print(f"[WARNING] BGE-M3 scoring failed, using TF-IDF fallback: {exc}")
            return self._tfidf_score(a, b)


class PcpReviserGpt52:
    """Revise PCP prompts with GPT-5.2, returning JSON-only output."""

    def __init__(self) -> None:
        self._client = client

    def _build_messages(
        self,
        prev_pcp: str,
        prev_pred: str,
        original: str,
        score: float,
        ctx: Dict[str, Any],
    ) -> List[Dict[str, str]]:
        ctx_text = json.dumps(ctx, ensure_ascii=True, indent=2)
        system_prompt = (
            "Anda adalah agen revisi prompt yang deterministik. "
            "Kembalikan HANYA JSON valid dengan key: revised_pcp_prompt, short_revision_rationale. "
            "Jangan sertakan key tambahan, code fence, atau komentar."
        )
        user_prompt = f"""Revisi prompt PCP untuk meningkatkan keselarasan semantik.

Input:
prev_pcp_prompt:
<<<
{prev_pcp}
>>>

prev_predicted_sentence:
{prev_pred}

user_original_sentence:
{original}

similarity_score (0..1):
{score:.4f}

current_essay_context_summary (JSON):
{ctx_text}

Aturan:
- Revisi prompt.
- Pastikan prediksi tetap selaras dengan topik dan tujuan esai.
- Berikan kata kunci yang terkait dengan kalimat asli.
- Keluarkan JSON saja dengan:
  - revised_pcp_prompt (string)
  - short_revision_rationale (string, <= 80 kata)
"""
        return [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

    def _parse_revision(self, content: str) -> Dict[str, str]:
        data = json.loads(content or "{}")
        revised = str(data.get("revised_pcp_prompt", "")).strip()
        rationale = str(data.get("short_revision_rationale", "")).strip()
        if not revised or not rationale:
            raise ValueError("Missing required revision fields.")
        words = rationale.split()
        if len(words) > 80:
            rationale = " ".join(words[:80])
        return {
            "revised_pcp_prompt": revised,
            "short_revision_rationale": rationale,
        }

    def revise(
        self,
        prev_pcp: str,
        prev_pred: str,
        original: str,
        score: float,
        ctx: Dict[str, Any],
    ) -> Dict[str, str]:
        messages = self._build_messages(prev_pcp, prev_pred, original, score, ctx)
        for attempt in range(2):
            try:
                response = self._client.chat.completions.create(
                    model="gpt-5-nano",
                    messages=messages,
                    temperature=0,
                    response_format={"type": "json_object"},
                )
                content = response.choices[0].message.content or ""
                return self._parse_revision(content)
            except Exception as exc:
                if attempt == 0:
                    print(f"[WARNING] Revision JSON parse failed, retrying: {exc}")
                    continue
                print(f"[WARNING] Revision failed, falling back to previous PCP: {exc}")
                break
        return {
            "revised_pcp_prompt": prev_pcp,
            "short_revision_rationale": "Revision failed; using previous PCP prompt.",
        }


_SIMILARITY_EVALUATOR: Optional[SimilarityEvaluatorBgeM3] = None
_PCP_REVISER: Optional[PcpReviserGpt52] = None


def _get_similarity_evaluator() -> SimilarityEvaluatorBgeM3:
    global _SIMILARITY_EVALUATOR
    if _SIMILARITY_EVALUATOR is None:
        _SIMILARITY_EVALUATOR = SimilarityEvaluatorBgeM3()
    return _SIMILARITY_EVALUATOR


def _get_pcp_reviser() -> PcpReviserGpt52:
    global _PCP_REVISER
    if _PCP_REVISER is None:
        _PCP_REVISER = PcpReviserGpt52()
    return _PCP_REVISER


def _predict_from_pcp_prompt(pcp_prompt: str) -> str:
    class PredictSentence(BaseModel):
        predict_sentence: str

    response = _cached_chat_parse(
        model="gpt-5-nano",
        reasoning_effort="low",
        messages=[{"role": "user", "content": pcp_prompt}],
        response_format=PredictSentence,
    )
    return response.choices[0].message.parsed.predict_sentence.strip()



## user judgement ###
def run_feedback_loop(
    essay_id: str,
    user_judgment: str,
    user_original_sentence: Optional[str],
) -> Dict[str, Any]:
    """Run one iteration of the feedback loop for a given essay."""
    normalized_judgment = (user_judgment or "").strip().lower()
    if normalized_judgment not in {"ok", "not ok"}:
        raise ValueError("user_judgment must be 'ok' or 'not ok'.")

    state = _FEEDBACK_STATE.get(str(essay_id))
    if not state:
        raise ValueError("No previous prediction found for this essay_id. Run prediction first.")

    iteration = int(state.get("iteration", 0))
    prev_pred = state.get("predicted_sentence", "")
    prev_pcp = state.get("pcp_prompt", "")
    ctx_summary = state.get("context_summary", {})

    if normalized_judgment == "ok":
        record = {
            "essay_id": essay_id,
            "iteration": iteration,
            "status": "final",
            "predicted_sentence": prev_pred,
            "judgment": "ok",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        _append_feedback_log(record)
        return {
            "status": "final",
            "predicted_sentence": prev_pred,
            "iteration": iteration,
            "similarity_score": None,
            "revision_rationale": None,
            "revised_pcp_prompt": None,
        }

    if not user_original_sentence or not user_original_sentence.strip():
        raise ValueError("user_original_sentence is required when judgment is 'not ok'.")

    if iteration >= MAX_FEEDBACK_RETRY:
        return {
            "status": "final",
            "predicted_sentence": prev_pred,
            "iteration": iteration,
            "similarity_score": None,
            "revision_rationale": None,
            "revised_pcp_prompt": None,
        }

    evaluator = _get_similarity_evaluator()
    similarity_score = evaluator.score(prev_pred, user_original_sentence.strip())

    reviser = _get_pcp_reviser()
    revision = reviser.revise(
        prev_pcp=prev_pcp,
        prev_pred=prev_pred,
        original=user_original_sentence.strip(),
        score=similarity_score,
        ctx=ctx_summary,
    )
    revised_pcp = revision["revised_pcp_prompt"]
    rationale = revision["short_revision_rationale"]

    new_predicted_sentence = _predict_from_pcp_prompt(revised_pcp)
    iteration += 1

    state.update(
        {
            "predicted_sentence": new_predicted_sentence,
            "pcp_prompt": revised_pcp,
            "iteration": iteration,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
    )

    record = {
        "essay_id": essay_id,
        "iteration": iteration,
        "status": "need_judgment" if iteration < MAX_FEEDBACK_RETRY else "final",
        "prev_predicted_sentence": prev_pred,
        "user_original_sentence": user_original_sentence.strip(),
        "embedding_model": evaluator.embedding_model,
        "similarity_score": similarity_score,
        "revision_rationale": rationale,
        "revised_pcp_prompt": revised_pcp,
        "new_predicted_sentence": new_predicted_sentence,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    _append_feedback_log(record)

    return {
        "status": "need_judgment" if iteration < MAX_FEEDBACK_RETRY else "final",
        "predicted_sentence": new_predicted_sentence,
        "iteration": iteration,
        "similarity_score": similarity_score,
        "revision_rationale": rationale,
        "revised_pcp_prompt": revised_pcp,
    }
