from sqlalchemy.orm import Session
import models
import schemas

def get_settings(db: Session):
    settings = db.query(models.AppSettings).first()
    if not settings:
        settings = models.AppSettings()
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings

def update_settings(db: Session, settings_data: schemas.AppSettingsSchema):
    settings = get_settings(db)
    for key, value in settings_data.dict().items():
        setattr(settings, key, value)
    db.commit()
    db.refresh(settings)
    return settings

def reset_settings(db: Session):
    db.query(models.AppSettings).delete()
    db.commit()
    return get_settings(db)

def get_chats(db: Session):
    return db.query(models.Chat).order_by(models.Chat.updated_at.desc()).all()

def get_chat(db: Session, chat_id: int):
    return db.query(models.Chat).filter(models.Chat.id == chat_id).first()

def create_chat(db: Session, title: str):
    chat = models.Chat(title=title)
    db.add(chat)
    db.commit()
    db.refresh(chat)
    return chat

def delete_chat(db: Session, chat_id: int):
    chat = get_chat(db, chat_id)
    if chat:
        db.delete(chat)
        db.commit()

def clear_messages(db: Session, chat_id: int):
    db.query(models.Message).filter(models.Message.chat_id == chat_id).delete()
    db.commit()

def add_message(db: Session, chat_id: int, role: str, content: str):
    message = models.Message(chat_id=chat_id, role=role, content=content)
    db.add(message)
    chat = get_chat(db, chat_id)
    if chat:
        # Auto rename if first message
        if chat.title == "New Chat" and role == "user":
            chat.title = content[:25] + "..." if len(content) > 25 else content
    db.commit()
    db.refresh(message)
    return message

def get_prompts(db: Session):
    return db.query(models.SavedPrompt).order_by(models.SavedPrompt.created_at.desc()).all()

def add_prompt(db: Session, data: schemas.PromptCreateRequest):
    prompt = models.SavedPrompt(**data.dict())
    db.add(prompt)
    db.commit()
    db.refresh(prompt)
    return prompt

def delete_prompt(db: Session, prompt_id: int):
    db.query(models.SavedPrompt).filter(models.SavedPrompt.id == prompt_id).delete()
    db.commit()

def get_code_history(db: Session):
    return db.query(models.CodeHistory).order_by(models.CodeHistory.created_at.desc()).all()

def add_code_history(db: Session, data: schemas.CodeResponse):
    history = models.CodeHistory(
        language=data.language,
        project_type=data.project_type,
        request=data.request,
        generated_code=data.generated_code
    )
    db.add(history)
    db.commit()
    db.refresh(history)
    return history

def delete_code_history(db: Session, history_id: int):
    db.query(models.CodeHistory).filter(models.CodeHistory.id == history_id).delete()
    db.commit()

def add_knowledge_file(db: Session, filename: str, stored_filename: str, category: str, content_type: str, size: int):
    f = models.KnowledgeFile(
        filename=filename, stored_filename=stored_filename, category=category, content_type=content_type, size=size
    )
    db.add(f)
    db.commit()
    db.refresh(f)
    return f

def get_knowledge_files(db: Session):
    return db.query(models.KnowledgeFile).order_by(models.KnowledgeFile.uploaded_at.desc()).all()

def delete_knowledge_file(db: Session, file_id: int):
    f = db.query(models.KnowledgeFile).filter(models.KnowledgeFile.id == file_id).first()
    if f:
        db.delete(f)
        db.commit()
    return f
