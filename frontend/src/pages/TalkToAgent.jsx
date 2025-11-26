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
  const [widgetLoaded, setWidgetLoaded] = useState(false)
  const widgetContainerRef = useRef(null)
  const scriptLoadedRef = useRef(false)
  const checkIntervalRef = useRef(null)

  useEffect(() => {
    console.log('TalkToAgent mounted, agentId:', agentId)
    console.log('Current domain:', window.location.hostname)
    
    // Load ElevenLabs widget script
    if (!scriptLoadedRef.current) {
      const existingScript = document.querySelector('script[src*="convai-widget-embed"]')
      if (!existingScript) {
        console.log('Loading ElevenLabs widget script...')
        const script = document.createElement('script')
        script.src = 'https://unpkg.com/@elevenlabs/convai-widget-embed'
        script.async = true
        script.type = 'text/javascript'
        script.onload = () => {
          console.log('ElevenLabs widget script loaded successfully')
          scriptLoadedRef.current = true
          // Wait a bit for custom element registration
          setTimeout(() => {
            console.log('Checking for custom element registration...')
            if (customElements.get('elevenlabs-convai')) {
              console.log('Custom element elevenlabs-convai is registered')
            } else {
              console.warn('Custom element elevenlabs-convai not found after script load')
            }
            setWidgetReady(true)
            if (agentId) {
              createWidget(agentId)
            }
          }, 1000) // Increased timeout
        }
        script.onerror = (err) => {
          console.error('Failed to load widget script:', err)
          setError('Failed to load voice widget script. Please check your internet connection and refresh the page.')
        }
        document.body.appendChild(script)
      } else {
        console.log('Widget script already exists')
        scriptLoadedRef.current = true
        setWidgetReady(true)
        if (agentId) {
          setTimeout(() => createWidget(agentId), 1000)
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
  
  // Auto-redirect fallback if widget doesn't load after 15 seconds
  useEffect(() => {
    if (agentId && !widgetLoaded && !error) {
      const redirectTimer = setTimeout(() => {
        console.log('Widget taking too long, redirecting to ElevenLabs...')
        window.location.href = getTalkToUrl(agentId)
      }, 15000) // 15 seconds
      
      return () => clearTimeout(redirectTimer)
    }
  }, [agentId, widgetLoaded, error])

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
          
          // Check if widget actually rendered after a delay
          setTimeout(() => {
            const widget = widgetContainerRef.current?.querySelector('elevenlabs-convai')
            if (widget && widget.offsetHeight > 0) {
              setWidgetLoaded(true)
              console.log('Widget successfully rendered')
            } else {
              console.warn('Widget element created but not rendering')
              setError('Widget not rendering. Please ensure your domain (callai.dialdesk.in) is allowlisted in ElevenLabs agent settings.')
            }
          }, 2000)
        } else {
          // Try innerHTML approach
          widgetContainerRef.current.innerHTML = `<elevenlabs-convai agent-id="${agentIdValue}"></elevenlabs-convai>`
          console.log('Widget created via innerHTML')
          
          // Check if it rendered
          setTimeout(() => {
            const widget = widgetContainerRef.current?.querySelector('elevenlabs-convai')
            if (widget && widget.offsetHeight > 0) {
              setWidgetLoaded(true)
            } else {
              setError('Widget not rendering. Please ensure your domain (callai.dialdesk.in) is allowlisted in ElevenLabs agent settings.')
            }
          }, 2000)
        }
      } catch (err) {
        console.error('Error creating widget:', err)
        setError('Widget failed to load. Please ensure your domain (callai.dialdesk.in) is allowlisted in ElevenLabs agent settings.')
      }
    }, 200)
  }
  
  // Check widget status periodically
  useEffect(() => {
    if (agentId && widgetReady) {
      checkIntervalRef.current = setInterval(() => {
        const widget = widgetContainerRef.current?.querySelector('elevenlabs-convai')
        if (widget && widget.offsetHeight > 0 && !widgetLoaded) {
          setWidgetLoaded(true)
          setError(null)
          if (checkIntervalRef.current) {
            clearInterval(checkIntervalRef.current)
          }
        }
      }, 1000)
      
      // Timeout after 10 seconds
      setTimeout(() => {
        if (checkIntervalRef.current) {
          clearInterval(checkIntervalRef.current)
        }
        if (!widgetLoaded) {
          setError('Widget is taking too long to load. Please ensure callai.dialdesk.in is allowlisted in ElevenLabs agent settings.')
        }
      }, 10000)
    }
    
    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current)
      }
    }
  }, [agentId, widgetReady, widgetLoaded])

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
              className="w-full h-full min-h-[600px] flex items-center justify-center bg-white rounded-lg shadow-sm"
            >
              {!widgetReady && !error && (
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                  <p className="text-gray-500">Loading voice conversation interface...</p>
                  <p className="text-gray-400 text-sm mt-2">Please wait...</p>
                </div>
              )}
              {error && (
                <div className="text-center max-w-2xl mx-auto">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-4">
                    <p className="text-red-600 mb-4 font-semibold">{error}</p>
                    <div className="text-left text-sm text-gray-600 bg-white p-4 rounded mb-4">
                      <p className="font-semibold mb-3 text-base">To fix this, add your domain to ElevenLabs allowlist:</p>
                      <ol className="list-decimal list-inside space-y-2">
                        <li>Go to <a href="https://elevenlabs.io/app" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-semibold">ElevenLabs Dashboard</a></li>
                        <li>Select agent: <code className="bg-gray-100 px-2 py-1 rounded text-xs font-mono">{agentId}</code></li>
                        <li>Go to <strong>"Security"</strong> tab</li>
                        <li>In the <strong>"Allowed Domains"</strong> section, add:</li>
                        <li className="ml-4 mt-2">
                          <code className="bg-blue-50 border border-blue-200 px-3 py-2 rounded block text-sm font-mono text-blue-800">
                            callai.dialdesk.in
                          </code>
                          <p className="text-xs text-gray-600 mt-2">
                            <strong>Important:</strong> Add exactly <code className="bg-gray-100 px-1 rounded">callai.dialdesk.in</code> (without http:// or https://)
                          </p>
                        </li>
                        <li>Click <strong>"Save"</strong></li>
                        <li>Wait a few seconds, then refresh this page</li>
                      </ol>
                    </div>
                    <div className="flex gap-3 justify-center">
                      <button
                        onClick={() => window.location.reload()}
                        className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium"
                      >
                        Refresh Page
                      </button>
                      <button
                        onClick={() => {
                          // Open in same window - seamless redirect
                          window.location.href = getTalkToUrl(agentId)
                        }}
                        className="px-6 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 font-medium"
                      >
                        Open in ElevenLabs
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {!error && !widgetLoaded && widgetReady && (
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                  <p className="text-gray-500">Initializing voice conversation...</p>
                  <p className="text-gray-400 text-sm mt-2">This may take a few moments</p>
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
