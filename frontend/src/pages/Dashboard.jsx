import { useState, useEffect } from 'react'
import api from '../services/api'
import { 
  ChatBubbleLeftRightIcon,
  UserGroupIcon,
  ClockIcon,
  ChartBarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  PhoneIcon
} from '@heroicons/react/24/outline'
import OutboundCallModal from '../components/OutboundCallModal'

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
  const [showOutboundModal, setShowOutboundModal] = useState(false)
  const [campaignMetrics, setCampaignMetrics] = useState(null)
  const [dashboardPeriod, setDashboardPeriod] = useState('today')
  const [dashboardStartDate, setDashboardStartDate] = useState('')
  const [dashboardEndDate, setDashboardEndDate] = useState('')

  useEffect(() => {
    fetchMetrics('today')
    fetchVolumeData()
    fetchCampaignMetrics('today')
  }, [])

  const fetchMetrics = async (periodOverride) => {
    try {
      setError(null)
      const period = periodOverride || dashboardPeriod
      const params = { period }
      if (period === 'custom' && dashboardStartDate) {
        params.start_date = dashboardStartDate
        if (dashboardEndDate) {
          params.end_date = dashboardEndDate
        }
      }
      const response = await api.get('/conversations/metrics', { params })
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

  const fetchCampaignMetrics = async (periodOverride) => {
    try {
      const period = periodOverride || dashboardPeriod
      const params = { period }
      if (period === 'custom' && dashboardStartDate) {
        params.start_date = dashboardStartDate
        if (dashboardEndDate) {
          params.end_date = dashboardEndDate
        }
      }
      const response = await api.get('/campaign/metrics', { params })
      setCampaignMetrics(response.data)
    } catch (e) {
      console.error('Error fetching campaign metrics:', e)
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
    <div className="space-y-5 max-w-7xl mx-auto px-2 sm:px-4">
      {/* Header - fixed at top while content scrolls */}
      <div className="sticky top-0 z-10 pb-3 bg-gradient-to-b from-gray-50 via-gray-50 to-transparent">
        <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl shadow-sm px-4 py-3">
          <div>
            <h1 className="text-lg sm:text-xl font-semibold text-gray-900">Dashboard</h1>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Voice AI performance overview for your selected date range
            </p>
          </div>
          <div className="flex items-center gap-4">
            {/* Global date filter for entire dashboard */}
            <div className="flex flex-col items-end gap-1">
              <div className="inline-flex items-center bg-gray-50 border border-gray-200 rounded-full shadow-sm overflow-hidden">
              {['today', 'yesterday', 'week', 'custom'].map((period) => (
                <button
                  key={period}
                  type="button"
                  onClick={() => {
                    setDashboardPeriod(period)
                    if (period !== 'custom') {
                      setDashboardStartDate('')
                      setDashboardEndDate('')
                      fetchMetrics(period)
                      fetchCampaignMetrics(period)
                    }
                  }}
                  className={`px-3 py-1 text-[11px] font-medium border-l border-gray-200 first:border-l-0 transition-colors ${
                    dashboardPeriod === period
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-50 text-gray-600 hover:bg-white'
                  }`}
                >
                  {period === 'today' && 'Today'}
                  {period === 'yesterday' && 'Yesterday'}
                  {period === 'week' && 'This week'}
                  {period === 'custom' && 'Custom'}
                </button>
              ))}
            </div>
              {dashboardPeriod === 'custom' && (
                <div className="flex items-center gap-1 text-[11px]">
                  <input
                    type="date"
                    value={dashboardStartDate}
                    onChange={(e) => setDashboardStartDate(e.target.value)}
                    className="border border-gray-300 rounded-md px-1 py-0.5 bg-white"
                  />
                  <span className="text-gray-500">to</span>
                  <input
                    type="date"
                    value={dashboardEndDate}
                    onChange={(e) => setDashboardEndDate(e.target.value)}
                    className="border border-gray-300 rounded-md px-1 py-0.5 bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!dashboardStartDate) {
                        alert('Please select a start date for the custom range.')
                        return
                      }
                      fetchMetrics('custom')
                      fetchCampaignMetrics('custom')
                    }}
                    className="ml-1 px-2 py-0.5 rounded-md bg-blue-600 text-white hover:bg-blue-700"
                  >
                    Apply
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={() => setShowOutboundModal(true)}
              className="hidden sm:inline-flex items-center space-x-2 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm text-xs"
            >
              <PhoneIcon className="h-4 w-4" />
              <span className="font-medium">OB Call</span>
            </button>
          </div>
        </div>
      </div>

      {/* Top KPI Row - all in a single row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Total Conversations */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 hover:shadow">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-0.5">
                Conversations
              </p>
              <p className="text-xl font-semibold text-gray-900">{metrics.total_conversations || 0}</p>
            </div>
            <div className="bg-gradient-to-br from-indigo-400 to-blue-600 rounded-lg p-2">
              <ChatBubbleLeftRightIcon className="w-4 h-4 text-white" />
            </div>
          </div>
        </div>

        {/* Total Agents */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 hover:shadow">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-0.5">
                Agents
              </p>
              <p className="text-xl font-semibold text-gray-900">{metrics.total_agents || 0}</p>
            </div>
            <div className="bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg p-2">
              <UserGroupIcon className="w-4 h-4 text-white" />
            </div>
          </div>
        </div>

        {/* Total Duration */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 hover:shadow">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-0.5">
                Total Duration
              </p>
              <p className="text-xl font-semibold text-gray-900">
                {formatDuration(metrics.total_duration || 0)}
              </p>
            </div>
            <div className="bg-gradient-to-br from-purple-400 to-purple-600 rounded-lg p-2">
              <ClockIcon className="w-4 h-4 text-white" />
            </div>
          </div>
        </div>

        {/* Average Sentiment */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 hover:shadow">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-0.5">
                Avg Sentiment
              </p>
              <p className="text-xl font-semibold text-gray-900">
                {(metrics.avg_sentiment || 0).toFixed(2)} ({sentimentPercentage}%)
              </p>
            </div>
            <div className="bg-gradient-to-br from-teal-400 to-teal-600 rounded-lg p-2">
              <ChartBarIcon className="w-4 h-4 text-white" />
            </div>
          </div>
        </div>

        {/* Avg Response Time */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 hover:shadow">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-0.5">
                Avg Response Time
              </p>
              <p className="text-xl font-semibold text-gray-900">
                {metrics.avg_response_time && metrics.avg_response_time > 0
                  ? `${metrics.avg_response_time.toFixed(1)}s`
                  : 'N/A'}
              </p>
            </div>
            <div className="bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg p-2">
              <ClockIcon className="w-4 h-4 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Call & Quality Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Call Performance */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3 gap-3">
            <div>
              <h2 className="text-base font-semibold text-gray-800">Call Performance</h2>
              <p className="text-[11px] text-gray-500">Snapshot of the current campaign</p>
            </div>
          </div>
          <div className="border border-gray-100 rounded-lg overflow-hidden text-xs">
            <div className="grid grid-cols-6 bg-gray-50 border-b border-gray-100 text-[11px] font-semibold text-gray-600">
              <div className="px-3 py-2">Calls Attempted</div>
              <div className="px-3 py-2">Calls Completed</div>
              <div className="px-3 py-2">Lead Qualified</div>
              <div className="px-3 py-2">Call Back Booked</div>
              <div className="px-3 py-2">Goal Completion</div>
              <div className="px-3 py-2">DND Numbers</div>
            </div>
            <div className="grid grid-cols-6 text-sm text-gray-900">
              <div className="px-3 py-3 border-r border-gray-100 text-center font-semibold">
                {campaignMetrics?.calls_attempted ?? '—'}
              </div>
              <div className="px-3 py-3 border-r border-gray-100 text-center">
                {campaignMetrics?.calls_completed ?? '—'}
              </div>
              <div className="px-3 py-3 border-r border-gray-100 text-center">
                {campaignMetrics?.lead_qualified ?? '—'}
              </div>
              <div className="px-3 py-3 border-r border-gray-100 text-center">
                {campaignMetrics?.call_back_booked ?? '—'}
              </div>
              <div className="px-3 py-3 border-r border-gray-100 text-center">
                {campaignMetrics?.goal_completion_rate ?? '—'}
              </div>
              <div className="px-3 py-3 text-center">
                {campaignMetrics?.dnd_numbers ?? '—'}
              </div>
            </div>
          </div>
        </div>

        {/* Quality & VOC */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h2 className="text-base font-semibold text-gray-800 mb-3">Quality Insights</h2>

          {/* Conversation Intelligence */}
          <div className="mb-4">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Conversation Intelligence
            </p>
            <div className="grid grid-cols-5 gap-2 text-xs">
              <div className="bg-green-50 border border-green-100 rounded-md px-3 py-2">
                <p className="text-[11px] text-gray-500">Positive</p>
                <p className="text-sm font-semibold text-gray-900">
                  {campaignMetrics?.sentiment_positive ?? '—'}
                </p>
              </div>
              <div className="bg-gray-50 border border-gray-100 rounded-md px-3 py-2">
                <p className="text-[11px] text-gray-500">Neutral</p>
                <p className="text-sm font-semibold text-gray-900">
                  {campaignMetrics?.sentiment_neutral ?? '—'}
                </p>
              </div>
              <div className="bg-red-50 border border-red-100 rounded-md px-3 py-2">
                <p className="text-[11px] text-gray-500">Negative</p>
                <p className="text-sm font-semibold text-gray-900">
                  {campaignMetrics?.sentiment_negative ?? '—'}
                </p>
              </div>
              <div className="bg-indigo-50 border border-indigo-100 rounded-md px-3 py-2">
                <p className="text-[11px] text-gray-500">Intent Recognition</p>
                <p className="text-sm font-semibold text-gray-900">
                  {campaignMetrics?.intent_recognition ?? '—'}
                </p>
              </div>
              <div className="bg-orange-50 border border-orange-100 rounded-md px-3 py-2">
                <p className="text-[11px] text-gray-500">Switch to Human</p>
                <p className="text-sm font-semibold text-gray-900">
                  {campaignMetrics?.switch_to_human_ratio ?? '—'}
                </p>
              </div>
            </div>
          </div>

          {/* Dropped Analytics & VOC */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Dropped Analytics
              </p>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Dropped at Greeting</span>
                  <span className="font-semibold text-gray-900">
                    {campaignMetrics?.dropped_at_greeting ?? '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Initial Drop</span>
                  <span className="font-semibold text-gray-900">
                    {campaignMetrics?.initial_drop ?? '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Before Resolution</span>
                  <span className="font-semibold text-gray-900">
                    {campaignMetrics?.dropped_before_resolution ?? '—'}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
                VOC (Voice of Customer)
              </p>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Interested</span>
                  <span className="font-semibold text-gray-900">
                    {campaignMetrics?.voc_interested ?? '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Not Interested</span>
                  <span className="font-semibold text-gray-900">
                    {campaignMetrics?.voc_not_interested ?? '—'}
                  </span>
                </div>
              </div>
            </div>
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

      {/* Outbound Call Modal */}
      {showOutboundModal && (
        <OutboundCallModal
          isOpen={showOutboundModal}
          onClose={() => setShowOutboundModal(false)}
        />
      )}
    </div>
  )
}

export default Dashboard
