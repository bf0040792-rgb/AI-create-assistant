import threading
from llama_cpp import Llama

class LocalGGUFProvider:
    def __init__(self, model_path: str, context_size: int, threads: int):
        self.lock = threading.Lock()
        self.model_path = model_path
        self.context_size = context_size
        self.threads = threads
        
        # Load the model into memory
        self.llm = Llama(
            model_path=model_path,
            n_ctx=context_size,
            n_threads=threads if threads > 0 else None,
            verbose=False
        )

    def generate_chat(self, messages: list, max_tokens: int, temperature: float, top_p: float):
        """Standard synchronous generation"""
        with self.lock:
            res = self.llm.create_chat_completion(
                messages=messages,
                max_tokens=max_tokens,
                temperature=temperature,
                top_p=top_p
            )
            return res["choices"][0]["message"]["content"]

    def generate_chat_stream(self, messages: list, max_tokens: int, temperature: float, top_p: float):
        """Generator for SSE streaming"""
        with self.lock:
            stream = self.llm.create_chat_completion(
                messages=messages,
                max_tokens=max_tokens,
                temperature=temperature,
                top_p=top_p,
                stream=True
            )
            for chunk in stream:
                delta = chunk["choices"][0].get("delta", {})
                if "content" in delta:
                    yield delta["content"]
