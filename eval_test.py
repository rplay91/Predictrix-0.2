# ==============================================================
# predict_api_independent.py
# Standalone version of predict_api.py — no DB, no login
# Uses NodeRAG (NodeConfig, NodeSearch) directly
# English logs & results, all prompts preserved
# ==============================================================

import os, sys, json, time
from datetime import datetime
from typing import List, Tuple, Any
from pydantic import BaseModel
from openai import OpenAI

# --- Initialize OpenAI Client ---
OPENAI_API_KEY = "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"
if not OPENAI_API_KEY:
    print("⚠️ No OPENAI_API_KEY found. You can still run, but outputs will be mocked.\n")

client = OpenAI(api_key=OPENAI_API_KEY or "FAKE_KEY")
MODEL = "gpt-5-2025-08-07"

# --- Import NodeRAG components ---
from NodeRAG import NodeConfig, NodeSearch


# ==============================================================
# BaseModel Definitions (structured outputs)
# ==============================================================

class WritingPurposes(BaseModel):
    writing_purposes: str

class BestMatchWritingPurposes(BaseModel):
    best_match_writing_purpose: str
    best_match_writing_purpose_reason: str

class WritingQuerys(BaseModel):
    query: List[str]

class Answer(BaseModel):
    answer: str

class PredictSentence(BaseModel):
    predict_sentence: str


# ==============================================================
# Utility
# ==============================================================

def timed(func):
    """Simple decorator to measure execution time in seconds."""
    def wrapper(*args, **kwargs):
        start = time.time()
        result = func(*args, **kwargs)
        duration = time.time() - start
        return result, round(duration, 2)
    return wrapper

def run_llm(prompt: str, response_model: Any, n: int = 1):
    """Wrapper for GPT structured output parsing."""
    if not OPENAI_API_KEY:
        return [{"parsed": None, "text": f"[MOCK OUTPUT] {prompt[:200]}"}]
    try:
        resp = client.beta.chat.completions.parse(
            model=MODEL,
            messages=[{"role": "user", "content": prompt}],
            response_format=response_model,
            n=n
        )
        out = []
        for ch in resp.choices:
            out.append({
                "parsed": ch.message.parsed,
                "text": ch.message.content
            })
        return out
    except Exception as e:
        return [{"parsed": None, "text": f"[Error calling LLM] {e}"}]


# ==============================================================
# Step 1 — Identify Writing Purpose
# ==============================================================

@timed
def identify_writing_purpose(current_writing_content: str) -> List[str]:
    prompt = f"""# Instruction:
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
    
    resp = run_llm(prompt, WritingPurposes, n=5)
    purposes = [r["parsed"].writing_purposes if r["parsed"] else r["text"] for r in resp]
    return [p.strip() for p in purposes]


# ==============================================================
# Step 2 — Vote for Best Writing Purpose
# ==============================================================

@timed
def vote_writing_purpose(current_writing_content: str, writing_purposes_list: List[str]) -> Tuple[str, str]:
    options = "\n".join([f"{i+1}. {p}" for i, p in enumerate(writing_purposes_list)])
    prompt = f"""# Instruction:
You are an advanced AI assistant with expertise in English writing. Your task is to analyze a predicted sentence in a English essay and determine which of three given purposes of writing best aligns with its intended function. Additionally, you must consider whether purposes of writing aligns with the English essay cntext. Please think step by step.

# Input Structure:
The user provides the essay's content:
Essay Content:
{current_writing_content}

Additionally, the user specifies the paragraph containing the predicted sentence and marks its position using [PREDICTED SENTENCE] within the paragraph’s text.

Three Purposes of Writing:
{options}

