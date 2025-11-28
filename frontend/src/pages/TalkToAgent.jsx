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
      <div className="bg-white border-b border-gray-200 px-4 py-3 shadow-sm z-10">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeftIcon className="h-5 w-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-xl font-semibold text-gray-900 flex items-center space-x-2">
                <PhoneIcon className="h-6 w-6" />
                <span>Talk to Agent</span>
              </h1>
              {agent && (
                <p className="text-sm text-gray-500">{agent.name}</p>
              )}
            </div>
          </div>
          
          {/* Agent Selector */}
          <div className="flex items-center space-x-2">
            <label className="text-sm text-gray-600">Agent:</label>
            <select
              value={agentId || ''}
              onChange={handleAgentChange}
              disabled={isConnected}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="">Select an agent...</option>
              {agents.map((a) => (
                <option key={a.agent_id} value={a.agent_id}>
                  {a.name || a.agent_id}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 mx-4 mt-4 rounded">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <p className="text-sm text-red-700 whitespace-pre-line">{error}</p>
              {error.includes('Domain Authorization Required') && (
                <div className="mt-3 bg-white rounded p-3 border border-red-200">
                  <p className="text-xs font-semibold text-red-900 mb-2">Quick Fix Steps:</p>
                  <ol className="text-xs text-red-800 list-decimal list-inside space-y-1">
                    <li>Go to <a href="https://elevenlabs.io/app" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-semibold">ElevenLabs Dashboard</a></li>
                    <li>Select your agent: <code className="bg-red-100 px-1 py-0.5 rounded text-xs font-mono">{agentId}</code></li>
                    <li>Click on the <strong>"Security"</strong> tab</li>
                    <li>In <strong>"Allowed Domains"</strong>, add: <code className="bg-red-100 px-1 py-0.5 rounded text-xs font-mono">{window.location.hostname}</code></li>
                    <li>Click <strong>"Save"</strong></li>
                    <li>Wait a few seconds, then refresh this page</li>
                  </ol>
                  <p className="text-xs text-red-700 mt-2">
                    <strong>Important:</strong> Add exactly <code className="bg-red-100 px-1 py-0.5 rounded">{window.location.hostname}</code> (without http:// or https://)
                  </p>
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
              <PhoneIcon className="h-24 w-24 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 text-lg mb-2">No agent selected</p>
              <p className="text-gray-400 text-sm">Please select an agent from the dropdown above to start a voice conversation</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8">
            {/* Conversation Status */}
            <div className="w-full max-w-2xl mb-6">
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Voice Conversation</h2>
                    {conversationId && (
                      <p className="text-xs text-gray-500 mt-1">ID: {conversationId}</p>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className={`h-3 w-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`}></div>
                    <span className="text-sm text-gray-600">
                      {isConnected ? 'Connected' : 'Disconnected'}
                    </span>
                  </div>
                </div>

                {/* Control Buttons */}
                <div className="flex items-center justify-center space-x-4 mb-6">
                  {!isConnected ? (
                    <button
                      onClick={startConversation}
                      className="flex items-center space-x-2 px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium transition-colors shadow-md"
                    >
                      <PhoneIconSolid className="h-5 w-5" />
                      <span>Start Call</span>
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={toggleMute}
                        className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                          micMuted
                            ? 'bg-red-500 text-white hover:bg-red-600'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        {micMuted ? (
                          <MicrophoneIcon className="h-5 w-5" />
                        ) : (
                          <MicrophoneIconSolid className="h-5 w-5" />
                        )}
                        <span>{micMuted ? 'Unmute' : 'Mute'}</span>
                      </button>
                      <button
                        onClick={endConversation}
                        className="flex items-center space-x-2 px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 font-medium transition-colors shadow-md"
                      >
                        <PhoneIconSolid className="h-5 w-5" />
                        <span>End Call</span>
                      </button>
                    </>
                  )}
                </div>

                {/* Volume Control */}
                {isConnected && (
                  <div className="mb-4">
                    <label className="flex items-center space-x-2 text-sm text-gray-600 mb-2">
                      {volume > 0 ? (
                        <SpeakerWaveIcon className="h-5 w-5" />
                      ) : (
                        <SpeakerXMarkIcon className="h-5 w-5" />
                      )}
                      <span>Volume: {Math.round(volume * 100)}%</span>
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={volume}
                      onChange={handleVolumeChange}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                )}

                {/* Speaking Indicator */}
                {isConnected && isSpeaking && (
                  <div className="flex items-center justify-center space-x-2 text-blue-600 mb-4">
                    <div className="animate-pulse">
                      <SpeakerWaveIcon className="h-5 w-5" />
                    </div>
                    <span className="text-sm font-medium">Agent is speaking...</span>
                  </div>
                )}

                {/* Connection Warning */}
                {isConnected && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                    <p className="text-xs text-yellow-800">
                      <strong>Note:</strong> If you experience connection issues, check that your firewall/network allows WebSocket connections to <code className="bg-yellow-100 px-1 rounded">livekit.rtc.elevenlabs.io</code>
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Messages Display */}
            {messages.length > 0 && (
              <div className="w-full max-w-2xl bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Conversation</h3>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`p-3 rounded-lg ${
                        msg.role === 'user'
                          ? 'bg-blue-50 text-blue-900 ml-auto text-right'
                          : 'bg-gray-50 text-gray-900'
                      }`}
                    >
                      <p className="text-sm">{msg.content}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {msg.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Instructions */}
            {!isConnected && (
              <div className="w-full max-w-2xl mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">How to use:</h4>
                <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                  <li>Click "Start Call" to begin the voice conversation</li>
                  <li>Allow microphone access when prompted</li>
                  <li>Speak naturally - the agent will respond</li>
                  <li>Use the mute button to temporarily disable your microphone</li>
                  <li>Adjust volume using the slider</li>
                  <li>Click "End Call" when finished</li>
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default TalkToAgent
