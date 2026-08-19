import asyncio

class AIEngine:
    async def generate_response(self, request_data: dict) -> str:
        """
        Mock AI Engine Interface for Phase 2.
        This will be replaced by a real self-hosted AI model in Phase 3.
        """
        # Simulate network delay
        await asyncio.sleep(1.0)
        
        msg = request_data.get("message", "").lower()
        model_settings = request_data.get("model_settings", {})
        ai_name = model_settings.get("ai_name", "AI")
        ai_role = model_settings.get("ai_role", "Assistant")
        
        if "hello" in msg or "hi" in msg:
            return f"Hello there! I am {ai_name}, your {ai_role}. How can I help you create today?"
        
        if "code" in msg or "script" in msg or "function" in msg:
            return f"Certainly! Based on your request, here is a conceptual structure:\n\n```python\n# Implementation for: {request_data.get('message')}\ndef init_feature():\n    print('Feature initialized securely.')\n    pass\n```\n\nLet me know if you want to refine this!"
            
        if "prompt" in msg:
            return "I can help you craft the perfect prompt. I recommend heading over to the **Prompt Studio** section where we can break down your requirements into a Master Prompt."
            
        if "plan" in msg or "idea" in msg or "app" in msg:
            return "That sounds like a great idea. Here is a high-level plan for your application:\n\n1. **Phase 1: Foundation** - Setup basic UI and State.\n2. **Phase 2: Backend Logic** - Implement main functionality.\n3. **Phase 3: AI Integration** - Polish intelligence.\n\nWould you like me to generate specific prompts or code for Phase 1?"
            
        return f"I understand you are asking about: \"{request_data.get('message')}\". As a {ai_role}, I recommend we define clear requirements first. \n\n*Note: This is a simulated backend response. Real model integration will occur in the next phase.*"

    async def generate_prompt(self, request_data: dict) -> str:
        # Deterministic prompt generation
        return f"""Act as an expert {request_data.get('target', 'General AI')}. Your objective is to design a {request_data.get('type', 'Detailed Prompt')} for a {request_data.get('category', 'Project')}.

[IDEA]
{request_data.get('idea', '')}

[REQUIREMENTS]
- Detail Level: {request_data.get('detail', 'Detailed')}
- Include comprehensive Feature List
- Outline Technical Requirements
- Specify UI/UX expectations

Please provide the output in a structured markdown format containing:
1. Project Role & Objective
2. Core Features
3. Functional Requirements
4. Technical Stack Recommendations
5. Expected Output Format"""

    async def generate_code(self, request_data: dict) -> str:
        lang = request_data.get('language', 'JavaScript')
        ptype = request_data.get('project_type', 'Component')
        style = request_data.get('style', 'Modern')
        request = request_data.get('request', '')
        
        if "HTML" in lang:
            return f"""<!-- Generated {ptype} -->\n<div class="{style.lower().replace(' ', '-')}-container">\n  <h1>{ptype}</h1>\n  <p>Based on request: {request}</p>\n  <button class="btn-primary">Action</button>\n</div>"""
        elif "Python" in lang:
            return f"""# Generated {ptype}\n# Style preference: {style}\n\ndef process_{ptype.lower().replace(' ', '_')}():\n    \"\"\"\n    Implements: {request}\n    \"\"\"\n    print("Initializing {ptype}...")\n    # TODO: Implement core logic\n    return True\n\nif __name__ == "__main__":\n    process_{ptype.lower().replace(' ', '_')}()"""
        else:
            return f"""// Generated {ptype} in {lang}\n// Request: {request}\n\nclass {ptype.replace(' ', '')} {{\n  constructor() {{\n    this.style = "{style}";\n    this.init();\n  }}\n\n  init() {{\n    console.log('{ptype} initialized.');\n  }}\n}}\n\nexport default {ptype.replace(' ', '')};"""

ai_engine = AIEngine()
