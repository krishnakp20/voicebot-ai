import { useState, useEffect } from 'react'
import api from '../services/api'
import { 
  ChatBubbleLeftRightIcon,
  UserGroupIcon,
  ClockIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline'

const Dashboard = () => {
  const [metrics, setMetrics] = useState({
    total_conversations: 0,
    todays_conversations: 0,
    todays_change_percent: 0,
    avg_sentiment: 0,
    sentiment_change_percent: 0,
    total_duration: 0,
    total_agents: 0,
    agents_change_percent: 0,
    avg_response_time: 1.2,
    response_time_change_percent: -4.1
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchMetrics()
  }, [])

  const fetchMetrics = async () => {
    try {
      setError(null)
      const response = await api.get('/conversations/metrics')
      console.log('Metrics response:', response.data)
      
      // Safely merge response data with defaults
      setMetrics({
        total_conversations: response.data?.total_conversations || 0,
        todays_conversations: response.data?.todays_conversations || 0,
        todays_change_percent: response.data?.todays_change_percent || 0,
        avg_sentiment: response.data?.avg_sentiment || 0,
        sentiment_change_percent: response.data?.sentiment_change_percent || 0,
        total_duration: response.data?.total_duration || 0,
        total_agents: response.data?.total_agents || 0,
        agents_change_percent: response.data?.agents_change_percent || 0,
        avg_response_time: response.data?.avg_response_time || 1.2,
        response_time_change_percent: response.data?.response_time_change_percent || -4.1
      })
    } catch (error) {
      console.error('Error fetching metrics:', error)
      setError(error.response?.data?.detail || error.message || 'Failed to load metrics')
      // Keep default metrics on error
    } finally {
      setLoading(false)
    }
  }

  // Calculate sentiment percentage
  const sentimentPercentage = Math.round((metrics.avg_sentiment || 0) * 100)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading metrics...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <h1 className="text-3xl font-bold text-gray-800 mb-8">Dashboard</h1>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          Error loading dashboard: {error}
        </div>
        <button
          onClick={fetchMetrics}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-800 mb-8">Dashboard</h1>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Today's Conversations */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-green-100 rounded-lg p-3">
              <ChatBubbleLeftRightIcon className="w-6 h-6 text-green-600" />
            </div>
            {metrics.todays_change_percent !== 0 && (
              <div className={`flex items-center ${metrics.todays_change_percent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                <span className="text-sm font-medium">
                  {metrics.todays_change_percent >= 0 ? '+' : ''}{metrics.todays_change_percent.toFixed(1)}%
                </span>
                <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={metrics.todays_change_percent >= 0 ? "M5 10l7-7m0 0l7 7m-7-7v18" : "M19 14l-7 7m0 0l-7-7m7 7V3"} />
                </svg>
              </div>
            )}
          </div>
          <h3 className="text-sm font-medium text-gray-600 mb-1">Today's Conversations</h3>
          <p className="text-3xl font-bold text-gray-800">{metrics.todays_conversations || 0}</p>
        </div>

        {/* Total Agents */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-blue-100 rounded-lg p-3">
              <UserGroupIcon className="w-6 h-6 text-blue-600" />
            </div>
            {metrics.agents_change_percent !== 0 && (
              <div className={`flex items-center ${metrics.agents_change_percent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                <span className="text-sm font-medium">
                  {metrics.agents_change_percent >= 0 ? '+' : ''}{metrics.agents_change_percent.toFixed(1)}%
                </span>
                <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={metrics.agents_change_percent >= 0 ? "M5 10l7-7m0 0l7 7m-7-7v18" : "M19 14l-7 7m0 0l-7-7m7 7V3"} />
                </svg>
              </div>
            )}
          </div>
          <h3 className="text-sm font-medium text-gray-600 mb-1">Total Agents</h3>
          <p className="text-3xl font-bold text-gray-800">{metrics.total_agents || 0}</p>
        </div>

        {/* Avg. Response Time */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-purple-100 rounded-lg p-3">
              <ClockIcon className="w-6 h-6 text-purple-600" />
            </div>
            {metrics.response_time_change_percent !== 0 && (
              <div className={`flex items-center ${metrics.response_time_change_percent >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                <span className="text-sm font-medium">
                  {metrics.response_time_change_percent >= 0 ? '+' : ''}{metrics.response_time_change_percent.toFixed(1)}%
                </span>
                <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={metrics.response_time_change_percent >= 0 ? "M19 14l-7 7m0 0l-7-7m7 7V3" : "M5 10l7-7m0 0l7 7m-7-7v18"} />
                </svg>
              </div>
            )}
          </div>
          <h3 className="text-sm font-medium text-gray-600 mb-1">Avg. Response Time</h3>
          <p className="text-3xl font-bold text-gray-800">{(metrics.avg_response_time || 1.2).toFixed(1)}s</p>
        </div>

        {/* Overall Sentiment */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-green-100 rounded-lg p-3">
              <ChartBarIcon className="w-6 h-6 text-green-600" />
            </div>
            {metrics.sentiment_change_percent !== 0 && (
              <div className={`flex items-center ${metrics.sentiment_change_percent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                <span className="text-sm font-medium">
                  {metrics.sentiment_change_percent >= 0 ? '+' : ''}{metrics.sentiment_change_percent.toFixed(1)}%
                </span>
                <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={metrics.sentiment_change_percent >= 0 ? "M5 10l7-7m0 0l7 7m-7-7v18" : "M19 14l-7 7m0 0l-7-7m7 7V3"} />
                </svg>
              </div>
            )}
          </div>
          <h3 className="text-sm font-medium text-gray-600 mb-1">Overall Sentiment</h3>
          <p className="text-3xl font-bold text-gray-800">{sentimentPercentage}%</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Conversation Volume Over Time */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-800">Conversation Volume Over Time</h2>
            <span className="text-sm text-gray-500">Last 7 days</span>
          </div>
          <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
            <div className="text-center">
              <ChartBarIcon className="w-12 h-12 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500">Chart visualization placeholder</p>
              <p className="text-sm text-gray-400 mt-1">Integration with chart library needed</p>
            </div>
          </div>
        </div>

        {/* Sentiment Distribution */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-800">Sentiment Distribution</h2>
            <span className="text-sm text-gray-500">Current week</span>
          </div>
          <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
            <div className="text-center">
              <div className="relative inline-block mb-4">
                <div className="w-32 h-32 rounded-full border-8 border-green-400 border-t-transparent border-r-transparent"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-bold text-gray-800">65%</span>
                </div>
              </div>
              <div className="flex gap-4 justify-center">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-400 rounded"></div>
                  <span className="text-sm text-gray-600">Positive</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-gray-400 rounded"></div>
                  <span className="text-sm text-gray-600">Neutral</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-400 rounded"></div>
                  <span className="text-sm text-gray-600">Negative</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
