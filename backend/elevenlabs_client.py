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
    
    def get_conversations(self) -> List[Dict]:
        """Fetch all conversations from ElevenLabs"""
        try:
            response = requests.get(
                f"{self.base_url}/convai/conversations",
                headers=self.headers
            )
            response.raise_for_status()
            data = response.json()
            # Handle both list and object with conversations key
            if isinstance(data, list):
                return data
            elif isinstance(data, dict) and "conversations" in data:
                return data["conversations"]
            return []
        except Exception as e:
            print(f"Error fetching conversations: {e}")
            import traceback
            traceback.print_exc()
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
        """Fetch all agents from ElevenLabs"""
        try:
            response = requests.get(
                f"{self.base_url}/convai/agents",
                headers=self.headers
            )
            response.raise_for_status()
            data = response.json()
            if isinstance(data, list):
                return data
            elif isinstance(data, dict) and "agents" in data:
                return data["agents"]
            return []
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

