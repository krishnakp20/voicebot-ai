import { useState, useRef, useEffect } from 'react'
import { PlayIcon, PauseIcon } from '@heroicons/react/24/solid'
import api from '../services/api'

const AudioPlayer = ({ audioUrl }) => {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [audioSrc, setAudioSrc] = useState(null)
  const [loading, setLoading] = useState(false)
  const audioRef = useRef(null)

  useEffect(() => {
    if (!audioUrl) {
      setAudioSrc(null)
      return
    }

    // Load audio as blob with authentication
    const loadAudio = async () => {
      try {
        setLoading(true)
        const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
        const fullUrl = audioUrl.startsWith('/') 
          ? `${apiBaseUrl}${audioUrl}` 
          : audioUrl
        
        // Get token for authentication
        const token = localStorage.getItem('token')
        const response = await fetch(fullUrl, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        
        if (!response.ok) {
          throw new Error('Failed to load audio')
        }
        
        const blob = await response.blob()
        const blobUrl = URL.createObjectURL(blob)
        setAudioSrc(blobUrl)
      } catch (error) {
        console.error('Error loading audio:', error)
        setAudioSrc(null)
      } finally {
        setLoading(false)
      }
    }

    loadAudio()

    // Cleanup blob URL when component unmounts or URL changes
    return () => {
      if (audioSrc && audioSrc.startsWith('blob:')) {
        URL.revokeObjectURL(audioSrc)
      }
    }
  }, [audioUrl])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !audioSrc) return

    const handleLoadedMetadata = () => {
      setDuration(audio.duration)
    }
    
    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime)
    }
    
    const handleEnded = () => {
      setIsPlaying(false)
      setCurrentTime(0)
    }
    
    const handleError = (e) => {
      console.error('Audio error:', e)
      setIsPlaying(false)
    }

    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('error', handleError)

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('error', handleError)
    }
  }, [audioSrc])

  const togglePlayPause = async () => {
    const audio = audioRef.current
    if (!audio || !audioSrc) return

    try {
      if (isPlaying) {
        audio.pause()
        setIsPlaying(false)
      } else {
        await audio.play()
        setIsPlaying(true)
      }
    } catch (error) {
      console.error('Error playing audio:', error)
      setIsPlaying(false)
    }
  }

  const formatTime = (seconds) => {
    if (isNaN(seconds) || !isFinite(seconds)) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleProgressChange = (e) => {
    const audio = audioRef.current
    if (audio && duration > 0) {
      const newTime = (e.target.value / 100) * duration
      audio.currentTime = newTime
      setCurrentTime(newTime)
    }
  }

  if (loading) {
    return (
      <div className="bg-gray-100 rounded-lg p-4 text-center text-gray-500">
        Loading audio...
      </div>
    )
  }

  if (!audioSrc || !audioUrl) {
    return (
      <div className="bg-gray-100 rounded-lg p-4 text-center text-gray-500">
        No audio available
      </div>
    )
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <audio ref={audioRef} src={audioSrc} preload="auto" />
      
      <div className="flex items-center space-x-4">
        <button
          onClick={togglePlayPause}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-full p-3 transition-colors"
        >
          {isPlaying ? (
            <PauseIcon className="w-6 h-6" />
          ) : (
            <PlayIcon className="w-6 h-6" />
          )}
        </button>

        <div className="flex-1">
          <input
            type="range"
            min="0"
            max="100"
            value={progress}
            onChange={handleProgressChange}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <div className="text-sm text-gray-600 min-w-[100px] text-right">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      </div>
    </div>
  )
}

export default AudioPlayer