# Your Task:
1. Analyze Context: Understand the logical flow of the essay and the role of the predicted sentence.
2. Evaluate Purposes of Writing: Compare the predicted sentence’s expected function with the Three given purposes of writing and assess whether it aligns with situation description cntext.
3. Select the Best Fit: Identify and justify which purpose of writing most accurately aligns with the predicted sentence's role and the English essay cntext.(Respond with a number: 1, 2, 3, 4, or 5)
4. Explain Your Choice: Provide a brief explanation supporting your selection based on the essay’s structure and logical coherence."""

    resp = run_llm(prompt, BestMatchWritingPurposes, n=5)
    from collections import Counter
    picks = [r["parsed"].best_match_writing_purpose if r["parsed"] else r["text"] for r in resp]
    reasons = [r["parsed"].best_match_writing_purpose_reason if r["parsed"] else "" for r in resp]
    counter = Counter(picks)
    best_purpose = counter.most_common(1)[0][0]
    reason = reasons[0] if reasons else ""
    return best_purpose.strip(), reason.strip()


# ==============================================================
# Step 3 — Generate Questions
# ==============================================================

@timed
def generate_question(current_writing_content: str, best_match_writing_purpose: str) -> List[str]:
    prompt = f"""# Instruction:
You are an English writing assistant. Based on the essay and the identified purpose, generate **three concise and relevant questions** that could help improve or support the [PREDICTED SENTENCE].

Essay:
{current_writing_content}

Writing Purpose:
{best_match_writing_purpose}

1. Understand the logical flow of the essay and the role of the predicted sentence.
2. Based on the purpose of writing predicted sentence, produce three clear and concise questions.
3. Each question should be crafted to extract specific information from the database that will help enhance the predicted sentence's effectiveness.
4. Think carefully about what aspects of the writing need further research, and ensure that your questions are directly aligned with the writing purpose.

# Output:
Return a JSON list of 3 questions."""
    resp = run_llm(prompt, WritingQuerys, n=1)
    if resp[0]["parsed"]:
        return resp[0]["parsed"].query
    return [q.strip() for q in resp[0]["text"].split("\n") if q.strip()][:3]


# ==============================================================
# Step 4 — Answer from History (NodeRAG)
# ==============================================================

@timed
def answer_from_history(question: str, search_engine: Any) -> str:
    prompt = f"""# Instruction:
You are an AI assistant answering based on a Knowledge Graph (NodeRAG). Use **only** the facts in the graph to answer the question. 
If the answer cannot be inferred directly, reply "No related information."

Question:
{question}

# Your Task:
1. Carefully examine the Knowledge Graph subgraph to determine whether it contains a direct answer to the question.
2. If the answer is explicitly represented or can be directly inferred via one or more graph relations, provide a concise and accurate response.
3. If the Knowledge Graph subgraph does not contain the requested information, respond strictly with: "No related information."
4. Do not include external knowledge or assumptions beyond what is present in the provided Knowledge Graph subgraph."""
    result = search_engine.query(prompt)
    return getattr(result, "answer", "No related information.")


# ==============================================================
# Step 5 — Answer from Current Essay
# ==============================================================

@timed
def answer_from_current(current_writing_content: str, question: str) -> str:
    prompt = f"""# Instruction:
Answer the question using only the content of the essay below.
If the answer isn't stated or implied, reply "No related information."

Essay:
{current_writing_content}

Question:
{question}
# Your Task:
1. Carefully analyze the essay to determine if it contains a direct answer to the question.
2. If the answer is explicitly stated or can be directly inferred from the essay, provide a concise and accurate response.
3. If the essay does not contain the requested information, respond strictly with: "No related information."
4. Do not include external knowledge or assumptions beyond what is given in the essay.
"""
    resp = run_llm(prompt, Answer, n=1)
    if resp[0]["parsed"]:
        return resp[0]["parsed"].answer.strip()
    return resp[0]["text"].strip()


# ==============================================================
# Step 6 — Identify Sentence Pattern (simplified placeholder)
# ==============================================================

@timed
def identify_sentence_pattern(current_writing_content: str, history_content: str, purpose: str) -> str:
    prompt = f"""# Instruction:
#Instruction:
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

Analyze both the historical writings and current essay to decide the most suitable **sentence pattern** for the predicted sentence.

Purpose: {purpose}

Historical Writing Samples:
{history_content}

Current Essay:
{current_writing_content}

