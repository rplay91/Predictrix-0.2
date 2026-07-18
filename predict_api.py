from openai import OpenAI
from pydantic import BaseModel
from typing import List, Optional
import json
import asyncio
import time
import re
import os
from collections import Counter
import pymysql
import requests

from api_config import GPT_API_KEY
from db_config import DB_CONFIG
client = OpenAI(api_key=GPT_API_KEY)

# ── PTM RAG configuration ──────────────────────────────────────
PTM_BASE_URL = os.getenv("PTM_BASE_URL", "http://140.115.126.108:5290")
PTM_ADMIN_USER = os.getenv("PTM_ADMIN_USER", "admin")
PTM_ADMIN_PASS = os.getenv("PTM_ADMIN_PASS", "admin123")
PTM_USERS_FILE = os.path.join(os.path.dirname(__file__), "users_list.txt")

_ptm_token = None

# Build account → ptm_user_id lookup from users_list.txt
# File format: "<ptm_id>: s<account>"
_ptm_id_by_account = {}
if os.path.exists(PTM_USERS_FILE):
    with open(PTM_USERS_FILE) as f:
        for line in f:
            line = line.strip()
            if ":" in line:
                parts = line.split(":", 1)
                ptm_id = int(parts[0].strip())
                username = parts[1].strip()
                if username.startswith("s"):
                    _ptm_id_by_account[username[1:]] = ptm_id

def _lookup_ptm_user_id(sid: str) -> int | None:
    """Look up PTM user_id using the student's DB account."""
    if not sid:
        return None
    try:
        conn = pymysql.connect(**DB_CONFIG)
        with conn.cursor() as cursor:
            cursor.execute("SELECT account FROM students WHERE sid = %s", (sid,))
            row = cursor.fetchone()
            if row and row["account"] in _ptm_id_by_account:
                return _ptm_id_by_account[row["account"]]
        return None
    except Exception as e:
        print(f"[WARN] Could not resolve PTM user for sid={sid}: {e}")
        return None
    finally:
        if "conn" in dir():
            conn.close()

def _ptm_login():
    """Login to PTM and cache the access token."""
    global _ptm_token
    r = requests.post(
        f"{PTM_BASE_URL}/api/auth/token",
        data={"username": PTM_ADMIN_USER, "password": PTM_ADMIN_PASS, "grant_type": "password"},
        timeout=10,
    )
    r.raise_for_status()
    _ptm_token = r.json()["access_token"]

def _ptm_headers():
    if not _ptm_token:
        _ptm_login()
    return {"Authorization": f"Bearer {_ptm_token}"}

def ptm_rag_query(sid: str, query: str, top_k: int = 5) -> list[dict]:
    """Query PTM RAG for a student and return the result nodes."""
    ptm_user_id = _lookup_ptm_user_id(sid)
    if ptm_user_id is None:
        print(f"[WARN] No PTM user found for sid={sid}")
        return []
    try:
        r = requests.post(
            f"{PTM_BASE_URL}/api/rag/query",
            json={"user_id": ptm_user_id, "query": query, "top_k": top_k},
            headers=_ptm_headers(),
            timeout=30,
        )
        if r.status_code == 401:
            _ptm_login()
            r = requests.post(
                f"{PTM_BASE_URL}/api/rag/query",
                json={"user_id": ptm_user_id, "query": query, "top_k": top_k},
                headers=_ptm_headers(),
                timeout=30,
            )
        r.raise_for_status()
        return r.json().get("results", [])
    except requests.RequestException as e:
        print(f"[WARN] PTM RAG query failed: {e}")
        return []


## add the reasoning Prompt for the component
# generate the reasoning from history essays
# construct the output to Pydantic

#================= re-rank historical component====================
def gpt_extract_ranked_snippets_from_raw_history(
    client,
    model: str,
    title: str,
    purpose: str,
    current_window: str,
    raw_history: str,
    top_n_snippets: int = 8
):
    prompt = f"""
You are extracting and ranking the best historical writing snippets to help predict ONE next sentence in an English essay.

Essay title: {title}
Writing purpose: {purpose}
Current window: {current_window}

Historical essays (raw):
{raw_history}

Task:
- Extract short snippets (1-2 sentences each) from the historical essays.
- Rank the snippets by usefulness for predicting the next sentence.
- Snippets must match topic and purpose, and avoid redundancy with the current window.
- Do NOT copy long passages.

Return JSON only:
{{
  "snippets": [
    {{
      "source": "Essay Number (eg. essay 1)",
      "score": 0-100,
      "reason": "<short>",
      "text": "<1-2 sentences>"
    }}
  ]
}}
""".strip()

    resp = client.chat.completions.create(
        model=model,
        messages=[{"role":"user","content": prompt}],
        reasoning_effort="minimal"
    )
    raw = (resp.choices[0].message.content or "").strip()
    raw = raw.replace("```json", "").replace("```", "").strip()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", raw, flags=re.DOTALL)
        if not match:
            raise
        data = json.loads(match.group(0))

    snippets = data.get("snippets", [])
    if not isinstance(snippets, list):
        return []

    return snippets[:top_n_snippets]


