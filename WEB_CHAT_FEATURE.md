# Web Chat Feature

## Overview
This feature allows clients to chat with AI agents directly through a web interface. The chat supports both **text and voice modes**, using WebSocket for real-time communication and integrates with your existing ElevenLabs agents.

## Features
- **Text Chat Mode**: Real-time text chat with AI agents via WebSocket
- **Voice Chat Mode**: Speak to agents and hear their responses
  - Browser-based speech-to-text (Web Speech API)
  - ElevenLabs TTS for agent voice responses
  - Audio recording and playback
- Agent selection dropdown
- Connection status indicator
- Typing indicators
- Message history
- Responsive, modern UI

## Backend Changes

### New Endpoints
1. **WebSocket Endpoint**: `/ws/chat/{agent_id}`
   - Real-time bidirectional communication
   - Handles message sending and receiving
   - Manages conversation history

2. **HTTP Endpoints**:
   - `GET /chat/agents` - Get list of available agents for chat
   - `POST /chat/start` - Start a new chat session

### New Methods in ElevenLabsClient
- `send_text_message()` - Send text message to ElevenLabs API (if supported)
- `generate_text_response()` - Generate response using agent's LLM configuration
- `_generate_simple_response()` - Fallback response generator

## Frontend Changes

### New Page
- **Chat Page** (`/chat` or `/chat/:agentId`)
  - Full-screen chat interface
  - Agent selector
  - Real-time message display
  - Input area with send button

### Navigation
- Added "Web Chat" link to sidebar navigation

## Setup Instructions

### Optional: OpenAI Integration (for better responses)
If you want to use OpenAI for generating text responses (recommended), install the OpenAI library:

```bash
cd backend
pip install openai
```

Then add your OpenAI API key to your `.env` file:
```
OPENAI_API_KEY=your-openai-api-key-here
```

**Note**: The chat will work without OpenAI, but responses will be basic. With OpenAI configured, it will use the agent's configured LLM model for intelligent responses.

### Using the Chat Feature

1. **Access the Chat Page**:
   - Navigate to `/chat` from the sidebar or directly
   - Or go to `/chat/{agent_id}` to start with a specific agent

2. **Select an Agent**:
   - Use the dropdown in the header to select an agent
   - Only agents available to your account will be shown

3. **Text Mode**:
   - Type your message in the input area
   - Press Enter to send (Shift+Enter for new line)
   - Or click the send button
   - Wait for the agent's response

4. **Voice Mode**:
   - Click the "Voice" button in the header to enable voice mode
   - Click and hold the microphone button to record
   - Release to send your voice message
   - The agent will respond with both text and audio
   - Audio will play automatically when received

5. **Connection Status**:
   - Green dot = Connected
   - Red dot = Disconnected
   - Check the status indicator in the header

## Technical Details

### WebSocket Communication
- Protocol: WS (WebSocket) or WSS (Secure WebSocket)
- Message Format: JSON (text) or Binary (audio)
- Message Types:
  - `message` - Chat messages (user or assistant)
  - `audio` - Audio data (base64 encoded MP3)
  - `typing` - Typing indicator
  - `error` - Error messages
  - `auth` - Authentication (optional)

### Voice Chat Flow
1. **User Input**:
   - Browser Web Speech API converts speech to text (if available)
   - Or audio is sent to backend for STT processing
   
2. **Agent Response**:
   - Text response is generated using agent's LLM
   - Response is converted to speech using ElevenLabs TTS
   - Audio is sent back to client as base64-encoded MP3
   
3. **Audio Playback**:
   - Client receives audio and plays it automatically
   - Visual indicator shows when audio is playing

### Agent Response Generation
1. First tries ElevenLabs text conversation API (if available)
2. Falls back to OpenAI API (if configured)
3. Falls back to simple response generator (if neither available)

### Security
- Chat page is protected by authentication (requires login)
- WebSocket connections are established after authentication
- Agent access is filtered based on user's receiver_number mapping (if configured)

## Troubleshooting

### WebSocket Connection Issues
- Check that the backend is running
- Verify CORS settings allow your frontend origin
- Check browser console for connection errors
- Ensure WebSocket URL is correct (check VITE_API_URL in frontend .env)

### No Response from Agent
- Check if OpenAI API key is configured (optional but recommended)
- Verify agent exists and is accessible
- Check backend logs for errors
- Ensure agent has a valid system prompt configured

### Voice Chat Issues
- **Microphone not working**: Check browser permissions for microphone access
- **No audio playback**: Check browser audio settings and volume
- **Speech not recognized**: Ensure Web Speech API is supported (Chrome, Edge, Safari)
- **Audio not sent**: Check that microphone permissions are granted
- **Agent voice not working**: Verify agent has a valid voice_id configured in ElevenLabs

### Agent Not Showing in Dropdown
- Verify you have access to the agent (check receiver_number mapping)
- Ensure agent exists in ElevenLabs
- Check backend logs for agent fetching errors

## Browser Compatibility

### Voice Chat Requirements
- **Chrome/Edge**: Full support (Web Speech API + MediaRecorder)
- **Safari**: Full support (Web Speech API + MediaRecorder)
- **Firefox**: Limited support (MediaRecorder works, Web Speech API not available)
- **Mobile Browsers**: Varies by platform

### Permissions Required
- Microphone access (for voice input)
- Audio playback (for agent responses)

## Future Enhancements
- Enhanced speech-to-text accuracy
- Multiple language support
- Voice activity detection (VAD)
- File uploads in chat
- Chat history persistence
- Multiple concurrent chat sessions
- Agent switching during conversation
- Export chat transcripts
- Voice cloning customization