#Your Task:
1. Analyze the provided essays to identify writing patterns and features.
2. Returning your analysis results in the output structure, ensuring each section is thorough and well-explained.

# Output:
Describe the selected sentence pattern briefly."""
    resp = run_llm(prompt, Answer, n=1)
    if resp[0]["parsed"]:
        return resp[0]["parsed"].answer.strip()
    return resp[0]["text"].strip()


# ==============================================================
# Step 7 — Identify Writing Style
# ==============================================================

@timed
def identify_writing_pattern(history_content: str) -> Tuple[str, str]:
    prompt = f"""# Instruction:
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

Essays:
{history_content}

# Your Task:
1. Analyze the provided essays to identify writing patterns and features.
2. Return your analysis results in the output structure, ensuring each section is thorough and well-explained.

# Output:
1. Writing Patterns: (organizational structure)
2. Writing Features: (vocabulary, syntax, tone)"""
    resp = run_llm(prompt, Answer, n=1)
    txt = resp[0]["parsed"].answer if resp[0]["parsed"] else resp[0]["text"]
    return txt, ""


# ==============================================================
# Step 8 — Predict Sentence
# ==============================================================

@timed
def predict_sentence(title: str,
                     context_info: str,
                     current_writing_content: str,
                     best_match_writing_purpose: str,
                     answer_from_current_list: List[str],
                     answer_from_history_list: List[str],
                     best_match_sentence_pattern: str,
                     writing_patterns_formatted_output: str,
                     writing_features_formatted_output: str) -> Tuple[str, str]:
    prompt = f"""# Instruction:
You are an AI writing assistant specialized in predicting a sentence within a user’s English essay. Your task is to generate ONE predicted sentence based on the provided full context. The sentence must align with the essay's **core topic**, as defined by the Title and Context, and must not deviate from the main subject. Please think step by step!

# Input Detail:
- Essay Title: The title defines the essay's core topic and sets the overall direction.
- Contextual Information: Background descriptions and keywords that represent the essay's intent and audience perspective.
- Essay Content: The entire essay text, with one paragraph containing the marker [PREDICTED SENTENCE], which is where the sentence will be inserted.
- Writing Purpose: The intent or goal for adding the predicted sentence.
- Writing Pattern: The organizational structure of the essay.
- Writing Features: The stylistic and linguistic tone.
- Sentence Pattern: The designated grammatical structure of the sentence.
- Enhancement Details: Supplementary writing details, drawn from current and past writing drafts.

Essay Title: {title}
Context Info: {context_info}

Essay Content:
{current_writing_content}

Writing Purpose:
{best_match_writing_purpose}

Sentence Pattern:
{best_match_sentence_pattern}

Writing Patterns:
{writing_patterns_formatted_output}

Writing Features:
{writing_features_formatted_output}

Relevant Info (Current Essay):
{chr(10).join(answer_from_current_list)}

Relevant Info (From History / NodeRAG):
{chr(10).join(answer_from_history_list)}

# Your Task:
1. **Focus on the Core Topic:**
   - Ensure the predicted sentence directly supports the essay's core topic as defined by the Title and Contextual Information. (e.g., location, people involved, names of food, physical landmarks, etc.).
   - Identify the role of the predicted sentence (e.g., introducing an idea, providing evidence, offering a transition, or summarizing a point).
   - Avoid introducing unrelated or tangential ideas.

2. **Enhance Logical Flow:**
   - The predicted sentence must connect seamlessly with the preceding and following sentences.
   - Use transition words or phrases if necessary to enhance the flow.

3. **Avoid Redundancy:**
   - Do NOT repeat or paraphrase ideas already present in the essay.
   - Check for semantic similarity (not just surface text).

4. **Preserve Logical Accuracy:**
   - The predicted sentence MUST NOT introduce false or contradictory information (e.g., misidentifying a restaurant as a cafe, mischaracterizing a door as a mural).

5. **Respect Contextual Consistency:**
   - Align your sentence with the setting, tone, and real-world implications established by the essay. Use the contextual information (keywords + description) to guide your tone and content.

