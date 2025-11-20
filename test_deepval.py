from deepeval import assert_test
from deepeval.metrics import GEval
from deepeval.test_case import LLMTestCase, LLMTestCaseParams

def test_case():
    correctness_metric = GEval(
        name="Correctness",
        criteria=(
        "Evaluate the correctness of the predicted sentence (ACTUAL_OUTPUT) based on the following criteria:\n"
        "1. Semantic Alignment: The predicted sentence must be factually accurate and semantically aligned with the expected sentence (EXPECTED_OUTPUT). "
        "Minor variations in wording are acceptable as long as the core meaning remains unchanged.\n"
        "2. Prompt Adherence: The predicted sentence must follow the writing style, tone, and instructions provided in the input prompt (INPUT). "
        "This includes maintaining consistency in vocabulary choice, sentence structure, and any explicit stylistic guidelines.\n"
        "3. Logical Coherence: The predicted sentence should be logically consistent and should not introduce contradictions, misinformation, or hallucinations."
    ),
        evaluation_params=[LLMTestCaseParams.ACTUAL_OUTPUT, LLMTestCaseParams.EXPECTED_OUTPUT],
        threshold=0.5555
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
Halloween Event

Contextual Information:


Essay Content:
Halloween day is a celebration of horror that celebrated once a year. In halloween, people in the west usually throw costume parties, such as super-heroes themed, or maybe spooky themed like the carved pumpkins or devil. For children, they usually dressed up as a character and go to their neighbors house for 'trick or treat'. In the first photo, we can see that those children already dressed up as a character they chose. They bring a character bucket with them to collect sweets like candies and chocolates from the houses in the neighborhood. Not just that, the children also can do tricks for the house owner. Such little magic trick that they performed. That's why when they knocked on their neighbor's door, they say "trick or treats". They give the choice for the house owner to choose wheter to see their tricks or to give and take some of their sweets. In the halloween period, you can also see many people decorated their houses with many decorations such as carved pumpkins, spider webs, ghost lamp, and many more. The decorations is not just in the front yard, some people like to decorate their house from the front yard, inside the house, maybe inside their bedrooms, and even more on the backyard. Especially for those who like to house a halloween party, they can be extra with decorations. Halloween party can be different among people. Some people like to just throw a party that including eat together or having drinks, but some people like to include a costume party and play halloween games. Some also like to just stay home and enjoy their own halloween day by watching horror or thriller movie. In conclusion, halloween is not just about celebration of horror, halloween is much more than just a spooky celebration. It can be the time for people to gather togheter and spend their time togheter. [PREDICTED SENTENCE]

Writing Purpose:
Summarize or restate the overall idea at the end of the paragraph

Writing Pattern:
Pattern 1:
Type: Descriptive-visual
Explanation: The author frequently focuses on concrete visual details to depict scenes, objects, or events. Descriptions emphasize appearance, setting, and sensory cues (colors, textures, surroundings). The tone is often observational and aims to paint a clear image for the reader, sometimes with a mild documentary or explanatory bent.
Pattern: Intro scene setting -> specific details -> broad summary of scene or sequence -> occasional concluding remark about significance or mood. Paragraphs often move from a static image to a small narrative moment (e.g., harvesting, fashion show setup, street food cart) and finish with a summative statement.
Example: Essay 1 moves from a farmer in the fields with green leaves and grass to milled beans and a calm coffee shop ambience, ending with a wrap-up about the steps from harvest to cup.

Pattern 2:
Type: Expository/Informative with sequence
Explanation: Many essays outline a sequence of events or steps (photos, competition events, or process descriptions). They aim to inform the reader about a process, event chronology, or components of a larger activity.
Pattern: Identify a process or event -> break into stages or components -> provide concrete but sometimes repetitive details -> conclude with a general takeaway or summary.
Example: Essay 3 outlines Independence Day events over two days, including tug of war, relay, fashion show, field setups, and concludes with reflections on success and teamwork.

Pattern 3:
Type: Narrative-leaning personal reflection
Explanation: Several essays blend personal reflections with general statements, often ending with a moral, takeaway, or cultural observation. The voice sometimes shifts into opinion or value judgment (e.g., importance of teamwork, personal growth from reading).
Pattern: Personal viewpoint introduced -> illustrative examples or experiences -> concluding thought about meaning or impact.
Example: Essay 6 discusses reading as mental travel and personal growth, weaving examples of imagination, preferred genres, and the value of quiet spaces, ending with a reflective summary.

Pattern 4:
Type: Opinion/comparative
Explanation: Some pieces compare items (fried rice variations, genres of novels) and advocate a preference or describe differences in taste, texture, or experience. The writer often states a preference and supports it with described characteristics.
Pattern: Present options -> compare features -> express preference -> justify with descriptive reasoning.
Example: Essay 5 contrasts regular fried rice with mawut fried rice, discussing texture and ingredients, then concludes with a preference-based summary.

Pattern 5:
Type: Informal cultural/exploratory
Explanation: Several essays discuss cultural topics (Indonesian foods, Independence Day events, Halloween) in a simple, approachable style. The language is straightforward, with occasional casual phrases or colloquialisms and some spelling/grammar irregularities.
Pattern: Introduce cultural subject -> highlight activities, foods, or traditions -> provide simple observations or outcomes -> conclude with a broad cultural takeaway.
Example: Essay 4 describes cart fried rice and its cultural context, its flavors and the street-cart setting, ending with a general statement about its charm.


Writing Features:
Feature 1:
Type: Vocabulary and register
Explanation: Vocabulary is plain and accessible, with recurring culinary, event, and everyday-life terms. There are occasional precise nouns (e.g., 'tug of war', 'Paskibra', 'Bubur Manado') but generally the lexicon stays simple and concrete.
Example: Words like 'photo', 'harvesting', 'coffee cherries', 'fashion show', 'competition', 'runway', 'crackers', 'pickled cucumber'.
Preferred Words: photo, competition, fashion show, tradition, flavor, taste, dish, culture, street food, run, runways, crowd, place
Preferred Syntax: Predominantly simple or compound sentences; occasional longer sentences with multiple clauses; frequent use of noun phrases to describe scenes.

Feature 2:
Type: Sentence structure
Explanation: A mix of short, straightforward sentences and longer, descriptive sentences. Tendencies toward parallel structures and lists when enumerating events or steps. Occasional run-on feel due to minor grammar inconsistencies.
Example: Essay 3: 'The tug of war and relay races happened in the back field, which is called LABELA. And for the fashion show, the student council had prepared the center field to become the runway.'
Preferred Words: and, then, also, the, is/are, was/were
Preferred Syntax: Simple sentences with occasional compound structures; repetitive linking words to connect steps or events.

Feature 3:
Type: Consistency and cohesion
Explanation: Transitions between ideas are often via simple connectors or reiteration of the topic (e.g., 'The fashion show', 'Day one', 'In conclusion'). Cohesion relies on topic nouns and repeated focus on the main subject rather than deep logical progression.
Example: Many essays begin with a setting or event, then expand to related activities and end with a concluding sentiment or summary line.
Preferred Words: The, this, that, and, also, then
Preferred Syntax: Repeating frame structures: present-then-describe-then-conclude.

Feature 4:
Type: Rhetorical devices
Explanation: Limited use of advanced rhetoric; some descriptive imagery; occasional evaluative statements (e.g., 'the most important thing is working together') and emphasis on mood (calm, lively).
Example: Essay 7 uses metaphor and reflective tone about imagination as a mirror and growth through reading.
Preferred Words: like, not only... but, the most important
Preferred Syntax: Metaphorical comparisons and evaluative statements sprinkled through prose.

Feature 5:
Type: Spelling/grammar quirks
Explanation: There are frequent spelling and typographical errors, inconsistent article usage, and occasional incorrect pluralization or word forms. This suggests a learner-writer with developing control over orthography; however, meaning is generally clear.
Example: proffesional, milled with proffesional skilllls, wth, adjaccent, kosayu, carm (calm), cullinary, inn, mawut
Preferred Words: 
Preferred Syntax: 


Sentence Pattern:
Type: Conclusion with generalized takeaway through thematic cohesion
Explanation: The current essay repeatedly centers on Halloween's meaning and social aspects, building toward a summarizing closure. To wrap up, a concluding sentence that states a generalized takeaway about Halloween's broader meaning and social value aligns with both the current patterns (thematic cohesion and generalization) and the inferred goal of the predicted sentence (summarize/conclude).
Example: Halloween is thus not only a festival of fright but a shared time for communities to come together, reflect on traditions, and celebrate connection.
Pattern: [Theme/subject] + [assertion of broader meaning or social value] + [optional qualifier or takeaway]
Function: Wrap up the discussion by restating the central idea and highlighting the social significance or universal takeaway.

Enhancement Details:
Question: What is the central message or theme of the Halloween celebration as described in the essay, and how can a concluding sentence best restate this theme?
Answer: The central theme described is that Halloween is more than just a horror celebration; it is a time for people to gather, celebrate with costumes, decorations, tricks or treats, and shared activities with neighbors and friends. A concluding sentence that restates this theme could be: "Halloween is not only about spookiness, but about coming together with others to celebrate, decorate, and share moments of fun and community."

Question: What key details from the paragraph should be summarized to reinforce the idea that Halloween is about more than horror and includes gathering with others, decorations, and varied celebrations?
Answer: The essay states that Halloween is not just about horror but also involves: - gathering with others (people gathering, families and neighbors during celebrations) - decorations (house decorations such as carved pumpkins, spider webs, ghost lamps, inside and outside decorations) - varied celebrations (costume parties, tricks or treats, games, eating and drinking, watching horror or thriller movies) These points reinforce that Halloween includes social gatherings, decorations, and a variety of celebration styles beyond scariness.



Question: What is the central message or theme of the Halloween celebration as described in the essay, and how can a concluding sentence best restate this theme?
Answer: No related information.

Question: What key details from the paragraph should be summarized to reinforce the idea that Halloween is about more than horror and includes gathering with others, decorations, and varied celebrations?
Answer: No related information.

Question: Which transitional or concluding phrasing would most effectively tie together the ideas of costumes, tricks, decorations, activities, and the communal aspect to end the paragraph with a strong restatement?
Answer: No related information.



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
        actual_output="In short Halloween brings people together through costumes, trick-or-treating, decorations, and parties to enjoy a creative, spooky, and fun atmosphere.",
        expected_output="In short, Halloween is a symbol that related to horror and mystic event. And it's really popular and fun.",
        #retrieval_context=["All customers are eligible for a 30 day full refund at no extra costs."]
        
    )
    assert_test(test_case, [correctness_metric])