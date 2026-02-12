from datetime import datetime, timedelta, date
from typing import List, Dict, Optional

import requests
from fastapi import FastAPI, Depends, HTTPException, status, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import or_
import json
import asyncio
import base64
import io
import random
import os
import paramiko
import urllib.parse

from database import SessionLocal, engine, Base
from models import User, Conversation, Transcript, PromptTemplate
from schemas import (
    UserResponse,
    UserCreate,
    Token,
    ConversationResponse,
    ConversationDetailResponse,
    TranscriptResponse,
    AgentCreate,
    AgentUpdate,
    AgentResponse,
    PromptTemplateCreate,
    PromptTemplateUpdate,
    PromptTemplateResponse,
    SendOtpRequest,
    SendOtpResponse,
    VerifyOtpRequest,
    VerifyOtpResponse,
    CampaignMetricsResponse,
)
from auth import verify_password, create_access_token, verify_token
from elevenlabs_client import (
    ElevenLabsClient,
    ELEVENLABS_API_KEY,
    ELEVENLABS_BASE_URL,
)


Base.metadata.create_all(bind=engine)

# Ensure receiver columns exist in users table (for existing databases)
def ensure_receiver_columns():
    """Ensure receiver_number and receiver_name columns exist in users table"""
    from sqlalchemy import text, inspect
    inspector = inspect(engine)
    try:
        columns = [col['name'] for col in inspector.get_columns('users')]
        
        with engine.connect() as conn:
            if 'receiver_number' not in columns:
                conn.execute(text("""
                    ALTER TABLE users 
                    ADD COLUMN receiver_number VARCHAR(50) NULL,
                    ADD INDEX idx_users_receiver_number (receiver_number)
                """))
                conn.commit()
            
            if 'receiver_name' not in columns:
                conn.execute(text("""
                    ALTER TABLE users 
                    ADD COLUMN receiver_name VARCHAR(255) NULL
                """))
                conn.commit()
    except Exception as e:
        # Table might not exist yet, which is fine
        pass

# Ensure user_id column exists in prompt_templates table (for existing databases)
def ensure_prompt_template_user_id():
    """Ensure user_id column exists in prompt_templates table"""
    from sqlalchemy import text, inspect
    inspector = inspect(engine)
    try:
        # Check if prompt_templates table exists
        table_names = inspector.get_table_names()
        if 'prompt_templates' not in table_names:
            # Table doesn't exist yet, Base.metadata.create_all() will create it with all columns
            return
        
        columns = [col['name'] for col in inspector.get_columns('prompt_templates')]
        
        with engine.connect() as conn:
            if 'user_id' not in columns:
                # Add user_id column - first as nullable for existing records
                conn.execute(text("""
                    ALTER TABLE prompt_templates 
                    ADD COLUMN user_id INT NULL,
                    ADD INDEX idx_prompt_templates_user_id (user_id)
                """))
                conn.commit()
                
                # Add foreign key constraint
                try:
                    conn.execute(text("""
                        ALTER TABLE prompt_templates 
                        ADD CONSTRAINT fk_prompt_templates_user_id 
                        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                    """))
                    conn.commit()
                except Exception as e:
                    # Foreign key might already exist or there's a constraint issue
                    print(f"Note: Could not add foreign key constraint: {e}")
                
                # Delete any existing records without user_id (they're orphaned)
                # Or assign to first user if preferred - for now we'll delete them
                conn.execute(text("""
                    DELETE FROM prompt_templates WHERE user_id IS NULL
                """))
                conn.commit()
                
                # Now make user_id NOT NULL
                conn.execute(text("""
                    ALTER TABLE prompt_templates 
                    MODIFY COLUMN user_id INT NOT NULL
                """))
                conn.commit()
    except Exception as e:
        # Table might not exist yet or migration already applied, which is fine
        print(f"Note: Prompt template migration check: {e}")

# Ensure conversation analysis columns exist in conversations table (for existing databases)
def ensure_conversation_analysis_columns():
    """Ensure data_collection_results, evaluation_criteria_results, and other analysis columns exist in conversations table"""
    from sqlalchemy import text, inspect
    inspector = inspect(engine)
    try:
        columns = [col['name'] for col in inspector.get_columns('conversations')]
        
        with engine.connect() as conn:
            if 'transcript_summary' not in columns:
                conn.execute(text("""
                    ALTER TABLE conversations 
                    ADD COLUMN transcript_summary TEXT NULL
                """))
                conn.commit()
            
            if 'data_collection_results' not in columns:
                conn.execute(text("""
                    ALTER TABLE conversations 
                    ADD COLUMN data_collection_results TEXT NULL
                """))
                conn.commit()
            
            if 'call_summary_title' not in columns:
                conn.execute(text("""
                    ALTER TABLE conversations 
                    ADD COLUMN call_summary_title VARCHAR(500) NULL
                """))
                conn.commit()
            
            if 'evaluation_criteria_results' not in columns:
                conn.execute(text("""
                    ALTER TABLE conversations 
                    ADD COLUMN evaluation_criteria_results TEXT NULL
                """))
                conn.commit()
            
            if 'call_successful' not in columns:
                conn.execute(text("""
                    ALTER TABLE conversations 
                    ADD COLUMN call_successful VARCHAR(50) NULL
                """))
                conn.commit()
    except Exception as e:
        # Table might not exist yet, which is fine
        print(f"Note: Conversation analysis columns migration check: {e}")

# Run migration checks on startup
ensure_receiver_columns()
ensure_prompt_template_user_id()
ensure_conversation_analysis_columns()