6. **Natural Integration:**
   - Your sentence should enhance the flow of the paragraph, connect ideas logically, and sound natural.

7. **Maintain Stylistic Consistency**:
   - The predicted sentence must match the tone and stylistic level of the surrounding content (e.g., avoid shifting from factual to poetic or from neutral to emotional).
   - Do not use overly figurative or metaphorical language unless such style is already present in the preceding or following sentences.

8. **Output a SINGLE Sentence Only.**
# Output:
Return exactly one coherent sentence."""
    resp = run_llm(prompt, PredictSentence, n=1)
    if resp[0]["parsed"]:
        return resp[0]["parsed"].predict_sentence.strip(), prompt
    return resp[0]["text"].strip(), prompt


# ==============================================================
# Main CLI
# ==============================================================

def main():
    print("\n=== Independent Predict API (with NodeRAG) ===\n")

    student_id = input("Student ID: ").strip() or "S000"
    node_path = input("NodeRAG folder path (default: ./NodeRAG): ").strip() or "./NodeRAG"

    config = NodeConfig.from_main_folder(node_path)
    search_engine = NodeSearch(config)
    print(f"[INFO] NodeRAG initialized from: {node_path}\n")

    # Historical writing input
    print("Enter historical writings (finish with an empty line):")
    history_lines = []
    while True:
        line = input()
        if not line.strip(): break
        history_lines.append(line)
    history_content = "\n".join(history_lines)

    # Current essay input
    print("\nEnter current essay (include [PREDICTED SENTENCE] marker, finish with an empty line):")
    essay_lines = []
    while True:
        line = input()
        if not line.strip(): break
        essay_lines.append(line)
    current_essay = "\n".join(essay_lines)

    title = input("\nEssay Title (optional): ").strip()
    context_info = input("Context Info / keywords (optional): ").strip()

    timings = {}
    total_start = time.time()

    # Run pipeline
    purposes, t = identify_writing_purpose(current_essay)
    timings["Identify writing purpose"] = t

    best_purpose, reason = vote_writing_purpose(current_essay, purposes)[0]
    timings["Vote best writing purpose"] = t

    questions, t = generate_question(current_essay, best_purpose)
    timings["Generate questions"] = t

    hist_answers = []
    for q in questions:
        a, dt = answer_from_history(q, search_engine)
        hist_answers.append(f"Q: {q}\nA: {a}")
    timings["Answer from history (NodeRAG)"] = dt

    cur_answers = []
    for q in questions:
        a, dt = answer_from_current(current_essay, q)
        cur_answers.append(f"Q: {q}\nA: {a}")
    timings["Answer from current essay"] = dt

    pattern, t = identify_sentence_pattern(current_essay, history_content, best_purpose)
    timings["Identify sentence pattern"] = t

    writing_patterns, writing_features = identify_writing_pattern(history_content)[0]
    timings["Identify writing style"] = t

    predicted, prompt_snapshot = predict_sentence(
        title, context_info, current_essay,
        best_purpose, cur_answers, hist_answers,
        pattern, writing_patterns, writing_features
    )[0]
    timings["Predict sentence"] = t

    total_time = round(time.time() - total_start, 2)
    timings["Total pipeline time"] = total_time

    # Results
    print("\n✅ Predicted Sentence:")
    print(predicted)
    print("\n⏱️  Execution Time Summary:")
    for k, v in timings.items():
        print(f" - {k}: {v} sec")

    os.makedirs("results", exist_ok=True)
    outpath = f"results/predict_result_{student_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    result = {
        "student_id": student_id,
        "writing_purposes": purposes,
        "best_purpose": best_purpose,
        "reason": reason,
        "questions": questions,
        "answers_history": hist_answers,
        "answers_current": cur_answers,
        "sentence_pattern": pattern,
        "writing_patterns": writing_patterns,
        "writing_features": writing_features,
        "predicted_sentence": predicted,
        "timings": timings,
        "prompt_snapshot": prompt_snapshot
    }
    with open(outpath, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    print(f"\n💾 Results saved to: {outpath}")


if __name__ == "__main__":
    main()
