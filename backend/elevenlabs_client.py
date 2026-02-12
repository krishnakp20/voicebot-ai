import requests
import os
from dotenv import load_dotenv
from typing import List, Dict, Optional

load_dotenv()

ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
ELEVENLABS_BASE_URL = "https://api.elevenlabs.io/v1"

class ElevenLabsClient:
    def __init__(self):
        self.api_key = ELEVENLABS_API_KEY
        self.base_url = ELEVENLABS_BASE_URL
        self.headers = {
            "xi-api-key": self.api_key,
            "Content-Type": "application/json"
        }
    
    def get_conversations(self, limit: int = None, page_size: int = 100) -> List[Dict]:
        """Fetch all conversations from ElevenLabs with pagination support"""
        all_conversations = []
        page = 1
        max_pages = 1000  # Safety limit to prevent infinite loops
        
        try:
            # First, try to get conversations without pagination to see the response format
            response = requests.get(
                f"{self.base_url}/convai/conversations",
                headers=self.headers,
                params={"page_size": page_size} if page_size else None
            )
            response.raise_for_status()
            data = response.json()
            
            # Handle different response formats
            conversations = []
            pagination_info = {}
            
            if isinstance(data, list):
                conversations = data
            elif isinstance(data, dict):
                if "conversations" in data:
                    conversations = data["conversations"]
                elif "data" in data:
                    conversations = data["data"]
                else:
                    # Try to extract conversations from any array field
                    for key, value in data.items():
                        if isinstance(value, list):
                            conversations = value
                            break
                
                # Check for pagination metadata
                if "has_more" in data:
                    pagination_info["has_more"] = data["has_more"]
                if "next_page" in data:
                    pagination_info["next_page"] = data["next_page"]
                if "next_cursor" in data:
                    pagination_info["next_cursor"] = data["next_cursor"]
                if "total" in data:
                    pagination_info["total"] = data["total"]
                if "page" in data:
                    pagination_info["page"] = data["page"]
            
            # Add first page of conversations
            if conversations:
                all_conversations.extend(conversations)
                print(f"[API] Fetched {len(conversations)} conversations from page {page} (total so far: {len(all_conversations)})")
            
            # If we got a full page and there's pagination info, continue fetching
            if conversations and (len(conversations) >= page_size or pagination_info.get("has_more", False)):
                # Continue paginating
                while page < max_pages:
                    page += 1
                    
                    # Build query parameters for next page
                    params = {"page_size": page_size} if page_size else {}
                    
                    # Try different pagination methods
                    if "next_cursor" in pagination_info:
                        params["cursor"] = pagination_info["next_cursor"]
                    elif "next_page" in pagination_info:
                        params["page"] = pagination_info["next_page"]
                    else:
                        params["page"] = page
                    
                    try:
                        response = requests.get(
                            f"{self.base_url}/convai/conversations",
                            headers=self.headers,
                            params=params
                        )
                        response.raise_for_status()
                        data = response.json()
                        
                        # Extract conversations from response
                        page_conversations = []
                        if isinstance(data, list):
                            page_conversations = data
                        elif isinstance(data, dict):
                            if "conversations" in data:
                                page_conversations = data["conversations"]
                            elif "data" in data:
                                page_conversations = data["data"]
                            
                            # Update pagination info
                            if "has_more" in data:
                                pagination_info["has_more"] = data["has_more"]
                            if "next_page" in data:
                                pagination_info["next_page"] = data["next_page"]
                            if "next_cursor" in data:
                                pagination_info["next_cursor"] = data["next_cursor"]
                        
                        if page_conversations:
                            all_conversations.extend(page_conversations)
                            print(f"[API] Fetched {len(page_conversations)} conversations from page {page} (total so far: {len(all_conversations)})")
                            
                            # Check if we should continue
                            if len(page_conversations) < page_size and not pagination_info.get("has_more", False):
                                # Got fewer results than page size and no more pages
                                break
                            if not pagination_info.get("has_more", False) and "next_cursor" not in pagination_info and "next_page" not in pagination_info:
                                # No pagination info suggests we're done
                                break
                        else:
                            # No more conversations
                            break
                            
                    except requests.exceptions.HTTPError as e:
                        if e.response.status_code == 404:
                            # Page doesn't exist, we're done
                            break
                        else:
                            # Other error, log and continue
                            print(f"[API] Error fetching page {page}: {e}")
                            break
                    except Exception as e:
                        print(f"[API] Error fetching page {page}: {e}")
                        break
                    
                    # If limit is specified and we've reached it, stop
                    if limit and len(all_conversations) >= limit:
                        all_conversations = all_conversations[:limit]
                        break
            
            print(f"[API] Total conversations fetched: {len(all_conversations)}")
            return all_conversations
            
        except Exception as e:
            print(f"[API] Error fetching conversations: {e}")
            import traceback
            traceback.print_exc()
            # Return what we've collected so far
            if all_conversations:
                print(f"[API] Returning {len(all_conversations)} conversations fetched before error")
                return all_conversations
            return []
    
    def get_conversation(self, conversation_id: str) -> Optional[Dict]:
        """Fetch a specific conversation from ElevenLabs"""
        try:
            print(f"Fetching conversation {conversation_id} from ElevenLabs...")
            response = requests.get(
                f"{self.base_url}/convai/conversations/{conversation_id}",
                headers=self.headers,
                timeout=30
            )
            response.raise_for_status()
            data = response.json()
            print(f"Successfully fetched conversation {conversation_id}")
            return data
        except requests.exceptions.HTTPError as e:
            print(f"HTTP error fetching conversation {conversation_id}: {e}")
            print(f"Response status: {e.response.status_code}")
            print(f"Response body: {e.response.text[:200] if e.response.text else 'No body'}")
            return None
        except requests.exceptions.RequestException as e:
            print(f"Request error fetching conversation {conversation_id}: {e}")
            return None
        except Exception as e:
            print(f"Error fetching conversation {conversation_id}: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    def get_transcript(self, conversation_id: str) -> Optional[Dict]:
        """Fetch transcript for a conversation"""
        try:
            # Try transcript endpoint first
            try:
                response = requests.get(
                    f"{self.base_url}/convai/conversations/{conversation_id}/transcript",
                    headers=self.headers
                )
                response.raise_for_status()
                data = response.json()
                # Handle different response formats
                if isinstance(data, dict):
                    if "text" in data:
                        return data
                    elif "transcript" in data:
                        return {"text": data["transcript"]}
                return {"text": str(data)}
            except Exception as transcript_error:
                # If transcript endpoint fails, get full conversation and extract transcript
                conv_data = self.get_conversation(conversation_id)
                if conv_data and "transcript" in conv_data:
                    # Build transcript text from transcript array
                    transcript_parts = []
                    for item in conv_data.get("transcript", []):
                        role = item.get("role", "")
                        message = item.get("message", "")
                        if message and message.strip() and message != "...":
                            # Clean up the message
                            message = message.strip()
                            transcript_parts.append(f"{role.capitalize()}: {message}")
                    
                    if transcript_parts:
                        return {"text": "\n\n".join(transcript_parts)}
                
                # If no transcript found, return empty
                return {"text": ""}
        except Exception as e:
            print(f"Error fetching transcript for {conversation_id}: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    def get_audio_url(self, conversation_id: str) -> Optional[str]:
        """Get audio URL for a conversation - just checks if audio exists"""
        try:
            # First check if conversation has audio
            conv_data = self.get_conversation(conversation_id)
            if not conv_data:
                return None
                
            has_audio = conv_data.get("has_audio", False)
            if not has_audio:
                print(f"Conversation {conversation_id} does not have audio")
                return None
            
            # If audio exists, return the endpoint URL (we'll proxy it)
            # The actual streaming will be handled by the proxy endpoint
            return f"{self.base_url}/convai/conversations/{conversation_id}/audio"
        except Exception as e:
            print(f"Error checking audio for {conversation_id}: {e}")
            return None
    
    def get_agents(self) -> List[Dict]:
        """Fetch all agents from ElevenLabs (handles pagination)"""
        all_agents = []
        cursor = None
        try:
            while True:
                params = {"page_size": 100}
                if cursor:
                    params["cursor"] = cursor
                response = requests.get(
                    f"{self.base_url}/convai/agents",
                    headers=self.headers,
                    params=params
                )
                response.raise_for_status()
                data = response.json()
                agents = []
                if isinstance(data, list):
                    all_agents = data
                    break
                elif isinstance(data, dict) and "agents" in data:
                    agents = data["agents"]
                    all_agents.extend(agents)
                    has_more = data.get("has_more", False)
                    cursor = data.get("next_cursor")
                    if not has_more or not cursor:
                        break
                else:
                    break
            return all_agents
        except Exception as e:
            print(f"Error fetching agents: {e}")
            return []
    
    def get_agent(self, agent_id: str) -> Optional[Dict]:
        """Fetch a specific agent from ElevenLabs"""
        try:
            response = requests.get(
                f"{self.base_url}/convai/agents/{agent_id}",
                headers=self.headers
            )
            response.raise_for_status()
            data = response.json()
            # Debug: print raw response
            print(f"Raw ElevenLabs API response for agent {agent_id}:")
            import json
            print(json.dumps(data, indent=2, default=str))
            return data
        except Exception as e:
            print(f"Error fetching agent {agent_id}: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    def create_agent(self, agent_data: Dict) -> Optional[Dict]:
        """Create a new agent in ElevenLabs"""
        try:
            # Use the correct endpoint: /v1/convai/agents/create
            response = requests.post(
                f"{self.base_url}/convai/agents/create",
                headers=self.headers,
                json=agent_data
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.HTTPError as e:
            print(f"Error creating agent: {e}")
            print(f"Response status: {e.response.status_code}")
            print(f"Response body: {e.response.text[:500] if e.response.text else 'No body'}")
            import traceback
            traceback.print_exc()
            return None
        except Exception as e:
            print(f"Error creating agent: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    def update_agent(self, agent_id: str, agent_data: Dict) -> Optional[Dict]:
        """Update an existing agent in ElevenLabs"""
        try:
            # Use PATCH method as per ElevenLabs API documentation
            response = requests.patch(
                f"{self.base_url}/convai/agents/{agent_id}",
                headers=self.headers,
                json=agent_data
            )
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f"Error updating agent {agent_id}: {e}")
            import traceback
            traceback.print_exc()
            if hasattr(e, 'response') and e.response is not None:
                print(f"Response status: {e.response.status_code}")
                print(f"Response body: {e.response.text[:500] if e.response.text else 'No body'}")
            return None
    
    def send_text_message(self, agent_id: str, message: str, conversation_id: Optional[str] = None) -> Optional[Dict]:
        """Send a text message to an agent and get response"""
        try:
            # Try to use ElevenLabs text conversation endpoint if available
            # Otherwise, we'll use OpenAI/LLM directly based on agent config
            payload = {
                "message": message
            }
            if conversation_id:
                payload["conversation_id"] = conversation_id
            
            # Try ElevenLabs text endpoint first
            try:
                endpoint = f"{self.base_url}/convai/agents/{agent_id}/chat"
                if conversation_id:
                    endpoint = f"{self.base_url}/convai/conversations/{conversation_id}/chat"
                
                response = requests.post(
                    endpoint,
                    headers=self.headers,
                    json=payload,
                    timeout=30
                )
                response.raise_for_status()
                return response.json()
            except requests.exceptions.HTTPError as e:
                # If endpoint doesn't exist, we'll handle it in the main function
                print(f"ElevenLabs text endpoint not available: {e}")
                return None
        except Exception as e:
            print(f"Error sending text message: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    def generate_text_response(self, agent_id: str, message: str, conversation_history: List[Dict] = None) -> Optional[str]:
        """Generate text response using ElevenLabs native conversation API"""
        try:
            # First try ElevenLabs native chat endpoint
            response_data = self.send_text_message(agent_id, message, None)
            if response_data:
                if "message" in response_data:
                    return response_data["message"]
                elif "response" in response_data:
                    return response_data["response"]
                elif "text" in response_data:
                    return response_data["text"]
            
            # If ElevenLabs endpoint doesn't work, return None to indicate we need conversation API
            return None
        except Exception as e:
            print(f"Error generating text response: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    def _generate_simple_response(self, system_prompt: str, message: str, conversation_history: List[Dict] = None) -> str:
        """Generate a simple response when OpenAI is not available"""
        # This is a basic fallback - in production, you might want to use
        # a different LLM service or implement a rule-based response system
        return f"Thank you for your message: '{message}'. I'm configured to help you, but advanced AI features require OpenAI API key to be configured. Please contact your administrator."
    
    def text_to_speech(self, text: str, voice_id: str = None, model_id: str = "eleven_turbo_v2_5") -> Optional[bytes]:
        """Convert text to speech using ElevenLabs TTS API"""
        try:
            if not voice_id:
                # Use default voice if not provided
                voice_id = "21m00Tcm4TlvDq8ikWAM"
            
            url = f"{self.base_url}/text-to-speech/{voice_id}"
            headers = {
                "xi-api-key": self.api_key,
                "Content-Type": "application/json"
            }
            data = {
                "text": text,
                "model_id": model_id,
                "voice_settings": {
                    "stability": 0.5,
                    "similarity_boost": 0.75
                }
            }
            
            response = requests.post(url, headers=headers, json=data, timeout=30)
            response.raise_for_status()
            return response.content
        except Exception as e:
            print(f"Error converting text to speech: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    def speech_to_text(self, audio_data: bytes) -> Optional[str]:
        """Convert speech to text using ElevenLabs STT API (if available)"""
        try:
            # ElevenLabs may have a speech-to-text endpoint
            # For now, we'll use a placeholder that can be extended
            # In production, you might use Whisper API or similar
            url = f"{self.base_url}/speech-to-text"
            headers = {
                "xi-api-key": self.api_key,
            }
            files = {
                "audio": ("audio.wav", audio_data, "audio/wav")
            }
            
            response = requests.post(url, headers=headers, files=files, timeout=30)
            if response.status_code == 200:
                data = response.json()
                return data.get("text", "")
            else:
                # If endpoint doesn't exist, return None to use alternative
                return None
        except Exception as e:
            # Endpoint might not exist, that's okay
            print(f"ElevenLabs STT not available: {e}")
            return None
    
    def start_conversation(self, agent_id: str) -> Optional[Dict]:
        """Start a new conversation with an agent using ElevenLabs native API"""
        try:
            endpoint = f"{self.base_url}/convai/conversations/create"
            payload = {
                "agent_id": agent_id
            }
            
            response = requests.post(
                endpoint,
                headers=self.headers,
                json=payload,
                timeout=30
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.HTTPError as e:
            print(f"Error starting conversation: {e}")
            if e.response:
                print(f"Response: {e.response.text[:200]}")
            return None
        except Exception as e:
            print(f"Error starting conversation: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    def send_audio_to_conversation(self, conversation_id: str, audio_data: bytes) -> Optional[Dict]:
        """Send audio to an active conversation"""
        try:
            endpoint = f"{self.base_url}/convai/conversations/{conversation_id}/audio"
            headers = {
                "xi-api-key": self.api_key,
            }
            files = {
                "audio": ("audio.webm", audio_data, "audio/webm")
            }
            
            response = requests.post(
                endpoint,
                headers=headers,
                files=files,
                timeout=30
            )
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f"Error sending audio to conversation: {e}")
            return None
    
    def get_conversation_audio_stream(self, conversation_id: str):
        """Get audio stream from conversation"""
        try:
            endpoint = f"{self.base_url}/convai/conversations/{conversation_id}/audio/stream"
            headers = {
                "xi-api-key": self.api_key,
            }
            
            response = requests.get(
                endpoint,
                headers=headers,
                stream=True,
                timeout=30
            )
            response.raise_for_status()
            return response
        except Exception as e:
            print(f"Error getting conversation audio stream: {e}")
            return None

