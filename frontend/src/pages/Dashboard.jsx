import { useState, useEffect } from 'react'
import api from '../services/api'
import { 
  ChatBubbleLeftRightIcon,
  UserGroupIcon,
  ClockIcon,
  ChartBarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon
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
    avg_response_time: 0,
    response_time_change_percent: 0
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [volumeData, setVolumeData] = useState([])
  const [volumeLoading, setVolumeLoading] = useState(true)
  const [volumeError, setVolumeError] = useState(null)

  useEffect(() => {
    fetchMetrics()
    fetchVolumeData()
  }, [])

  const fetchMetrics = async () => {
    try {
      setError(null)
      const response = await api.get('/conversations/metrics')
      console.log('Metrics response:', response.data)
      
      setMetrics({
        total_conversations: response.data?.total_conversations || 0,
        todays_conversations: response.data?.todays_conversations || 0,
        todays_change_percent: response.data?.todays_change_percent || 0,
        avg_sentiment: response.data?.avg_sentiment || 0,
        sentiment_change_percent: response.data?.sentiment_change_percent || 0,
        total_duration: response.data?.total_duration || 0,
        total_agents: response.data?.total_agents || 0,
        agents_change_percent: response.data?.agents_change_percent || 0,
    avg_response_time: response.data?.avg_response_time || 0,
    response_time_change_percent: response.data?.response_time_change_percent || 0
      })
    } catch (error) {
      console.error('Error fetching metrics:', error)
      setError(error.response?.data?.detail || error.message || 'Failed to load metrics')
    } finally {
      setLoading(false)
    }
  }

  // Helper function to get local date string (YYYY-MM-DD) without timezone conversion
  const getLocalDateString = (date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const fetchVolumeData = async () => {
    try {
      setVolumeLoading(true)
      setVolumeError(null)
      const response = await api.get('/conversations?limit=500')
      const conversations = Array.isArray(response.data) ? response.data : []

      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const lastSevenDays = Array.from({ length: 7 }).map((_, index) => {
        const day = new Date(today)
        day.setDate(today.getDate() - (6 - index))
        return {
          key: getLocalDateString(day),
          label: day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          value: 0,
        }
      })

      conversations.forEach((conversation) => {
        if (!conversation.created_at) return
        const convDate = new Date(conversation.created_at)
        // Use local date string to match with day buckets
        const key = getLocalDateString(convDate)
        const targetDay = lastSevenDays.find((day) => day.key === key)
        if (targetDay) {
          targetDay.value += 1
        }
      })

      setVolumeData(lastSevenDays)
    } catch (error) {
      console.error('Error fetching conversation volume:', error)
      setVolumeError(error.response?.data?.detail || error.message || 'Failed to load conversation volume')
    } finally {
      setVolumeLoading(false)
    }
  }

  // Calculate sentiment percentage
  const sentimentPercentage = Math.round((metrics.avg_sentiment || 0) * 100)

  const totalVolume = volumeData.reduce((sum, day) => sum + day.value, 0)
  const maxVolume = volumeData.reduce((max, day) => Math.max(max, day.value), 0)
  
  // Format duration
  const formatDuration = (seconds) => {
    if (!seconds) return '0h'
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${minutes}m`
  }

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
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Dashboard</h1>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          Error loading dashboard: {error}
        </div>
        <button
          onClick={fetchMetrics}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header - fixed at top while content scrolls */}
      <div className="flex items-center justify-between sticky top-0 z-10 bg-gray-50 pb-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Dashboard</h1>
          <p className="text-xs text-gray-500 mt-0.5">Voice AI performance summary</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] text-gray-500 uppercase tracking-wide">Total Conversations</p>
          <p className="text-base font-semibold text-gray-800">{metrics.total_conversations || 0}</p>
        </div>
      </div>

      {/* Key Metrics Cards - Compact Design */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Today's Conversations */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 hover:shadow">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-0.5">Today</p>
              <p className="text-xl font-semibold text-gray-900">{metrics.todays_conversations || 0}</p>
              {metrics.todays_change_percent !== 0 && (
                <div className={`flex items-center text-[11px] ${metrics.todays_change_percent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {metrics.todays_change_percent >= 0 ? (
                    <ArrowTrendingUpIcon className="w-3.5 h-3.5 mr-1" />
                  ) : (
                    <ArrowTrendingDownIcon className="w-3.5 h-3.5 mr-1" />
                  )}
                  <span className="font-medium">
                    {Math.abs(metrics.todays_change_percent).toFixed(1)}% vs yesterday
                  </span>
                </div>
              )}
            </div>
            <div className="bg-gradient-to-br from-green-400 to-green-600 rounded-lg p-2">
              <ChatBubbleLeftRightIcon className="w-4 h-4 text-white" />
            </div>
          </div>
        </div>

        {/* Total Agents */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 hover:shadow">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-0.5">Total Agents</p>
              <p className="text-xl font-semibold text-gray-900">{metrics.total_agents || 0}</p>
              {metrics.agents_change_percent !== 0 && (
                <div className={`flex items-center text-[11px] ${metrics.agents_change_percent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {metrics.agents_change_percent >= 0 ? (
                    <ArrowTrendingUpIcon className="w-3.5 h-3.5 mr-1" />
                  ) : (
                    <ArrowTrendingDownIcon className="w-3.5 h-3.5 mr-1" />
                  )}
                  <span className="font-medium">
                    {Math.abs(metrics.agents_change_percent).toFixed(1)}%
                  </span>
                </div>
              )}
            </div>
            <div className="bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg p-2">
              <UserGroupIcon className="w-4 h-4 text-white" />
            </div>
          </div>
        </div>

        {/* Avg. Response Time */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 hover:shadow">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-0.5">Avg Response Time</p>
              <p className="text-xl font-semibold text-gray-900">
                {metrics.avg_response_time && metrics.avg_response_time > 0 
                  ? `${metrics.avg_response_time.toFixed(1)}s` 
                  : 'N/A'}
              </p>
              {metrics.response_time_change_percent !== 0 && (
                <div className={`flex items-center text-[11px] ${metrics.response_time_change_percent >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {metrics.response_time_change_percent >= 0 ? (
                    <ArrowTrendingUpIcon className="w-3.5 h-3.5 mr-1" />
                  ) : (
                    <ArrowTrendingDownIcon className="w-3.5 h-3.5 mr-1" />
                  )}
                  <span className="font-medium">
                    {Math.abs(metrics.response_time_change_percent).toFixed(1)}%
                  </span>
                </div>
              )}
            </div>
            <div className="bg-gradient-to-br from-purple-400 to-purple-600 rounded-lg p-2">
              <ClockIcon className="w-4 h-4 text-white" />
            </div>
          </div>
        </div>

        {/* Overall Sentiment */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 hover:shadow">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-0.5">Sentiment</p>
              <p className="text-xl font-semibold text-gray-900">{sentimentPercentage}%</p>
              {metrics.sentiment_change_percent !== 0 && (
                <div className={`flex items-center text-[11px] ${metrics.sentiment_change_percent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {metrics.sentiment_change_percent >= 0 ? (
                    <ArrowTrendingUpIcon className="w-3.5 h-3.5 mr-1" />
                  ) : (
                    <ArrowTrendingDownIcon className="w-3.5 h-3.5 mr-1" />
                  )}
                  <span className="font-medium">
                    {Math.abs(metrics.sentiment_change_percent).toFixed(1)}%
                  </span>
                </div>
              )}
            </div>
            <div className="bg-gradient-to-br from-teal-400 to-teal-600 rounded-lg p-2">
              <ChartBarIcon className="w-4 h-4 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Total Conversations */}
        <div className="bg-gradient-to-br from-white to-gray-50 rounded-lg border border-gray-200 p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-600 mb-0.5">Total Conversations</p>
              <p className="text-lg font-semibold text-gray-800">{metrics.total_conversations || 0}</p>
            </div>
            <ChatBubbleLeftRightIcon className="w-6 h-6 text-gray-400" />
          </div>
        </div>

        {/* Total Duration */}
        <div className="bg-gradient-to-br from-white to-gray-50 rounded-lg border border-gray-200 p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-600 mb-0.5">Total Duration</p>
              <p className="text-lg font-semibold text-gray-800">{formatDuration(metrics.total_duration || 0)}</p>
            </div>
            <ClockIcon className="w-6 h-6 text-gray-400" />
          </div>
        </div>

        {/* Average Sentiment Score */}
        <div className="bg-gradient-to-br from-white to-gray-50 rounded-lg border border-gray-200 p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-600 mb-0.5">Avg Sentiment Score</p>
              <p className="text-lg font-semibold text-gray-800">{(metrics.avg_sentiment || 0).toFixed(2)}</p>
            </div>
            <ChartBarIcon className="w-6 h-6 text-gray-400" />
          </div>
        </div>
      </div>

      {/* Charts Row - Compact */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Conversation Volume Over Time */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-base font-semibold text-gray-800">Conversation Volume</h2>
              <span className="text-[11px] text-gray-500">Last 7 days</span>
            </div>
            <div className="text-right">
              <p className="text-[11px] uppercase text-gray-400 tracking-wide">Total</p>
              <p className="text-lg font-semibold text-gray-900">{totalVolume}</p>
            </div>
          </div>
          <div className="h-44 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg border border-gray-200 px-4 py-3 flex items-center justify-center">
            {volumeLoading ? (
              <div className="text-sm text-gray-500">Loading chart...</div>
            ) : volumeError ? (
              <div className="text-sm text-red-600 text-center px-4">{volumeError}</div>
            ) : maxVolume === 0 ? (
              <div className="text-sm text-gray-500 text-center px-4">
                No conversations recorded in the last 7 days.
              </div>
            ) : (
              <div className="flex items-end gap-3 w-full h-full">
                {volumeData.map((day) => {
                  const heightPercent = maxVolume ? Math.round((day.value / maxVolume) * 100) : 0
                  return (
                    <div key={day.key} className="flex-1 flex flex-col items-center">
                      <div className="w-full h-28 bg-white/40 rounded-md flex items-end overflow-hidden">
                        <div
                          className="w-full rounded-md bg-gradient-to-t from-indigo-500 to-blue-400 transition-all duration-300"
                          style={{ height: `${heightPercent}%` }}
                        ></div>
                      </div>
                      <span className="mt-2 text-[11px] text-gray-500">{day.label}</span>
                      <span className="text-xs font-semibold text-gray-800">{day.value}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Sentiment Distribution */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-gray-800">Sentiment Distribution</h2>
            <span className="text-[11px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded">This week</span>
          </div>
          <div className="h-44 flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg border border-gray-200">
            <div className="text-center">
              <div className="relative inline-block mb-3">
                <svg className="w-20 h-20 transform -rotate-90">
                  <circle cx="40" cy="40" r="32" fill="none" stroke="#e5e7eb" strokeWidth="7" />
                  <circle
                    cx="40"
                    cy="40"
                    r="32"
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="7"
                    strokeDasharray={`${sentimentPercentage * 2.01} 201`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-semibold text-gray-800">{sentimentPercentage}%</span>
                </div>
              </div>
              <div className="flex gap-3 justify-center text-[11px]">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 bg-green-500 rounded-full"></div>
                  <span className="text-gray-600">Positive</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 bg-gray-400 rounded-full"></div>
                  <span className="text-gray-600">Neutral</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 bg-red-400 rounded-full"></div>
                  <span className="text-gray-600">Negative</span>
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
