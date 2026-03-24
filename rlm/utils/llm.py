"""
LLM client wrapper with cost tracking.
"""

import os
import requests
from typing import Optional, Dict, Tuple, Any

from openai import OpenAI


PRICING_PER_1M = {
    "gpt-5": (2.50, 10.00),
    "gpt-5-mini": (0.15, 0.60),
    "gpt-5-nano": (0.10, 0.40),
    "Nemotron-3-Nano-30B-A3B-IQ4_XS.gguf": (0.05, 0.20),
}

DEFAULT_LOCAL_URL = "http://localhost:8080/v1"
DEFAULT_OPENAI_MODEL = "gpt-5-mini"


def _to_float_env(name: str, default: float) -> float:
    raw = os.getenv(name)
    try:
        return float(raw) if raw is not None else default
    except (TypeError, ValueError):
        return default


def _price_for_model(model: str) -> Tuple[float, float]:
    return PRICING_PER_1M.get(model, (0.05, 0.20))


def _estimate_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    input_price, output_price = _price_for_model(model)
    return (
        input_tokens / 1_000_000 * input_price
        + output_tokens / 1_000_000 * output_price
    )


def get_llm_client(api_key: Optional[str], model: str):
    """
    Factory function to get the LLM client.

    Provider selection:
    - RLM_PROVIDER=openai: always use OpenAI API
    - RLM_PROVIDER=local: always use local OpenAI-compatible server
    - RLM_PROVIDER=auto (default):
      - If RLM_API_URL is explicitly set, try local first then fallback to OpenAI if key exists.
      - Otherwise, use OpenAI directly when API key exists.
      - If no API key, fallback to local default URL.
    """
    provider = (os.getenv("RLM_PROVIDER", "auto") or "auto").strip().lower()
    explicit_local_url = "RLM_API_URL" in os.environ
    has_openai_key = bool(api_key or os.getenv("OPENAI_API_KEY"))

    if provider == "openai":
        return OpenAIClient(api_key, model)
    if provider == "local":
        return LocalClient(api_key, model)

    if explicit_local_url:
        try:
            return LocalClient(api_key, model)
        except Exception as exc:
            if has_openai_key:
                print(f"[WARNING] Local RLM endpoint unavailable; using OpenAI provider instead: {exc}")
                return OpenAIClient(api_key, model)
            raise

    if has_openai_key:
        return OpenAIClient(api_key, model)

    return LocalClient(api_key, model)


def _extract_content(choice: Any) -> str:
    if isinstance(choice, dict):
        if "message" in choice and isinstance(choice["message"], dict):
            return str(choice["message"].get("content", "") or "")
        return str(choice.get("text", "") or "")

    message = getattr(choice, "message", None)
    if message is not None:
        content = getattr(message, "content", "")
        if isinstance(content, list):
            parts = []
            for item in content:
                if isinstance(item, dict):
                    if item.get("type") == "text":
                        parts.append(str(item.get("text", "")))
                else:
                    text = getattr(item, "text", None)
                    if text is not None:
                        parts.append(str(text))
            return "".join(parts).strip()
        return str(content or "")
    return str(getattr(choice, "text", "") or "")


class OpenAIClient:
    """OpenAI-hosted client with cost tracking."""

    def __init__(self, api_key: Optional[str], model: str):
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        if not self.api_key:
            raise ValueError("OPENAI_API_KEY is required when using OpenAI provider.")

        self.model = model
        if not self.model or self.model == "auto":
            self.model = os.getenv("RLM_OPENAI_MODEL", DEFAULT_OPENAI_MODEL)

        base_url = os.getenv("RLM_OPENAI_BASE_URL") or os.getenv("OPENAI_BASE_URL")
        if base_url:
            self.client = OpenAI(api_key=self.api_key, base_url=base_url)
        else:
            self.client = OpenAI(api_key=self.api_key)

    def completion(self, messages, **kwargs) -> str:
        response = self._make_request(messages, **kwargs)
        if not getattr(response, "choices", None):
            raise ValueError(f"Unexpected OpenAI response format: {response}")
        return _extract_content(response.choices[0])

    def completion_with_cost(self, messages, **kwargs) -> Tuple[str, Dict[str, float]]:
        response = self._make_request(messages, **kwargs)
        if not getattr(response, "choices", None):
            raise ValueError(f"Unexpected OpenAI response format: {response}")

        content = _extract_content(response.choices[0])
        usage = getattr(response, "usage", None)

        if usage is not None:
            input_tokens = int(getattr(usage, "prompt_tokens", 0) or 0)
            output_tokens = int(getattr(usage, "completion_tokens", 0) or 0)
            total_tokens = int(getattr(usage, "total_tokens", input_tokens + output_tokens) or 0)
        else:
            input_tokens = sum(len(str(msg.get("content", ""))) for msg in messages) // 4
            output_tokens = len(content) // 4
            total_tokens = input_tokens + output_tokens

        cost = _estimate_cost(self.model, input_tokens, output_tokens)
        return content, {
            "cost": cost,
            "tokens": total_tokens,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
        }

    def _make_request(self, messages, **kwargs):
        payload = {
            "model": self.model,
            "messages": messages,
        }

        max_tokens = kwargs.get("max_tokens")
        if max_tokens is not None:
            payload["max_completion_tokens"] = max_tokens

        temperature = kwargs.get("temperature")
        if temperature is not None:
            payload["temperature"] = temperature

        return self.client.chat.completions.create(**payload)


