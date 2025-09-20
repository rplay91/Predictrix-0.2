from openai import OpenAI
from pydantic import BaseModel
from typing import List
import asyncio
import time
from collections import Counter
from typing import List
from datetime import datetime
from NodeRAG import NodeRag, NodeConfig, NodeSearch

from api_config import GPT_API_KEY
from db_config import DB_CONFIG

client = OpenAI(api_key=GPT_API_KEY)

# Initialize NodeRAG
config = NodeConfig.from_main_folder("./data")
node_rag = NodeRag(config)
search_engine = NodeSearch(node_rag)


# 辨識寫作目的
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

    # 輸出格式
    class WritingPurposes(BaseModel):
        writing_purposes: str

    # 構建 response
    messages=[
        {"role": "user", "content": user_prompt}
    ]

    # 發送請求
    response = client.beta.chat.completions.parse(
        model="gpt-4o-mini",
        # reasoning_effort="low",
        messages=messages,
        response_format=WritingPurposes,
        n=5 # 生成五個寫作目的
    )

    # 輸出結果: 五個寫作目的
    writing_purposes_list = []

    for choice in response.choices:
        writing_purposes_list.append(choice.message.parsed.writing_purposes)

    # 回傳結果
    return writing_purposes_list

# 投票:寫作目的
def vote_writing_purpose(current_writing_content, writing_purposes_list):
    # 將所有寫作目的做為選項加入列表中
    writing_purposes_options_list = "\n".join([f"{i+1}. {response}" for i, response in enumerate(writing_purposes_list)])
    # Voting Prompt: 選出最符合輸入情境的寫作目的
    user_prompt = f"""# Instruction:
You are an advanced AI assistant with expertise in English writing. Your task is to analyze a predicted sentence in a English essay and determine which of five given purposes of writing best aligns with its intended function. Additionally, you must consider whether purposes of writing aligns with the English essay cntext. Please think step by step.

# Input Structure:
The user provides the essay's content:
Essay Content:
{current_writing_content}

Additionally, the user specifies the paragraph containing the predicted sentence and marks its position using [PREDICTED SENTENCE] within the paragraph’s text.

Five Purposes of Writing:{writing_purposes_options_list}

# Your Task:
1. Analyze Context: Understand the logical flow of the essay and the role of the predicted sentence.
2. Evaluate Purposes of Writing: Compare the predicted sentence’s expected function with the five given purposes of writing and assess whether it aligns with situation description cntext.
3. Select the Best Fit: Identify and justify which purpose of writing most accurately aligns with the predicted sentence's role and the English essay cntext.(Respond with a number: 1, 2, 3, 4, or 5)
4. Explain Your Choice: Provide a brief explanation supporting your selection based on the essay’s structure and logical coherence."""

    # 輸出格式
    class BestMatchWritingPurposes(BaseModel):
        best_match_writing_purpose: str
        best_match_writing_purpose_reason: str

    # 構建 response
    messages=[
        {"role": "user", "content": user_prompt}
    ]

    # 發送請求
    response = client.beta.chat.completions.parse(
        model="gpt-4o-mini",
        # reasoning_effort="low",
        messages=messages,
        response_format=BestMatchWritingPurposes,
        n=5
    )

    # 輸出結果: 票選結果
    best_match_writing_purpose_vote_results = []
    for choice in response.choices:
        best_match_writing_purpose_vote_results.append(choice.message.parsed.best_match_writing_purpose)

    # 計算票數
    best_match_writing_purpose_vote_counts = Counter(best_match_writing_purpose_vote_results)
    best_match_writing_purpose_highest_vote_result = max(best_match_writing_purpose_vote_counts.values())
    best_match_writing_purpose_winning_options = [option for option, count in best_match_writing_purpose_vote_counts.items() if count == best_match_writing_purpose_highest_vote_result]

    # 確認是否有平票
    if len(best_match_writing_purpose_winning_options) > 1:
        # print("平票的選項編號:", best_match_writing_purpose_winning_options)
        # print("需要進行重新投票以選出最終結果。")
        re_writing_purposes_options_list = ""  # 初始化空字串
        for i, option in enumerate(best_match_writing_purpose_winning_options, start=1):
            writing_purpose = writing_purposes_list[int(option) - 1]
            re_writing_purposes_options_list += f"{i}. {writing_purpose}\n"
        
        # Re-Voting Prompt: 選出最符合輸入情境的寫作目的
        user_prompt = f"""# Instruction:
You are an advanced AI assistant with expertise in English writing. Your task is to analyze a predicted sentence in a English essay and determine which of two given purposes of writing best aligns with its intended function. Additionally, you must consider whether purposes of writing aligns with the English essay cntext. Please think step by step.

# Input Structure:
The user provides the essay's content:
Essay Content:
{current_writing_content}

Additionally, the user specifies the paragraph containing the predicted sentence and marks its position using [PREDICTED SENTENCE] within the paragraph’s text.

Two Purposes of Writing:{writing_purposes_options_list}

# Your Task:
1. Analyze Context: Understand the logical flow of the essay and the role of the predicted sentence.
2. Evaluate Purposes of Writing: Compare the predicted sentence’s expected function with the two given purposes of writing and assess whether it aligns with situation description cntext.
3. Select the Best Fit: Identify and justify which purpose of writing most accurately aligns with the predicted sentence's role and the English essay cntext.(Respond with a number: 1, 2, 3, 4, or 5)
4. Explain Your Choice: Provide a brief explanation supporting your selection based on the essay’s structure and logical coherence."""
        # 輸出格式
        class BestMatchWritingPurposes(BaseModel):
            best_match_writing_purpose: str
            best_match_writing_purpose_reason: str
        # 構建 response
        messages=[
            {"role": "user", "content": user_prompt}
        ]
        # 發送請求
        response = client.beta.chat.completions.parse(
            model="gpt-4o-mini",
            # reasoning_effort="low",
            messages=messages,
            response_format=BestMatchWritingPurposes,
            n=3
        )
        # 輸出結果: 票選結果
        re_best_match_writing_purpose_vote_results = []
        for choice in response.choices:
            re_best_match_writing_purpose_vote_results.append(choice.message.parsed.best_match_writing_purpose)
            # print("Number:" + choice.message.parsed.best_match_writing_purpose)
            # print("Reason:" + choice.message.parsed.best_match_writing_purpose_reason + "\n")
        # 計算票數
        best_match_writing_purpose_vote_counts = Counter(re_best_match_writing_purpose_vote_results)
        best_match_writing_purpose_highest_vote_result = max(best_match_writing_purpose_vote_counts.values())
        best_match_writing_purpose_winning_options = [option for option, count in best_match_writing_purpose_vote_counts.items() if count == best_match_writing_purpose_highest_vote_result]
        best_match_writing_purpose_winning_option = best_match_writing_purpose_winning_options[0]
        best_match_writing_purpose = writing_purposes_list[int(best_match_writing_purpose_winning_option) - 1]        
    else:
        best_match_writing_purpose_winning_option = best_match_writing_purpose_winning_options[0]
        best_match_writing_purpose = writing_purposes_list[int(best_match_writing_purpose_winning_option) - 1]

    return best_match_writing_purpose, ""

