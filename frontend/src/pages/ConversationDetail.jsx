import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../services/api'
import AudioPlayer from '../components/AudioPlayer'
import { ArrowLeftIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline'

const ConversationDetail = () => {
  const { id } = useParams()
  const [conversation, setConversation] = useState(null)
  const [transcript, setTranscript] = useState(null)
  const [audioUrl, setAudioUrl] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchConversationDetails()
  }, [id])

  const fetchConversationDetails = async () => {
    try {
      setLoading(true)
      console.log('Fetching conversation details for ID:', id)
      
      const [convResponse, transcriptResponse, audioResponse] = await Promise.all([
        api.get(`/conversations/${id}`).catch((err) => {
          console.error('Conversation fetch failed:', err)
          console.error('Error details:', err.response?.data || err.message)
          throw err
        }),
        api.get(`/conversations/${id}/transcript`).catch((err) => {
          console.warn('Transcript fetch failed:', err.response?.data || err.message)
          return null
        }),
        api.get(`/conversations/${id}/audio`).catch((err) => {
          console.warn('Audio fetch failed:', err.response?.data || err.message)
          return null
        })
      ])

      console.log('Conversation response:', convResponse.data)
      if (!convResponse.data) {
        console.error('No conversation data received')
        return
      }
      
      setConversation(convResponse.data)
      
      if (transcriptResponse && transcriptResponse.data) {
        console.log('Transcript response:', transcriptResponse.data)
        setTranscript(transcriptResponse.data)
      }
      
      if (audioResponse && audioResponse.data) {
        console.log('Audio response:', audioResponse.data)
        if (audioResponse.data.audio_url && audioResponse.data.available) {
          setAudioUrl(audioResponse.data.audio_url)
        }
      }
    } catch (error) {
      console.error('Error fetching conversation details:', error)
      console.error('Error response:', error.response?.data)
      // Don't set conversation to null if it's a 404, let the UI show the error
      if (error.response?.status === 404) {
        setConversation(null)
      }
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const formatDuration = (seconds) => {
    if (!seconds) return 'N/A'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}m ${secs}s`
  }

  const getSentimentColor = (sentiment) => {
    if (!sentiment) return 'text-gray-500'
    if (sentiment >= 0.7) return 'text-green-600'
    if (sentiment >= 0.4) return 'text-yellow-600'
    return 'text-red-600'
  }

  const handleDownloadAudio = async () => {
    if (!audioUrl) return
    
    try {
      // Build full URL
      const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
      const fullUrl = audioUrl.startsWith('/') 
        ? `${apiBaseUrl}${audioUrl}` 
        : audioUrl
      
      // Fetch with auth token
      const token = localStorage.getItem('token')
      const response = await fetch(fullUrl, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (!response.ok) throw new Error('Failed to download audio')
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `conversation-${id}.mp3`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error downloading audio:', error)
      alert('Failed to download audio')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading conversation details...</div>
      </div>
    )
  }

  if (!conversation) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 mb-4">Conversation not found</p>
        <Link to="/conversations" className="text-blue-600 hover:text-blue-800">
          Back to Conversations
        </Link>
      </div>
    )
  }

  const dataCollectionEntries =
    conversation.data_collection_results && typeof conversation.data_collection_results === 'object'
      ? Object.entries(conversation.data_collection_results).filter(
          ([, value]) => value && typeof value === 'object'
        )
      : []

  const evaluationEntries =
    conversation.evaluation_criteria_results && typeof conversation.evaluation_criteria_results === 'object'
      ? Object.entries(conversation.evaluation_criteria_results).filter(
          ([, value]) => value && typeof value === 'object'
        )
      : []

  const hasDataCollection = dataCollectionEntries.length > 0
  const hasEvaluationResults = evaluationEntries.length > 0
  const showAnalysisSection =
    Boolean(conversation.call_successful) || hasEvaluationResults || hasDataCollection

  return (
    <div>
      <Link
        to="/conversations"
        className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-6"
      >
        <ArrowLeftIcon className="w-5 h-5 mr-2" />
        Back to Conversations
      </Link>

      {/* Header with Call Summary Title */}
      <div className="mb-6">
        {conversation.call_summary_title ? (
          <h1 className="text-2xl font-bold text-gray-800 mb-2">{conversation.call_summary_title}</h1>
        ) : (
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Conversation Details</h1>
        )}
        <p className="text-sm text-gray-500">Conversation ID: {conversation.conversation_id}</p>
      </div>

      {/* Transcript Summary Card */}
      {conversation.transcript_summary && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-5 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
            <span className="mr-2">📝</span>
            Conversation Summary
          </h2>
          <div className="bg-white rounded-lg p-4 border border-blue-100">
            <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{conversation.transcript_summary}</p>
          </div>
        </div>
      )}

      {/* Metadata Card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Metadata</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Conversation ID</p>
            <p className="text-sm font-medium text-gray-800 font-mono break-all">{conversation.conversation_id}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Agent</p>
            <p className="text-sm font-medium text-gray-800">{conversation.agent || 'N/A'}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Caller Number</p>
            <p className="text-sm font-medium text-gray-800">{conversation.caller_number || 'N/A'}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Receiver Number</p>
            <p className="text-sm font-medium text-gray-800">{conversation.receiver_number || 'N/A'}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Duration</p>
            <p className="text-sm font-medium text-gray-800">{formatDuration(conversation.duration)}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Sentiment Score</p>
            <p className={`text-sm font-medium ${getSentimentColor(conversation.sentiment)}`}>
              {conversation.sentiment ? conversation.sentiment.toFixed(2) : 'N/A'}
            </p>
          </div>
          <div className="md:col-span-2 lg:col-span-3">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Created At</p>
            <p className="text-sm font-medium text-gray-800">{formatDate(conversation.created_at)}</p>
          </div>
        </div>
      </div>

      {/* Audio Player Card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-800">Audio</h2>
          {audioUrl && (
            <button
              onClick={handleDownloadAudio}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <ArrowDownTrayIcon className="w-5 h-5 mr-2" />
              Download
            </button>
          )}
        </div>
        <AudioPlayer audioUrl={audioUrl} />
      </div>

      {/* Transcript Card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Full Transcript</h2>
        {transcript ? (
          <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto border border-gray-200">
            <p className="text-gray-800 whitespace-pre-wrap text-sm leading-relaxed">{transcript.text}</p>
          </div>
        ) : (
          <div className="bg-gray-50 rounded-lg p-4 text-center text-gray-500 border border-gray-200">
            Transcript not available
          </div>
        )}
      </div>

      {/* AI Analysis Section */}
      {showAnalysisSection && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">AI Analysis</h2>
              <p className="text-sm text-gray-500">Insights extracted automatically</p>
            </div>
            {conversation.call_successful && (
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${
                  conversation.call_successful === 'success'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
                }`}
              >
                Call Status: {conversation.call_successful}
              </span>
            )}
          </div>

          {hasEvaluationResults && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                Evaluation Criteria
              </h3>
              <div className="grid grid-cols-1 gap-4">
                {evaluationEntries.map(([key, value]) => (
                  <div
                    key={key}
                    className="border border-gray-200 rounded-lg p-4 bg-gradient-to-r from-indigo-50 to-blue-50"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="text-xs font-semibold text-indigo-800 uppercase tracking-wide">{key}</p>
                        {value.evaluation_criteria_id && (
                          <p className="text-[11px] text-gray-500 font-mono">
                            ID: {value.evaluation_criteria_id}
                          </p>
                        )}
                      </div>
                      {value.score !== undefined && value.score !== null && (
                        <span className="text-sm font-semibold text-indigo-700">
                          Score: {value.score}
                        </span>
                      )}
                    </div>
                    {value.result && (
                      <p className="text-sm font-medium text-gray-800 mb-2">Result: {value.result}</p>
                    )}
                    {value.rationale && (
                      <div className="text-sm text-gray-700 bg-white rounded p-3 border border-gray-200">
                        {value.rationale}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {hasDataCollection && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                Data Collection
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {dataCollectionEntries.map(([key, dataCollection]) => {
                  const value =
                    dataCollection.value === null || dataCollection.value === undefined
                      ? 'Not provided'
                      : typeof dataCollection.value === 'object'
                        ? JSON.stringify(dataCollection.value)
                        : String(dataCollection.value)

                  return (
                    <div
                      key={key}
                      className="border border-purple-100 bg-white rounded-lg p-3 flex flex-col gap-2 shadow-sm"
                    >
                      <div className="text-xs font-semibold text-purple-700 uppercase tracking-wide">
                        {key.replace(/_/g, ' ')}
                      </div>
                      <p className="text-sm font-medium text-gray-900">{value}</p>
                      {dataCollection.rationale && (
                        <p className="text-xs text-gray-500">
                          {dataCollection.rationale.length > 120
                            ? `${dataCollection.rationale.slice(0, 117)}...`
                            : dataCollection.rationale}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default ConversationDetail