class LocalClient:
    """Local LLM client with cost tracking."""

    def __init__(self, api_key: Optional[str], model: str):
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        self.timeout = _to_float_env("RLM_CONNECT_TIMEOUT", 3.0)

        # Get API URL from environment variable or default.
        self.base_url = os.getenv("RLM_API_URL", DEFAULT_LOCAL_URL)

        # Verify connection and get available models.
        try:
            response = requests.get(f"{self.base_url}/models", timeout=self.timeout)
            if response.status_code != 200:
                raise ValueError(f"Failed to connect to local LLM server: {response.status_code}")

            models_data = response.json()
            available_models = []

            if "data" in models_data:
                for model_info in models_data["data"]:
                    available_models.append(model_info.get("id", model_info.get("model", "")))
            elif "models" in models_data:
                for model_info in models_data["models"]:
                    available_models.append(model_info.get("id", model_info.get("model", "")))
            else:
                available_models = models_data if isinstance(models_data, list) else []

            if (model is None or model == "" or model == "auto") and available_models:
                self.model = available_models[0]
                print(f"Auto-selected model: {self.model}")
            else:
                self.model = model

            if self.model not in available_models:
                print(f"Warning: Requested model '{self.model}' not found in available models: {available_models}")

        except Exception as e:
            raise ValueError(f"Failed to connect to local LLM server or retrieve models: {e}")

    def completion(self, messages, **kwargs) -> str:
        """Simple completion without cost tracking."""
        try:
            response = self._make_request(messages, **kwargs)
            if "choices" in response and len(response["choices"]) > 0:
                content = _extract_content(response["choices"][0])
            else:
                raise ValueError(f"Unexpected response format: {response}")

            return content
        except Exception as e:
            print(f"Error in completion method: {e}")
            import traceback
            traceback.print_exc()
            raise

    def completion_with_cost(
        self,
        messages,
        **kwargs
    ) -> Tuple[str, Dict[str, float]]:
        """Completion with cost tracking."""
        response = self._make_request(messages, **kwargs)

        if "choices" in response and len(response["choices"]) > 0:
            content = _extract_content(response["choices"][0])
        else:
            raise ValueError(f"Unexpected response format: {response}")

        input_tokens = sum(len(msg.get("content", "")) for msg in messages) // 4
        output_tokens = len(content) // 4
        total_tokens = input_tokens + output_tokens

        cost = _estimate_cost(self.model, input_tokens, output_tokens)

        cost_info = {
            'cost': cost,
            'tokens': total_tokens,
            'input_tokens': input_tokens,
            'output_tokens': output_tokens,
        }

        return content, cost_info

    def _make_request(self, messages, **kwargs):
        """Make a request to the local LLM API."""
        headers = {
            "Content-Type": "application/json"
        }

        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        try:
            data = {
                "model": self.model,
                "messages": messages,
                "max_tokens": kwargs.get("max_tokens", 1000),
                "temperature": kwargs.get("temperature", 0.7),
            }

            response = requests.post(
                f"{self.base_url}/chat/completions",
                headers=headers,
                json=data,
                timeout=self.timeout,
            )

            if response.status_code == 200:
                return response.json()
            else:
                print(f"Chat completions failed: {response.status_code} - {response.text}")
        except Exception as e:
            print(f"Chat completions exception: {e}")
            pass

        prompt = ""
        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            prompt += f"{role.capitalize()}: {content}\n"
        prompt += "Assistant: "

        data = {
            "model": self.model,
            "prompt": prompt,
            "max_tokens": kwargs.get("max_tokens", 1000),
            "temperature": kwargs.get("temperature", 0.7),
            "stop": kwargs.get("stop", ["User:", "Assistant:"])
        }

        response = requests.post(
            f"{self.base_url}/completions",
            headers=headers,
            json=data,
            timeout=self.timeout,
        )

        if response.status_code != 200:
            raise Exception(f"API request failed: {response.status_code} - {response.text}")

        return response.json()
