from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Float
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class Chat(Base):
    __tablename__ = "chats"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, default="New Chat")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    messages = relationship("Message", back_populates="chat", cascade="all, delete-orphan")

class Message(Base):
    __tablename__ = "messages"
    id = Column(Integer, primary_key=True, index=True)
    chat_id = Column(Integer, ForeignKey("chats.id"))
    role = Column(String)  # user, assistant, system
    content = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    chat = relationship("Chat", back_populates="messages")

class AppSettings(Base):
    __tablename__ = "app_settings"
    id = Column(Integer, primary_key=True, index=True)
    theme = Column(String, default="dark")
    ai_name = Column(String, default="Create Assistant")
    ai_role = Column(String, default="Senior Developer & Architect")
    ai_personality = Column(String, default="Professional, helpful, and concise")
    ai_purpose = Column(String, default="To assist in building software and digital products.")
    system_instructions = Column(Text, default="You are a Senior Frontend Engineer and AI Product Architect.")
    temperature = Column(Float, default=0.7)
    creativity = Column(Float, default=0.7)
    precision = Column(Float, default=0.8)
    response_length = Column(String, default="Balanced")
    context_mode = Column(String, default="Full History")
    preferred_language = Column(String, default="en")
    preferred_coding_language = Column(String, default="JavaScript")
    response_style = Column(String, default="Standard")

class SavedPrompt(Base):
    __tablename__ = "saved_prompts"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String)
    content = Column(Text)
    category = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

class CodeHistory(Base):
    __tablename__ = "code_history"
    id = Column(Integer, primary_key=True, index=True)
    language = Column(String)
    project_type = Column(String)
    request = Column(Text)
    generated_code = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

class KnowledgeFile(Base):
    __tablename__ = "knowledge_files"
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String)
    stored_filename = Column(String)
    category = Column(String)
    content_type = Column(String)
    size = Column(Integer)
    uploaded_at = Column(DateTime, default=datetime.utcnow)
