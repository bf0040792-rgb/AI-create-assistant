import os
import uuid
from typing import List
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from datetime import datetime

import models
import schemas
import services
from database import engine, get_db, Base
from ai_engine import ai_engine
from config import settings

# Create DB Tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="AI Create Assistant API", version="1.0")

# CORS for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------
# Health Check
# ---------------------------------------------------------
@app.get("/api/health")
def health_check():
    return {
        "status": "online",
        "service": "AI Create Assistant Backend",
        "version": "1.0"
    }

# ---------------------------------------------------------
# Chat Endpoints
# ---------------------------------------------------------
@app.get("/api/chats", response_model=List[schemas.ChatResponse])
def get_chats(db: Session = Depends(get_db)):
    return services.get_chats(db)

@app.get("/api/chats/{chat_id}", response_model=schemas.ChatResponse)
def get_chat(chat_id: int, db: Session = Depends(get_db)):
    chat = services.get_chat(db, chat_id)
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    return chat

@app.post("/api/chats", response_model=schemas.ChatResponse)
def create_chat(title: str = "New Chat", db: Session = Depends(get_db)):
    return services.create_chat(db, title)

@app.delete("/api/chats/{chat_id}")
def delete_chat(chat_id: int, db: Session = Depends(get_db)):
    services.delete_chat(db, chat_id)
    return {"success": True}

@app.delete("/api/chats/{chat_id}/messages")
def clear_messages(chat_id: int, db: Session = Depends(get_db)):
    services.clear_messages(db, chat_id)
    return {"success": True}

@app.post("/api/chat")
async def chat_interaction(req: schemas.ChatCreateRequest, db: Session = Depends(get_db)):
    if not req.message:
        raise HTTPException(status_code=400, detail="Message is empty")
    
    chat_id = req.chat_id
    if not chat_id:
        chat = services.create_chat(db, "New Chat")
        chat_id = chat.id
    
    # Save user msg
    user_msg = services.add_message(db, chat_id, "user", req.message)
    
    # Load state
    app_settings = services.get_settings(db)
    
    # Build AI request obj
    ai_request = {
        "message": req.message,
        "chat_id": chat_id,
        "system_instructions": app_settings.system_instructions,
        "preferences": {
            "preferred_language": app_settings.preferred_language,
            "preferred_coding_language": app_settings.preferred_coding_language
        },
        "model_settings": {
            "ai_name": app_settings.ai_name,
            "ai_role": app_settings.ai_role,
            "temperature": app_settings.temperature
        }
    }
    
    # Generate AI Response (Mock for Phase 2)
    ai_text = await ai_engine.generate_response(ai_request)
    
    # Save AI msg
    ai_msg = services.add_message(db, chat_id, "assistant", ai_text)
    
    return {
        "chat_id": chat_id,
        "user_message": user_msg,
        "assistant_message": ai_msg
    }

# ---------------------------------------------------------
# Settings API
# ---------------------------------------------------------
@app.get("/api/settings", response_model=schemas.AppSettingsSchema)
def get_settings(db: Session = Depends(get_db)):
    return services.get_settings(db)

@app.put("/api/settings", response_model=schemas.AppSettingsSchema)
def update_settings(settings_data: schemas.AppSettingsSchema, db: Session = Depends(get_db)):
    return services.update_settings(db, settings_data)

@app.post("/api/settings/reset", response_model=schemas.AppSettingsSchema)
def reset_settings(db: Session = Depends(get_db)):
    return services.reset_settings(db)

# ---------------------------------------------------------
# Prompt Studio
# ---------------------------------------------------------
@app.post("/api/prompts/generate")
async def generate_prompt(req: schemas.PromptGenerateRequest):
    content = await ai_engine.generate_prompt(req.dict())
    return {"content": content}

@app.get("/api/prompts", response_model=List[schemas.PromptResponse])
def get_prompts(db: Session = Depends(get_db)):
    return services.get_prompts(db)

@app.post("/api/prompts", response_model=schemas.PromptResponse)
def add_prompt(req: schemas.PromptCreateRequest, db: Session = Depends(get_db)):
    return services.add_prompt(db, req)

