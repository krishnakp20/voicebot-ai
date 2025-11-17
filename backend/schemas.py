from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    
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
    
    class Config:
        from_attributes = True

class TranscriptResponse(BaseModel):
    id: int
    conversation_id: str
    text: str
    created_at: datetime
    
    class Config:
        from_attributes = True