# 生成問題(Max 3)
def generate_question(current_writing_content, best_match_writing_purpose):
    user_prompt = f"""# Instruction:
You are an advanced AI assistant with expertise in analyzing English writing. Your task is to improve the predicted sentence in an English essay by formulating effective database queries. The predicted sentence has a specific purpose of writing, which will be provided as input.  Your ultimate goal is to generate three targeted, insightful questions that can retrieve relevant and useful information from the database to refine the predicted sentence.

# Input Structure:
The user provides the essay's content:
Essay Content:
{current_writing_content}

Additionally, the user specifies the paragraph containing the predicted sentence and marks its position using [PREDICTED SENTENCE] within the paragraph’s text.

The purpose of writing predicted sentence: {best_match_writing_purpose}

# Your Task:
1. Understand the logical flow of the essay and the role of the predicted sentence.
2. Based on the purpose of writing predicted sentence, produce three clear and concise questions.
3. Each question should be crafted to extract specific information from the database that will help enhance the predicted sentence's effectiveness.
4. Think carefully about what aspects of the writing need further research, and ensure that your questions are directly aligned with the writing purpose."""

    # 輸出格式
    class WritingQuerys(BaseModel):
        query: List[str]

    # 構建 response
    messages=[
        {"role": "user", "content": user_prompt}
    ]

    # 發送請求
    query = client.beta.chat.completions.parse(
        model="gpt-4o-mini",
        # reasoning_effort="low",
        messages=messages,
        response_format=WritingQuerys
    )

    # 結果: 生成數個問題
    query_list = query.choices[0].message.parsed.query

    return query_list

