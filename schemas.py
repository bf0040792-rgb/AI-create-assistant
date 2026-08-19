from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class MessageBase(BaseModel):
    role: str
    content: str

class MessageResponse(MessageBase):
    id: int
    created_at: datetime
    class Config:
        orm_mode = True
        from_attributes = True

class ChatBase(BaseModel):
    title: str

class ChatResponse(ChatBase):
    id: int
    created_at: datetime
    updated_at: datetime
    messages: List[MessageResponse] = []
    class Config:
        orm_mode = True
        from_attributes = True

class ChatCreateRequest(BaseModel):
    message: str
    chat_id: Optional[int] = None
    stream: Optional[bool] = False

class AppSettingsSchema(BaseModel):
    theme: str
    ai_name: str
    ai_role: str
    ai_personality: str
    ai_purpose: str
    system_instructions: str
    temperature: float
    creativity: float
    precision: float
    top_p: Optional[float] = 0.9 # Added for Phase 3
    response_length: str
    context_mode: str
    preferred_language: str
    preferred_coding_language: str
    response_style: str
    class Config:
        orm_mode = True
        from_attributes = True

class PromptGenerateRequest(BaseModel):
    idea: str
    category: str
    target: str
    type: str
    detail: str

class PromptCreateRequest(BaseModel):
    title: str
    content: str
    category: str

class PromptResponse(PromptCreateRequest):
    id: int
    created_at: datetime
    class Config:
        orm_mode = True
        from_attributes = True

class CodeGenerateRequest(BaseModel):
    project_type: str
    language: str
    style: str
    device: str
    request: str

class CodeResponse(BaseModel):
    id: int
    language: str
    project_type: str
    request: str
    generated_code: str
    created_at: datetime
    class Config:
        orm_mode = True
        from_attributes = True

class KnowledgeFileResponse(BaseModel):
    id: int
    filename: str
    category: str
    size: int
    uploaded_at: datetime
    class Config:
        orm_mode = True
        from_attributes = True

class ImportData(BaseModel):
    settings: Optional[AppSettingsSchema]
    chats: Optional[List[dict]]
    saved_prompts: Optional[List[dict]]
    code_history: Optional[List[dict]]
