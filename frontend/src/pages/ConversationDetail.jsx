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

  return (
    <div>
      <Link
        to="/conversations"
        className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-6"
      >
        <ArrowLeftIcon className="w-5 h-5 mr-2" />
        Back to Conversations
      </Link>

      <h1 className="text-3xl font-bold text-gray-800 mb-8">Conversation Details</h1>

      {/* Metadata Card */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Metadata</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">Conversation ID</p>
            <p className="text-lg font-medium text-gray-800">{conversation.conversation_id}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Agent</p>
            <p className="text-lg font-medium text-gray-800">{conversation.agent || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Caller Number</p>
            <p className="text-lg font-medium text-gray-800">{conversation.caller_number || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Receiver Number</p>
            <p className="text-lg font-medium text-gray-800">{conversation.receiver_number || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Duration</p>
            <p className="text-lg font-medium text-gray-800">{formatDuration(conversation.duration)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Sentiment Score</p>
            <p className={`text-lg font-medium ${getSentimentColor(conversation.sentiment)}`}>
              {conversation.sentiment ? conversation.sentiment.toFixed(2) : 'N/A'}
            </p>
          </div>
          <div className="md:col-span-2">
            <p className="text-sm text-gray-600">Created At</p>
            <p className="text-lg font-medium text-gray-800">{formatDate(conversation.created_at)}</p>
          </div>
        </div>
      </div>

      {/* Audio Player Card */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-800">Audio</h2>
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
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Transcript</h2>
        {transcript ? (
          <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
            <p className="text-gray-800 whitespace-pre-wrap">{transcript.text}</p>
          </div>
        ) : (
          <div className="bg-gray-50 rounded-lg p-4 text-center text-gray-500">
            Transcript not available
          </div>
        )}
      </div>
    </div>
  )
}

export default ConversationDetail