# 從 History Essays 提取資訊
async def answer_from_history(query):
    # 定義 query
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
    # NodeRAG retrieval search
    try:
        # Kirim user_prompt ke NodeRAG search engine
        result = search_engine.query(user_prompt)
        if result and hasattr(result, "answer"):
            return result.answer
        return "No related information."
    except Exception as e:
        return f"Error during NodeRAG search: {str(e)}"

# 從 Current Essay 提取資訊
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

    # 輸出格式
    class Answer(BaseModel):
        answer: str

    # 構建 response
    messages=[
        {"role": "user", "content": user_prompt}
    ]

    # 發送請求
    answer = client.beta.chat.completions.parse(
        model="gpt-4o-mini",
        # reasoning_effort="low",
        messages=messages,
        response_format=Answer
    )

    # 取得結果: 問題答案
    query_answer_from_current = answer.choices[0].message.parsed.answer

    return str(query_answer_from_current)

# 提取Sentence Pattern
def identify_sentence_pattern(current_writing_content, history_content, best_match_writing_purpose):
    # Prompt: 提取Sentence Patterns
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

    # 輸出格式
    class HistorySentencePattern(BaseModel):
        sentent_pattern_type: str
        explanation: str
        example: str
        pattern: str
        function: str


    class HistoryWritingPatternAnalysis(BaseModel):
        history_sentence_patterns: list[HistorySentencePattern]

    # 構建 response
    messages=[
        {"role": "user", "content": user_prompt},
    ]

    # 發送請求
    history_writing_pattern_analysis = client.beta.chat.completions.parse(
        model="gpt-4o-mini",
        # reasoning_effort="low",
        messages=messages,
        response_format=HistoryWritingPatternAnalysis
    )

    # 取得結果: 歷史 Sentence Pattern & Grammar Feature
    history_sentence_patterns = history_writing_pattern_analysis.choices[0].message.parsed.history_sentence_patterns


    # Prompt: 提取當前寫作的Patterns
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

    # 輸出格式
    class CurrentSentencePattern(BaseModel):
        sentent_pattern_type: str
        explanation: str
        example: str
        pattern: str
        function: str

    class CurrentWritingPatternAnalysis(BaseModel):
        current_sentence_patterns: list[CurrentSentencePattern]

    # 構建 response
    messages=[
        {"role": "user", "content": user_prompt},
    ]

    # 發送請求
    current_writing_pattern_analysis = client.beta.chat.completions.parse(
        model="gpt-4o-mini",
        # reasoning_effort="low",
        messages=messages,
        response_format=CurrentWritingPatternAnalysis
    )

    # 取得結果: 當前 Sentence Pattern & Grammar Feature
    current_sentence_patterns = current_writing_pattern_analysis.choices[0].message.parsed.current_sentence_patterns

    # 格式化 Sentence Pattern 的輸出
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
    
    # 格式化歷史 & 當前 Sentence Patterns
    formatted_history_patterns = format_common_sentence_patterns(history_sentence_patterns)
    formatted_current_patterns = format_common_sentence_patterns(current_sentence_patterns)

    # 選擇預測句的 Sentence Pattern
    # Prompt: 根據寫作目的，取得應該使用的 Sentence Pattern
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

    # 輸出格式
    class PredictSentencePattern(BaseModel):
        sentent_pattern_type: str
        explanation: str
        example: str
        pattern: str
        function: str

    # 構建 response
    messages=[
        {"role": "user", "content": user_prompt}
    ]

    # 發送請求
    predict_sntence_pattern = client.beta.chat.completions.parse(
        model="gpt-4o-mini",
        # reasoning_effort="low",
        messages=messages,
        response_format=PredictSentencePattern,
        n=5 # 生成五個句型模式
    )

    # 取得結果: 五個句型模式
    predict_sntence_pattern_list = []
    for i, choice in enumerate(predict_sntence_pattern.choices):
        parsed = choice.message.parsed        
        # 使用屬性存取方式提取資訊
        type_info = f"Type: {parsed.sentent_pattern_type}"
        explanation = f"Explanation: {parsed.explanation}"
        example = f"Example: {parsed.example}"
        pattern = f"Pattern: {parsed.pattern}"
        function = f"Function: {parsed.function}"
        # 格式化字串
        formatted_string = f"{type_info}\n{explanation}\n{example}\n{pattern}\n{function}"
        # 將格式化後的字串加入列表
        predict_sntence_pattern_list.append(formatted_string)


    # 投票: 最符合當前寫作目的的 Sentence Pattern    
    # 將所有句型模式做為選項加入列表中
    predict_sntence_pattern_options_list = "\n".join([f"{i+1}. {response}" for i, response in enumerate(predict_sntence_pattern_list)])

    # Voting Prompt: 根據當前文章摘要選擇最合適的句型模式
    user_prompt = f"""# Instruction: 
You are an advanced AI assistant with expertise in English writing. Your task is to choose the sentence pattern that the predicted sentence should use from the five sentence pattern options according to the English essay and the purpose of writing the predicted sentence.

# Input Structure: 
The user provides the essay's content:
Essay Content:
{current_writing_content}

The purpose of writing the predicted sentence : {best_match_writing_purpose}

Five Sentence Pattern Options: {predict_sntence_pattern_options_list}

# Your Task:
- Review the content of the essay and the stated purpose of the predicted sentence.
- Carefully analyze the five provided sentence pattern options.
- Select the sentence pattern that aligns best with the essay’s context and the goal of the predicted sentence.(Respond with a number: 1, 2, 3, 4, or 5)
- Ensure that the chosen sentence pattern enhances the overall clarity, flow, and coherence of the essay.
- Provide a brief explanation of why you chose the selected sentence pattern."""
    user_prompt = user_prompt.replace("[PREDICTED SENTENCE]", "")

    # 輸出格式
    class BestMatchSentencePattern(BaseModel):
        best_match_sentence_pattern: str
        best_match_sentence_pattern_reason: str

    # 構建 response
    messages=[
        {"role": "user", "content": user_prompt}
    ]

    # 發送請求
    response = client.beta.chat.completions.parse(
        model="gpt-4o-mini",
        # reasoning_effort="low",
        messages=messages,
        response_format=BestMatchSentencePattern,
        n=5 # 生成五個句型模式
    )

    # 取得結果: 輸出票選結果
    best_match_sentence_pattern_vote_results = []
    best_match_sentence_pattern_vote_results_reason = []
    for choice in response.choices:
        best_match_sentence_pattern_vote_results.append(choice.message.parsed.best_match_sentence_pattern)
        best_match_sentence_pattern_vote_results_reason.append(choice.message.parsed.best_match_sentence_pattern_reason)
        # print("編號:" + choice.message.parsed.best_match_sentence_pattern)
        # print("理由:" + choice.message.parsed.best_match_sentence_pattern_reason + "\n")

    # 計算票數
    best_match_sentence_pattern_vote_counts = Counter(best_match_sentence_pattern_vote_results)
    best_match_sentence_pattern_highest_vote_result = max(best_match_sentence_pattern_vote_counts.values())
    best_match_sentence_pattern_winning_options = [option for option, count in best_match_sentence_pattern_vote_counts.items() if count == best_match_sentence_pattern_highest_vote_result]

    # 確認是否有平票
    if len(best_match_sentence_pattern_winning_options) > 1:
        # 平票處理
        tie_options = [predict_sntence_pattern_list[int(option) - 1] for option in best_match_sentence_pattern_winning_options]
        tie_options_list = "\n".join([f"{i+1}. {response}" for i, response in enumerate(tie_options)])

        # Voting Prompt: 從平票選項中重新投票
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

        # 構建 response
        tie_messages = [
            {"role": "user", "content": tie_prompt}
        ]

        # 發送請求
        tie_response = client.beta.chat.completions.parse(
            model="gpt-4o-mini",
            # reasoning_effort="low",
            messages=tie_messages,
            response_format=BestMatchSentencePattern,
            n=3
        )

        # 取得結果: 再次票選結果
        tie_vote_results = []
        tie_vote_reason = []
        for choice in tie_response.choices:
            tie_vote_results.append(choice.message.parsed.best_match_sentence_pattern)
            tie_vote_reason.append(choice.message.parsed.best_match_sentence_pattern_reason)


        # 再次計算票數
        tie_vote_counts = Counter(tie_vote_results)
        tie_highest_vote_result = max(tie_vote_counts.values())
        tie_winning_options = [option for option, count in tie_vote_counts.items() if count == tie_highest_vote_result][0]
        best_match_sentence_pattern = tie_options[int(tie_winning_options) - 1]

    else:
        best_match_sentence_pattern_winning_option = best_match_sentence_pattern_winning_options[0]
        best_match_sentence_pattern = predict_sntence_pattern_list[int(best_match_sentence_pattern_winning_option) - 1]
        # print(f"得票最高的選項編號: {best_match_sentence_pattern_winning_option}")
        # print(f"選項內容: {best_match_sentence_pattern}")
    
    return best_match_sentence_pattern