#============== Reasoning Component ===================
def reasoning_component(essay_context: str, previous_sentence: str, current_sentence: str) -> dict:
    """
    Reasoning Component using Step-Back Prompting 
    with client.beta.chat.completions.parse()
    """

    # ==================== ① Step-Back Abstraction ====================
    class StepBackOutput(BaseModel):
        abstract_concept: str
        forward_reasoning: str

    stepback_prompt = f"""
    You are a Step-Back Reasoning Agent.

    Step back → summarize the abstract idea.
    Then reason forward → explain logically what should come next.

    Essay Context: {essay_context}
    Previous Sentence: {previous_sentence}
    Current Sentence: {current_sentence}

    Respond exactly in this JSON:
    {{
      "abstract_concept": "...",
      "forward_reasoning": "..."
    }}
    """

    sb = client.beta.chat.completions.parse(
        model="gpt-5-nano",
        messages=[{"role": "user", "content": stepback_prompt}],
        response_format=StepBackOutput,
        reasoning_effort="minimal"
    )
    stepback_output = sb.choices[0].message.parsed


    # ==================== ② Semantic Goal ====================
    class SemanticGoal(BaseModel):
        semantic_goal: str

    semantic_prompt = f"""
    Based on this abstraction:
    {stepback_output}

    Determine the semantic goal of the next sentence 
    (continue description, contrast, example, summary, introduce result).

    Respond in JSON:
    {{
      "semantic_goal": "..."
    }}
    """

    sem = client.beta.chat.completions.parse(
        model="gpt-5-nano",
        messages=[{"role": "user", "content": semantic_prompt}],
        response_format=SemanticGoal,
        reasoning_effort="minimal"
    )
    semantic_goal = sem.choices[0].message.parsed.semantic_goal


    # ==================== ③ Writing Style ====================
    class WritingStyle(BaseModel):
        writing_style: str
        tone: str
        structure: str

    style_prompt = f"""
    The next sentence must achieve the semantic goal: {semantic_goal}

    Describe:
    - writing_style
    - tone
    - structure

    Respond in JSON:
    {{
      "writing_style": "...",
      "tone": "...",
      "structure": "..."
    }}
    """

    st = client.beta.chat.completions.parse(
        model="gpt-5-nano",
        messages=[{"role": "user", "content": style_prompt}],
        response_format=WritingStyle,
        reasoning_effort="minimal"
    )
    writing_style = st.choices[0].message.parsed


    # ==================== ④ Reasoning Summary ====================
    class SummaryOutput(BaseModel):
        reasoning_summary: str

    summary_prompt = f"""
    Summarize all reasoning into a short paragraph:
    - Abstract Concept: {stepback_output.abstract_concept}
    - Forward Reasoning: {stepback_output.forward_reasoning}
    - Semantic Goal: {semantic_goal}
    - Writing Style: {writing_style}

    Respond in JSON:
    {{
      "reasoning_summary": "..."
    }}
    """

    summ = client.beta.chat.completions.parse(
        model="gpt-5-nano",
        messages=[{"role": "user", "content": summary_prompt}],
        response_format=SummaryOutput,
        reasoning_effort="minimal"
    )
    reasoning_summary = summ.choices[0].message.parsed.reasoning_summary


    # ==================== Final Return ====================
    return {
        "stepback_reasoning": {
            "abstract_concept": stepback_output.abstract_concept,
            "forward_reasoning": stepback_output.forward_reasoning
        },
        "semantic_goal": semantic_goal,
        "writing_style": {
            "writing_style": writing_style.writing_style,
            "tone": writing_style.tone,
            "structure": writing_style.structure
        },
        "reasoning_summary": reasoning_summary
    }

