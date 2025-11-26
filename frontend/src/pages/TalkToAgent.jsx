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
  const [diagnostics, setDiagnostics] = useState([])
  const widgetContainerRef = useRef(null)
  const scriptLoadedRef = useRef(false)
  const checkIntervalRef = useRef(null)
  
  const addDiagnostic = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString()
    setDiagnostics(prev => [...prev, { timestamp, message, type }])
    console.log(`[${timestamp}] ${message}`)
  }

  useEffect(() => {
    addDiagnostic('Component mounted', 'info')
    addDiagnostic(`Current domain: ${window.location.hostname}`, 'info')
    addDiagnostic(`Agent ID: ${agentId || 'none'}`, 'info')
    
    // Check if widget script is already loaded (from index.html)
    const checkScriptLoaded = () => {
      const existingScript = document.querySelector('script[src*="convai-widget-embed"]')
      if (existingScript) {
        addDiagnostic('Widget script found in DOM', 'success')
        addDiagnostic(`Script src: ${existingScript.src}`, 'info')
        
        // Wait for script to fully load (especially if it's a module)
        const scriptLoadCheck = () => {
          // Check if custom element is registered
          if (customElements.get('elevenlabs-convai')) {
            addDiagnostic('Custom element registered', 'success')
            scriptLoadedRef.current = true
            setWidgetReady(true)
            if (agentId) {
              setTimeout(() => createWidget(agentId), 500)
            }
          } else {
            // Wait for script to load and register custom element
            addDiagnostic('Waiting for custom element registration...', 'info')
            let attempts = 0
            const maxAttempts = 20 // 10 seconds total
            
            const checkInterval = setInterval(() => {
              attempts++
              if (customElements.get('elevenlabs-convai')) {
                addDiagnostic('Custom element registered', 'success')
                clearInterval(checkInterval)
                scriptLoadedRef.current = true
                setWidgetReady(true)
                if (agentId) {
                  createWidget(agentId)
                }
              } else if (attempts >= maxAttempts) {
                addDiagnostic('Custom element not registered after 10 seconds', 'error')
                addDiagnostic('Available custom elements: ' + Array.from(customElements.entries?.() || []).join(', '), 'error')
                clearInterval(checkInterval)
                setError('Widget script loaded but custom element not registered. Check browser console for errors.')
              }
            }, 500)
          }
        }
        
        // If script is already loaded, check immediately
        if (existingScript.complete || existingScript.readyState === 'complete') {
          scriptLoadCheck()
        } else {
          // Wait for script to load
          existingScript.addEventListener('load', scriptLoadCheck)
          existingScript.addEventListener('error', () => {
            addDiagnostic('Script failed to load', 'error')
            setError('Failed to load widget script. Please check your internet connection.')
          })
        }
      } else {
        // Script not in DOM, wait for it (it's loaded from index.html)
        addDiagnostic('Waiting for widget script to load from index.html...', 'info')
        const checkScript = setInterval(() => {
          const script = document.querySelector('script[src*="convai-widget-embed"]')
          if (script) {
            addDiagnostic('Script found, checking registration...', 'info')
            clearInterval(checkScript)
            checkScriptLoaded()
          }
        }, 500)
        
        setTimeout(() => {
          clearInterval(checkScript)
          if (!document.querySelector('script[src*="convai-widget-embed"]')) {
            addDiagnostic('Widget script not found after 10 seconds', 'error')
            setError('Widget script not found. Please ensure the script is loaded.')
          }
        }, 10000)
      }
    }
    
    // Wait a bit for page to fully load
    if (document.readyState === 'complete') {
      checkScriptLoaded()
    } else {
      window.addEventListener('load', checkScriptLoaded)
      return () => window.removeEventListener('load', checkScriptLoaded)
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
  
  // Auto-redirect fallback if widget doesn't load after 20 seconds
  useEffect(() => {
    if (agentId && !widgetLoaded && !error) {
      const redirectTimer = setTimeout(() => {
        console.log('Widget taking too long, showing redirect option...')
        // Don't auto-redirect, just show error with redirect option
        setError('Widget is taking too long to load. Please use the button below to open in ElevenLabs, or ensure callai.dialdesk.in is properly allowlisted.')
      }, 20000) // 20 seconds
      
      return () => clearTimeout(redirectTimer)
    }
  }, [agentId, widgetLoaded, error])

  const createWidget = (agentIdValue) => {
    if (!widgetContainerRef.current) {
      console.error('Widget container ref not available')
      return
    }
    
    console.log('Creating widget for agent:', agentIdValue)
    console.log('Container element:', widgetContainerRef.current)
    
    // Clear existing widget
    widgetContainerRef.current.innerHTML = ''
    
    // Wait for custom element to be registered
    setTimeout(() => {
      try {
        const customElementDefined = customElements.get('elevenlabs-convai')
        console.log('Custom element check:', {
          defined: !!customElementDefined,
          allCustomElements: Array.from(customElements.entries?.() || [])
        })
        
        if (customElementDefined) {
          addDiagnostic('Creating widget element...', 'info')
          const widgetElement = document.createElement('elevenlabs-convai')
          widgetElement.setAttribute('agent-id', agentIdValue)
          
          // Add event listeners to debug
          widgetElement.addEventListener('error', (e) => {
            addDiagnostic('Widget error event: ' + (e.message || 'Unknown'), 'error')
            console.error('Widget error event:', e)
            setError('Widget error: ' + (e.message || 'Unknown error'))
          })
          
          // Listen for any console errors from the widget
          const originalError = console.error
          console.error = (...args) => {
            if (args.some(arg => typeof arg === 'string' && (arg.includes('elevenlabs') || arg.includes('convai') || arg.includes('agent')))) {
              addDiagnostic('Console error: ' + args.join(' '), 'error')
            }
            originalError.apply(console, args)
          }
          
          widgetContainerRef.current.appendChild(widgetElement)
          console.log('Widget element appended to DOM:', {
            element: widgetElement,
            parent: widgetContainerRef.current,
            agentId: agentIdValue
          })
          setError(null)
          
          // Check widget rendering with multiple attempts
          let checkCount = 0
          const maxChecks = 10
          const checkWidget = () => {
            checkCount++
            const widget = widgetContainerRef.current?.querySelector('elevenlabs-convai')
            console.log(`Widget check #${checkCount}:`, {
              found: !!widget,
              offsetHeight: widget?.offsetHeight,
              offsetWidth: widget?.offsetWidth,
              innerHTML: widget?.innerHTML?.substring(0, 50),
              shadowRoot: widget?.shadowRoot ? 'exists' : 'none',
              computedStyle: widget ? window.getComputedStyle(widget).display : 'N/A'
            })
            
            if (widget) {
              const hasContent = widget.offsetHeight > 0 || 
                                widget.shadowRoot || 
                                widget.innerHTML.trim().length > 0 ||
                                window.getComputedStyle(widget).display !== 'none'
              
              if (hasContent) {
                setWidgetLoaded(true)
                console.log('✓ Widget successfully rendered!')
                return
              }
            }
            
            if (checkCount < maxChecks) {
              setTimeout(checkWidget, 1000)
            } else {
              console.error('Widget failed to render after', maxChecks, 'checks')
              // Check for specific error messages in console
              setError('Widget not rendering after multiple attempts. Please check: 1) Domain is allowlisted (callai.dialdesk.in), 2) Browser console for errors, 3) Network tab for failed requests.')
            }
          }
          
          // Start checking after initial delay
          setTimeout(checkWidget, 1000)
        } else {
          // Custom element not registered
          console.error('Custom element elevenlabs-convai is not registered!')
          console.log('Available custom elements:', Array.from(customElements.entries?.() || []))
          console.log('Scripts in DOM:', Array.from(document.querySelectorAll('script')).map(s => s.src))
          
          // Try innerHTML approach as fallback
          console.log('Attempting fallback: innerHTML approach')
          widgetContainerRef.current.innerHTML = `<elevenlabs-convai agent-id="${agentIdValue}"></elevenlabs-convai>`
          
          setTimeout(() => {
            const widget = widgetContainerRef.current?.querySelector('elevenlabs-convai')
            if (widget) {
              console.log('Fallback widget element found')
              if (widget.offsetHeight > 0 || widget.shadowRoot || widget.innerHTML.trim().length > 0) {
                setWidgetLoaded(true)
              } else {
                setError('Widget script may not be loaded. Please refresh the page and check browser console.')
              }
            } else {
              setError('Failed to create widget element. Please refresh the page.')
            }
          }, 3000)
        }
      } catch (err) {
        console.error('Error creating widget:', err)
        console.error('Error stack:', err.stack)
        setError('Widget failed to load: ' + err.message)
      }
    }, 500)
  }
  
  // Monitor network errors
  useEffect(() => {
    const handleError = (event) => {
      if (event.target && event.target.tagName === 'SCRIPT') {
        console.error('Script load error:', event.target.src)
        if (event.target.src.includes('elevenlabs') || event.target.src.includes('convai')) {
          setError('Failed to load widget script. Please check your internet connection.')
        }
      }
    }
    
    window.addEventListener('error', handleError, true)
    return () => window.removeEventListener('error', handleError, true)
  }, [])

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

      {/* Diagnostics Panel - Always visible when there are diagnostics */}
      {diagnostics.length > 0 && (
        <div className="bg-gray-900 text-green-400 p-4 mx-4 mt-2 rounded font-mono text-xs max-h-40 overflow-y-auto border border-gray-700">
          <div className="font-bold mb-2 text-white">Debug Logs (Check Console for Details):</div>
          {diagnostics.slice(-8).map((diag, idx) => (
            <div key={idx} className={diag.type === 'error' ? 'text-red-400' : diag.type === 'success' ? 'text-green-400' : 'text-gray-400'}>
              [{diag.timestamp}] {diag.message}
            </div>
          ))}
          <button
            onClick={() => {
              console.log('=== Full Diagnostics ===')
              console.log('Domain:', window.location.hostname)
              console.log('Agent ID:', agentId)
              console.log('Script loaded:', !!document.querySelector('script[src*="convai-widget-embed"]'))
              console.log('Custom element registered:', !!customElements.get('elevenlabs-convai'))
              console.log('Widget element:', widgetContainerRef.current?.querySelector('elevenlabs-convai'))
              console.log('All scripts:', Array.from(document.querySelectorAll('script')).map(s => s.src))
            }}
            className="mt-2 px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
          >
            Log Full Details to Console
          </button>
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
              className="w-full h-full min-h-[600px] flex items-center justify-center bg-white rounded-lg shadow-sm relative"
              style={{ minHeight: '600px' }}
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
                  <p className="text-gray-400 text-xs mt-4">
                    If this takes too long, the widget may not be loading properly.
                    <br />
                    Check browser console (F12) for errors.
                  </p>
                </div>
              )}
              {widgetLoaded && !error && (
                <div className="absolute top-4 right-4 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-green-700 text-xs z-10">
                  <p>✓ Voice conversation interface loaded</p>
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
