import { useState, useEffect } from 'react'
import api from '../services/api'
import { XMarkIcon } from '@heroicons/react/24/outline'

const AgentForm = ({ agent, onClose }) => {
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    system_prompt: '',
    first_message: '',
    knowledge_base_url: '',
    knowledge_base_text: '',
    knowledge_base_file: '',
    voice_id: '',
    language: 'en',
    llm_model: 'gpt-4o-mini',
  })
  
  // Debug: log formData changes
  useEffect(() => {
    console.log('FormData state changed:', {
      name: formData.name?.substring(0, 30) || 'empty',
      system_prompt_length: formData.system_prompt?.length || 0,
      first_message_length: formData.first_message?.length || 0,
      voice_id: formData.voice_id || 'empty',
      language: formData.language || 'empty',
      llm_model: formData.llm_model || 'empty',
    })
  }, [formData])

  useEffect(() => {
    const fetchAgentData = async () => {
      if (agent && agent.agent_id) {
        setLoadingData(true)
        try {
          // Fetch full agent details from API
          const response = await api.get(`/agents/${agent.agent_id}`)
          const agentData = response.data
          
          console.log('=== Fetched agent data ===')
          console.log('Full response:', JSON.stringify(agentData, null, 2))
          console.log('System prompt:', agentData.system_prompt)
          console.log('First message:', agentData.first_message)
          console.log('Voice ID:', agentData.voice_id)
          console.log('Language:', agentData.language)
          console.log('LLM Model:', agentData.llm_model)
          console.log('Knowledge base:', agentData.knowledge_base)
          
          // Populate form with existing agent data
          // Handle knowledge_base - it might be null, undefined, or an object
          let kb = {}
          if (agentData.knowledge_base && agentData.knowledge_base !== null) {
            if (typeof agentData.knowledge_base === 'object' && !Array.isArray(agentData.knowledge_base)) {
              kb = agentData.knowledge_base
            }
          }
          
          // Handle null values - convert to empty strings for form fields
          const formDataToSet = {
            name: agentData.name || '',
            system_prompt: (agentData.system_prompt !== null && agentData.system_prompt !== undefined) ? String(agentData.system_prompt) : '',
            first_message: (agentData.first_message !== null && agentData.first_message !== undefined) ? String(agentData.first_message) : '',
            knowledge_base_url: kb.url || '',
            knowledge_base_text: kb.text || '',
            knowledge_base_file: kb.file || '',
            voice_id: (agentData.voice_id !== null && agentData.voice_id !== undefined) ? String(agentData.voice_id) : '',
            language: (agentData.language !== null && agentData.language !== undefined) ? String(agentData.language) : 'en',
            llm_model: (agentData.llm_model !== null && agentData.llm_model !== undefined) ? String(agentData.llm_model) : 'gpt-4o-mini',
          }
          
          console.log('=== Setting form data ===')
          console.log('Form data to set:', JSON.stringify(formDataToSet, null, 2))
          console.log('System prompt length:', formDataToSet.system_prompt?.length || 0)
          console.log('First message length:', formDataToSet.first_message?.length || 0)
          
          console.log('=== Calling setFormData ===')
          setFormData(formDataToSet)
          
          // Verify the state was set by logging after a small delay
          setTimeout(() => {
            console.log('=== Form data after setState (100ms later) ===')
            console.log('This should show the updated state in the component')
          }, 100)
          
          // Force a re-render by updating a dummy state
          console.log('Form data set, component should re-render')
        } catch (error) {
          console.error('Error fetching agent details:', error)
          console.error('Error response:', error.response?.data)
          // Fallback to agent data from list if API call fails
          let kb = {}
          if (agent.knowledge_base) {
            if (typeof agent.knowledge_base === 'object') {
              kb = agent.knowledge_base
            }
          }
          setFormData({
            name: agent.name || '',
            system_prompt: agent.system_prompt || '',
            first_message: agent.first_message || '',
            knowledge_base_url: kb.url || '',
            knowledge_base_text: kb.text || '',
            knowledge_base_file: kb.file || '',
            voice_id: agent.voice_id || '',
            language: agent.language || 'en',
            llm_model: agent.llm_model || 'gpt-4o-mini',
          })
        } finally {
          setLoadingData(false)
        }
      } else {
        // Reset form for new agent
        setFormData({
          name: '',
          system_prompt: '',
          first_message: '',
          knowledge_base_url: '',
          knowledge_base_text: '',
          knowledge_base_file: '',
          voice_id: '',
          language: 'en',
          llm_model: 'gpt-4o-mini',
        })
        setLoadingData(false)
      }
    }

    fetchAgentData()
  }, [agent])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (agent) {
        // UPDATE EXISTING AGENT
        // For updates, only send fields that should change in ElevenLabs.
        // This prevents overwriting other agent settings (voice, language, kb, etc.)
        // that might have been configured directly in ElevenLabs.
        const payload = {}

        if (formData.system_prompt) {
          payload.system_prompt = formData.system_prompt
        }

        if (formData.first_message) {
          payload.first_message = formData.first_message
        }

        await api.put(`/agents/${agent.agent_id}`, payload)
        alert('Agent updated successfully!')
      } else {
        // CREATE NEW AGENT
        // For new agents we still send the full configuration.

        // Prepare knowledge base object
        const knowledge_base = {}
        if (formData.knowledge_base_url) {
          knowledge_base.url = formData.knowledge_base_url
        }
        if (formData.knowledge_base_text) {
          knowledge_base.text = formData.knowledge_base_text
        }
        if (formData.knowledge_base_file) {
          knowledge_base.file = formData.knowledge_base_file
        }

        // Prepare payload
        const payload = {
          name: formData.name,
        }

        if (formData.system_prompt) {
          payload.system_prompt = formData.system_prompt
        }

        if (formData.first_message) {
          payload.first_message = formData.first_message
        }

        if (Object.keys(knowledge_base).length > 0) {
          payload.knowledge_base = knowledge_base
        }

        if (formData.voice_id) {
          payload.voice_id = formData.voice_id
        }

        if (formData.language) {
          payload.language = formData.language
        }

        if (formData.llm_model) {
          payload.llm_model = formData.llm_model
        }

        await api.post('/agents', payload)
        alert('Agent created successfully!')
      }

      onClose()
    } catch (error) {
      console.error('Error saving agent:', error)
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to save agent'
      alert(`Error: ${errorMessage}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-3 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-800">
            {agent ? 'Improve Agent' : 'Create New Agent'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {loadingData ? (
          <div className="p-6 flex items-center justify-center h-64">
            <div className="text-gray-500">Loading agent data...</div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Debug Info - Remove this in production */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mb-4 p-3 bg-gray-100 rounded text-xs">
              <strong>Debug - Current formData:</strong>
              <pre className="mt-1 overflow-auto max-h-32">
                {JSON.stringify({
                  name: formData.name?.substring(0, 50) || 'empty',
                  system_prompt: formData.system_prompt?.substring(0, 50) || 'empty',
                  first_message: formData.first_message?.substring(0, 50) || 'empty',
                  voice_id: formData.voice_id || 'empty',
                  language: formData.language || 'empty',
                  llm_model: formData.llm_model || 'empty',
                  knowledge_base_file: formData.knowledge_base_file || 'empty'
                }, null, 2)}
              </pre>
            </div>
          )}
          
          {/* Agent Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
              Agent Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name || ''}
              onChange={handleChange}
              required
              disabled={!!agent}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500"
              placeholder="Enter agent name"
            />
            {agent && (
              <p className="mt-1 text-xs text-gray-500">
                Editing an existing agent only updates the system prompt and first message.
              </p>
            )}
          </div>

          {/* System Prompt */}
          <div>
            <label htmlFor="system_prompt" className="block text-sm font-medium text-gray-700 mb-2">
              System Prompt
            </label>
            <textarea
              id="system_prompt"
              name="system_prompt"
              value={formData.system_prompt || ''}
              onChange={handleChange}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Define the persona and context for the agent's conversation style..."
            />
            <p className="mt-1 text-sm text-gray-500">
              This defines how the agent should behave and respond to conversations.
            </p>
          </div>

          {/* First Message */}
          <div>
            <label htmlFor="first_message" className="block text-sm font-medium text-gray-700 mb-2">
              First Message
            </label>
            <textarea
              id="first_message"
              name="first_message"
              value={formData.first_message || ''}
              onChange={handleChange}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Hello! How can I assist you today?"
            />
            <p className="mt-1 text-sm text-gray-500">
              The initial message the agent will send when starting a conversation.
            </p>
          </div>

          {/* Knowledge Base Section – only when creating a new agent */}
          {!agent && (
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Knowledge Base</h3>
              
              {/* Knowledge Base URL */}
              <div className="mb-4">
                <label htmlFor="knowledge_base_url" className="block text-sm font-medium text-gray-700 mb-2">
                  Knowledge Base URL
                </label>
                <input
                  type="url"
                  id="knowledge_base_url"
                  name="knowledge_base_url"
                  value={formData.knowledge_base_url || ''}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://example.com/knowledge-base"
                />
                <p className="mt-1 text-sm text-gray-500">
                  URL to a knowledge base or documentation.
                </p>
              </div>

              {/* Knowledge Base Text */}
              <div className="mb-4">
                <label htmlFor="knowledge_base_text" className="block text-sm font-medium text-gray-700 mb-2">
                  Knowledge Base Text
                </label>
                <textarea
                  id="knowledge_base_text"
                  name="knowledge_base_text"
                  value={formData.knowledge_base_text || ''}
                  onChange={handleChange}
                  rows={5}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter knowledge base content here..."
                />
                <p className="mt-1 text-sm text-gray-500">
                  Direct text content for the knowledge base.
                </p>
              </div>

              {/* Knowledge Base File */}
              <div>
                <label htmlFor="knowledge_base_file" className="block text-sm font-medium text-gray-700 mb-2">
                  Knowledge Base File Path/URL
                </label>
                <input
                  type="text"
                  id="knowledge_base_file"
                  name="knowledge_base_file"
                  value={formData.knowledge_base_file || ''}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="path/to/file.pdf or https://example.com/file.pdf"
                />
                <p className="mt-1 text-sm text-gray-500">
                  File path or URL to a document (PDF, text file, etc.).
                </p>
              </div>
            </div>
          )}

          {/* Additional Settings – only when creating a new agent */}
          {!agent && (
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Additional Settings</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Voice ID */}
                <div>
                  <label htmlFor="voice_id" className="block text-sm font-medium text-gray-700 mb-2">
                    Voice ID
                  </label>
                  <input
                    type="text"
                    id="voice_id"
                    name="voice_id"
                    value={formData.voice_id || ''}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="21m00Tcm4TlvDq8ikWAM"
                  />
                </div>

                {/* Language */}
                <div>
                  <label htmlFor="language" className="block text-sm font-medium text-gray-700 mb-2">
                    Language
                  </label>
                  <input
                    type="text"
                    id="language"
                    name="language"
                    value={formData.language || 'en'}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="en"
                  />
                </div>
              </div>

              {/* LLM Model */}
              <div className="mt-4">
                <label htmlFor="llm_model" className="block text-sm font-medium text-gray-700 mb-2">
                  LLM Model
                </label>
                <select
                  id="llm_model"
                  name="llm_model"
                  value={formData.llm_model || 'gpt-4o-mini'}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="gpt-4o-mini">GPT-4o Mini</option>
                  <option value="gpt-4o">GPT-4o</option>
                  <option value="gpt-4">GPT-4</option>
                  <option value="gpt-4-turbo">GPT-4 Turbo</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                  <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                  <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                  <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                  <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
                  <option value="claude-3-7-sonnet">Claude 3.7 Sonnet</option>
                </select>
                <p className="mt-1 text-sm text-gray-500">
                  Select the LLM model for the agent.
                </p>
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-5 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading ? 'Saving...' : agent ? 'Update Agent' : 'Create Agent'}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  )
}

export default AgentForm

