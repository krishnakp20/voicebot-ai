import { useState, useEffect } from 'react'
import api from '../services/api'
import { PlusIcon, PencilIcon } from '@heroicons/react/24/outline'
import AgentForm from '../components/AgentForm'

const Agents = () => {
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingAgent, setEditingAgent] = useState(null)

  useEffect(() => {
    fetchAgents()
  }, [])

  const fetchAgents = async () => {
    try {
      const response = await api.get('/agents')
      setAgents(response.data)
    } catch (error) {
      console.error('Error fetching agents:', error)
      alert('Failed to fetch agents. Please check your ElevenLabs API key.')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    setEditingAgent(null)
    setShowForm(true)
  }

  const handleEdit = (agent) => {
    setEditingAgent(agent)
    setShowForm(true)
  }

  const handleFormClose = () => {
    setShowForm(false)
    setEditingAgent(null)
    fetchAgents()
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).replace(',', '')
  }

  const filteredAgents = agents.filter(agent => {
    if (!searchTerm) return true
    const searchLower = searchTerm.toLowerCase()
    return (
      (agent.name && agent.name.toLowerCase().includes(searchLower)) ||
      (agent.agent_id && agent.agent_id.toLowerCase().includes(searchLower))
    )
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading agents...</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Agents</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage your voice AI personas</p>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 transition-colors"
        >
          <PlusIcon className="w-4.5 h-4.5" />
          Create Agent
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="max-w-lg">
          <input
            type="text"
            placeholder="Search agents by name or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Agents Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                Name
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                Agent ID
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                Voice ID
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                Language
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                Created At
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200 text-sm">
            {filteredAgents.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-4 py-4 text-center text-gray-500 text-sm">
                  {agents.length === 0 
                    ? 'No agents found. Create your first agent to get started!' 
                    : 'No agents match your search.'}
                </td>
              </tr>
            ) : (
              filteredAgents.map((agent) => (
                <tr key={agent.agent_id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="font-medium text-gray-900">
                      {agent.name || 'Unnamed Agent'}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-gray-600 font-mono text-xs">
                      {agent.agent_id}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                    {agent.voice_id || 'N/A'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                    {agent.language || 'N/A'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                    {formatDate(agent.created_at)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <button
                      onClick={() => handleEdit(agent)}
                      className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium"
                    >
                      <PencilIcon className="w-4 h-4 mr-1" />
                      Improve Agent
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Agent Form Modal */}
      {showForm && (
        <AgentForm
          key={editingAgent?.agent_id || 'new'}
          agent={editingAgent}
          onClose={handleFormClose}
        />
      )}
    </div>
  )
}

export default Agents

