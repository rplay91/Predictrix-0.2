import os
import pandas as pd
import asyncio
import tiktoken

from graphrag.query.indexer_adapters import (
    read_indexer_entities,
    read_indexer_reports,
)
from graphrag.query.llm.oai.chat_openai import ChatOpenAI
from graphrag.query.structured_search.global_search.community_context import (
    GlobalCommunityContext,
)
from graphrag.query.structured_search.global_search.search import GlobalSearch

from api_config import GPT_API_KEY as OPENAI_API_KEY


def setup_search_engine(input_dir: str = "graphRAG/output", community_level: int = 2):
    """Initialize the GraphRAG search engine for global search."""
    llm = ChatOpenAI(
        api_key=OPENAI_API_KEY,
        model="gpt-4.1",
        max_retries=20,
    )
    token_encoder = tiktoken.get_encoding("cl100k_base")

    entity_df = pd.read_parquet(f"{input_dir}/entities.parquet")
    community_df = pd.read_parquet(f"{input_dir}/communities.parquet")
    report_df = pd.read_parquet(f"{input_dir}/community_reports.parquet")

    reports = read_indexer_reports(report_df, community_df, community_level)
    entities = read_indexer_entities(entity_df, community_df, community_level)

    context_builder = GlobalCommunityContext(
        community_reports=reports,
        entities=entities,
        token_encoder=token_encoder,
    )

    context_builder_params = {
        "use_community_summary": False,
        "shuffle_data": True,
        "include_community_rank": True,
        "min_community_rank": 0,
        "community_rank_name": "rank",
        "include_community_weight": True,
        "community_weight_name": "occurrence weight",
        "normalize_community_weight": True,
        "max_tokens": 12_000,
        "context_name": "Reports",
    }

    map_llm_params = {
        "max_tokens": 1000,
        "temperature": 0.0,
        "response_format": {"type": "json_object"},
    }

    reduce_llm_params = {
        "max_tokens": 2000,
        "temperature": 0.0,
    }

    search_engine = GlobalSearch(
        llm=llm,
        context_builder=context_builder,
        token_encoder=token_encoder,
        max_data_tokens=12_000,
        map_llm_params=map_llm_params,
        reduce_llm_params=reduce_llm_params,
        allow_general_knowledge=False,
        json_mode=True,
        context_builder_params=context_builder_params,
        concurrent_coroutines=32,
        response_type="multiple paragraphs",
    )

    return search_engine


async def _async_search(engine, query: str):
    result = await engine.search(query)
    return result.response


def search_graph(query: str, input_dir: str = "graphRAG/output") -> str:
    engine = setup_search_engine(input_dir)

    async def run_query():
        result = await engine.search(query)
        return result.response

    try:
        return asyncio.run(run_query())
    except RuntimeError:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            return loop.create_task(run_query())
        else:
            return loop.run_until_complete(run_query())
