from NodeRAG import NodeConfig, NodeSearch
import time

# Load configuration from the main folder
config = NodeConfig.from_main_folder(r"D:\Master-Degree\NodeRAG-test")

# Initialize search engine
start_search = time.time()
search = NodeSearch(config)
end_search = time.time()
elapsed_time = end_search - start_search
print(f"Elapsed time: {elapsed_time:.4f} seconds")

# Query the system
ans = search.answer('who is harry potter?')

# 'ans' is an object with several accessible attributes:

# Response: the generated answer to your question
print(ans.response)

# # Number of tokens in the answer
# print(ans.response_tokens)

# # Retrieval info: the context used to generate the answer
# print(ans.retrieval_info)

# # Number of tokens in the retrieval context
# print(ans.retrieval_tokens)