# Identify the writing purpose
def identify_writing_purpose(current_writing_content):
    user_prompt = f"""# Instruction:
You are an advanced AI assistant with expertise in English writing. Your task is to analyze the writing purpose of the predicted sentence in a English essay. Please think step by step.

# Input Structure:
The user provides the essay's content:
Essay Content:
{current_writing_content}

Additionally, the user specifies the paragraph containing the predicted sentence and marks its position using [PREDICTED SENTENCE] within the paragraph’s text.

# Your Task:
1. Understand Context: Analyze the given content and determine the role of the predicted sentence.
2. Identify Writing Purpose: Consider whether the predicted sentence should introduce an idea, provide evidence, offer a transition, or summarize a point.
3. Just output the purpose of predicted sentence you analyzed."""

    # Output format
    class WritingPurposes(BaseModel):
        writing_purposes: str

    # Prepare request payload for the language model
    messages=[
        {"role": "user", "content": user_prompt}
    ]

    # Send request
    response = client.beta.chat.completions.parse(
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

# ============================================
# Vocabulary Extraction (Inline Component)
# ============================================

# def extract_vocabulary_features(current_writing_content: str):
#     """Extracts vocabulary and common words from current essay using step-back reasoning."""

#     user_prompt = f"""# Instruction:
# You are an advanced AI assistant specialized in English writing analysis.
# Your task is to extract the key vocabulary characteristics from a student's English essay.

# # Your Task:
# 1. Identify and return **EXACTLY 5** most frequently used topic-related vocabulary words that represent the essay’s subject domain.
# 2. Identify and return **EXACTLY 5** common words that appear frequently and reflect the student's writing style.
# 3. Do not include essay titles or themes; focus only on the essay body text.
# 4. If more than 5 are possible, choose the **most representative 5 words only**.
# 5. The final JSON output **must not contain more than 5 words per list**.

# # Input:
# Essay Content:
# {current_writing_content}

# # Output format (strictly JSON):
# {{
#   "vocabulary": ["word1", "word2", "word3", "word4", "word5"],
#   "common_words": ["wordA", "wordB", "wordC", "wordD", "wordE"]
# }}
# """


#     class VocabularyExtraction(BaseModel):
#         vocabulary: List[str]
#         common_words: List[str]

#     # Send Request (Initial Extraction)
#     messages = [{"role": "user", "content": user_prompt}]

#     response = client.beta.chat.completions.parse(
#         model="gpt-5-nano",
#         reasoning_effort="minimal",
#         messages=messages,
#         response_format=VocabularyExtraction,
#         n=1
#     )

#     base_extraction = response.choices[0].message.parsed

#     # Step-Back Reflection Prompt
#     step_back_prompt = f"""# Step-Back Reflection:
# You are a writing reflection assistant.
# Review the extracted vocabulary lists below and ensure they accurately represent the essay's lexical field and word usage.

# # Task:
# 1. If any words are too generic or irrelevant, replace or refine them.
# 2. Ensure the vocabulary truly fits the essay’s domain, tone, and topic.

# Essay Content:
# {current_writing_content}

# Initial Extraction:
# Vocabulary: {base_extraction.vocabulary}
# Common Words: {base_extraction.common_words}

# Return revised output strictly in this JSON format:

# {{
#   "vocabulary": ["word1", "word2", ...],
#   "common_words": ["wordA", "wordB", ...]
# }}
# """

#     # Send Step-Back Request (Refinement)
#     response_refined = client.beta.chat.completions.parse(
#         model="gpt-5-nano",
#         reasoning_effort="minimal",
#         messages=[{"role": "user", "content": step_back_prompt}],
#         response_format=VocabularyExtraction,
#         n=1
#     )

#     refined_extraction = response_refined.choices[0].message.parsed

#     result = {
#     "vocabulary": refined_extraction.vocabulary[:5],
#     "common_words": refined_extraction.common_words[:5]
#     }


#     return result


def vote_writing_purpose(current_writing_content, writing_purposes_list):
    # Format candidate purposes for voting
    writing_purposes_options_list = "\n".join([f"{i+1}. {response}" for i, response in enumerate(writing_purposes_list)])
    # Build voting prompt for the language model
    user_prompt = f"""# Instruction:
You are an advanced AI assistant with expertise in English writing. Your task is to analyze a predicted sentence in a English essay and determine which of three given purposes of writing best aligns with its intended function. Additionally, you must consider whether purposes of writing aligns with the English essay cntext. Please think step by step.

# Input Structure:
The user provides the essay's content:
Essay Content:
{current_writing_content}

Additionally, the user specifies the paragraph containing the predicted sentence and marks its position using [PREDICTED SENTENCE] within the paragraph’s text.

Three Purposes of Writing:{writing_purposes_options_list}

# Your Task:
1. Analyze Context: Understand the logical flow of the essay and the role of the predicted sentence.
2. Evaluate Purposes of Writing: Compare the predicted sentence’s expected function with the Three given purposes of writing and assess whether it aligns with situation description cntext.
3. Select the Best Fit: Identify and justify which purpose of writing most accurately aligns with the predicted sentence's role and the English essay cntext.(Respond with a number: 1, 2, 3, 4, or 5)
4. Explain Your Choice: Provide a brief explanation supporting your selection based on the essay’s structure and logical coherence."""

    # Output format
    class BestMatchWritingPurposes(BaseModel):
        best_match_writing_purpose: str
        best_match_writing_purpose_reason: str

    # Prepare voting request payload for the language model
    messages=[
        {"role": "user", "content": user_prompt}
    ]

    # Ask the model to evaluate each candidate purpose
    response = client.beta.chat.completions.parse(
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
        user_prompt = f"""# Instruction:
You are an advanced AI assistant with expertise in English writing. Your task is to analyze a predicted sentence in a English essay and determine which of two given purposes of writing best aligns with its intended function. Additionally, you must consider whether purposes of writing aligns with the English essay cntext. Please think step by step.

# Input Structure:
The user provides the essay's content:
Essay Content:
{current_writing_content}

Additionally, the user specifies the paragraph containing the predicted sentence and marks its position using [PREDICTED SENTENCE] within the paragraph’s text.

Two Purposes of Writing:{re_writing_purposes_options_list}

# Your Task:
1. Analyze Context: Understand the logical flow of the essay and the role of the predicted sentence.
2. Evaluate Purposes of Writing: Compare the predicted sentence’s expected function with the two given purposes of writing and assess whether it aligns with situation description cntext.
3. Select the Best Fit: Identify and justify which purpose of writing most accurately aligns with the predicted sentence's role and the English essay cntext.(Respond with a number: 1, 2, 3, 4, or 5)
4. Explain Your Choice: Provide a brief explanation supporting your selection based on the essay’s structure and logical coherence."""
        # Output format
        class BestMatchWritingPurposes(BaseModel):
            best_match_writing_purpose: str
            best_match_writing_purpose_reason: str
        # Prepare tie-breaking request payload
        messages=[
            {"role": "user", "content": user_prompt}
        ]
        # Ask the model to resolve the tie between purposes
        response = client.beta.chat.completions.parse(
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
    user_prompt = f"""# Instruction:
You are an advanced AI assistant with expertise in analyzing English writing. Your task is to improve the predicted sentence in an English essay by formulating effective database queries. The predicted sentence has a specific purpose of writing, which will be provided as input.  Your ultimate goal is to generate EXACTLY THREE targeted, insightful questions that can retrieve relevant and useful information from the database to refine the predicted sentence.

# Input Structure:
The user provides the essay's content:
Essay Content:
{current_writing_content}

Additionally, the user specifies the paragraph containing the predicted sentence and marks its position using [PREDICTED SENTENCE] within the paragraph’s text.

The purpose of writing predicted sentence: {best_match_writing_purpose}

# Your Task:
1. Understand the logical flow of the essay and the role of the predicted sentence.
2. Based on the purpose of writing predicted sentence, produce EXACTLY THREE short, concrete, and database-friendly questions.
3. The questions should focus on retrieving factual or descriptive information, not literary analysis."""

    # Response schema for generated questions
    class WritingQuerys(BaseModel):
        query: List[str]

    # Prepare question-generation payload
    messages=[
        {"role": "user", "content": user_prompt}
    ]

    # Request the model to generate research questions
    query = client.beta.chat.completions.parse(
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
    from graphRAG.global_search import search_graph

    # Build prompt for retrieving factual answers from historical data
    user_prompt = f"""# Instruction:
You are an AI assistant tasked with extracting accurate information from a provided Knowledge Graph subgraph. Your primary goal is to answer the user's question strictly based on the facts present in the Knowledge Graph supplied below. If the answer is not explicitly represented or cannot be directly inferred from the graph relations, respond with "No related information." Avoid making assumptions, adding external knowledge, or generating speculative answers. Please think step by step.

# Input Structure:
Question: {query}

# Your Task:
1. Carefully examine the Knowledge Graph subgraph to determine whether it contains a direct answer to the question.
2. If the answer is explicitly represented or can be directly inferred via one or more graph relations, provide a concise and accurate response.
3. If the Knowledge Graph subgraph does not contain the requested information, respond strictly with: "No related information."
4. Do not include external knowledge or assumptions beyond what is present in the provided Knowledge Graph subgraph.
"""
    # GraphRAG retrieval search
    try:
        # Kirim user_prompt ke NodeRAG search engine
        result = await search_graph(user_prompt)
        if result and hasattr(result, "answer"):
            print(result.answer)
            return result.answer
        print("no related info")
        return "No related information."
    except Exception as e:
        return f"Error during RAG search: {str(e)}"
    
    ## REASONING COMPONENT ? ###
 
# Answer questions using the current essay content
def answer_from_current(current_writing_content, query):
    user_prompt = f"""
# Instruction:
You are an AI assistant tasked with extracting accurate information from a given essay. Your primary goal is to answer the user's question strictly based on the provided text. If the answer is not explicitly stated or cannot be inferred directly from the essay, respond with "No related information." Avoid making assumptions, adding external knowledge, or generating speculative answers. Please think step by step.

# Input Structure:
The user provides the essay's content:
Essay Content:
{current_writing_content}

Question: {query}

# Your Task:
1. Carefully analyze the essay to determine if it contains a direct answer to the question.
2. If the answer is explicitly stated or can be directly inferred from the essay, provide a concise and accurate response.
3. If the essay does not contain the requested information, respond strictly with: "No related information."
4. Do not include external knowledge or assumptions beyond what is given in the essay.
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
    answer = client.beta.chat.completions.parse(
        model="gpt-5-nano",
        reasoning_effort="minimal",
        messages=messages,
        response_format=Answer
    )

    # Extract the parsed answer text
    query_answer_from_current = answer.choices[0].message.parsed.answer

    print(query_answer_from_current)
    return str(query_answer_from_current)

# Identify sentence patterns using current and historical essays
def identify_sentence_pattern(current_writing_content, history_content, best_match_writing_purpose):
    # Build prompt for detailed sentence-pattern analysis
    user_prompt = f"""#Instruction:
You are a writing analysis AI designed to help users understand their writing style. Your task is to analyze the provided English essays and identify sentence patterns. You should provide detailed explanations for each identified category and include examples from the text.
# Task Details:
- Focus on the deeper underlying patterns and characteristics of the writing, including personal tendencies in vocabulary, sentence structures, and rhetorical devices.
- Do not worry too much about grammar or spelling mistakes; your primary goal is to focus on the stylistic tendencies present in the text.
- Provide clear definitions for each category, with specific examples from the text.
# Output Structure:
Sentence Pattern
- Sentence Pattern Type: Describes the common sentence structure used by the writer.
- Explanation: Explain the structure of the sentences that the user typically employs in their writing.
- Example: Provide a representative example from the text to demonstrate the sentence structure.
- Pattern: Describe the pattern of how sentences are generally formed.
- Function: Explain the purpose or effect this sentence pattern serves in the text.

#Input
English essays: {history_content}

#Your Task:
1. Analyze the provided essays to identify writing patterns and features.
2. Returning your analysis results in the output structure, ensuring each section is thorough and well-explained."""

    # Response schema for sentence-pattern analysis
    class HistorySentencePattern(BaseModel):
        sentent_pattern_type: str
        explanation: str
        example: str
        pattern: str
        function: str


    class HistoryWritingPatternAnalysis(BaseModel):
        history_sentence_patterns: list[HistorySentencePattern]

    # Prepare payload for sentence-pattern analysis
    messages=[
        {"role": "user", "content": user_prompt},
    ]

    # Request the model to analyze sentence patterns
    history_writing_pattern_analysis = client.beta.chat.completions.parse(
        model="gpt-5-nano",
        reasoning_effort="minimal",
        messages=messages,
        response_format=HistoryWritingPatternAnalysis
    )

    # Extract sentence-pattern data from the response
    history_sentence_patterns = history_writing_pattern_analysis.choices[0].message.parsed.history_sentence_patterns


    # Build prompt to extract grammar features for each pattern
    user_prompt = f"""#Instruction:
You are a writing analysis AI designed to help users understand their writing style. Your task is to analyze the provided English essays and identify sentence patterns. You should provide detailed explanations for each identified category and include examples from the text.
# Task Details:
- Focus on the deeper underlying patterns and characteristics of the writing, including personal tendencies in vocabulary, sentence structures, and rhetorical devices.
- Do not worry too much about grammar or spelling mistakes; your primary goal is to focus on the stylistic tendencies present in the text.
- Provide clear definitions for each category, with specific examples from the text.
# Output Structure:
Sentence Pattern
- Sentence Pattern Type: Describes the common sentence structure used by the writer.
- Explanation: Explain the structure of the sentences that the user typically employs in their writing.
- Example: Provide a representative example from the text to demonstrate the sentence structure.
- Pattern: Describe the pattern of how sentences are generally formed.
- Function: Explain the purpose or effect this sentence pattern serves in the text.

#Input
English essays: {current_writing_content}

#Your Task:
1. Analyze the provided essays to identify writing patterns and features.
2. Returning your analysis results in the output structure, ensuring each section is thorough and well-explained.
"""

    # Response schema for sentence patterns in the current essay
    class CurrentSentencePattern(BaseModel):
        sentent_pattern_type: str
        explanation: str
        example: str
        pattern: str
        function: str

    class CurrentWritingPatternAnalysis(BaseModel):
        current_sentence_patterns: list[CurrentSentencePattern]

    # Prepare payload for current-essay sentence-pattern analysis
    messages=[
        {"role": "user", "content": user_prompt},
    ]

    # Request sentence-pattern analysis for the current essay
    current_writing_pattern_analysis = client.beta.chat.completions.parse(
        model="gpt-5-nano",
        reasoning_effort="minimal",
        messages=messages,
        response_format=CurrentWritingPatternAnalysis
    )

    # Extract current sentence-pattern data
    current_sentence_patterns = current_writing_pattern_analysis.choices[0].message.parsed.current_sentence_patterns

    # Helper to format sentence-pattern output
    def format_common_sentence_patterns(patterns: List) -> str:
        class SentencePattern(BaseModel):
            sentent_pattern_type: str
            explanation: str
            example: str
            pattern: str
            function: str

        validated_patterns = [SentencePattern(**pattern) if isinstance(pattern, dict) else pattern for pattern in patterns]

        output = []
        for idx, pattern in enumerate(validated_patterns, start=1):
            output.append(
                f"Type: {pattern.sentent_pattern_type}\n"
                f"Explanation: {pattern.explanation}\n"
                f"Example: {pattern.example}\n"
                f"Pattern: {pattern.pattern}\n"
                f"Function: {pattern.function}\n"
            )
        return "\n".join(output)
    
    # Format pattern summaries for history and current essays
    formatted_history_patterns = format_common_sentence_patterns(history_sentence_patterns)
    formatted_current_patterns = format_common_sentence_patterns(current_sentence_patterns)

    # Build prompt to select the most suitable sentence pattern
    user_prompt = f"""# Instruction:
Instruction: You are an advanced AI assistant with expertise in English writing. Your task is to select the appropriate sentence pattern for the predicted sentence from both the history and current sentence pattern lists based on the essay content and the purpose of writing the predicted sentence. Please think step by step!

# Input Structure: 
The user provides the essay's content:
Essay Content:
{current_writing_content}

The purpose of writing the predicted sentence: {best_match_writing_purpose}

Current Sentence Pattern List:
{formatted_current_patterns}

History Sentence Pattern List:
{formatted_history_patterns}

# You Task:
- Please compare the sentence patterns used in the current essay and the past essays, and based on the purpose of the predicted sentence, determine which sentence pattern should be used for crafting the predicted sentence."""

    # Response schema for the selected sentence pattern
    class PredictSentencePattern(BaseModel):
        sentent_pattern_type: str
        explanation: str
        example: str
        pattern: str
        function: str

    # Prepare payload for sentence-pattern selection
    messages=[
        {"role": "user", "content": user_prompt}
    ]

    # Ask the model to choose the most suitable sentence pattern
    predict_sntence_pattern = client.beta.chat.completions.parse(
        model="gpt-5-nano",
        reasoning_effort="minimal",
        messages=messages,
        response_format=PredictSentencePattern,
        n=5  # Request five alternative sentence-pattern suggestions
    )

    # Format the sentence-pattern options returned by the model
    predict_sntence_pattern_list = []
    for i, choice in enumerate(predict_sntence_pattern.choices):
        parsed = choice.message.parsed        
        # Extract individual fields for clarity
        type_info = f"Type: {parsed.sentent_pattern_type}"
        explanation = f"Explanation: {parsed.explanation}"
        example = f"Example: {parsed.example}"
        pattern = f"Pattern: {parsed.pattern}"
        function = f"Function: {parsed.function}"
        # Combine the details into a readable block
        formatted_string = f"{type_info}\n{explanation}\n{example}\n{pattern}\n{function}"
        # Store formatted option for later voting
        predict_sntence_pattern_list.append(formatted_string)


    # Build voting prompt for sentence-pattern selection
    # Prepare payload for writing-pattern analysis
    predict_sntence_pattern_options_list = "\n".join([f"{i+1}. {response}" for i, response in enumerate(predict_sntence_pattern_list)])

    # Request writing-pattern analysis from the model
    user_prompt = f"""# Instruction: 
You are an advanced AI assistant with expertise in English writing. Your task is to choose the sentence pattern that the predicted sentence should use from the Three sentence pattern options according to the English essay and the purpose of writing the predicted sentence.

# Input Structure: 
The user provides the essay's content:
Essay Content:
{current_writing_content}

The purpose of writing the predicted sentence : {best_match_writing_purpose}

Three Sentence Pattern Options: {predict_sntence_pattern_options_list}

# Your Task:
- Review the content of the essay and the stated purpose of the predicted sentence.
- Carefully analyze the Three provided sentence pattern options.
- Select the sentence pattern that aligns best with the essay’s context and the goal of the predicted sentence.(Respond with a number: 1, 2, 3, 4, or 5)
- Ensure that the chosen sentence pattern enhances the overall clarity, flow, and coherence of the essay.
- Provide a brief explanation of why you chose the selected sentence pattern."""
    user_prompt = user_prompt.replace("[PREDICTED SENTENCE]", "")

    # Response schema for the selected sentence pattern
    class BestMatchSentencePattern(BaseModel):
        best_match_sentence_pattern: str
        best_match_sentence_pattern_reason: str

    # Prepare payload for sentence-pattern voting
    messages=[
        {"role": "user", "content": user_prompt}
    ]

    # Ask the model to vote on the best sentence pattern
    response = client.beta.chat.completions.parse(
        model="gpt-5-nano",
        reasoning_effort="minimal",
        messages=messages,
        response_format=BestMatchSentencePattern,
        n=5  # Request five votes for diversity
    )

    # Collect vote results for later analysis
    best_match_sentence_pattern_vote_results = []
    best_match_sentence_pattern_vote_results_reason = []
    for choice in response.choices:
        best_match_sentence_pattern_vote_results.append(choice.message.parsed.best_match_sentence_pattern)
        best_match_sentence_pattern_vote_results_reason.append(choice.message.parsed.best_match_sentence_pattern_reason)
        # Debug prints removed to avoid non-English output
        # Debug prints removed to avoid non-English output

    # Determine the winning sentence-pattern option
    best_match_sentence_pattern_vote_counts = Counter(best_match_sentence_pattern_vote_results)
    best_match_sentence_pattern_highest_vote_result = max(best_match_sentence_pattern_vote_counts.values())
    best_match_sentence_pattern_winning_options = [option for option, count in best_match_sentence_pattern_vote_counts.items() if count == best_match_sentence_pattern_highest_vote_result]

    # Helper to extract the option number from model output
    def _extract_option_number(text: str) -> int | None:
        if not text:
            return None
        cleaned = text.strip()
        if cleaned.isdigit():
            return int(cleaned)
        digit_match = re.search(r"\d+", cleaned)
        if digit_match:
            return int(digit_match.group())
        return None

    # Handle ties by triggering a tie-break vote
    if len(best_match_sentence_pattern_winning_options) > 1:
        # Prepare tie-breaking options for the sentence-pattern vote
        tie_options = [predict_sntence_pattern_list[_extract_option_number(option) - 1] for option in best_match_sentence_pattern_winning_options]
        tie_options_list = "\n".join([f"{i+1}. {response}" for i, response in enumerate(tie_options)])

        # Build tie-breaking prompt for sentence-pattern selection
        tie_prompt = f"""# Instruction: 
    You are an advanced AI assistant with expertise in English writing. Your task is to choose the sentence pattern that the predicted sentence should use from the two sentence pattern options according to the English essay and the purpose of writing the predicted sentence.

    # Input Structure: 
    The user provides the essay's content:
    Essay Content:
    {current_writing_content}

    The purpose of writing the predicted sentence : {best_match_writing_purpose}

    Two Sentence Pattern Options: {tie_options_list}

    # Your Task:
    - Review the content of the essay and the stated purpose of the predicted sentence.
    - Carefully analyze the two provided sentence pattern options.
    - Select the sentence pattern that aligns best with the essay’s context and the goal of the predicted sentence.(Respond with a number: 1, 2, 3, 4, or 5)
    - Ensure that the chosen sentence pattern enhances the overall clarity, flow, and coherence of the essay.
    - Provide a brief explanation of why you chose the selected sentence pattern."""
        user_prompt = user_prompt.replace("[PREDICTED SENTENCE]", "")

        # Prepare payload for tie-break voting
        tie_messages = [
            {"role": "user", "content": tie_prompt}
        ]

        # Request tie-break voting from the model
        tie_response = client.beta.chat.completions.parse(
            model="gpt-5-nano",
            reasoning_effort="minimal",
            messages=tie_messages,
            response_format=BestMatchSentencePattern,
            n=3
        )

        # Collect tie-break vote results
        tie_vote_results = []
        tie_vote_reason = []
        for choice in tie_response.choices:
            tie_vote_results.append(choice.message.parsed.best_match_sentence_pattern)
            tie_vote_reason.append(choice.message.parsed.best_match_sentence_pattern_reason)


        # Determine the winning option from the tie-break vote
        tie_vote_counts = Counter(tie_vote_results)
        tie_highest_vote_result = max(tie_vote_counts.values())
        tie_winning_options = [option for option, count in tie_vote_counts.items() if count == tie_highest_vote_result][0]
        best_match_sentence_pattern = tie_options[_extract_option_number(tie_winning_options) - 1]

    else:
        best_match_sentence_pattern_winning_option = best_match_sentence_pattern_winning_options[0]
        best_match_sentence_pattern = predict_sntence_pattern_list[_extract_option_number(best_match_sentence_pattern_winning_option) - 1]
        # Debug prints removed to avoid non-English output
        # Debug prints removed to avoid non-English output
    
    return best_match_sentence_pattern

# Identify overall writing patterns from historical essays
def identify_writing_pattern(history_content):
    # Build prompt for writing pattern analysis
    user_prompt = f"""# Instruction:
You are a writing analysis AI designed to help users understand their writing style. Your task is to generate user's writing style based on the user's provided English essays.

# Task Details:
- Analyze and discover the underlying writing patterns and features that reflect the user's personal writing habits, such as preferred vocabulary, sentence structures, and rhetorical devices.
Don't worry too much about grammar or spelling mistakes. Should focus on identifying and characterizing the user's stylistic tendencies.

# Output Structure:
Writing Pattern
- writing pattern type: defines the category of the pattern (e.g. narrative, expository, argumentative, etc.)
- explanation: the main features of the pattern, such as how information is organized, common expression habits, tone, etc.
- pattern: common ways of organizing paragraphs or content
example: provide a representative example of the pattern

Writing Feature
- writing feature type: defines the writing features (e.g. vocabulary, sentence structure, word order, rhetoric, etc.)
- explanation: describes the user's common expression style, including preferred syntax, vocabulary, conjunctions, etc.
- example: give an example illustrating how the feature manifests in the text
- preferred words: the words and phrases favored by the user
- preferred syntax: the sentence structures favored by the user, such as simple sentences, long sentences, repetitive sentence patterns, etc.

# Input
Several English essays:
{history_content}

# Your Task:
1. Analyze the provided essays to identify writing patterns and features.
2. Return your analysis results in the output structure, ensuring each section is thorough and well-explained."""
    
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
    writing_pattern_analysis = client.beta.chat.completions.parse(
            model="gpt-5-nano",
            reasoning_effort="minimal",
            messages=messages,
            response_format=WritingPatternAnalysis,
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
    reasoning_output = reasoning_component(
    essay_context=context_info,
    previous_sentence=answer_from_history,
    current_sentence=current_writing_content)
    
    # Extracted Vocabulary Context:
# Vocabulary Words: {', '.join(vocabulary_info.get('vocabulary', []))}
# Common Words: {', '.join(vocabulary_info.get('common_words', []))}

    # Build prompt for generating the predicted sentence
    user_prompt = f"""# Instruction:
You are an AI writing assistant specialized in predicting sentences within a student's English journal essay.
Your task is to generate 2 to 3 predicted sentences that match the **student's actual writing style** — be specific, concrete, and personal, just like the student writes.
The sentences must align with the essay's **core topic**, as defined by the Title and Context, and must not deviate from the main subject.
Each sentence should be natural, flow from the previous content, and include **specific details** (times, locations, activities, feelings, people) drawn from the essay itself rather than generic reflections.
Please think step by step!

# Input Detail:
- Essay Title: The title defines the essay's core topic and sets the overall direction.
- Contextual Information: Background descriptions and keywords that represent the essay's intent and audience perspective.
- Essay Content: The entire essay text, with one paragraph containing the marker [PREDICTED SENTENCE], which is where the sentences will be inserted.
- Writing Purpose: The intent or goal for adding the predicted sentence.
- Writing Pattern: The organizational structure of the essay.
- Writing Features: The stylistic and linguistic tone.
- Sentence Pattern: The designated grammatical structure of the sentence.
- Enhancement Details: Supplementary writing details, drawn from current and past writing drafts.
- Extracted Vocabulary Context: Words and expressions frequently appearing in the essay, reflecting tone and lexical consistency.

# Input Structure:
Essay Title:
{title}

Contextual Information:
{context_info}

Essay Content:
{current_writing_content}

Writing Purpose:
{best_match_writing_purpose}

Writing Pattern:
{writing_patterns_formatted_output}

Writing Features:
{writing_features_formatted_output}

Sentence Pattern:
{best_match_sentence_pattern}

Enhancement Details:
{answer_from_current}

{answer_from_history}

# Step-Back Reasoning Output:
Abstract Concept:
{reasoning_output["stepback_reasoning"]}

Semantic Goal:
{reasoning_output["semantic_goal"]}

Writing Style:
{reasoning_output["writing_style"]}

Reasoning Summary:
{reasoning_output["reasoning_summary"]}


# Your Task:
1. **Be Specific and Concrete (CRITICAL):**
   - The student writes about real events with specific times (e.g. "around 6 PM", "at 7:30 AM"), specific places (e.g. "Mrs. Mull's Noodle", "the mosque"), specific activities (e.g. "practiced traditional dance", "grilled chicken", "Isha prayer"), and specific feelings.
   - Your prediction MUST include concrete details drawn from the essay context. Do NOT replace them with generic summaries.
   - BAD (too generic): "Overall, the balance of focused work and brief rest supported steady progress."
   - GOOD (specific): "After eating, I reviewed my training notes and organized tasks for tomorrow."

2. **Match the Student's Voice:**
   - Use first-person ("I"), write in the same tense and tone as the essay.
   - Use vocabulary and expressions that appear in the essay.
   - If the student uses informal language (e.g. "it's what it's", "big smile"), match that tone.

3. **Enhance Logical Flow:**
   - The predicted sentences must connect seamlessly with the preceding content.
   - Use transition words if appropriate, but keep it natural.

4. **Avoid Redundancy:**
   - Do NOT repeat or paraphrase ideas already present in the preceding sentences.

5. **Preserve Logical Accuracy:**
   - The predicted sentences MUST NOT introduce false or contradictory information.

6. **Output exactly 2 or 3 sentences.** Do NOT output more than 3.
"""

    # Response schema for the predicted sentences
    class PredictSentences(BaseModel):
        predict_sentences: list[str]

    # Prepare payload
    messages = [{"role": "user", "content": user_prompt}]

    # Send request to model
    response = client.beta.chat.completions.parse(
        model="gpt-5",
        reasoning_effort="low",
        messages=messages,
        response_format=PredictSentences
    )

    # Extract predicted sentences
    predict_sentences = response.choices[0].message.parsed.predict_sentences
    final_predict_sentence = " ".join(predict_sentences)

    return final_predict_sentence, predict_sentences, user_prompt



# prediction check
def get_or_create_sentence_pattern(sid, eid, current_content, history_content, purpose):
    connection = None
    try:
        connection = pymysql.connect(**DB_CONFIG)
        with connection.cursor() as cursor:
            sql = "SELECT pattern_result FROM sentence_patterns WHERE sid=%s AND eid=%s"
            cursor.execute(sql, (sid, eid))
            row = cursor.fetchone()
            print(f"[DEBUG] SELECT result row={row}")
            if row:
                if isinstance(row, dict):
                    return row.get("pattern_result")
                elif isinstance(row, (list, tuple)):
                    return row[0]
                else:
                    return row

            # 🔥 1. Generate new pattern (raw)
            try:
                raw_result = identify_sentence_pattern(
                    current_content,
                    history_content,
                    purpose
                )
                if not raw_result:
                    raise ValueError("Empty pattern generated")
                result = normalize_pattern_string(raw_result)
                if not result:
                    raise ValueError("Empty pattern after normalization")
            except Exception as e:
                print(f"[WARN] Pattern generation failed, using fallback: {e}")
                result = "Type: General narrative summary"

            # 🔥 2. Simpan ke DB
            insert_sql = """
                INSERT INTO sentence_patterns (sid, eid, pattern_result)
                VALUES (%s, %s, %s)
                ON DUPLICATE KEY UPDATE pattern_result=VALUES(pattern_result)
            """
            cursor.execute(insert_sql, (sid, eid, result))
            connection.commit()
            return result

    except Exception as e:
        if connection:
            connection.rollback()
        raise RuntimeError(f"DB error in get_or_create_sentence_pattern: {str(e)}")
    finally:
        if connection:
            connection.close()



def normalize_pattern_string(value: str) -> str: # normalize "type:" from llm
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

    # 1. Hilangkan angka prefix misalnya "3." atau "4. "
    if v[0].isdigit() and "." in v:
        v = v.split(".", 1)[1].strip()

    # 2. Hilangkan duplicate "Type: Type:" yang sering muncul di LLM
    while v.lower().startswith("type: type:"):
        v = v[5:].strip()  # hapus satu "Type:"

    # 3. Hilangkan prefix "Pattern:" jika muncul
    if v.lower().startswith("pattern:"):
        v = v[len("pattern:"):].strip()

    # 4. Pastikan final string diawali dengan "Type:"
    if not v.lower().startswith("type:"):
        v = "Type: " + v

    return v

            
# Execute prediction
async def get_predict_sentence(sid: str, eid: int, current_essay_content: str, history_essay_content: str, images_info: List[dict], title: str) -> tuple:
    start_time = time.time()  # Start time
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
            print(f"[DEBUG] Writing-purpose identification took {time.time() - purpose_start:.2f} s")

            # 2. Vote for the best writing purpose
            vote_start = time.time()
            best_match_writing_purpose, error_msg = vote_writing_purpose(current_essay_content, writing_purposes_list)
            if error_msg:
                raise ValueError(f"Voting error while selecting writing purpose: {error_msg}")
            print(f"[DEBUG] Writing-purpose voting took {time.time() - vote_start:.2f} s")

            # 3. Generate guiding questions
            query_start = time.time()
            query_list = generate_question(current_essay_content, best_match_writing_purpose)
            if not query_list:
                raise ValueError("Failed to generate guiding questions for retrieval.")
            print(f"[DEBUG] Question generation took {time.time() - query_start:.2f} s")

            # 4. Retrieve answers from history
            history_start = time.time()
            answer_from_history_list = ""
            for query in query_list:
                query_answer_from_history = await answer_from_history(query)
                if query_answer_from_history != "I am sorry but I am unable to answer this question given the provided data.":
                    answer_from_history_list += f"Question: {query}\nAnswer: {query_answer_from_history}\n\n"
            print(f"[DEBUG] Historical retrieval took {time.time() - history_start:.2f} s")

            # 4b. Query PTM RAG for cognitive model insights
            ptm_start = time.time()
            try:
                ptm_results = ptm_rag_query(sid, best_match_writing_purpose, top_k=5)
                if ptm_results:
                    ptm_block = "\n--- Cognitive Model Insights (PTM) ---\n"
                    for node in ptm_results:
                        title = node.get("title", "")
                        content = node.get("content", "")
                        layer = node.get("layer", "")
                        if title and content:
                            ptm_block += f"[L{layer}] {title}\n{content}\n\n"
                    answer_from_history_list += ptm_block
            except Exception as e:
                print(f"[WARN] PTM RAG failed: {e}")
            print(f"[DEBUG] PTM RAG retrieval took {time.time() - ptm_start:.2f} s")

            # 4c. Extract ranked snippets from raw history for additional context
            snippets_start = time.time()
            ranked_snippets = gpt_extract_ranked_snippets_from_raw_history(
                client=client,
                model="gpt-5-nano",
                title=title,
                purpose=best_match_writing_purpose,
                current_window=current_essay_content,
                raw_history=history_essay_content,
                top_n_snippets=8
            )
            if ranked_snippets:
                snippet_block = ""
                for snip in ranked_snippets:
                    text = snip.get("text", "")
                    source = snip.get("source", "")
                    if text:
                        snippet_block += f"Snippet ({source}): {text}\n"
                if snippet_block:
                    answer_from_history_list += f"Ranked Snippets:\n{snippet_block}\n"
            print(f"[DEBUG] History snippet rerank took {time.time() - snippets_start:.2f} s")

            # 5. Retrieve answers from current essay
            current_start = time.time()
            answer_from_current_list = ""
            for query in query_list:
                query_answer_from_current = answer_from_current(current_essay_content, query)
                if query_answer_from_current != "No related information.":
                    answer_from_current_list += f"Question: {query}\nAnswer: {query_answer_from_current}\n\n"
            print(f"[DEBUG] Current-essay retrieval took {time.time() - current_start:.2f} s")

            # 6. Retrieve or create sentence pattern
            pattern_start = time.time()
            best_match_sentence_pattern = get_or_create_sentence_pattern(
                sid=sid,
                eid=eid,
                current_content=current_essay_content,
                history_content=history_essay_content,
                purpose=best_match_writing_purpose
            )
            if not best_match_sentence_pattern:
                raise ValueError("Unable to obtain a sentence pattern for the prediction step.")
            print(f"[DEBUG] Sentence-pattern lookup took {time.time() - pattern_start:.2f} s")

            # 7. Analyze writing pattern & features
            style_start = time.time()
            writing_patterns_formatted_output, writing_features_formatted_output = identify_writing_pattern(history_essay_content)
            if not writing_patterns_formatted_output or not writing_features_formatted_output:
                raise ValueError("Failed to identify writing patterns or features.")
            print(f"[DEBUG] Writing-style analysis took {time.time() - style_start:.2f} s")

            # 8️ NEW: Vocabulary Extraction (for lexical insight)
            # vocab_start = time.time()
            # vocabulary_info = extract_vocabulary_features(current_essay_content)
            # print(f"[DEBUG] Vocabulary extraction took {time.time() - vocab_start:.2f} s")
            # print(f"[INFO] Extracted vocabulary info: {vocabulary_info}")

            # 9. Generate predicted sentences
            predict_start = time.time()
            final_predict_sentence, predict_sentences_list, user_prompt = predict_sentence(
                title,
                context_info,
                current_essay_content,
                best_match_writing_purpose,
                answer_from_current_list,
                answer_from_history_list,
                best_match_sentence_pattern,
                writing_patterns_formatted_output,
                writing_features_formatted_output,
            )
            if not final_predict_sentence:
                raise ValueError("Model did not return a predicted sentence.")
            print(f"[DEBUG] Sentence prediction took {time.time() - predict_start:.2f} s")

            return final_predict_sentence, predict_sentences_list, user_prompt

        # Run all steps with timeout protection
        final_predict_sentence, predict_sentences_list, user_prompt = await asyncio.wait_for(predict_with_timeout(), timeout=timeout)
        print(f"[DEBUG] Total prediction time: {time.time() - start_time:.2f} s")

        return final_predict_sentence, predict_sentences_list, user_prompt

    except asyncio.TimeoutError:
        print(f"[WARNING] Prediction timed out after {time.time() - start_time:.2f} s")
        return "", [], "Prediction timed out"
    except Exception as e:
        print(f"[ERROR] Prediction failed after {time.time() - start_time:.2f} s")
        print(f"[ERROR] Reason: {str(e)}")
        return "", [], str(e)


            




