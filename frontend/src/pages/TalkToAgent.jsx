import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../services/api'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'

const TalkToAgent = () => {
  const { agentId } = useParams()
  const navigate = useNavigate()
  const [agent, setAgent] = useState(null)
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [widgetReady, setWidgetReady] = useState(false)
  const widgetContainerRef = useRef(null)
  const scriptLoadedRef = useRef(false)

  useEffect(() => {
    // Load ElevenLabs widget script
    if (!scriptLoadedRef.current) {
      const existingScript = document.querySelector('script[src*="convai-widget-embed"]')
      if (!existingScript) {
        const script = document.createElement('script')
        script.src = 'https://unpkg.com/@elevenlabs/convai-widget-embed'
        script.async = true
        script.type = 'text/javascript'
        script.onload = () => {
          console.log('ElevenLabs widget script loaded')
          scriptLoadedRef.current = true
          // Wait a bit for custom element registration
          setTimeout(() => {
            setWidgetReady(true)
            if (agentId) {
              createWidget(agentId)
            }
          }, 500)
        }
        script.onerror = () => {
          console.error('Failed to load widget script')
          setError('Failed to load voice widget. Please refresh the page.')
        }
        document.body.appendChild(script)
      } else {
        scriptLoadedRef.current = true
        setWidgetReady(true)
        if (agentId) {
          setTimeout(() => createWidget(agentId), 500)
        }
      }
    }
  }, [])

  useEffect(() => {
    fetchAgents()
    if (agentId) {
      fetchAgentDetails(agentId)
      if (widgetReady) {
        createWidget(agentId)
      }
    }
  }, [agentId, widgetReady])

  const createWidget = (agentIdValue) => {
    if (!widgetContainerRef.current) return
    
    // Clear existing widget
    widgetContainerRef.current.innerHTML = ''
    
    // Wait for custom element to be registered
    setTimeout(() => {
      try {
        if (customElements.get('elevenlabs-convai')) {
          const widgetElement = document.createElement('elevenlabs-convai')
          widgetElement.setAttribute('agent-id', agentIdValue)
          widgetContainerRef.current.appendChild(widgetElement)
          console.log('Widget created for agent:', agentIdValue)
          setError(null)
        } else {
          // Try innerHTML approach
          widgetContainerRef.current.innerHTML = `<elevenlabs-convai agent-id="${agentIdValue}"></elevenlabs-convai>`
          console.log('Widget created via innerHTML')
        }
      } catch (err) {
        console.error('Error creating widget:', err)
        setError('Widget failed to load. Please ensure your domain is allowlisted in ElevenLabs agent settings.')
      }
    }, 200)
  }

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
      navigate(`/talk-to/${selectedAgentId}`)
    }
  }

  const getTalkToUrl = (agentId) => {
    return `https://elevenlabs.io/app/talk-to?agent_id=${agentId}`
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
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
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
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-hidden relative">
        {!agentId ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <svg className="h-24 w-24 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <p className="text-gray-500 text-lg mb-2">No agent selected</p>
              <p className="text-gray-400 text-sm">Please select an agent from the dropdown above to start a voice conversation</p>
            </div>
          </div>
        ) : (
          <div className="h-full w-full p-8">
            <div 
              ref={widgetContainerRef}
              className="w-full h-full min-h-[600px] flex items-center justify-center"
            >
              {!widgetReady && (
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                  <p className="text-gray-500">Loading voice conversation interface...</p>
                </div>
              )}
              {error && (
                <div className="text-center max-w-md mx-auto">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-4">
                    <p className="text-red-600 mb-4">{error}</p>
                    <div className="text-left text-sm text-gray-600 bg-white p-4 rounded mb-4">
                      <p className="font-semibold mb-2">To fix this, add your domain to ElevenLabs allowlist:</p>
                      <ol className="list-decimal list-inside space-y-1">
                        <li>Go to <a href="https://elevenlabs.io/app" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">ElevenLabs Dashboard</a></li>
                        <li>Select agent: <code className="bg-gray-100 px-1 rounded text-xs">{agentId}</code></li>
                        <li>Go to <strong>"Security"</strong> tab</li>
                        <li>In the <strong>"Allowed Domains"</strong> section, add:</li>
                        <li className="ml-4 mt-2">
                          <code className="bg-gray-100 px-2 py-1 rounded block text-xs font-mono">
                            {window.location.hostname}
                          </code>
                          <p className="text-xs text-gray-500 mt-1">
                            Current domain: <strong>{window.location.hostname}</strong>
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
                              ? '⚠️ For production, use your actual domain (e.g., yourdomain.com)'
                              : '✅ Use this domain in ElevenLabs settings'
                            }
                          </p>
                        </li>
                        <li>Click <strong>"Save"</strong></li>
                        <li>Refresh this page</li>
                      </ol>
                      <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-xs">
                        <p className="font-semibold text-yellow-800 mb-1">Note:</p>
                        <p className="text-yellow-700">
                          If you're using localhost for development, you can add <code className="bg-yellow-100 px-1 rounded">localhost</code> to the allowlist. 
                          For production, add your actual domain (e.g., <code className="bg-yellow-100 px-1 rounded">yourdomain.com</code> or <code className="bg-yellow-100 px-1 rounded">app.yourdomain.com</code>).
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => window.location.reload()}
                      className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                    >
                      Refresh Page
                    </button>
                  </div>
                  <p className="text-gray-500 text-sm mt-4">Or use the button below to open in ElevenLabs directly:</p>
                  <button
                    onClick={() => {
                      window.location.href = getTalkToUrl(agentId)
                    }}
                    className="mt-4 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-purple-700 transition-all"
                  >
                    Open in ElevenLabs
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default TalkToAgent
