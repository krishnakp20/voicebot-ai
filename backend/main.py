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
    AgentCreate,
    AgentUpdate,
    AgentResponse,
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
    
    # Get all agents to resolve agent IDs to names
    agents = elevenlabs_client.get_agents()
    agent_map = {}
    if agents:
        for agent in agents:
            agent_id = agent.get("agent_id") or agent.get("id") or ""
            agent_name = agent.get("name") or ""
            if agent_id:
                # If name is missing from list, fetch full agent details
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
    
    if not conversations:
        sync_conversations(db)
        conversations = (
            db.query(Conversation)
            .order_by(Conversation.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )
        # Resolve agent IDs again after sync (in memory)
        for conv in conversations:
            if conv.agent and conv.agent.startswith("agent_"):
                resolved_name = agent_map.get(conv.agent)
                if resolved_name:
                    conv.agent = resolved_name
    
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
        "transcript_summary": transcript_summary,
        "data_collection_results": data_collection_results,
        "call_summary_title": call_summary_title,
        "evaluation_criteria_results": evaluation_criteria_results,
        "call_successful": call_successful,
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
):
    """Get all agents from ElevenLabs"""
    agents = elevenlabs_client.get_agents()
    if not agents:
        return []
    
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
    conversations_data = elevenlabs_client.get_conversations()
    if not conversations_data:
        return 0

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
        
        # Extract caller number from metadata
        metadata = conv_data.get("metadata", {}) or {}
        phone_call = metadata.get("phone_call") or {}
        caller_number = phone_call.get("external_number", "")
        receiver_number = phone_call.get("agent_number", "")
        
        duration = conv_data.get("call_duration_secs", 0)
        sentiment = conv_data.get("sentiment_score") or conv_data.get("sentiment")

        if existing:
            existing.agent = agent_name or existing.agent
            existing.caller_number = caller_number or existing.caller_number
            existing.receiver_number = receiver_number or existing.receiver_number
            existing.duration = duration or existing.duration
            existing.sentiment = sentiment or existing.sentiment
            existing.created_at = created_at
        else:
            conversation = Conversation(
                conversation_id=conv_id,
                agent=agent_name,
                caller_number=caller_number,
                receiver_number=receiver_number,
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
