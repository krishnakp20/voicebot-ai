import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import { EyeIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline'

const Conversations = () => {
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [sentimentFilter, setSentimentFilter] = useState('all')

  useEffect(() => {
    fetchConversations()
  }, [])

  const fetchConversations = async () => {
    try {
      const response = await api.get('/conversations')
      setConversations(response.data)
    } catch (error) {
      console.error('Error fetching conversations:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).replace(',', '')
  }

  const formatDuration = (seconds) => {
    if (!seconds) return 'N/A'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}m ${secs}s`
  }

  const getSentimentBadge = (sentiment) => {
    if (!sentiment || sentiment === null) {
      return (
        <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
          neutral
        </span>
      )
    }
    const score = parseFloat(sentiment)
    if (score >= 0.7) {
      return (
        <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
          positive
        </span>
      )
    } else if (score >= 0.4) {
      return (
        <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
          neutral
        </span>
      )
    } else {
      return (
        <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
          negative
        </span>
      )
    }
  }

  const getStatusBadge = (conversation) => {
    // Since we don't have status in API, default to completed
    return (
      <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
        completed
      </span>
    )
  }

  const getCustomerInitial = (callerNumber) => {
    if (!callerNumber) return '?'
    // Extract first letter from phone number or use first character
    return callerNumber.charAt(callerNumber.length - 1).toUpperCase()
  }

  const getCustomerName = (callerNumber) => {
    if (!callerNumber) return 'Unknown'
    // Use last 4 digits of phone number as identifier
    return callerNumber.slice(-4)
  }

  // Filter conversations based on search and sentiment
  const filteredConversations = conversations.filter(conv => {
    const matchesSearch = !searchTerm || 
      (conv.caller_number && conv.caller_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (conv.agent && conv.agent.toLowerCase().includes(searchTerm.toLowerCase()))
    
    let matchesSentiment = true
    if (sentimentFilter !== 'all') {
      const score = conv.sentiment ? parseFloat(conv.sentiment) : 0.5
      if (sentimentFilter === 'positive') {
        matchesSentiment = score >= 0.7
      } else if (sentimentFilter === 'neutral') {
        matchesSentiment = score >= 0.4 && score < 0.7
      } else if (sentimentFilter === 'negative') {
        matchesSentiment = score < 0.4
      }
    }
    
    return matchesSearch && matchesSentiment
  })

  const handleExport = () => {
    if (!filteredConversations.length) {
      alert('No conversations to export.')
      return
    }

    const headers = [
      'Conversation ID',
      'Caller Number',
      'Agent',
      'Sentiment',
      'Duration',
      'Created At',
    ]

    const escapeField = (value) => {
      if (value === null || value === undefined) return ''
      const stringValue = String(value)
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`
      }
      return stringValue
    }

    const rows = filteredConversations.map((conv) => {
      const sentiment = conv.sentiment !== null && conv.sentiment !== undefined
        ? Number(conv.sentiment).toFixed(2)
        : ''

      return [
        escapeField(conv.conversation_id || ''),
        escapeField(conv.caller_number || ''),
        escapeField(conv.agent || ''),
        escapeField(sentiment),
        escapeField(formatDuration(conv.duration)),
        escapeField(formatDate(conv.created_at)),
      ].join(',')
    })

    const csvContent = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `conversations_${Date.now()}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading conversations...</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Conversations</h1>
          <p className="text-sm text-gray-500 mt-0.5">View and manage voice interactions</p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 transition-colors"
        >
          <ArrowDownTrayIcon className="w-4 h-4" />
          Export
        </button>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          {/* Search Bar */}
          <div className="flex-1 max-w-lg">
            <input
              type="text"
              placeholder="Search by customer number or agent name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Sentiment Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setSentimentFilter('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                sentimentFilter === 'all'
                  ? 'bg-teal-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setSentimentFilter('positive')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                sentimentFilter === 'positive'
                  ? 'bg-teal-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
              }`}
            >
              Positive
            </button>
            <button
              onClick={() => setSentimentFilter('neutral')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                sentimentFilter === 'neutral'
                  ? 'bg-teal-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
              }`}
            >
              Neutral
            </button>
            <button
              onClick={() => setSentimentFilter('negative')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                sentimentFilter === 'negative'
                  ? 'bg-teal-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
              }`}
            >
              Negative
            </button>
          </div>
        </div>
      </div>

      {/* Conversations Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                Customer Number
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                Date/Time
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                Sentiment
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                Agent Name
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                Duration
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                Status
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredConversations.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-4 py-4 text-center text-gray-500 text-sm">
                  No conversations found
                </td>
              </tr>
            ) : (
              filteredConversations.map((conv) => (
                <tr key={conv.id} className="hover:bg-gray-50 text-sm">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-medium">
                        {getCustomerInitial(conv.caller_number)}
                      </div>
                      <div className="font-medium text-gray-900">
                        {conv.caller_number || 'N/A'}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-900">
                    {formatDate(conv.created_at)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {getSentimentBadge(conv.sentiment)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-900">
                    {conv.agent || 'N/A'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-900">
                    {formatDuration(conv.duration)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {getStatusBadge(conv)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Link
                      to={`/conversations/${conv.conversation_id}`}
                      className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium"
                    >
                      <EyeIcon className="w-4.5 h-4.5 mr-1" />
                      View
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default Conversations
