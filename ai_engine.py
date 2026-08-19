import os
import json
from model_manager import model_manager

class AIEngine:
    def __init__(self):
        pass

    def _build_context(self, request_data: dict) -> list:
        """Builds a ChatML / standard role-based message list for the model."""
        msg = request_data.get("message", "")
        system_instructions = request_data.get("system_instructions", "")
        model_settings = request_data.get("model_settings", {})
        prefs = request_data.get("preferences", {})
        chat_history = request_data.get("chat_history", [])
        
        # Build dynamic system prompt
        sys_prompt = f"Identity: Your name is {model_settings.get('ai_name', 'Assistant')}. Your role is {model_settings.get('ai_role', 'Helpful Assistant')}.\n"
        sys_prompt += f"Personality: {model_settings.get('ai_personality', 'Professional')}.\n"
        sys_prompt += f"Instructions: {system_instructions}\n"
        sys_prompt += f"Preferences: Respond in {prefs.get('preferred_language', 'English')}, prefer {prefs.get('preferred_coding_language', 'Python/JS')} for code."

        messages = [{"role": "system", "content": sys_prompt}]
        
        # Add history (limit to last N to save context, very basic trimming)
        # Ideally, we would count tokens here. For Phase 3, we just slice the last 10 messages.
        for h in chat_history[-10:]:
            messages.append({"role": h["role"], "content": h["content"]})
            
        # Add current user message
        messages.append({"role": "user", "content": msg})
        return messages

    async def generate_response(self, request_data: dict) -> str:
        """Standard synchronous response from the self-hosted model."""
        if model_manager.status != "ready":
            raise Exception("Model is not loaded or unavailable.")
            
        messages = self._build_context(request_data)
        
        temp = request_data.get("model_settings", {}).get("temperature", 0.7)
        top_p = request_data.get("model_settings", {}).get("top_p", 0.9)
        
        return model_manager.provider.generate_chat(
            messages=messages, 
            max_tokens=model_manager.max_tokens, 
            temperature=temp, 
            top_p=top_p
        )

    async def generate_response_stream(self, request_data: dict):
        """Generator yielding SSE formatted strings for FastAPI StreamingResponse."""
        if model_manager.status != "ready":
            yield f"data: {json.dumps({'error': 'Model is not loaded or unavailable.'})}\n\n"
            return
            
        messages = self._build_context(request_data)
        temp = request_data.get("model_settings", {}).get("temperature", 0.7)
        top_p = request_data.get("model_settings", {}).get("top_p", 0.9)
        
        try:
            for text_chunk in model_manager.provider.generate_chat_stream(
                messages=messages, 
                max_tokens=model_manager.max_tokens, 
                temperature=temp, 
                top_p=top_p
            ):
                # Send SSE data event
                yield f"data: {json.dumps({'text': text_chunk})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
            
        # Send completion event
        yield f"data: [DONE]\n\n"

    async def generate_prompt(self, request_data: dict) -> str:
        if model_manager.status != "ready":
            return "Error: AI Model is not loaded. Cannot generate prompt."
            
        user_msg = f"Generate a {request_data.get('type')} for a {request_data.get('category')} (Detail: {request_data.get('detail')}).\nIdea: {request_data.get('idea')}"
        sys_msg = f"Act as an expert {request_data.get('target', 'AI')}. Output in structured Markdown: 1. Role, 2. Core Features, 3. Requirements, 4. Tech Stack, 5. Output Format."
        
        messages = [
            {"role": "system", "content": sys_msg},
            {"role": "user", "content": user_msg}
        ]
        
        return model_manager.provider.generate_chat(messages, max_tokens=model_manager.max_tokens, temperature=0.7, top_p=0.9)

    async def generate_code(self, request_data: dict) -> str:
        if model_manager.status != "ready":
            return "/* Error: AI Model is not loaded. Cannot generate code. */"
            
        sys_msg = "You are an expert code generator. Output ONLY clean, working code without conversational filler. Use the requested language and style."
        user_msg = f"Language: {request_data.get('language')}\nType: {request_data.get('project_type')}\nStyle: {request_data.get('style')}\nTarget: {request_data.get('device')}\nRequest: {request_data.get('request')}"
        
        messages = [
            {"role": "system", "content": sys_msg},
            {"role": "user", "content": user_msg}
        ]
        
        return model_manager.provider.generate_chat(messages, max_tokens=model_manager.max_tokens, temperature=0.2, top_p=0.95)

ai_engine = AIEngine()
