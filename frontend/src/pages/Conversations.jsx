import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import { EyeIcon, MagnifyingGlassIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline'

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
      getCustomerName(conv.caller_number).toLowerCase().includes(searchTerm.toLowerCase()) ||
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
    // Export functionality - could implement CSV export here
    console.log('Export conversations')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading conversations...</div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Conversations</h1>
        <p className="text-gray-600 mt-1">View and manage all customer conversations</p>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Search Bar */}
          <div className="relative flex-1 max-w-md">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by customer name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Sentiment Filters */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSentimentFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                sentimentFilter === 'all'
                  ? 'bg-teal-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setSentimentFilter('positive')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                sentimentFilter === 'positive'
                  ? 'bg-teal-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
              }`}
            >
              Positive
            </button>
            <button
              onClick={() => setSentimentFilter('neutral')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                sentimentFilter === 'neutral'
                  ? 'bg-teal-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
              }`}
            >
              Neutral
            </button>
            <button
              onClick={() => setSentimentFilter('negative')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                sentimentFilter === 'negative'
                  ? 'bg-teal-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
              }`}
            >
              Negative
            </button>
          </div>

          {/* Export Button */}
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <ArrowDownTrayIcon className="w-5 h-5" />
            Export
          </button>
        </div>
      </div>

      {/* Conversations Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Customer Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date/Time
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Sentiment
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Agent Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Duration
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredConversations.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-6 py-4 text-center text-gray-500">
                  No conversations found
                </td>
              </tr>
            ) : (
              filteredConversations.map((conv) => (
                <tr key={conv.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-medium">
                          {getCustomerInitial(conv.caller_number)}
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          Customer {getCustomerName(conv.caller_number)}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(conv.created_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getSentimentBadge(conv.sentiment)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {conv.agent || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDuration(conv.duration)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(conv)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <Link
                      to={`/conversations/${conv.conversation_id}`}
                      className="inline-flex items-center text-blue-600 hover:text-blue-800"
                    >
                      <EyeIcon className="w-5 h-5 mr-1" />
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