app = FastAPI(title="VoiceBot AI Dashboard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000", 
        "http://localhost:5173",
        "http://callai.dialdesk.in",
        "https://callai.dialdesk.in"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")
elevenlabs_client = ElevenLabsClient()

# In-memory OTP storage (in production, use Redis or similar)
# Format: {phone_number: {"otp": "123456", "expires_at": datetime}}
otp_storage: Dict[str, Dict] = {}


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


@app.post("/users", response_model=UserResponse)
def create_user(
    user_data: UserCreate,
    db: Session = Depends(get_db),
):
    """Create a new user with optional receiver number mapping"""
    # Check if user already exists
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email already exists"
        )
    
    from auth import get_password_hash
    
    user = User(
        email=user_data.email,
        name=user_data.name,
        password_hash=get_password_hash(user_data.password),
        receiver_number=user_data.receiver_number,
        receiver_name=user_data.receiver_name
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@app.get("/conversations", response_model=List[ConversationResponse])
def get_conversations(
    skip: int = 0,
    limit: int = 100,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Filter conversations by user's receiver_number, allowed agents, and optional date range
    query = db.query(Conversation)
    
    # Apply date range - default to current date if none provided
    if not start_date and not end_date:
        today = date.today()
        start_date = today
        end_date = today
    elif start_date and not end_date:
        end_date = start_date
    
    if start_date:
        start_dt = datetime.combine(start_date, datetime.min.time())
        query = query.filter(Conversation.created_at >= start_dt)
    if end_date:
        end_dt = datetime.combine(end_date + timedelta(days=1), datetime.min.time())
        query = query.filter(Conversation.created_at < end_dt)
    
    # Get all agents from ElevenLabs to build agent mapping
    agents = elevenlabs_client.get_agents()
    agent_id_to_name = {}
    agent_name_to_id = {}
    if agents:
        for agent in agents:
            agent_id = agent.get("agent_id") or agent.get("id") or ""
            agent_name = agent.get("name") or ""
            if agent_id:
                agent_id_to_name[agent_id] = agent_name
            if agent_name:
                agent_name_to_id[agent_name] = agent_id
    
    # Build filter conditions
    filter_conditions = []
    
    # Condition 1: Match by receiver_number (if user has one mapped)
    if current_user.receiver_number:
        filter_conditions.append(Conversation.receiver_number == current_user.receiver_number)
    
    # Condition 2: Match by agent (if user has access to agents)
    # Get allowed agents from conversations with receiver_number OR from all agents if no receiver_number
    allowed_agent_identifiers = set()
    
    if current_user.receiver_number:
        # Get agents from conversations with this receiver_number
        conversations_with_receiver = (
            db.query(Conversation)
            .filter(Conversation.receiver_number == current_user.receiver_number)
            .filter(Conversation.agent.isnot(None))
            .all()
        )
        allowed_agent_identifiers = {conv.agent for conv in conversations_with_receiver if conv.agent}
    else:
        # If no receiver_number, get all agents from all conversations
        all_conversations = (
            db.query(Conversation)
            .filter(Conversation.agent.isnot(None))
            .all()
        )
        allowed_agent_identifiers = {conv.agent for conv in all_conversations if conv.agent}
    
    # Also include agents that match by ID or name
    if allowed_agent_identifiers:
        # Build list of agent IDs and names to match
        agent_match_conditions = []
        for identifier in allowed_agent_identifiers:
            # Check if identifier is an agent ID
            if identifier in agent_id_to_name:
                agent_match_conditions.append(Conversation.agent == identifier)
            # Check if identifier is an agent name
            elif identifier in agent_name_to_id:
                agent_match_conditions.append(Conversation.agent == identifier)
            # Also check direct match
            else:
                agent_match_conditions.append(Conversation.agent == identifier)
        
        # Also check if any agent name matches (case-insensitive)
        for agent_name, agent_id in agent_name_to_id.items():
            if agent_name.lower() in [ident.lower() for ident in allowed_agent_identifiers]:
                agent_match_conditions.append(Conversation.agent == agent_id)
                agent_match_conditions.append(Conversation.agent == agent_name)
        
        if agent_match_conditions:
            filter_conditions.append(or_(*agent_match_conditions))
    
    # Apply filters: show conversations that match receiver_number OR agent
    if filter_conditions:
        query = query.filter(or_(*filter_conditions))
    
    conversations = (
        query
        .order_by(Conversation.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    
    # Use the agents we already fetched to build agent_map for resolving IDs to names
    # agent_map is built from agent_id_to_name which we already created above
    agent_map = {}
    for agent_id, agent_name in agent_id_to_name.items():
        agent_map[agent_id] = agent_name
    # Also fetch full details for any missing names
    if agents:
        for agent in agents:
            agent_id = agent.get("agent_id") or agent.get("id") or ""
            agent_name = agent.get("name") or ""
            if agent_id and agent_id not in agent_map:
                if not agent_name:
                    full_agent = elevenlabs_client.get_agent(agent_id)
                    if full_agent:
                        agent_name = full_agent.get("name") or agent_id
                    else:
                        agent_name = agent_id
                agent_map[agent_id] = agent_name
    
    # Resolve agent IDs to names for conversations (in memory, not updating DB)
    conversations_to_update = []
    for conv in conversations:
        if conv.agent and conv.agent.startswith("agent_"):
            # If agent field looks like an ID, try to resolve it
            resolved_name = agent_map.get(conv.agent)
            if resolved_name:
                conv.agent = resolved_name
                conversations_to_update.append((conv.id, resolved_name))
    
    # Update database if we found any agent IDs to resolve
    if conversations_to_update:
        for conv_id, agent_name in conversations_to_update:
            db.query(Conversation).filter(Conversation.id == conv_id).update({"agent": agent_name})
        db.commit()
    
    # No auto-sync when empty. To pull conversations from ElevenLabs, use POST /sync-elevenlabs.
    return conversations


@app.get("/conversations/metrics")
def get_conversation_metrics(
    period: str = "today",  # "today" | "yesterday" | "week" | "custom"
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """High-level conversation metrics for dashboard, with the same date filter
    options as /campaign/metrics."""

    # Filter by user's receiver_number if mapped
    base_query = db.query(Conversation)
    if current_user.receiver_number:
        base_query = base_query.filter(Conversation.receiver_number == current_user.receiver_number)

    # Apply date range similar to /campaign/metrics
    start_dt: Optional[datetime] = None
    end_dt: Optional[datetime] = None

    if period == "today":
        today_start = datetime.combine(date.today(), datetime.min.time())
        start_dt = today_start
        end_dt = today_start + timedelta(days=1)
    elif period == "yesterday":
        today = date.today()
        yesterday = today - timedelta(days=1)
        start_dt = datetime.combine(yesterday, datetime.min.time())
        end_dt = datetime.combine(today, datetime.min.time())
    elif period in ("week", "this_week"):
        today = date.today()
        monday = today - timedelta(days=today.weekday())
        start_dt = datetime.combine(monday, datetime.min.time())
        end_dt = datetime.combine(today + timedelta(days=1), datetime.min.time())
    elif period == "custom":
        if not start_date:
            raise HTTPException(
                status_code=400,
                detail="start_date is required when period='custom' (format: YYYY-MM-DD)",
            )
        start_dt = datetime.combine(start_date, datetime.min.time())
        if end_date:
            end_dt = datetime.combine(end_date + timedelta(days=1), datetime.min.time())
    else:
        raise HTTPException(
            status_code=400,
            detail="Invalid period. Must be one of: today, yesterday, week, custom",
        )

    if start_dt:
        base_query = base_query.filter(Conversation.created_at >= start_dt)
    if end_dt:
        base_query = base_query.filter(Conversation.created_at < end_dt)

    total = base_query.count()

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
            "avg_response_time": 0.0,
            "response_time_change_percent": 0.0,
        }

    conversations = base_query.all()
    sentiments = [c.sentiment for c in conversations if c.sentiment is not None]
    avg_sentiment = sum(sentiments) / len(sentiments) if sentiments else 0

    total_duration = sum(c.duration or 0 for c in conversations)

    # Unique agents within the period
    unique_agents = {c.agent for c in conversations if c.agent}
    total_agents = len(unique_agents)

    # For filtered ranges we don't compute day-over-day deltas;
    # keep change percentages at 0 for now.
    todays_conversations = total
    todays_change_percent = 0.0
    sentiment_change = 0.0
    agents_change = 0.0
    response_time_change = 0.0

    # Average response time estimate (same rough heuristic)
    conversations_with_duration = [c for c in conversations if c.duration and c.duration > 0]
    if conversations_with_duration:
        avg_response_time = sum(c.duration for c in conversations_with_duration) / len(conversations_with_duration) / 10
        avg_response_time = min(avg_response_time, 5.0)
    else:
        avg_response_time = 0.0

    return {
        "total_conversations": total,
        "todays_conversations": todays_conversations,
        "todays_change_percent": round(todays_change_percent, 1),
        "avg_sentiment": round(avg_sentiment, 2),
        "sentiment_change_percent": round(sentiment_change, 1),
        "total_duration": total_duration,
        "total_agents": total_agents,
        "agents_change_percent": round(agents_change, 1),
        "avg_response_time": round(avg_response_time, 1),
        "response_time_change_percent": round(response_time_change, 1),
    }


@app.get("/campaign/metrics", response_model=CampaignMetricsResponse)
def get_campaign_metrics(
    period: str = "today",  # "today" | "yesterday" | "week" | "custom"
    start_date: Optional[date] = None,  # used when period="custom"
    end_date: Optional[date] = None,    # used when period="custom"
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return campaign-level KPIs for the current user's receiver_number.

    Date filters (query params):
    - period=today (default)    -> only today's conversations
    - period=yesterday          -> only yesterday's conversations
    - period=week               -> Monday..today of current week
    - period=custom             -> start_date / end_date (YYYY-MM-DD)
    """
    base_query = db.query(Conversation)
    if current_user.receiver_number:
        base_query = base_query.filter(Conversation.receiver_number == current_user.receiver_number)

    # Apply date filters
    start_dt: Optional[datetime] = None
    end_dt: Optional[datetime] = None

    if period == "today":
        today_start = datetime.combine(date.today(), datetime.min.time())
        start_dt = today_start
        end_dt = today_start + timedelta(days=1)
    elif period == "yesterday":
        today = date.today()
        yesterday = today - timedelta(days=1)
        start_dt = datetime.combine(yesterday, datetime.min.time())
        end_dt = datetime.combine(today, datetime.min.time())
    elif period in ("week", "this_week"):
        today = date.today()
        monday = today - timedelta(days=today.weekday())
        start_dt = datetime.combine(monday, datetime.min.time())
        end_dt = datetime.combine(today + timedelta(days=1), datetime.min.time())
    elif period == "custom":
        if not start_date:
            raise HTTPException(
                status_code=400,
                detail="start_date is required when period='custom' (format: YYYY-MM-DD)",
            )
        start_dt = datetime.combine(start_date, datetime.min.time())
        if end_date:
            end_dt = datetime.combine(end_date + timedelta(days=1), datetime.min.time())
    elif period not in ("today", "yesterday", "week"):
        raise HTTPException(
            status_code=400,
            detail="Invalid period. Must be one of: today, yesterday, week, custom",
        )

    if start_dt:
        base_query = base_query.filter(Conversation.created_at >= start_dt)
    if end_dt:
        base_query = base_query.filter(Conversation.created_at < end_dt)

    conversations = base_query.all()
    calls_attempted = len(conversations)
    # Treat "completed" as any conversation with duration > 0
    completed = [c for c in conversations if (c.duration or 0) > 0]
    calls_completed = len(completed)

    # We don't have explicit lead status; approximate "qualified" as
    # conversations with positive sentiment (> 0.3)
    qualified = [c for c in conversations if (c.sentiment or 0) > 0.3]
    lead_qualified = len(qualified)

    # No explicit "callback booked" flag; placeholder as subset of qualified
    call_back_booked = min(lead_qualified, max(0, lead_qualified // 2))

    goal_completion_rate = "0%"
    if calls_attempted:
        goal_completion_rate = f"{round((call_back_booked / calls_attempted) * 100)}%"

    # We don't track DND numbers in conversations table; keep as 0 for now
    dnd_numbers = 0

    # Sentiment buckets
    positives = [c for c in conversations if (c.sentiment or 0) > 0.3]
    neutrals = [c for c in conversations if -0.3 <= (c.sentiment or 0) <= 0.3]
    negatives = [c for c in conversations if (c.sentiment or 0) < -0.3]

    def pct(part, whole):
        return f"{round((part / whole) * 100)}%" if whole else "0%"

    sentiment_positive = pct(len(positives), len(conversations))
    sentiment_neutral = pct(len(neutrals), len(conversations))
    sentiment_negative = pct(len(negatives), len(conversations))

    # We don't have explicit intent or handoff flags yet
    intent_recognition = "0%"
    switch_to_human_ratio = "0%"

    # Drop-off approximations based on very rough position in chronological order
    dropped_at_greeting = 0
    initial_drop = 0
    dropped_before_resolution = 0
    short_calls = [c for c in conversations if 0 < (c.duration or 0) <= 30]
    mid_calls = [c for c in conversations if 30 < (c.duration or 0) <= 90]
    long_calls = [c for c in conversations if (c.duration or 0) > 90]
    dropped_at_greeting = len(short_calls)
    initial_drop = len(mid_calls)
    dropped_before_resolution = len(long_calls)

    # Voice of customer approximations from sentiment
    voc_interested = len(positives)
    voc_not_interested = len(negatives)

    return CampaignMetricsResponse(
        calls_attempted=calls_attempted,
        calls_completed=calls_completed,
        lead_qualified=lead_qualified,
        call_back_booked=call_back_booked,
        goal_completion_rate=goal_completion_rate,
        dnd_numbers=dnd_numbers,
        sentiment_positive=sentiment_positive,
        sentiment_neutral=sentiment_neutral,
        sentiment_negative=sentiment_negative,
        intent_recognition=intent_recognition,
        switch_to_human_ratio=switch_to_human_ratio,
        dropped_at_greeting=dropped_at_greeting,
        initial_drop=initial_drop,
        dropped_before_resolution=dropped_before_resolution,
        voc_interested=voc_interested,
        voc_not_interested=voc_not_interested,
    )


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
            # Return conversation with nulls for new fields
            return {
                "id": conversation.id,
                "conversation_id": conversation.conversation_id,
                "agent": conversation.agent,
                "caller_number": conversation.caller_number,
                "receiver_number": conversation.receiver_number,
                "duration": conversation.duration,
                "sentiment": conversation.sentiment,
                "created_at": conversation.created_at,
                "transcript_summary": None,
                "data_collection_results": None,
                "call_summary_title": None,
            }
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
    
    # Resolve agent ID to name if needed
    if agent_name and agent_name.startswith("agent_"):
        agents = elevenlabs_client.get_agents()
        if agents:
            for agent in agents:
                agent_id = agent.get("agent_id") or agent.get("id") or ""
                if agent_id == agent_name:
                    agent_name = agent.get("name") or agent_name
                    break

    caller_number = phone_call.get("external_number", "")
    receiver_number = phone_call.get("agent_number", "")
    duration = conv_data.get("call_duration_secs") or metadata.get("call_duration_secs") or 0

    sentiment = (
        conv_data.get("sentiment_score")
        or conv_data.get("sentiment")
        or analysis.get("sentiment_score")
        or analysis.get("sentiment")
    )
    
    # Extract transcript_summary
    transcript_summary = (
        conv_data.get("transcript_summary")
        or analysis.get("transcript_summary")
        or analysis.get("summary")
    )
    
    # Extract call_summary_title
    call_summary_title = (
        conv_data.get("call_summary_title")
        or analysis.get("call_summary_title")
        or analysis.get("title")
    )
    
    # Extract data_collection_results
    data_collection_results = (
        conv_data.get("data_collection_results")
        or conv_data.get("data_collection")
        or analysis.get("data_collection_results")
    )

    evaluation_criteria_results = analysis.get("evaluation_criteria_results")
    call_successful = analysis.get("call_successful") or conv_data.get("call_successful")
    
    # Convert dict/object fields to JSON strings for storage
    data_collection_json = None
    if data_collection_results:
        try:
            data_collection_json = json.dumps(data_collection_results) if isinstance(data_collection_results, (dict, list)) else str(data_collection_results)
        except:
            data_collection_json = str(data_collection_results)
    
    evaluation_criteria_json = None
    if evaluation_criteria_results:
        try:
            evaluation_criteria_json = json.dumps(evaluation_criteria_results) if isinstance(evaluation_criteria_results, (dict, list)) else str(evaluation_criteria_results)
        except:
            evaluation_criteria_json = str(evaluation_criteria_results)
    
    call_successful_str = None
    if call_successful is not None:
        call_successful_str = str(call_successful)

    if conversation:
        conversation.agent = agent_name
        conversation.caller_number = caller_number
        conversation.receiver_number = receiver_number
        conversation.duration = duration
        conversation.sentiment = sentiment
        conversation.created_at = created_at
        # Update analysis fields
        if transcript_summary is not None:
            conversation.transcript_summary = transcript_summary
        if call_summary_title is not None:
            conversation.call_summary_title = call_summary_title
        if data_collection_json is not None:
            conversation.data_collection_results = data_collection_json
        if evaluation_criteria_json is not None:
            conversation.evaluation_criteria_results = evaluation_criteria_json
        if call_successful_str is not None:
            conversation.call_successful = call_successful_str
    else:
        conversation = Conversation(
            conversation_id=conversation_id,
            agent=agent_name,
            caller_number=caller_number,
            receiver_number=receiver_number,
            duration=duration,
            sentiment=sentiment,
            transcript_summary=transcript_summary,
            call_summary_title=call_summary_title,
            data_collection_results=data_collection_json,
            evaluation_criteria_results=evaluation_criteria_json,
            call_successful=call_successful_str,
            created_at=created_at,
        )
        db.add(conversation)

    db.commit()
    db.refresh(conversation)
    
    # Parse JSON strings back to dicts for response
    data_collection_response = None
    if conversation.data_collection_results:
        try:
            data_collection_response = json.loads(conversation.data_collection_results)
        except:
            data_collection_response = conversation.data_collection_results
    
    evaluation_criteria_response = None
    if conversation.evaluation_criteria_results:
        try:
            evaluation_criteria_response = json.loads(conversation.evaluation_criteria_results)
        except:
            evaluation_criteria_response = conversation.evaluation_criteria_results
    
    # Return with additional fields
    return {
        "id": conversation.id,
        "conversation_id": conversation.conversation_id,
        "agent": conversation.agent,
        "caller_number": conversation.caller_number,
        "receiver_number": conversation.receiver_number,
        "duration": conversation.duration,
        "sentiment": conversation.sentiment,
        "created_at": conversation.created_at,
        "transcript_summary": conversation.transcript_summary or transcript_summary,
        "data_collection_results": data_collection_response or data_collection_results,
        "call_summary_title": conversation.call_summary_title or call_summary_title,
        "evaluation_criteria_results": evaluation_criteria_response or evaluation_criteria_results,
        "call_successful": conversation.call_successful or call_successful_str,
    }


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


@app.get("/agents", response_model=List[AgentResponse])
def get_agents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get agents from ElevenLabs, filtered to only those used in conversations with user's receiver_number"""
    agents = elevenlabs_client.get_agents()
    if not agents:
        return []
    
    # Filter to only agents that appear in conversations with user's receiver_number
    if current_user.receiver_number:
        conversations = (
            db.query(Conversation)
            .filter(Conversation.receiver_number == current_user.receiver_number)
            .filter(Conversation.agent.isnot(None))
            .all()
        )
        allowed_identifiers = {conv.agent for conv in conversations if conv.agent}
        
        if not allowed_identifiers:
            return []
        
        agent_id_to_name = {a.get("agent_id") or a.get("id") or "": a.get("name") or "" for a in agents if a.get("agent_id") or a.get("id")}
        agent_name_to_id = {v: k for k, v in agent_id_to_name.items() if v}
        
        allowed_ids = set()
        for ident in allowed_identifiers:
            if ident in agent_id_to_name:
                allowed_ids.add(ident)
            elif ident in agent_name_to_id:
                allowed_ids.add(agent_name_to_id[ident])
            for name, aid in agent_name_to_id.items():
                if name and ident and name.lower() == ident.lower():
                    allowed_ids.add(aid)
        
        agents = [
            a for a in agents
            if (a.get("agent_id") or a.get("id") or "") in allowed_ids
            or (a.get("name") or "") in allowed_identifiers
            or any((a.get("name") or "").lower() == i.lower() for i in allowed_identifiers if i)
        ]
    
    # Transform agents to match our response schema
    agent_list = []
    for agent in agents:
        agent_id = agent.get("agent_id") or agent.get("id") or ""
        if not agent_id:
            continue
        
        # Debug: Check if conversation_config exists in list response
        conversation_config = agent.get("conversation_config")
        
        # If conversation_config is not in the list response, fetch full agent details
        if not conversation_config:
            print(f"Agent {agent_id} missing conversation_config in list, fetching full details...")
            full_agent = elevenlabs_client.get_agent(agent_id)
            if full_agent:
                agent = full_agent
                conversation_config = agent.get("conversation_config") or {}
        
        # Extract conversation_config which contains all agent settings
        conversation_config = conversation_config or {}
        agent_config = conversation_config.get("agent") or {}
        prompt_config = agent_config.get("prompt") or {}
        tts_config = conversation_config.get("tts") or {}
        
        # Extract metadata for created_at
        metadata = agent.get("metadata") or {}
        
        # System prompt is in conversation_config.agent.prompt.prompt
        system_prompt = prompt_config.get("prompt")
        
        # First message is in conversation_config.agent.first_message
        first_message = agent_config.get("first_message")
        
        # Language is in conversation_config.agent.language
        language = agent_config.get("language")
        
        # Voice ID is in conversation_config.tts.voice_id
        voice_id = tts_config.get("voice_id")
        
        # LLM model is in conversation_config.agent.prompt.llm
        llm_model = prompt_config.get("llm")
        
        # Knowledge base is in conversation_config.agent.prompt.knowledge_base (it's an array)
        knowledge_base_array = prompt_config.get("knowledge_base") or []
        knowledge_base = None
        
        # Convert knowledge_base array to object format
        if knowledge_base_array:
            kb_items = []
            for kb_item in knowledge_base_array:
                if isinstance(kb_item, dict):
                    kb_type = kb_item.get("type", "")
                    kb_name = kb_item.get("name", "")
                    kb_id = kb_item.get("id", "")
                    
                    if kb_type == "file" and kb_name:
                        kb_items.append({"file": kb_name, "id": kb_id})
                    elif kb_type == "url":
                        kb_items.append({"url": kb_item.get("url", "")})
                    elif kb_type == "text":
                        kb_items.append({"text": kb_item.get("text", "")})
            
            if kb_items:
                # Merge all knowledge base items
                knowledge_base = {}
                for item in kb_items:
                    if "file" in item:
                        knowledge_base["file"] = item["file"]
                    if "url" in item:
                        knowledge_base["url"] = item["url"]
                    if "text" in item:
                        knowledge_base["text"] = item["text"]
                
                if not knowledge_base:
                    knowledge_base = None
        
        # Created at from metadata.created_at_unix_secs
        created_at_unix = metadata.get("created_at_unix_secs")
        created_at = None
        if created_at_unix:
            try:
                from datetime import datetime
                created_at = datetime.fromtimestamp(created_at_unix)
            except:
                created_at = None
        
        agent_list.append({
            "agent_id": agent_id,
            "name": agent.get("name"),
            "system_prompt": system_prompt,
            "first_message": first_message,
            "knowledge_base": knowledge_base,
            "voice_id": voice_id,
            "language": language,
            "llm_model": llm_model,
            "created_at": created_at,
        })
    
    return agent_list


@app.get("/agents/{agent_id}", response_model=AgentResponse)
def get_agent(
    agent_id: str,
    current_user: User = Depends(get_current_user),
):
    """Get a specific agent from ElevenLabs"""
    agent = elevenlabs_client.get_agent(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    # Debug: print agent data
    print(f"Raw agent data from ElevenLabs:")
    import json
    print(json.dumps(agent, indent=2, default=str))
    
    agent_id_key = agent.get("agent_id") or agent.get("id") or agent_id
    
    # Extract conversation_config which contains all agent settings
    conversation_config = agent.get("conversation_config")
    print(f"conversation_config exists: {conversation_config is not None}")
    
    if not conversation_config:
        # If no conversation_config, return basic data
        return {
            "agent_id": agent_id_key,
            "name": agent.get("name"),
            "system_prompt": None,
            "first_message": None,
            "knowledge_base": None,
            "voice_id": None,
            "language": None,
            "llm_model": None,
            "created_at": None,
        }
    
    agent_config = conversation_config.get("agent") or {}
    prompt_config = agent_config.get("prompt") or {}
    tts_config = conversation_config.get("tts") or {}
    
    print(f"agent_config keys: {list(agent_config.keys())}")
    print(f"prompt_config keys: {list(prompt_config.keys())}")
    print(f"tts_config keys: {list(tts_config.keys())}")
    
    # Extract metadata for created_at
    metadata = agent.get("metadata") or {}
    
    # System prompt is in conversation_config.agent.prompt.prompt
    system_prompt = prompt_config.get("prompt")
    print(f"System prompt found: {system_prompt is not None}, length: {len(system_prompt) if system_prompt else 0}")
    
    # First message is in conversation_config.agent.first_message
    first_message = agent_config.get("first_message")
    print(f"First message found: {first_message is not None}, value: {first_message[:50] if first_message else None}")
    
    # Language is in conversation_config.agent.language
    language = agent_config.get("language")
    print(f"Language found: {language}")
    
    # Voice ID is in conversation_config.tts.voice_id
    voice_id = tts_config.get("voice_id")
    print(f"Voice ID found: {voice_id}")
    
    # LLM model is in conversation_config.agent.prompt.llm
    llm_model = prompt_config.get("llm")
    print(f"LLM model found: {llm_model}")
    
    # Knowledge base is in conversation_config.agent.prompt.knowledge_base (it's an array)
    knowledge_base_array = prompt_config.get("knowledge_base") or []
    print(f"Knowledge base array: {knowledge_base_array}")
    knowledge_base = None
    
    # Convert knowledge_base array to object format
    if knowledge_base_array and isinstance(knowledge_base_array, list):
        kb_items = []
        for kb_item in knowledge_base_array:
            if isinstance(kb_item, dict):
                kb_type = kb_item.get("type", "")
                kb_name = kb_item.get("name", "")
                kb_id = kb_item.get("id", "")
                
                if kb_type == "file" and kb_name:
                    kb_items.append({"file": kb_name, "id": kb_id})
                elif kb_type == "url":
                    kb_items.append({"url": kb_item.get("url", "")})
                elif kb_type == "text":
                    kb_items.append({"text": kb_item.get("text", "")})
        
        if kb_items:
            # Merge all knowledge base items
            knowledge_base = {}
            for item in kb_items:
                if "file" in item:
                    knowledge_base["file"] = item["file"]
                if "url" in item:
                    knowledge_base["url"] = item["url"]
                if "text" in item:
                    knowledge_base["text"] = item["text"]
            
            if not knowledge_base:
                knowledge_base = None
    
    # Created at from metadata.created_at_unix_secs
    created_at_unix = metadata.get("created_at_unix_secs")
    created_at = None
    if created_at_unix:
        try:
            from datetime import datetime
            created_at = datetime.fromtimestamp(created_at_unix)
        except Exception as e:
            print(f"Error parsing created_at: {e}")
            created_at = None
    
    response_data = {
        "agent_id": agent_id_key,
        "name": agent.get("name"),
        "system_prompt": system_prompt,
        "first_message": first_message,
        "knowledge_base": knowledge_base,
        "voice_id": voice_id,
        "language": language,
        "llm_model": llm_model,
        "created_at": created_at,
    }
    
    print(f"Final response data:")
    print(json.dumps(response_data, indent=2, default=str))
    
    return response_data


@app.post("/agents", response_model=AgentResponse)
def create_agent(
    agent_data: AgentCreate,
    current_user: User = Depends(get_current_user),
):
    """Create a new agent in ElevenLabs"""
    # Build conversation_config structure as expected by ElevenLabs API
    # Valid LLM models: gpt-4o-mini, gpt-4o, gpt-4, gpt-4-turbo, gpt-4.1, gemini-1.5-pro, gemini-1.5-flash, claude-3-5-sonnet, etc.
    # Default to gpt-4o-mini if not provided or invalid
    valid_llm_models = [
        'gpt-4o-mini', 'gpt-4o', 'gpt-4', 'gpt-4-turbo', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano',
        'gpt-5', 'gpt-5.1', 'gpt-5-mini', 'gpt-5-nano', 'gpt-3.5-turbo',
        'gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite',
        'gemini-2.5-flash-lite', 'gemini-2.5-flash',
        'claude-sonnet-4-5', 'claude-sonnet-4', 'claude-haiku-4-5', 'claude-3-7-sonnet', 'claude-3-5-sonnet'
    ]
    
    llm_model = agent_data.llm_model or "gpt-4o-mini"
    if llm_model not in valid_llm_models:
        print(f"Warning: Invalid LLM model '{llm_model}', using default 'gpt-4o-mini'")
        llm_model = "gpt-4o-mini"
    
    conversation_config = {
        "agent": {
            "first_message": agent_data.first_message or "",
            "language": agent_data.language or "en",
            "prompt": {
                "prompt": agent_data.system_prompt or "",
                "llm": llm_model,
            }
        },
        "tts": {
            "voice_id": agent_data.voice_id or "21m00Tcm4TlvDq8ikWAM",
            "model_id": "eleven_turbo_v2_5"
        }
    }
    
    # Add knowledge_base if provided
    if agent_data.knowledge_base:
        kb_items = []
        if agent_data.knowledge_base.file:
            kb_items.append({
                "type": "file",
                "name": agent_data.knowledge_base.file
            })
        if agent_data.knowledge_base.url:
            kb_items.append({
                "type": "url",
                "url": agent_data.knowledge_base.url
            })
        if agent_data.knowledge_base.text:
            kb_items.append({
                "type": "text",
                "text": agent_data.knowledge_base.text
            })
        
        if kb_items:
            conversation_config["agent"]["prompt"]["knowledge_base"] = kb_items
    
    # Prepare payload with proper structure
    payload = {
        "name": agent_data.name,
        "conversation_config": conversation_config
    }
    
    print(f"Creating agent with payload:")
    import json
    print(json.dumps(payload, indent=2, default=str))
    
    result = elevenlabs_client.create_agent(payload)
    if not result:
        raise HTTPException(status_code=500, detail="Failed to create agent. The ElevenLabs API may not support creating agents programmatically, or the endpoint/structure may have changed.")
    
    agent_id_key = result.get("agent_id") or result.get("id") or ""
    
    # Extract data from response (same structure as get_agent)
    conversation_config_resp = result.get("conversation_config") or {}
    agent_config_resp = conversation_config_resp.get("agent") or {}
    prompt_config_resp = agent_config_resp.get("prompt") or {}
    tts_config_resp = conversation_config_resp.get("tts") or {}
    metadata = result.get("metadata") or {}
    
    system_prompt = prompt_config_resp.get("prompt")
    first_message = agent_config_resp.get("first_message")
    language = agent_config_resp.get("language")
    voice_id = tts_config_resp.get("voice_id")
    llm_model = prompt_config_resp.get("llm")
    
    knowledge_base_array = prompt_config_resp.get("knowledge_base") or []
    knowledge_base = None
    if knowledge_base_array:
        kb_items = []
        for kb_item in knowledge_base_array:
            if isinstance(kb_item, dict):
                kb_type = kb_item.get("type", "")
                kb_name = kb_item.get("name", "")
                if kb_type == "file" and kb_name:
                    kb_items.append({"file": kb_name})
                elif kb_type == "url":
                    kb_items.append({"url": kb_item.get("url", "")})
                elif kb_type == "text":
                    kb_items.append({"text": kb_item.get("text", "")})
        
        if kb_items:
            knowledge_base = {}
            for item in kb_items:
                knowledge_base.update(item)
            if not knowledge_base:
                knowledge_base = None
    
    created_at_unix = metadata.get("created_at_unix_secs")
    created_at = None
    if created_at_unix:
        try:
            from datetime import datetime
            created_at = datetime.fromtimestamp(created_at_unix)
        except:
            created_at = None
    
    return {
        "agent_id": agent_id_key,
        "name": result.get("name"),
        "system_prompt": system_prompt,
        "first_message": first_message,
        "knowledge_base": knowledge_base,
        "voice_id": voice_id,
        "language": language,
        "llm_model": llm_model,
        "created_at": created_at,
    }


@app.put("/agents/{agent_id}", response_model=AgentResponse)
def update_agent(
    agent_id: str,
    agent_data: AgentUpdate,
    current_user: User = Depends(get_current_user),
):
    """Update an existing agent in ElevenLabs"""
    # First get the current agent to preserve existing structure
    current_agent = elevenlabs_client.get_agent(agent_id)
    if not current_agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    # Build conversation_config with updates
    conversation_config = current_agent.get("conversation_config") or {}
    agent_config = conversation_config.get("agent") or {}
    prompt_config = agent_config.get("prompt") or {}
    tts_config = conversation_config.get("tts") or {}
    
    # Update fields if provided
    if agent_data.name is not None:
        current_agent["name"] = agent_data.name
    
    if agent_data.system_prompt is not None:
        if not prompt_config:
            prompt_config = {}
        prompt_config["prompt"] = agent_data.system_prompt
    
    if agent_data.first_message is not None:
        agent_config["first_message"] = agent_data.first_message
    
    if agent_data.language is not None:
        agent_config["language"] = agent_data.language
    
    if agent_data.voice_id is not None:
        tts_config["voice_id"] = agent_data.voice_id
    
    if agent_data.llm_model is not None:
        if not prompt_config:
            prompt_config = {}
        prompt_config["llm"] = agent_data.llm_model
    
    # Update knowledge_base if provided
    if agent_data.knowledge_base is not None:
        kb_items = []
        if agent_data.knowledge_base.file:
            kb_items.append({
                "type": "file",
                "name": agent_data.knowledge_base.file
            })
        if agent_data.knowledge_base.url:
            kb_items.append({
                "type": "url",
                "url": agent_data.knowledge_base.url
            })
        if agent_data.knowledge_base.text:
            kb_items.append({
                "type": "text",
                "text": agent_data.knowledge_base.text
            })
        
        if kb_items:
            if not prompt_config:
                prompt_config = {}
            prompt_config["knowledge_base"] = kb_items
    
    # Rebuild conversation_config
    if prompt_config:
        agent_config["prompt"] = prompt_config
    if agent_config:
        conversation_config["agent"] = agent_config
    if tts_config:
        conversation_config["tts"] = tts_config
    
    # Prepare payload
    payload = {
        "name": current_agent.get("name"),
        "conversation_config": conversation_config
    }
    
    print(f"Updating agent with payload:")
    import json
    print(json.dumps(payload, indent=2, default=str)[:1000])  # Truncate for logging
    
    result = elevenlabs_client.update_agent(agent_id, payload)
    if not result:
        raise HTTPException(status_code=500, detail="Failed to update agent")
    
    # Return updated agent using get_agent function
    return get_agent(agent_id, current_user)


def sync_conversations(db: Session) -> int:
    print(f"[SYNC] Starting conversation sync from ElevenLabs...")
    conversations_data = elevenlabs_client.get_conversations()
    if not conversations_data:
        print(f"[SYNC] No conversations found in ElevenLabs API")
        return 0
    
    print(f"[SYNC] Fetched {len(conversations_data)} conversations from ElevenLabs API")
    
    # Log date range of conversations
    if conversations_data:
        dates = []
        for conv in conversations_data:
            start_time = conv.get("start_time_unix_secs")
            if start_time:
                dates.append(datetime.fromtimestamp(start_time))
        if dates:
            min_date = min(dates)
            max_date = max(dates)
            print(f"[SYNC] Conversation date range: {min_date.strftime('%Y-%m-%d')} to {max_date.strftime('%Y-%m-%d')}")

    # Get all agents to resolve agent IDs to names
    agents = elevenlabs_client.get_agents()
    agent_map = {}
    if agents:
        for agent in agents:
            agent_id = agent.get("agent_id") or agent.get("id") or ""
            agent_name = agent.get("name") or ""
            if agent_id:
                agent_map[agent_id] = agent_name
                # Also try to get name from conversation_config if available
                if not agent_name:
                    conversation_config = agent.get("conversation_config") or {}
                    if conversation_config:
                        full_agent = elevenlabs_client.get_agent(agent_id)
                        if full_agent:
                            agent_map[agent_id] = full_agent.get("name") or agent_id

    count = 0
    new_count = 0
    updated_count = 0
    skipped_count = 0
    
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

        # Get agent ID from conversation data
        agent_id = conv_data.get("agent_id") or conv_data.get("agent_name") or ""
        agent_name = conv_data.get("agent_name") or ""
        
        # If we only have agent_id, try to resolve it to agent name
        if agent_id and not agent_name:
            agent_name = agent_map.get(agent_id, agent_id)
        elif not agent_name:
            # Try to get from agent object if present
            if isinstance(conv_data.get("agent"), dict):
                agent_name = conv_data["agent"].get("name", "")
        
        # Extract caller and receiver numbers from metadata
        # Try multiple possible locations in the response
        metadata = conv_data.get("metadata", {}) or {}
        phone_call = metadata.get("phone_call") or {}
        
        # Try different field names that ElevenLabs might use
        caller_number = (
            phone_call.get("external_number") or 
            phone_call.get("caller_number") or 
            phone_call.get("from_number") or
            conv_data.get("caller_number") or
            conv_data.get("external_number") or
            ""
        )
        receiver_number = (
            phone_call.get("agent_number") or 
            phone_call.get("receiver_number") or 
            phone_call.get("to_number") or
            phone_call.get("destination_number") or
            conv_data.get("receiver_number") or
            conv_data.get("agent_number") or
            ""
        )
        
        # Check if we need to fetch full conversation details
        # Only fetch if:
        # 1. Conversation doesn't exist (new conversation)
        # 2. Existing conversation is missing analysis fields
        need_full_details = False
        if not existing:
            need_full_details = True
        elif existing and (not existing.data_collection_results or not existing.evaluation_criteria_results or 
                          not existing.transcript_summary or not existing.call_summary_title):
            need_full_details = True
        
        # Fetch full conversation details only if needed
        full_conv = None
        if need_full_details:
            full_conv = elevenlabs_client.get_conversation(conv_id)
        else:
            skipped_count += 1
        
        # Extract all fields from full conversation if available
        if full_conv:
            full_metadata = full_conv.get("metadata", {}) or {}
            full_phone_call = full_metadata.get("phone_call") or {}
            full_analysis = full_conv.get("analysis", {}) or {}
            
            # Update phone numbers if missing or if we have better data
            if not caller_number:
                caller_number = (
                    full_phone_call.get("external_number") or 
                    full_phone_call.get("caller_number") or 
                    full_phone_call.get("from_number") or
                    full_conv.get("caller_number") or
                    full_conv.get("external_number") or
                    ""
                )
            if not receiver_number:
                receiver_number = (
                    full_phone_call.get("agent_number") or 
                    full_phone_call.get("receiver_number") or 
                    full_phone_call.get("to_number") or
                    full_phone_call.get("destination_number") or
                    full_conv.get("receiver_number") or
                    full_conv.get("agent_number") or
                    ""
                )
            
            # Extract analysis fields
            transcript_summary = (
                full_conv.get("transcript_summary")
                or full_analysis.get("transcript_summary")
                or full_analysis.get("summary")
            )
            
            call_summary_title = (
                full_conv.get("call_summary_title")
                or full_analysis.get("call_summary_title")
                or full_analysis.get("title")
            )
            
            data_collection_results = (
                full_conv.get("data_collection_results")
                or full_conv.get("data_collection")
                or full_analysis.get("data_collection_results")
            )
            
            evaluation_criteria_results = full_analysis.get("evaluation_criteria_results")
            call_successful = full_analysis.get("call_successful") or full_conv.get("call_successful")
            
            # Convert dict/object fields to JSON strings for storage
            data_collection_json = None
            if data_collection_results:
                try:
                    data_collection_json = json.dumps(data_collection_results) if isinstance(data_collection_results, (dict, list)) else str(data_collection_results)
                except:
                    data_collection_json = str(data_collection_results)
            
            evaluation_criteria_json = None
            if evaluation_criteria_results:
                try:
                    evaluation_criteria_json = json.dumps(evaluation_criteria_results) if isinstance(evaluation_criteria_results, (dict, list)) else str(evaluation_criteria_results)
                except:
                    evaluation_criteria_json = str(evaluation_criteria_results)
            
            call_successful_str = None
            if call_successful is not None:
                call_successful_str = str(call_successful)
        else:
            # If full conversation fetch failed, use values from list response
            transcript_summary = None
            call_summary_title = None
            data_collection_json = None
            evaluation_criteria_json = None
            call_successful_str = None
        
        duration = conv_data.get("call_duration_secs") or conv_data.get("duration") or 0
        sentiment = conv_data.get("sentiment_score") or conv_data.get("sentiment")

        if existing:
            # Update basic fields if they're missing or different
            updated = False
            if agent_name and existing.agent != agent_name:
                existing.agent = agent_name
                updated = True
            if caller_number and existing.caller_number != caller_number:
                existing.caller_number = caller_number
                updated = True
            if receiver_number and existing.receiver_number != receiver_number:
                existing.receiver_number = receiver_number
                updated = True
            if duration and existing.duration != duration:
                existing.duration = duration
                updated = True
            if sentiment is not None and existing.sentiment != sentiment:
                existing.sentiment = sentiment
                updated = True
            if existing.created_at != created_at:
                existing.created_at = created_at
                updated = True
            
            # Update analysis fields if we have them and they're missing
            if full_conv:
                if transcript_summary is not None and not existing.transcript_summary:
                    existing.transcript_summary = transcript_summary
                    updated = True
                if call_summary_title is not None and not existing.call_summary_title:
                    existing.call_summary_title = call_summary_title
                    updated = True
                if data_collection_json is not None and not existing.data_collection_results:
                    existing.data_collection_results = data_collection_json
                    updated = True
                if evaluation_criteria_json is not None and not existing.evaluation_criteria_results:
                    existing.evaluation_criteria_results = evaluation_criteria_json
                    updated = True
                if call_successful_str is not None and not existing.call_successful:
                    existing.call_successful = call_successful_str
                    updated = True
            
            if updated:
                updated_count += 1
                count += 1
        else:
            # New conversation
            conversation = Conversation(
                conversation_id=conv_id,
                agent=agent_name if agent_name else None,
                caller_number=caller_number if caller_number else None,
                receiver_number=receiver_number if receiver_number else None,
                duration=duration if duration else None,
                sentiment=sentiment,
                transcript_summary=transcript_summary,
                call_summary_title=call_summary_title,
                data_collection_results=data_collection_json,
                evaluation_criteria_results=evaluation_criteria_json,
                call_successful=call_successful_str,
                created_at=created_at,
            )
            db.add(conversation)
            new_count += 1
            count += 1
        
        if count % 50 == 0:
            print(f"[SYNC] Processed {count}/{len(conversations_data)} conversations... (New: {new_count}, Updated: {updated_count}, Skipped: {skipped_count})")

    db.commit()
    print(f"[SYNC] Successfully synced {count} conversations to database")
    print(f"[SYNC] Summary: {new_count} new, {updated_count} updated, {skipped_count} skipped (already complete)")
    return count


# Prompt Template Endpoints
@app.post("/prompt-templates", response_model=PromptTemplateResponse)
def create_prompt_template(
    template_data: PromptTemplateCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new prompt template for the current user"""
    # Check if template with same name already exists for this user
    existing = db.query(PromptTemplate).filter(
        PromptTemplate.name == template_data.name,
        PromptTemplate.user_id == current_user.id
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A prompt template with this name already exists for your account"
        )
    
    prompt_template = PromptTemplate(
        user_id=current_user.id,
        name=template_data.name,
        system_prompt=template_data.system_prompt,
        first_message=template_data.first_message,
    )
    db.add(prompt_template)
    db.commit()
    db.refresh(prompt_template)
    return prompt_template


@app.get("/prompt-templates", response_model=List[PromptTemplateResponse])
def get_prompt_templates(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all prompt templates for the current user"""
    templates = db.query(PromptTemplate).filter(
        PromptTemplate.user_id == current_user.id
    ).order_by(PromptTemplate.created_at.desc()).all()
    return templates


@app.get("/prompt-templates/{template_id}", response_model=PromptTemplateResponse)
def get_prompt_template(
    template_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a specific prompt template (only if it belongs to the current user)"""
    template = db.query(PromptTemplate).filter(
        PromptTemplate.id == template_id,
        PromptTemplate.user_id == current_user.id
    ).first()
    if not template:
        raise HTTPException(status_code=404, detail="Prompt template not found")
    return template


@app.put("/prompt-templates/{template_id}", response_model=PromptTemplateResponse)
def update_prompt_template(
    template_id: int,
    template_data: PromptTemplateUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update a prompt template (only if it belongs to the current user)"""
    template = db.query(PromptTemplate).filter(
        PromptTemplate.id == template_id,
        PromptTemplate.user_id == current_user.id
    ).first()
    if not template:
        raise HTTPException(status_code=404, detail="Prompt template not found")
    
    # Check if name is being changed and if new name already exists for this user
    if template_data.name is not None and template_data.name != template.name:
        existing = db.query(PromptTemplate).filter(
            PromptTemplate.name == template_data.name,
            PromptTemplate.user_id == current_user.id,
            PromptTemplate.id != template_id
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A prompt template with this name already exists for your account"
            )
        template.name = template_data.name
    
    if template_data.system_prompt is not None:
        template.system_prompt = template_data.system_prompt
    
    if template_data.first_message is not None:
        template.first_message = template_data.first_message
    
    template.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(template)
    return template


@app.delete("/prompt-templates/{template_id}")
def delete_prompt_template(
    template_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a prompt template (only if it belongs to the current user)"""
    template = db.query(PromptTemplate).filter(
        PromptTemplate.id == template_id,
        PromptTemplate.user_id == current_user.id
    ).first()
    if not template:
        raise HTTPException(status_code=404, detail="Prompt template not found")
    
    db.delete(template)
    db.commit()
    return {"message": "Prompt template deleted successfully"}



@app.get("/chat/agents")
def get_chat_agents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get list of agents available for chat - only those used in conversations with user's receiver_number"""
    agents = elevenlabs_client.get_agents()
    if not agents:
        return []
    
    if current_user.receiver_number:
        conversations = (
            db.query(Conversation)
            .filter(Conversation.receiver_number == current_user.receiver_number)
            .filter(Conversation.agent.isnot(None))
            .all()
        )
        allowed_identifiers = {conv.agent for conv in conversations if conv.agent}
        
        if not allowed_identifiers:
            return []
        
        agent_id_to_name = {a.get("agent_id") or a.get("id") or "": a.get("name") or "" for a in agents if a.get("agent_id") or a.get("id")}
        agent_name_to_id = {v: k for k, v in agent_id_to_name.items() if v}
        
        allowed_ids = set()
        for ident in allowed_identifiers:
            if ident in agent_id_to_name:
                allowed_ids.add(ident)
            elif ident in agent_name_to_id:
                allowed_ids.add(agent_name_to_id[ident])
            for name, aid in agent_name_to_id.items():
                if name and ident and name.lower() == ident.lower():
                    allowed_ids.add(aid)
        
        agents = [
            a for a in agents
            if (a.get("agent_id") or a.get("id") or "") in allowed_ids
            or (a.get("name") or "") in allowed_identifiers
            or any((a.get("name") or "").lower() == i.lower() for i in allowed_identifiers if i)
        ]
    
    return [
        {"agent_id": a.get("agent_id") or a.get("id") or "", "name": a.get("name") or ""}
        for a in agents
        if a.get("agent_id") or a.get("id")
    ]


@app.get("/chat/signed-url")
def get_signed_url(
    agent_id: str,
    connection_type: str = "webrtc",  # "webrtc" or "websocket"
    current_user: User = Depends(get_current_user),
):
    """Get a signed URL or conversation token for authenticated agents"""
    try:
        if connection_type == "websocket":
            # Get signed URL for WebSocket connection
            response = requests.get(
                f"{ELEVENLABS_BASE_URL}/convai/conversation/get-signed-url",
                params={"agent_id": agent_id},
                headers={
                    "xi-api-key": ELEVENLABS_API_KEY,
                },
            )
            response.raise_for_status()
            data = response.json()
            return {"signed_url": data.get("signed_url")}
        else:
            # Get conversation token for WebRTC connection
            response = requests.post(
                f"{ELEVENLABS_BASE_URL}/convai/conversation",
                json={"agent_id": agent_id},
                headers={
                    "xi-api-key": ELEVENLABS_API_KEY,
                    "Content-Type": "application/json",
                },
            )
            response.raise_for_status()
            data = response.json()
            return {"conversation_token": data.get("conversation_token")}
    except requests.exceptions.RequestException as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get signed URL/token: {str(e)}"
        )


@app.post("/send-otp", response_model=SendOtpResponse)
def send_otp(
    request: SendOtpRequest,
    current_user: User = Depends(get_current_user),
):
    """Send OTP to the provided mobile number"""
    try:
        # Validate number
        number = request.number.strip()
        if not number or len(number) < 10:
            raise HTTPException(status_code=400, detail="Invalid mobile number. Must be at least 10 digits.")
        
        # Generate random 6-digit OTP
        otp = str(random.randint(100000, 999999))
        
        # Store OTP with expiration (10 minutes to match SMS message)
        expires_at = datetime.now() + timedelta(minutes=10)
        otp_storage[number] = {
            "otp": otp,
            "expires_at": expires_at
        }
        
        # Get SMS API configuration from environment variables
        sms_username = os.getenv("SMS_API_USERNAME", "masCallnet1.trans")
        sms_password = os.getenv("SMS_API_PASSWORD", "1t3BK")
        sms_from = os.getenv("SMS_API_FROM", "Ispark")
        sms_dlt_content_id = os.getenv("SMS_DLT_CONTENT_ID", "1707176439618550283")
        sms_dlt_principal_entity_id = os.getenv("SMS_DLT_PRINCIPAL_ENTITY_ID", "1001485540000016211")
        sms_api_url = os.getenv("SMS_API_URL", "https://api.smartping.ai/fe/api/v1/send")
        
        # Construct SMS message with OTP
        sms_message = f"Your DialDesk One-Time Password is {otp}. It is valid for 10 minutes. Do not share this code with anyone. Ispark"
        
        # Send OTP via SMS API
        try:
            sms_params = {
                "username": sms_username,
                "password": sms_password,
                "unicode": "false",
                "from": sms_from,
                "to": number,
                "dltContentId": sms_dlt_content_id,
                "dltPrincipalEntityId": sms_dlt_principal_entity_id,
                "text": sms_message
            }
            
            print(f"[OTP] Sending OTP to {number} via SMS API")
            print(f"[OTP] Generated OTP: {otp} (expires at: {expires_at})")
            print(f"[OTP] SMS API URL: {sms_api_url}")
            print(f"[OTP] SMS Parameters: {sms_params}")
            
            # Build the full URL for debugging (requests will URL-encode automatically)
            full_url = f"{sms_api_url}?{urllib.parse.urlencode(sms_params)}"
            print(f"[OTP] Full SMS API URL: {full_url}")
            
            response = requests.get(sms_api_url, params=sms_params, timeout=10)
            response.raise_for_status()
            
            print(f"[OTP] SMS API response status: {response.status_code}")
            print(f"[OTP] SMS API response body: {response.text}")
            
            # Parse JSON response to check if SMS was accepted
            try:
                response_data = response.json()
                state = response_data.get("state", "")
                status_code = response_data.get("statusCode", 0)
                description = response_data.get("description", "")
                
                print(f"[OTP] SMS API response - State: {state}, StatusCode: {status_code}, Description: {description}")
                
                if state == "SUBMIT_ACCEPTED" and status_code == 200:
                    print(f"[OTP] OTP sent successfully to {number}")
                    transaction_id = response_data.get("transactionId", "")
                    if transaction_id:
                        print(f"[OTP] Transaction ID: {transaction_id}")
                else:
                    error_msg = f"SMS API returned unexpected state: {state} (statusCode: {status_code}, description: {description})"
                    print(f"[OTP] ERROR: {error_msg}")
                    # Log full response for debugging
                    print(f"[OTP] Full API response: {response_data}")
                    # Still continue - OTP is stored, but SMS delivery may have failed
                    
            except (ValueError, KeyError) as json_error:
                print(f"[OTP] Warning: Could not parse SMS API response as JSON: {json_error}")
                print(f"[OTP] Raw response: {response.text}")
                # Still continue - response was 200, SMS might still be delivered
                
        except requests.exceptions.RequestException as e:
            error_msg = f"Error calling SMS API: {str(e)}"
            print(f"[OTP] {error_msg}")
            # Log full error details
            import traceback
            traceback.print_exc()
            # Still return success - OTP is generated and stored
            # User can still verify OTP even if SMS delivery failed
            print(f"[OTP] OTP generated but SMS delivery may have failed: {otp}")
        
        return SendOtpResponse(message=f"OTP sent to {number}")
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error sending OTP: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to send OTP: {str(e)}")


@app.post("/verify-otp-and-call", response_model=VerifyOtpResponse)
def verify_otp_and_call(
    request: VerifyOtpRequest,
    current_user: User = Depends(get_current_user),
):
    """Verify OTP and trigger outbound call via Asterisk"""
    try:
        number = request.number.strip()
        otp = request.otp.strip()
        
        # Validate inputs
        if not number or len(number) < 10:
            raise HTTPException(status_code=400, detail="Invalid mobile number")
        if not otp or len(otp) != 6:
            raise HTTPException(status_code=400, detail="Invalid OTP format. Must be 6 digits.")
        
        # Check if OTP exists for this number
        if number not in otp_storage:
            raise HTTPException(status_code=400, detail="OTP not found. Please request a new OTP.")
        
        stored_data = otp_storage[number]
        
        # Check if OTP has expired
        if datetime.now() > stored_data["expires_at"]:
            del otp_storage[number]
            raise HTTPException(status_code=400, detail="OTP has expired. Please request a new OTP.")
        
        # Verify OTP
        if stored_data["otp"] != otp:
            raise HTTPException(status_code=400, detail="Invalid OTP. Please try again.")
        
        # OTP is valid, remove it from storage
        del otp_storage[number]
        
        # Get Asterisk SSH configuration from environment variables
        asterisk_host = os.getenv("ASTERISK_SSH_HOST", "localhost")
        asterisk_port = int(os.getenv("ASTERISK_SSH_PORT", "22"))
        asterisk_username = os.getenv("ASTERISK_SSH_USER", "root")
        asterisk_password = os.getenv("ASTERISK_SSH_PASSWORD", "")
        asterisk_key_path = os.getenv("ASTERISK_SSH_KEY_PATH", None)  # Optional: path to SSH key
        asterisk_sip_trunk = os.getenv("ASTERISK_SIP_TRUNK", "airtel_120")  # SIP trunk name
        asterisk_number_prefix = os.getenv("ASTERISK_NUMBER_PREFIX", "951")  # Number prefix to add
        
        # SSH into Asterisk server and trigger call
        try:
            ssh = paramiko.SSHClient()
            ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            
            # Connect to SSH server
            if asterisk_key_path and os.path.exists(asterisk_key_path):
                # Use SSH key authentication
                ssh.connect(
                    hostname=asterisk_host,
                    port=asterisk_port,
                    username=asterisk_username,
                    key_filename=asterisk_key_path,
                    timeout=10
                )
            elif asterisk_password:
                # Use password authentication
                ssh.connect(
                    hostname=asterisk_host,
                    port=asterisk_port,
                    username=asterisk_username,
                    password=asterisk_password,
                    timeout=10
                )
            else:
                raise HTTPException(
                    status_code=500,
                    detail="Asterisk SSH configuration incomplete. Please set ASTERISK_SSH_PASSWORD or ASTERISK_SSH_KEY_PATH."
                )
            
            # Construct the full number with prefix (e.g., 9519911362206)
            full_number = f"{asterisk_number_prefix}{number}"
            
            # Construct the Asterisk command using SIP trunk format
            # Format: channel originate SIP/951{number}@airtel_120 extension 951{number}@outbound-to-customer-bot
            asterisk_command = (
                f'asterisk -rx "channel originate SIP/{full_number}@{asterisk_sip_trunk} '
                f'extension {full_number}@outbound-to-customer-bot"'
            )
            
            print(f"[Asterisk] Executing command: {asterisk_command}")
            
            # Execute the command
            stdin, stdout, stderr = ssh.exec_command(asterisk_command, timeout=10)
            
            # Get output
            exit_status = stdout.channel.recv_exit_status()
            output = stdout.read().decode('utf-8')
            error_output = stderr.read().decode('utf-8')
            
            # Close SSH connection
            ssh.close()
            
            if exit_status != 0:
                print(f"[Asterisk] Error output: {error_output}")
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to trigger call via Asterisk: {error_output or 'Unknown error'}"
                )
            
            print(f"[Asterisk] Call triggered successfully. Output: {output}")
            
            return VerifyOtpResponse(
                status="success",
                message=f"Call triggered to {number}"
            )
            
        except paramiko.AuthenticationException:
            raise HTTPException(
                status_code=500,
                detail="Asterisk SSH authentication failed. Check credentials."
            )
        except paramiko.SSHException as e:
            raise HTTPException(
                status_code=500,
                detail=f"Asterisk SSH connection error: {str(e)}"
            )
        except Exception as e:
            print(f"Error connecting to Asterisk: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to connect to Asterisk server: {str(e)}"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error verifying OTP and calling: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to verify OTP and trigger call: {str(e)}")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