# 提取Writing Pattern
def identify_writing_pattern(history_content):
    # Prompt: 提取歷史寫作紀錄的Patterns
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
    
    # 輸出格式
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
    # 構建 response
    messages=[
        {"role": "user", "content": user_prompt},
    ]
    # 發送請求
    writing_pattern_analysis = client.beta.chat.completions.parse(
            model="gpt-4o-mini",
            # reasoning_effort="low",
            messages=messages,
            response_format=WritingPatternAnalysis,
        )
    writing_patterns = writing_pattern_analysis.choices[0].message.parsed.writing_patterns
    writing_features = writing_pattern_analysis.choices[0].message.parsed.writing_features

    # 格式化 Writing Pattern
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

    # 格式化 Writing Feature
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

# 預測句子
def predict_sentence(title, context_info, current_writing_content, best_match_writing_purpose, answer_from_current, answer_from_history, best_match_sentence_pattern, writing_patterns_formatted_output, writing_features_formatted_output):
    # Prompt: 根據提取出的資訊進行預測
    user_prompt = f"""# Instruction:
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

8. **Output a SINGLE Sentence Only.**"""

    # 輸出格式
    class PredictSentence(BaseModel):
        predict_sentence: str
    # 構建 response
    messages=[
        {"role": "user", "content": user_prompt}
    ]
    # 發送請求
    predict_sentence = client.beta.chat.completions.parse(
        model="gpt-4o-mini", #o3-mini #gpt-4o-mini
        # reasoning_effort="low",
        messages=messages,
        response_format=PredictSentence
    )
    # 回傳結果
    final_predict_sentence = predict_sentence.choices[0].message.parsed.predict_sentence
    
    return final_predict_sentence, user_prompt

