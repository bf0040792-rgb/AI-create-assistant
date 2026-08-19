import os
import time
from local_gguf_provider import LocalGGUFProvider

class ModelManager:
    def __init__(self):
        self.status = "unloaded"
        self.provider = None
        self.model_path = os.getenv("AI_MODEL_PATH", "models/model.gguf")
        
        profile = os.getenv("AI_HARDWARE_PROFILE", "Balanced")
        if profile == "Low":
            self.ctx = 2048
            self.threads = 2
            self.max_tokens = 512
        elif profile == "High":
            self.ctx = 8192
            self.threads = 0 # Auto
            self.max_tokens = 2048
        else:
            self.ctx = 4096
            self.threads = 4
            self.max_tokens = 1024
            
        self.ctx = int(os.getenv("AI_MODEL_CONTEXT_SIZE", self.ctx))
        self.threads = int(os.getenv("AI_MODEL_THREADS", self.threads))
        self.max_tokens = int(os.getenv("AI_MODEL_MAX_TOKENS", self.max_tokens))
        self.load_time = 0.0

    def load_model(self):
        if self.status == "loading":
            raise Exception("Model is already loading.")
        if self.status == "ready":
            return
            
        if not os.path.exists(self.model_path):
            self.status = "error"
            raise FileNotFoundError(f"Model file not found at {self.model_path}. Please download a valid GGUF file.")
            
        self.status = "loading"
        try:
            start_time = time.time()
            self.provider = LocalGGUFProvider(self.model_path, self.ctx, self.threads)
            self.load_time = time.time() - start_time
            self.status = "ready"
        except Exception as e:
            self.status = "error"
            self.provider = None
            raise e

    def unload_model(self):
        self.status = "unloaded"
        self.provider = None
        self.load_time = 0.0

    def get_status(self):
        return {
            "status": self.status,
            "loaded": self.status == "ready",
            "model_path": os.path.basename(self.model_path), # Hide absolute path
            "context_size": self.ctx,
            "max_tokens": self.max_tokens,
            "load_time": round(self.load_time, 2)
        }

model_manager = ModelManager()
