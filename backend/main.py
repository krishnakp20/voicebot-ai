from datetime import datetime, timedelta, date
from typing import List

import requests
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from database import SessionLocal, engine, Base
from models import User, Conversation, Transcript
from schemas import (
    UserResponse,
    Token,
    ConversationResponse,
    ConversationDetailResponse,
    TranscriptResponse,
)
from auth import verify_password, create_access_token, verify_token
from elevenlabs_client import (
    ElevenLabsClient,
    ELEVENLABS_API_KEY,
    ELEVENLABS_BASE_URL,
)


Base.metadata.create_all(bind=engine)

app = FastAPI(title="VoiceBot AI Dashboard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")
elevenlabs_client = ElevenLabsClient()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = verify_token(token)
    if payload is None:
        raise credentials_exception
    user = db.query(User).filter(User.email == payload.get("sub")).first()
    if user is None:
        raise credentials_exception
    return user


@app.post("/auth/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer"}


@app.get("/auth/me", response_model=UserResponse)
def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user


@app.get("/conversations", response_model=List[ConversationResponse])
def get_conversations(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conversations = (
        db.query(Conversation)
        .order_by(Conversation.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    if not conversations:
        sync_conversations(db)
        conversations = (
            db.query(Conversation)
            .order_by(Conversation.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )
    return conversations


@app.get("/conversations/metrics")
def get_conversation_metrics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    total = db.query(Conversation).count()
    today_start = datetime.combine(date.today(), datetime.min.time())
    today_end = today_start + timedelta(days=1)
    yesterday_start = today_start - timedelta(days=1)
    yesterday_end = today_start

    todays_count = (
        db.query(Conversation)
        .filter(Conversation.created_at >= today_start, Conversation.created_at < today_end)
        .count()
    )
    yesterdays_count = (
        db.query(Conversation)
        .filter(
            Conversation.created_at >= yesterday_start, Conversation.created_at < yesterday_end
        )
        .count()
    )

    if yesterdays_count > 0:
        todays_change = ((todays_count - yesterdays_count) / yesterdays_count) * 100
    elif todays_count > 0:
        todays_change = 100.0
    else:
        todays_change = 0.0

    if total == 0:
        return {
            "total_conversations": 0,
            "todays_conversations": 0,
            "todays_change_percent": 0,
            "avg_sentiment": 0,
            "sentiment_change_percent": 0,
            "total_duration": 0,
            "total_agents": 0,
            "agents_change_percent": 0,
            "avg_response_time": 1.2,
            "response_time_change_percent": -4.1,
        }

    conversations = db.query(Conversation).all()
    sentiments = [c.sentiment for c in conversations if c.sentiment is not None]
    avg_sentiment = sum(sentiments) / len(sentiments) if sentiments else 0

    yesterday_conversations = (
        db.query(Conversation)
        .filter(
            Conversation.created_at >= yesterday_start, Conversation.created_at < yesterday_end
        )
        .all()
    )
    yesterday_sentiments = [
        c.sentiment for c in yesterday_conversations if c.sentiment is not None
    ]
    if yesterday_sentiments:
        avg_yesterday_sentiment = sum(yesterday_sentiments) / len(yesterday_sentiments)
        if avg_yesterday_sentiment != 0:
            sentiment_change = (
                (avg_sentiment - avg_yesterday_sentiment) / avg_yesterday_sentiment
            ) * 100
        else:
            sentiment_change = 0
    else:
        sentiment_change = 0

    total_duration = sum(c.duration or 0 for c in conversations)

    unique_agents = {c.agent for c in conversations if c.agent}
    yesterday_unique_agents = {c.agent for c in yesterday_conversations if c.agent}

    try:
        agents = elevenlabs_client.get_agents()
        total_agents = len(agents) if agents else len(unique_agents)
        agents_change = 0
    except Exception:
        total_agents = len(unique_agents)
        if len(yesterday_unique_agents) > 0:
            agents_change = ((total_agents - len(yesterday_unique_agents)) / len(yesterday_unique_agents)) * 100
        elif total_agents > 0:
            agents_change = 100
        else:
            agents_change = 0

    return {
        "total_conversations": total,
        "todays_conversations": todays_count,
        "todays_change_percent": round(todays_change, 1),
        "avg_sentiment": round(avg_sentiment, 2),
        "sentiment_change_percent": round(sentiment_change, 1),
        "total_duration": total_duration,
        "total_agents": total_agents,
        "agents_change_percent": round(agents_change, 1),
        "avg_response_time": 1.2,
        "response_time_change_percent": -4.1,
    }


@app.get("/conversations/{conversation_id}", response_model=ConversationDetailResponse)
def get_conversation(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conversation = (
        db.query(Conversation).filter(Conversation.conversation_id == conversation_id).first()
    )
    conv_data = elevenlabs_client.get_conversation(conversation_id)
    if not conv_data:
        if conversation:
            return conversation
        raise HTTPException(status_code=404, detail="Conversation not found")

    metadata = conv_data.get("metadata", {}) or {}
    phone_call = metadata.get("phone_call") or {}
    analysis = conv_data.get("analysis", {}) or {}

    start_time = conv_data.get("start_time_unix_secs") or metadata.get("start_time_unix_secs")
    created_at = (
        datetime.fromtimestamp(start_time) if start_time else datetime.utcnow()
    )

    agent_name = conv_data.get("agent_name") or conv_data.get("agent_id") or ""
    if not agent_name and isinstance(conv_data.get("agent"), dict):
        agent_name = conv_data["agent"].get("name", "")

    caller_number = phone_call.get("external_number", "")
    receiver_number = phone_call.get("agent_number", "")
    duration = conv_data.get("call_duration_secs") or metadata.get("call_duration_secs") or 0

    sentiment = (
        conv_data.get("sentiment_score")
        or conv_data.get("sentiment")
        or analysis.get("sentiment_score")
        or analysis.get("sentiment")
    )

    if conversation:
        conversation.agent = agent_name
        conversation.caller_number = caller_number
        conversation.receiver_number = receiver_number
        conversation.duration = duration
        conversation.sentiment = sentiment
        conversation.created_at = created_at
    else:
        conversation = Conversation(
            conversation_id=conversation_id,
            agent=agent_name,
            caller_number=caller_number,
            receiver_number=receiver_number,
            duration=duration,
            sentiment=sentiment,
            created_at=created_at,
        )
        db.add(conversation)

    db.commit()
    db.refresh(conversation)
    return conversation


@app.get("/conversations/{conversation_id}/transcript", response_model=TranscriptResponse)
def get_transcript(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    transcript = (
        db.query(Transcript).filter(Transcript.conversation_id == conversation_id).first()
    )
    if not transcript:
        transcript_data = elevenlabs_client.get_transcript(conversation_id)
        if not transcript_data or not transcript_data.get("text"):
            raise HTTPException(status_code=404, detail="Transcript not found")
        transcript = Transcript(
            conversation_id=conversation_id,
            text=transcript_data.get("text", ""),
        )
        db.add(transcript)
        db.commit()
        db.refresh(transcript)
    return transcript


@app.get("/conversations/{conversation_id}/audio")
def get_audio(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
):
    audio_url = elevenlabs_client.get_audio_url(conversation_id)
    if not audio_url:
        return {"audio_url": None, "available": False}
    return {
        "audio_url": f"/conversations/{conversation_id}/audio/stream",
        "original_url": audio_url,
        "available": True,
    }


@app.get("/conversations/{conversation_id}/audio/stream")
def stream_audio(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
):
    """Stream audio directly from ElevenLabs, even if has_audio flag is missing."""
    audio_endpoint = f"{ELEVENLABS_BASE_URL}/convai/conversations/{conversation_id}/audio"
    headers = {"xi-api-key": ELEVENLABS_API_KEY}

    try:
        response = requests.get(audio_endpoint, headers=headers, stream=True)
        if response.status_code == 404:
            raise HTTPException(
                status_code=404,
                detail="Audio not available for this conversation",
            )
        response.raise_for_status()
    except requests.exceptions.RequestException as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch audio from ElevenLabs: {exc}",
        ) from exc

    media_type = response.headers.get("Content-Type", "audio/mpeg")
    return StreamingResponse(response.iter_content(chunk_size=8192), media_type=media_type)


@app.post("/sync-elevenlabs")
def sync_elevenlabs(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    count = sync_conversations(db)
    return {"message": f"Synced {count} conversations from ElevenLabs"}


def sync_conversations(db: Session) -> int:
    conversations_data = elevenlabs_client.get_conversations()
    if not conversations_data:
        return 0

    count = 0
    for conv_data in conversations_data:
        conv_id = conv_data.get("conversation_id")
        if not conv_id:
            continue

        existing = (
            db.query(Conversation).filter(Conversation.conversation_id == conv_id).first()
        )
        start_time = conv_data.get("start_time_unix_secs")
        created_at = (
            datetime.fromtimestamp(start_time) if start_time else datetime.utcnow()
        )

        agent_name = conv_data.get("agent_name") or conv_data.get("agent_id") or ""
        duration = conv_data.get("call_duration_secs", 0)
        sentiment = conv_data.get("sentiment_score") or conv_data.get("sentiment")

        if existing:
            existing.agent = agent_name or existing.agent
            existing.duration = duration or existing.duration
            existing.sentiment = sentiment or existing.sentiment
            existing.created_at = created_at
        else:
            conversation = Conversation(
                conversation_id=conv_id,
                agent=agent_name,
                caller_number="",
                receiver_number="",
                duration=duration,
                sentiment=sentiment,
                created_at=created_at,
            )
            db.add(conversation)
        count += 1

    db.commit()
    return count


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
