import tiktoken
import pandas as pd
import re
import os

from graphrag.query.indexer_adapters import read_indexer_entities, read_indexer_reports
from graphrag.query.llm.oai.chat_openai import ChatOpenAI
from graphrag.query.llm.oai.embedding import OpenAIEmbedding

from graphrag.query.llm.oai.typing import OpenaiApiType

from graphrag.query.structured_search.global_search.community_context import (
    GlobalCommunityContext,
)
from graphrag.query.structured_search.global_search.search import GlobalSearch

from graphrag.query.structured_search.local_search.mixed_context import (
    LocalSearchMixedContext,
)
from graphrag.query.structured_search.local_search.search import LocalSearch
from graphrag.vector_stores.lancedb import LanceDBVectorStore
from graphrag.query.context_builder.entity_extraction import EntityVectorStoreKey
from graphrag.query.indexer_adapters import (
    read_indexer_covariates,
    read_indexer_entities,
    read_indexer_relationships,
    read_indexer_reports,
    read_indexer_text_units,
)
from graphrag.query.input.loaders.dfs import (
    store_entity_semantic_embeddings,
)

api_key = "" #Set your OpenAI or Azure OpenAI API key here
llm_model = "gpt-4o-mini" #Set your LLM model here
embedding_model = "text-embedding-3-small" #Set your embedding model here
llm = ChatOpenAI(
    api_key=api_key,
    model=llm_model,
    api_type=OpenaiApiType.OpenAI,  # OpenaiApiType.OpenAI or OpenaiApiType.AzureOpenAI
    max_retries=20,
)
# 將原有的 text_embedder 初始化改為：
text_embedder = OpenAIEmbedding(
    api_key=api_key,
    api_base=None,
    api_type=OpenaiApiType.OpenAI,
    model=embedding_model,
    deployment_name=embedding_model,
    max_retries=20,
)
token_encoder = tiktoken.get_encoding("cl100k_base")


# 定義基礎路徑
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GRAPHRAG_DIR = os.path.join(BASE_DIR, "graphRAG")

# 添加除錯訊息
print(f"BASE_DIR: {BASE_DIR}")
print(f"GRAPHRAG_DIR: {GRAPHRAG_DIR}")

INPUT_DIR = os.path.join(GRAPHRAG_DIR, "output", "20250311-012701", "artifacts")   # 請根據實際情況修改路徑
print(f"INPUT_DIR: {INPUT_DIR}")

# 驗證路徑是否存在
if not os.path.exists(INPUT_DIR):
    raise FileNotFoundError(f"找不到資料夾路徑: {INPUT_DIR}")

LANCEDB_URI = f"{INPUT_DIR}/lancedb"

# parquet files generated from indexing pipeline
COMMUNITY_REPORT_TABLE = "create_final_community_reports"
ENTITY_TABLE = "create_final_nodes"
ENTITY_EMBEDDING_TABLE = "create_final_entities"
RELATIONSHIP_TABLE = "create_final_relationships"
COVARIATE_TABLE = "create_final_covariates"
TEXT_UNIT_TABLE = "create_final_text_units"
COMMUNITY_TABLE = "create_final_communities"

# community level in the Leiden community hierarchy from which we will load the community reports
# higher value means we use reports from more fine-grained communities (at the cost of higher computation cost)
COMMUNITY_LEVEL = 2


# read nodes table to get community and degree data
entity_df = pd.read_parquet(f"{INPUT_DIR}/{ENTITY_TABLE}.parquet")
report_df = pd.read_parquet(f"{INPUT_DIR}/{COMMUNITY_REPORT_TABLE}.parquet")
relationship_df = pd.read_parquet(f"{INPUT_DIR}/{RELATIONSHIP_TABLE}.parquet")
text_unit_df = pd.read_parquet(f"{INPUT_DIR}/{TEXT_UNIT_TABLE}.parquet")
entity_embedding_df = pd.read_parquet(f"{INPUT_DIR}/{ENTITY_EMBEDDING_TABLE}.parquet")
community_df= pd.read_parquet(f"{INPUT_DIR}/{COMMUNITY_TABLE}.parquet")

reports = read_indexer_reports(report_df, entity_df, COMMUNITY_LEVEL)
entities = read_indexer_entities(entity_df, entity_embedding_df, COMMUNITY_LEVEL)
relationships = read_indexer_relationships(relationship_df)
text_units = read_indexer_text_units(text_unit_df)

# load description embeddings to an in-memory lancedb vectorstore
# to connect to a remote db, specify url and port values.
description_embedding_store = LanceDBVectorStore(
    collection_name="entity_description_embeddings",
)
description_embedding_store.connect(db_uri=LANCEDB_URI)
entity_description_embeddings = store_entity_semantic_embeddings(
    entities=entities, vectorstore=description_embedding_store
)


# Global serach is used to answer questions which need the complete dataset understanding for questions like "What are top 10 themes in articles"
context_builder = GlobalCommunityContext(
    community_reports=reports,
    entities=entities,  # default to None if you don't want to use community weights for ranking
    token_encoder=token_encoder,
)

context_builder_params = {
    "use_community_summary": False,  # False means using full community reports. True means using community short summaries.
    "shuffle_data": True,
    "include_community_rank": True,
    "min_community_rank": 0,
    "community_rank_name": "rank",
    "include_community_weight": True,
    "community_weight_name": "occurrence weight",
    "normalize_community_weight": True,
    "max_tokens": 12_000,  # change this based on the token limit you have on your model (if you are using a model with 8k limit, a good setting could be 5000)
    "context_name": "Reports",
}

map_llm_params = {
    "max_tokens": 1000,
    "temperature": 0.0,
    "response_format": {"type": "json_object"},
}

reduce_llm_params = {
    "max_tokens": 2000,  # change this based on the token limit you have on your model (if you are using a model with 8k limit, a good setting could be 1000-1500)
    "temperature": 0.0,
}

global_search_engine = GlobalSearch(
    llm=llm,
    context_builder=context_builder,
    token_encoder=token_encoder,
    max_data_tokens=12_000,  # change this based on the token limit you have on your model (if you are using a model with 8k limit, a good setting could be 5000)
    map_llm_params=map_llm_params,
    reduce_llm_params=reduce_llm_params,
    allow_general_knowledge=False,  # set this to True will add instruction to encourage the LLM to incorporate general knowledge in the response, which may increase hallucinations, but could be useful in some use cases.
    json_mode=True,  # set this to False if your LLM model does not support JSON mode.
    context_builder_params=context_builder_params,
    concurrent_coroutines=32,
    response_type="single paragraph",  # free form text describing the response type and format, can be anything, e.g. prioritized list, single paragraph, multiple paragraphs, multiple-page report
)


# 定義異步函數，接收問題並返回搜尋結果
async def global_search(question: str) -> any:
    result = await global_search_engine.asearch(question)
    answer = re.sub(r' \[.*?\]', '', result.response).strip()
    return answer

# 使用示例
async def main():
    question = """Introducing Indonesia's Independence Day"""
    result = await global_search_engine.asearch(question)
    answer = re.sub(r' \[.*?\]', '', result.response).strip()
    print(answer)

# 當你需要執行 main 函數時，可以使用以下代碼
if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
