import { useState, useEffect } from 'react'
import api from '../services/api'
import { XMarkIcon } from '@heroicons/react/24/outline'

const PromptForm = ({ prompt, onClose }) => {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    system_prompt: '',
    first_message: '',
  })

  useEffect(() => {
    if (prompt) {
      setFormData({
        name: prompt.name || '',
        system_prompt: prompt.system_prompt || '',
        first_message: prompt.first_message || '',
      })
    } else {
      setFormData({
        name: '',
        system_prompt: '',
        first_message: '',
      })
    }
  }, [prompt])

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
      if (prompt) {
        // UPDATE EXISTING PROMPT
        await api.put(`/prompt-templates/${prompt.id}`, formData)
        alert('Prompt template updated successfully!')
      } else {
        // CREATE NEW PROMPT
        await api.post('/prompt-templates', formData)
        alert('Prompt template created successfully!')
      }

      onClose()
    } catch (error) {
      console.error('Error saving prompt template:', error)
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to save prompt template'
      alert(`Error: ${errorMessage}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between z-10">
          <h2 className="text-lg font-semibold text-gray-800">
            {prompt ? 'Edit Prompt Template' : 'Create New Prompt Template'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          {/* Prompt Name */}
          <div>
            <label htmlFor="name" className="block text-xs font-medium text-gray-700 mb-1">
              Template Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name || ''}
              onChange={handleChange}
              required
              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter template name (e.g., Customer Support, Sales Agent)"
            />
            <p className="mt-0.5 text-xs text-gray-500">
              Choose a descriptive name for this prompt template.
            </p>
          </div>

          {/* System Prompt */}
          <div>
            <label htmlFor="system_prompt" className="block text-xs font-medium text-gray-700 mb-1">
              System Prompt <span className="text-red-500">*</span>
            </label>
            <textarea
              id="system_prompt"
              name="system_prompt"
              value={formData.system_prompt || ''}
              onChange={handleChange}
              required
              rows={5}
              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
              placeholder="You are a helpful customer support agent. Your role is to assist customers with their inquiries..."
            />
            <p className="mt-0.5 text-xs text-gray-500">
              Define the persona, context, and behavior guidelines for the agent.
            </p>
          </div>

          {/* First Message */}
          <div>
            <label htmlFor="first_message" className="block text-xs font-medium text-gray-700 mb-1">
              First Message
            </label>
            <textarea
              id="first_message"
              name="first_message"
              value={formData.first_message || ''}
              onChange={handleChange}
              rows={2}
              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Hello! How can I assist you today?"
            />
            <p className="mt-0.5 text-xs text-gray-500">
              The initial message the agent will send when starting a conversation. (Optional)
            </p>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading ? 'Saving...' : prompt ? 'Update Template' : 'Create Template'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default PromptForm


