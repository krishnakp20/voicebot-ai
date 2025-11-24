import { useState, useEffect } from 'react'
import api from '../services/api'
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline'
import PromptForm from '../components/PromptForm'

const Prompts = () => {
  const [prompts, setPrompts] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingPrompt, setEditingPrompt] = useState(null)

  useEffect(() => {
    fetchPrompts()
  }, [])

  const fetchPrompts = async () => {
    try {
      const response = await api.get('/prompt-templates')
      setPrompts(response.data)
    } catch (error) {
      console.error('Error fetching prompts:', error)
      alert('Failed to fetch prompt templates.')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    setEditingPrompt(null)
    setShowForm(true)
  }

  const handleEdit = (prompt) => {
    setEditingPrompt(prompt)
    setShowForm(true)
  }

  const handleDelete = async (prompt) => {
    if (!window.confirm(`Are you sure you want to delete "${prompt.name}"?`)) {
      return
    }

    try {
      await api.delete(`/prompt-templates/${prompt.id}`)
      alert('Prompt template deleted successfully!')
      fetchPrompts()
    } catch (error) {
      console.error('Error deleting prompt:', error)
      alert('Failed to delete prompt template.')
    }
  }

  const handleFormClose = () => {
    setShowForm(false)
    setEditingPrompt(null)
    fetchPrompts()
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    }).replace(',', '')
  }

  const filteredPrompts = prompts.filter(prompt => {
    if (!searchTerm) return true
    const searchLower = searchTerm.toLowerCase()
    return (
      (prompt.name && prompt.name.toLowerCase().includes(searchLower)) ||
      (prompt.system_prompt && prompt.system_prompt.toLowerCase().includes(searchLower))
    )
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading prompt templates...</div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Prompt Templates</h1>
          <p className="text-xs text-gray-500 mt-0.5">Manage your system prompt templates</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Compact Search Bar */}
          <input
            type="text"
            placeholder="Search prompts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent w-48"
          />
          <button
            onClick={handleCreate}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md text-xs hover:bg-blue-700 transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            Create Template
          </button>
        </div>
      </div>

      {/* Compact Prompts Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                Name
              </th>
              <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                System Prompt
              </th>
              <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                First Message
              </th>
              <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                Created
              </th>
              <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200 text-xs">
            {filteredPrompts.length === 0 ? (
              <tr>
                <td colSpan="5" className="px-3 py-3 text-center text-gray-500 text-xs">
                  {prompts.length === 0 
                    ? 'No prompt templates found. Create your first template to get started!' 
                    : 'No templates match your search.'}
                </td>
              </tr>
            ) : (
              filteredPrompts.map((prompt) => (
                <tr key={prompt.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="font-medium text-gray-900 text-xs">
                      {prompt.name}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="text-gray-600 text-[11px] max-w-xs truncate" title={prompt.system_prompt || 'N/A'}>
                      {prompt.system_prompt || 'N/A'}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="text-gray-600 text-[11px] max-w-xs truncate" title={prompt.first_message || 'N/A'}>
                      {prompt.first_message || 'N/A'}
                    </div>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-600 text-[11px]">
                    {formatDate(prompt.created_at)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(prompt)}
                        className="inline-flex items-center text-blue-600 hover:text-blue-800 text-xs font-medium"
                        title="Edit"
                      >
                        <PencilIcon className="w-3.5 h-3.5 mr-0.5" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(prompt)}
                        className="inline-flex items-center text-red-600 hover:text-red-800 text-xs font-medium"
                        title="Delete"
                      >
                        <TrashIcon className="w-3.5 h-3.5 mr-0.5" />
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Prompt Form Modal */}
      {showForm && (
        <PromptForm
          key={editingPrompt?.id || 'new'}
          prompt={editingPrompt}
          onClose={handleFormClose}
        />
      )}
    </div>
  )
}

export default Prompts


