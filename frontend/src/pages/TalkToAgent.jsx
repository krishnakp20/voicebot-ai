import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useConversation } from '@elevenlabs/react'
import api from '../services/api'
import { ArrowLeftIcon, MicrophoneIcon, PhoneIcon, SpeakerWaveIcon, SpeakerXMarkIcon } from '@heroicons/react/24/outline'
import { MicrophoneIcon as MicrophoneIconSolid, PhoneIcon as PhoneIconSolid } from '@heroicons/react/24/solid'

const TalkToAgent = () => {
  const { agentId } = useParams()
  const navigate = useNavigate()
  const [agent, setAgent] = useState(null)
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [messages, setMessages] = useState([])
  const [micMuted, setMicMuted] = useState(false)
  const [volume, setVolume] = useState(0.8)
  const [conversationId, setConversationId] = useState(null)

  // Initialize the conversation hook
  const conversation = useConversation({
    micMuted,
    volume,
    onConnect: () => {
      console.log('Conversation connected')
      setError(null)
    },
    onDisconnect: () => {
      console.log('Conversation disconnected')
      // Don't show error on normal disconnect
      if (conversation.status === 'disconnected' && conversationId) {
        // Only show error if we were connected and got unexpectedly disconnected
        // This will be handled by onError for actual errors
      }
    },
    onMessage: (message) => {
      console.log('Message received:', message)
      const messageContent = message.content || message.text || message.message || ''
      const messageRole = message.role || (message.source === 'ai' ? 'agent' : 'user')
      
      if (messageContent) {
        setMessages(prev => [...prev, {
          id: Date.now() + Math.random(),
          type: message.type || 'text',
          content: messageContent,
          role: messageRole,
          timestamp: new Date()
        }])
      }
    },
    onError: (err) => {
      console.error('Conversation error:', err)
      // Filter out connection errors that are being handled by reconnection
      const errorMessage = err?.message || err?.toString() || 'An error occurred during the conversation'
      
      // Don't show transient connection errors as they're being handled
      if (!errorMessage.includes('websocket') && 
          !errorMessage.includes('WebSocket') && 
          !errorMessage.includes('reconnect') &&
          !errorMessage.includes('ConnectionError')) {
        setError(errorMessage)
      }
    },
    onStatusChange: (status) => {
      console.log('Status changed:', status)
      // Clear error when successfully connected
      if (status.status === 'connected') {
        setError(null)
      }
    },
    onModeChange: (mode) => {
      console.log('Mode changed:', mode)
    }
  })

  useEffect(() => {
    fetchAgents()
    if (agentId) {
      fetchAgentDetails(agentId)
    }
  }, [agentId])

  const fetchAgents = async () => {
    try {
      const response = await api.get('/chat/agents')
      setAgents(response.data)
    } catch (err) {
      console.error('Error fetching agents:', err)
    }
  }

  const fetchAgentDetails = async (id) => {
    try {
      setLoading(true)
      setError(null)
      const response = await api.get(`/agents/${id}`)
      setAgent(response.data)
    } catch (err) {
      console.error('Error fetching agent:', err)
      setError('Failed to load agent. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleAgentChange = (e) => {
    const selectedAgentId = e.target.value
    if (selectedAgentId) {
      // End current conversation if active
      if (conversation.status === 'connected') {
        conversation.endSession()
      }
      navigate(`/talk-to/${selectedAgentId}`)
    }
  }

  const startConversation = async () => {
    if (!agentId) {
      setError('Please select an agent first')
      return
    }

    try {
      setError(null)
      setMessages([])

      // Request microphone permission first
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true })
      } catch (micError) {
        setError('Microphone access is required for voice conversations. Please allow microphone access and try again.')
        return
      }

      // Try WebSocket first as it's more stable than WebRTC for some network configurations
      // If that fails, try WebRTC
      let connectionEstablished = false
      
      // First, try with agentId using WebSocket (more stable)
      try {
        console.log('Attempting WebSocket connection...')
        const id = await conversation.startSession({
          agentId: agentId,
          connectionType: 'websocket',
        })
        setConversationId(id)
        console.log('Conversation started with WebSocket, ID:', id)
        connectionEstablished = true
      } catch (wsError) {
        console.log('WebSocket connection failed, trying WebRTC...', wsError)
        
        // Check for domain authorization error
        const errorMessage = wsError?.message || wsError?.reason || wsError?.toString() || ''
        if (errorMessage.includes('Access denied') || 
            errorMessage.includes('not authorized') || 
            errorMessage.includes('domain') ||
            (wsError?.code === 3000 && errorMessage.includes('authorized'))) {
          throw new Error(
            `Domain Authorization Required: Your domain (${window.location.hostname}) is not authorized to connect to this agent. ` +
            `Please add "${window.location.hostname}" to the agent's allowed domains in ElevenLabs Dashboard. ` +
            `Go to: ElevenLabs Dashboard → Select Agent → Security → Allowed Domains → Add "${window.location.hostname}"`
          )
        }
        
        // Try WebRTC as fallback
        try {
          const id = await conversation.startSession({
            agentId: agentId,
            connectionType: 'webrtc',
          })
          setConversationId(id)
          console.log('Conversation started with WebRTC, ID:', id)
          connectionEstablished = true
        } catch (webrtcError) {
          console.log('WebRTC also failed, checking for authorization error...', webrtcError)
          
          // Check for domain authorization error in WebRTC too
          const webrtcErrorMessage = webrtcError?.message || webrtcError?.reason || webrtcError?.toString() || ''
          if (webrtcErrorMessage.includes('Access denied') || 
              webrtcErrorMessage.includes('not authorized') || 
              webrtcErrorMessage.includes('domain') ||
              (webrtcError?.code === 3000 && webrtcErrorMessage.includes('authorized'))) {
            throw new Error(
              `Domain Authorization Required: Your domain (${window.location.hostname}) is not authorized to connect to this agent. ` +
              `Please add "${window.location.hostname}" to the agent's allowed domains in ElevenLabs Dashboard. ` +
              `Go to: ElevenLabs Dashboard → Select Agent → Security → Allowed Domains → Add "${window.location.hostname}"`
            )
          }
          
          console.log('Trying with signed URL...')
          // If both fail, try with signed URL (for authenticated agents)
          try {
            const response = await api.get('/chat/signed-url', {
              params: {
                agent_id: agentId,
                connection_type: 'websocket'
              }
            })
            
            if (response.data.signed_url) {
              const id = await conversation.startSession({
                signedUrl: response.data.signed_url,
                connectionType: 'websocket',
              })
              setConversationId(id)
              console.log('Conversation started with signed URL (WebSocket), ID:', id)
              connectionEstablished = true
            } else if (response.data.conversation_token) {
              const id = await conversation.startSession({
                conversationToken: response.data.conversation_token,
                connectionType: 'webrtc',
              })
              setConversationId(id)
              console.log('Conversation started with token (WebRTC), ID:', id)
              connectionEstablished = true
            } else {
              throw new Error('No signed URL or token received from server')
            }
          } catch (signedUrlError) {
            console.error('Error getting signed URL:', signedUrlError)
            throw new Error('Failed to start conversation. Please check your network connection and try again.')
          }
        }
      }
      
      if (!connectionEstablished) {
        throw new Error('Failed to establish connection with all methods')
      }
    } catch (err) {
      console.error('Error starting conversation:', err)
      setError(err.message || 'Failed to start conversation. Please try again.')
    }
  }

  const endConversation = async () => {
    try {
      await conversation.endSession()
      setConversationId(null)
      setMessages([])
    } catch (err) {
      console.error('Error ending conversation:', err)
      setError(err.message || 'Failed to end conversation')
    }
  }

  const toggleMute = () => {
    setMicMuted(!micMuted)
  }

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value)
    setVolume(newVolume)
    conversation.setVolume({ volume: newVolume })
  }

  if (loading && agentId) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <div className="text-gray-500">Loading agent...</div>
        </div>
      </div>
    )
  }

  const isConnected = conversation.status === 'connected'
  const isSpeaking = conversation.isSpeaking

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-3 py-2 shadow-sm z-10">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-1.5 hover:bg-gray-100 rounded transition-colors"
            >
              <ArrowLeftIcon className="h-4 w-4 text-gray-600" />
            </button>
            <div className="flex items-center space-x-2">
              <PhoneIcon className="h-4 w-4 text-gray-600" />
              <h1 className="text-base font-semibold text-gray-900">Talk to Agent</h1>
              {agent && (
                <span className="text-xs text-gray-500">• {agent.name}</span>
              )}
            </div>
          </div>
          
          {/* Agent Selector */}
          <select
            value={agentId || ''}
            onChange={handleAgentChange}
            disabled={isConnected}
            className="text-sm px-2.5 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            <option value="">Select agent...</option>
            {agents.map((a) => (
              <option key={a.agent_id} value={a.agent_id}>
                {a.name || a.agent_id}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-2.5 mx-3 mt-2 rounded">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-4 w-4 text-red-400 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-2 flex-1">
              <p className="text-xs text-red-700 whitespace-pre-line">{error}</p>
              {error.includes('Domain Authorization Required') && (
                <div className="mt-2 bg-white rounded p-2 border border-red-200">
                  <p className="text-xs font-semibold text-red-900 mb-1.5">Quick Fix:</p>
                  <ol className="text-xs text-red-800 list-decimal list-inside space-y-0.5">
                    <li>Go to <a href="https://elevenlabs.io/app" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">ElevenLabs Dashboard</a></li>
                    <li>Agent: <code className="bg-red-100 px-1 rounded text-xs">{agentId}</code> → Security → Allowed Domains</li>
                    <li>Add: <code className="bg-red-100 px-1 rounded text-xs">{window.location.hostname}</code> (no http://)</li>
                    <li>Save and refresh</li>
                  </ol>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {!agentId ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <PhoneIcon className="h-16 w-16 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500 text-base mb-1">No agent selected</p>
              <p className="text-gray-400 text-xs">Select an agent from the dropdown above</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center p-4 overflow-y-auto">
            {/* Conversation Status */}
            <div className="w-full max-w-xl mb-4 flex-shrink-0">
              <div className="bg-white rounded-lg shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`}></div>
                    <span className="text-xs font-medium text-gray-700">
                      {isConnected ? 'Connected' : 'Disconnected'}
                    </span>
                    {conversationId && (
                      <span className="text-xs text-gray-400">• {conversationId.substring(0, 12)}...</span>
                    )}
                  </div>
                </div>

                {/* Control Buttons */}
                <div className="flex items-center justify-center space-x-2 mb-3">
                  {!isConnected ? (
                    <button
                      onClick={startConversation}
                      className="flex items-center space-x-1.5 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm font-medium transition-colors shadow-sm"
                    >
                      <PhoneIconSolid className="h-4 w-4" />
                      <span>Start Call</span>
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={toggleMute}
                        className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          micMuted
                            ? 'bg-red-500 text-white hover:bg-red-600'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        {micMuted ? (
                          <MicrophoneIcon className="h-4 w-4" />
                        ) : (
                          <MicrophoneIconSolid className="h-4 w-4" />
                        )}
                        <span>{micMuted ? 'Unmute' : 'Mute'}</span>
                      </button>
                      <button
                        onClick={endConversation}
                        className="flex items-center space-x-1.5 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm font-medium transition-colors shadow-sm"
                      >
                        <PhoneIconSolid className="h-4 w-4" />
                        <span>End Call</span>
                      </button>
                    </>
                  )}
                </div>

                {/* Volume Control & Speaking Indicator */}
                {isConnected && (
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2 flex-1">
                      {volume > 0 ? (
                        <SpeakerWaveIcon className="h-4 w-4 text-gray-500" />
                      ) : (
                        <SpeakerXMarkIcon className="h-4 w-4 text-gray-500" />
                      )}
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={volume}
                        onChange={handleVolumeChange}
                        className="flex-1 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                      />
                      <span className="text-xs text-gray-600 w-10 text-right">{Math.round(volume * 100)}%</span>
                    </div>
                    {isSpeaking && (
                      <div className="flex items-center space-x-1.5 text-blue-600 ml-3">
                        <div className="animate-pulse">
                          <SpeakerWaveIcon className="h-4 w-4" />
                        </div>
                        <span className="text-xs font-medium">Speaking...</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Messages Display */}
            {messages.length > 0 && (
              <div className="w-full max-w-xl bg-white rounded-lg shadow-sm p-3 mb-4 flex-shrink-0">
                <h3 className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">Messages</h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`p-2 rounded text-xs ${
                        msg.role === 'user'
                          ? 'bg-blue-50 text-blue-900 ml-auto text-right'
                          : 'bg-gray-50 text-gray-900'
                      }`}
                    >
                      <p className="text-xs">{msg.content}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {msg.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Instructions */}
            {!isConnected && (
              <div className="w-full max-w-xl bg-blue-50 border border-blue-200 rounded-lg p-2.5 flex-shrink-0">
                <p className="text-xs text-blue-800">
                  <strong>Tip:</strong> Click "Start Call" and allow microphone access to begin
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default TalkToAgent
