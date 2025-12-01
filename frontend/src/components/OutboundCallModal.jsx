import { useState } from 'react'
import api from '../services/api'
import { XMarkIcon, PhoneIcon } from '@heroicons/react/24/outline'

const OutboundCallModal = ({ isOpen, onClose }) => {
  const [mobileNumber, setMobileNumber] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState('number') // 'number' or 'otp'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const handleNumberSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // Validate mobile number (basic validation)
      if (!mobileNumber || mobileNumber.length < 10) {
        throw new Error('Please enter a valid mobile number (minimum 10 digits)')
      }

      const response = await api.post('/send-otp', {
        number: mobileNumber
      })

      if (response.data && response.data.message) {
        setStep('otp')
      } else {
        throw new Error('Failed to send OTP. Please try again.')
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to send OTP')
    } finally {
      setLoading(false)
    }
  }

  const handleOtpSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // Validate OTP
      if (!otp || otp.length !== 6) {
        throw new Error('Please enter a valid 6-digit OTP')
      }

      const response = await api.post('/verify-otp-and-call', {
        number: mobileNumber,
        otp: otp
      })

      if (response.data && response.data.status === 'success') {
        setSuccess(true)
        // Close modal after 2 seconds
        setTimeout(() => {
          handleClose()
        }, 2000)
      } else {
        throw new Error(response.data?.message || 'Failed to verify OTP and trigger call')
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to verify OTP and trigger call')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    // Reset state
    setMobileNumber('')
    setOtp('')
    setStep('number')
    setError(null)
    setSuccess(false)
    setLoading(false)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6 relative">
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <XMarkIcon className="h-6 w-6" />
        </button>

        {/* Header */}
        <div className="flex items-center space-x-3 mb-6">
          <div className="bg-green-100 rounded-full p-2">
            <PhoneIcon className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-800">Outbound Call</h2>
            <p className="text-sm text-gray-500">
              {step === 'number' ? 'Enter mobile number' : 'Enter OTP to verify'}
            </p>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-700">
              {success ? 'Call triggered successfully! Closing...' : ''}
            </p>
          </div>
        )}

        {/* Number Input Form */}
        {step === 'number' && (
          <form onSubmit={handleNumberSubmit}>
            <div className="mb-4">
              <label htmlFor="mobileNumber" className="block text-sm font-medium text-gray-700 mb-2">
                Mobile Number
              </label>
              <input
                type="tel"
                id="mobileNumber"
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, ''))}
                placeholder="9911362206"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                required
                disabled={loading}
              />
            </div>
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading}
              >
                {loading ? 'Sending...' : 'Send OTP'}
              </button>
            </div>
          </form>
        )}

        {/* OTP Input Form */}
        {step === 'otp' && (
          <form onSubmit={handleOtpSubmit}>
            <div className="mb-4">
              <label htmlFor="otp" className="block text-sm font-medium text-gray-700 mb-2">
                Enter OTP (6 digits)
              </label>
              <input
                type="text"
                id="otp"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-center text-2xl tracking-widest"
                maxLength="6"
                required
                disabled={loading || success}
              />
              <p className="text-xs text-gray-500 mt-2">
                OTP sent to {mobileNumber}
              </p>
            </div>
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={() => {
                  setStep('number')
                  setOtp('')
                  setError(null)
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={loading || success}
              >
                Back
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading || success}
              >
                {loading ? 'Verifying...' : success ? 'Success!' : 'Verify & Call'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export default OutboundCallModal