# 執行預測
async def get_predict_sentence(current_essay_content: str, history_essay_content: str, images_info: List[dict], title: str) -> str:
    start_time = time.time()  # 開始時間
    try:
        # 設定超時限制
        timeout = 160  # 秒數

        # 將圖片資訊整合成字串
        context_info = ""
        for idx, img in enumerate(images_info, 1):
            context_info += f"Context Infomation {idx}:\n"
            context_info += f"Keywords: {', '.join(img['keywords'])}\n"
            context_info += f"Description: {img['description']}\n\n"

        async def predict_with_timeout():
            # 1. 辨識寫作目的
            purpose_start = time.time()
            writing_purposes_list = identify_writing_purpose(current_essay_content)
            if not writing_purposes_list:
                raise ValueError("無法識別寫作目的")
            print(f"辨識寫作目的花費時間: {time.time() - purpose_start:.2f} 秒")

            # 2. 投票選出最佳寫作目的
            vote_start = time.time()
            best_match_writing_purpose, error_msg = vote_writing_purpose(current_essay_content, writing_purposes_list)
            if error_msg:
                raise ValueError(f"投票過程發生錯誤: {error_msg}")
            print(f"投票選出最佳寫作目的花費時間: {time.time() - vote_start:.2f} 秒")

            # 3. 檢索相關資訊
            query_start = time.time()
            query_list = generate_question(current_essay_content, best_match_writing_purpose)
            if not query_list:
                raise ValueError("無法生成問題")
            print(f"生成問題花費時間: {time.time() - query_start:.2f} 秒")

            # 4. 從歷史文章獲取答案
            history_start = time.time()
            answer_from_history_list = ""
            for query in query_list:
                query_answer_from_history = await answer_from_history(query)
                if query_answer_from_history != "I am sorry but I am unable to answer this question given the provided data.":
                    answer_from_history_list += f"Question: {query}\nAnswer: {query_answer_from_history}\n\n"
            print(f"從歷史文章獲取答案花費時間: {time.time() - history_start:.2f} 秒")

            # 5. 從當前文章獲取答案
            current_start = time.time()
            answer_from_current_list = ""
            for query in query_list:
                query_answer_from_current = answer_from_current(current_essay_content, query)
                if query_answer_from_current != "No related information.":
                    answer_from_current_list += f"Question: {query}\nAnswer: {query_answer_from_current}\n\n"
            print(f"從當前文章獲取答案花費時間: {time.time() - current_start:.2f} 秒")

            # 6. 提取句型模式
            pattern_start = time.time()
            best_match_sentence_pattern = identify_sentence_pattern(
                current_essay_content, 
                history_essay_content, 
                best_match_writing_purpose
            )
            if not best_match_sentence_pattern:
                raise ValueError("無法識別句型模式")
            print(f"識別句型模式花費時間: {time.time() - pattern_start:.2f} 秒")

            # 7. 提取寫作風格
            style_start = time.time()
            writing_patterns_formatted_output, writing_features_formatted_output = identify_writing_pattern(history_essay_content)
            if not writing_patterns_formatted_output or not writing_features_formatted_output:
                raise ValueError("無法識別寫作風格")
            print(f"識別寫作風格花費時間: {time.time() - style_start:.2f} 秒")

            # 8. 預測句子
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
                writing_features_formatted_output
            )
            if not final_predict_sentence:
                raise ValueError("無法生成預測句子")
            print(f"生成預測句子花費時間: {time.time() - predict_start:.2f} 秒")

            # await asyncio.sleep(11)  # 模擬超時
            # final_predict_sentence = "test"
            # user_prompt = "test"

            return final_predict_sentence, user_prompt

        # 使用 asyncio.wait_for 設定超時
        final_predict_sentence, user_prompt = await asyncio.wait_for(predict_with_timeout(), timeout=timeout)

        total_time = time.time() - start_time
        print(f"\n預測流程總共花費時間: {total_time:.2f} 秒")

        return final_predict_sentence, user_prompt

    except asyncio.TimeoutError:
        total_time = time.time() - start_time
        print(f"預測超時，總共執行時間: {total_time:.2f} 秒")
        raise TimeoutError("預測超時，請稍後再試。")

    except Exception as e:
        total_time = time.time() - start_time
        print(f"預測失敗，總共執行時間: {total_time:.2f} 秒")
        print(f"預測句子時發生錯誤: {str(e)}")
        raise e


            





