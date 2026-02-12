from pydantic import BaseModel, EmailStr
from typing import Optional, Dict
from datetime import datetime

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    receiver_number: Optional[str] = None
    receiver_name: Optional[str] = None

class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    receiver_number: Optional[str] = None
    receiver_name: Optional[str] = None
    
    class Config:
        from_attributes = True

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class ConversationResponse(BaseModel):
    id: int
    conversation_id: str
    agent: Optional[str]
    caller_number: Optional[str]
    receiver_number: Optional[str]
    duration: Optional[int]
    sentiment: Optional[float]
    created_at: datetime
    # Extra analysis fields for list/export views
    transcript_summary: Optional[str] = None
    data_collection_results: Optional[str] = None
    call_summary_title: Optional[str] = None
    evaluation_criteria_results: Optional[str] = None
    call_successful: Optional[str] = None
    
    class Config:
        from_attributes = True

class ConversationDetailResponse(BaseModel):
    id: int
    conversation_id: str
    agent: Optional[str]
    caller_number: Optional[str]
    receiver_number: Optional[str]
    duration: Optional[int]
    sentiment: Optional[float]
    created_at: datetime
    transcript_summary: Optional[str] = None
    data_collection_results: Optional[Dict] = None
    call_summary_title: Optional[str] = None
    evaluation_criteria_results: Optional[Dict] = None
    call_successful: Optional[str] = None
    
    class Config:
        from_attributes = True

class TranscriptResponse(BaseModel):
    id: int
    conversation_id: str
    text: str
    created_at: datetime
    
    class Config:
        from_attributes = True


class KnowledgeBaseInput(BaseModel):
    url: Optional[str] = None
    text: Optional[str] = None
    file: Optional[str] = None  # File path or URL


class AgentCreate(BaseModel):
    name: str
    system_prompt: Optional[str] = None
    first_message: Optional[str] = None
    knowledge_base: Optional[KnowledgeBaseInput] = None
    voice_id: Optional[str] = None
    language: Optional[str] = "en"
    llm_model: Optional[str] = None


class AgentUpdate(BaseModel):
    name: Optional[str] = None
    system_prompt: Optional[str] = None
    first_message: Optional[str] = None
    knowledge_base: Optional[KnowledgeBaseInput] = None
    voice_id: Optional[str] = None
    language: Optional[str] = None
    llm_model: Optional[str] = None


class AgentResponse(BaseModel):
    agent_id: str
    name: Optional[str] = None
    system_prompt: Optional[str] = None
    first_message: Optional[str] = None
    knowledge_base: Optional[Dict] = None
    voice_id: Optional[str] = None
    language: Optional[str] = None
    llm_model: Optional[str] = None
    created_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class PromptTemplateCreate(BaseModel):
    name: str
    system_prompt: str
    first_message: Optional[str] = None


class PromptTemplateUpdate(BaseModel):
    name: Optional[str] = None
    system_prompt: Optional[str] = None
    first_message: Optional[str] = None


class PromptTemplateResponse(BaseModel):
    id: int
    name: str
    system_prompt: str
    first_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class SendOtpRequest(BaseModel):
    number: str


class SendOtpResponse(BaseModel):
    message: str


class VerifyOtpRequest(BaseModel):
    number: str
    otp: str


class VerifyOtpResponse(BaseModel):
    status: str
    message: str


class CampaignMetricsResponse(BaseModel):
    calls_attempted: int
    calls_completed: int
    lead_qualified: int
    call_back_booked: int
    goal_completion_rate: str
    dnd_numbers: int
    sentiment_positive: str
    sentiment_neutral: str
    sentiment_negative: str
    intent_recognition: str
    switch_to_human_ratio: str
    dropped_at_greeting: int
    initial_drop: int
    dropped_before_resolution: int
    voc_interested: int
    voc_not_interested: int
