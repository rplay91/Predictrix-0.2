import pytest
from deepeval import assert_test
from deepeval.metrics import GEval
from deepeval.test_case import LLMTestCase, LLMTestCaseParams

def test_case():
    correctness_metric = GEval(
        name="Correctness",
        criteria="Evaluate the correctness of the predicted sentence based on the following criteria:\n"
        "1. Semantic Alignment: The predicted sentence must be factually accurate and semantically aligned with the expected sentence (EXPECTED_OUTPUT). "
        "Minor variations in wording are acceptable as long as the core meaning remains unchanged.\n"
        "2. Prompt Adherence: The predicted sentence must follow the writing style, tone, and instructions provided in the input prompt (INPUT). "
        "This includes maintaining consistency in vocabulary choice, sentence structure, and any explicit stylistic guidelines.\n"
        "3. Logical Coherence: The predicted sentence should be logically consistent and should not introduce contradictions, misinformation, or hallucinations.",
        evaluation_params=[LLMTestCaseParams.ACTUAL_OUTPUT, LLMTestCaseParams.EXPECTED_OUTPUT],
        threshold=0.5
    )
    test_case = LLMTestCase(
        input="""
        # Instruction:
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
Bakso

Contextual Information:
The soup is served in a large bowl. It contains meatballs, pieces of beef, and vegetables, all floating in hot broth. The dish looks delicious and inviting.

Essay Content:
 Bakso, one of Indonesia’s most beloved street foods, is a savory meatball soup enjoyed by people of all ages. 
        Made from finely ground beef mixed with tapioca flour, bakso has a springy texture that distinguishes it from other meatballs. 
        The meatballs are typically served in a clear, flavorful broth accompanied by noodles, fried tofu, bean sprouts, and a sprinkle of green onions. 
        Many vendors also add condiments like chili sauce, soy sauce, or vinegar to suit individual tastes. 
        Found in both humble street stalls and fancy restaurants, bakso is not just a meal—it’s a comforting symbol of Indonesian culinary culture that warms both the body and the heart. 
        Served steaming in a large bowl, bakso unites beef meatballs, pieces of beef, and vegetables in hot broth—a daily comfort that reflects Indonesia’s shared culinary heritage.
        [PREDICTED SENTENCE]

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
       

""",
        # Replace this with the actual output from your LLM application
        actual_output="Served steaming in a large bowl, bakso unites beef meatballs, pieces of beef, and vegetables in hot broth—a daily comfort that reflects Indonesia’s shared culinary heritage.",
        expected_output="Across street stalls and restaurants alike, the steam from a hot bowl of bakso invites diners to gather, turning simple beef meatballs and vegetables in clear broth into a shared tradition carried across generations.",
        #retrieval_context=["All customers are eligible for a 30 day full refund at no extra costs."]
    )
    assert_test(test_case, [correctness_metric])