@app.delete("/api/prompts/{prompt_id}")
def delete_prompt(prompt_id: int, db: Session = Depends(get_db)):
    services.delete_prompt(db, prompt_id)
    return {"success": True}

# ---------------------------------------------------------
# Code Generator
# ---------------------------------------------------------
@app.post("/api/code/generate", response_model=schemas.CodeResponse)
async def generate_code(req: schemas.CodeGenerateRequest, db: Session = Depends(get_db)):
    content = await ai_engine.generate_code(req.dict())
    response_data = schemas.CodeResponse(
        id=0, language=req.language, project_type=req.project_type, 
        request=req.request, generated_code=content, created_at=datetime.utcnow()
    )
    return services.add_code_history(db, response_data)

@app.get("/api/code/history")
def get_code_history(db: Session = Depends(get_db)):
    return services.get_code_history(db)

@app.delete("/api/code/history/{history_id}")
def delete_code_history(history_id: int, db: Session = Depends(get_db)):
    services.delete_code_history(db, history_id)
    return {"success": True}

# ---------------------------------------------------------
# Knowledge Hub
# ---------------------------------------------------------
@app.post("/api/knowledge/upload")
async def upload_knowledge(file: UploadFile = File(...), category: str = Form("General"), db: Session = Depends(get_db)):
    if file.size > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large")
    
    ext = file.filename.split('.')[-1] if '.' in file.filename else ''
    stored_filename = f"{uuid.uuid4().hex}.{ext}"
    os.makedirs("uploads", exist_ok=True)
    file_path = os.path.join("uploads", stored_filename)
    
    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)
        
    kfile = services.add_knowledge_file(db, file.filename, stored_filename, category, file.content_type, len(content))
    return kfile

@app.get("/api/knowledge", response_model=List[schemas.KnowledgeFileResponse])
def get_knowledge(db: Session = Depends(get_db)):
    return services.get_knowledge_files(db)

@app.delete("/api/knowledge/{file_id}")
def delete_knowledge(file_id: int, db: Session = Depends(get_db)):
    kfile = services.delete_knowledge_file(db, file_id)
    if kfile:
        try:
            os.remove(os.path.join("uploads", kfile.stored_filename))
        except:
            pass
    return {"success": True}

# ---------------------------------------------------------
# Export & Import
# ---------------------------------------------------------
@app.get("/api/export")
def export_data(db: Session = Depends(get_db)):
    settings = services.get_settings(db)
    chats = services.get_chats(db)
    prompts = services.get_prompts(db)
    history = services.get_code_history(db)
    return {
        "settings": {c.name: getattr(settings, c.name) for c in models.AppSettings.__table__.columns},
        "chats": [{"id": c.id, "title": c.title, "messages": [{"role": m.role, "content": m.content} for m in c.messages]} for c in chats],
        "saved_prompts": [{"title": p.title, "content": p.content, "category": p.category} for p in prompts],
        "code_history": [{"language": h.language, "project_type": h.project_type, "request": h.request, "generated_code": h.generated_code} for h in history]
    }

@app.post("/api/import")
def import_data(data: schemas.ImportData, db: Session = Depends(get_db)):
    # Very basic import logic for phase 2
    if data.settings:
        services.update_settings(db, data.settings)
    if data.saved_prompts:
        for p in data.saved_prompts:
            db.add(models.SavedPrompt(**p))
    if data.code_history:
        for h in data.code_history:
            db.add(models.CodeHistory(**h))
    if data.chats:
        for c in data.chats:
            chat = models.Chat(title=c.get("title", "Imported Chat"))
            db.add(chat)
            db.commit()
            for m in c.get("messages", []):
                db.add(models.Message(chat_id=chat.id, role=m.get("role"), content=m.get("content")))
    db.commit()
    return {"success": True}

# ---------------------------------------------------------
# Static File Serving (Frontend)
# ---------------------------------------------------------
@app.get("/")
def read_index():
    return FileResponse("index.html")

@app.get("/{filename}")
def read_file(filename: str):
    if filename in ["index.html", "style.css", "script.js"]:
        return FileResponse(filename)
    raise HTTPException(status_code=404)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=settings.PORT, reload=True)
