import os
import pandas as pd
import asyncio

from graphrag.config.enums import ModelType
from graphrag.config.models.language_model_config import LanguageModelConfig
from graphrag.language_model.manager import ModelManager
from graphrag.query.indexer_adapters import (
    read_indexer_communities,
    read_indexer_entities,
    read_indexer_reports,
)
from graphrag.query.structured_search.global_search.community_context import (
    GlobalCommunityContext,
)
from graphrag.query.structured_search.global_search.search import GlobalSearch
from graphrag.tokenizer.get_tokenizer import get_tokenizer


# === 🗝️ Hardcoded API Key (ganti sesuai milikmu) ===
OPENAI_API_KEY = "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"


def setup_search_engine(input_dir: str = "graphRAG/output", community_level: int = 2):
    """Initialize the GraphRAG search engine for global search."""
    # === Model configuration ===
    config = LanguageModelConfig(
        api_key=OPENAI_API_KEY,
        type=ModelType.Chat,
        model_provider="openai",
        model="gpt-4.1",
        max_retries=20,
    )
    model = ModelManager().get_or_create_chat_model(
        name="global_search",
        model_type=ModelType.Chat,
        config=config,
    )
    tokenizer = get_tokenizer(config)

    # === Load Parquet index files ===
    community_df = pd.read_parquet(f"{input_dir}/communities.parquet")
    entity_df = pd.read_parquet(f"{input_dir}/entities.parquet")
    report_df = pd.read_parquet(f"{input_dir}/community_reports.parquet")

    communities = read_indexer_communities(community_df, report_df)
    reports = read_indexer_reports(report_df, community_df, community_level)
    entities = read_indexer_entities(entity_df, community_df, community_level)

    # === Context Builder ===
    context_builder = GlobalCommunityContext(
        community_reports=reports,
        communities=communities,
        entities=entities,
        tokenizer=tokenizer,
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

    # === Build search engine ===
    search_engine = GlobalSearch(
        model=model,
        context_builder=context_builder,
        tokenizer=tokenizer,
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
    """Internal async search function."""
    result = await engine.search(query)
    return result.response


def search_graph(query: str, input_dir: str = "graphRAG/output") -> str:
    """Public function to perform global search with GraphRAG."""
    engine = setup_search_engine(input_dir)

    async def run_query():
        result = await engine.search(query)
        return result.response

    try:
        # ✅ Jika tidak ada event loop aktif
        return asyncio.run(run_query())
    except RuntimeError:
        # ✅ Jika sudah ada event loop aktif (misalnya di FastAPI)
        loop = asyncio.get_event_loop()
        if loop.is_running():
            return loop.create_task(run_query())  # return coroutine task
        else:
            return loop.run_until_complete(run_query())
