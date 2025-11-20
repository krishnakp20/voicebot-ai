import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'

const Login = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const params = new URLSearchParams()
      params.append('username', email)
      params.append('password', password)

      const response = await api.post('/auth/login', params.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      })

      if (response.data.access_token) {
        localStorage.setItem('token', response.data.access_token)
        navigate('/dashboard')
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 relative overflow-hidden">
      <div className="absolute inset-0 opacity-40 bg-gradient-to-tr from-blue-500 via-indigo-500 to-purple-600"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.12),_transparent_45%)]"></div>

      <div className="relative z-10 flex items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden border border-white/60">
          {/* Brand Panel */}
          <div className="bg-gradient-to-br from-blue-600 to-indigo-600 text-white p-8 md:p-10 flex flex-col justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-white/80 mb-4">DialdeskBot AI</p>
              <h2 className="text-3xl font-bold leading-tight">Give your business a voice with intelligent agents.</h2>
              <p className="mt-4 text-white/80 text-sm">
                Real-time dashboards • Sentiment tracking • Call insights
              </p>
            </div>
            <div className="mt-10 md:mt-0 space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-white/15 flex items-center justify-center text-lg font-semibold">
                  24/7
                </div>
                <div>
                  <p className="text-sm font-semibold">Always-On Availability</p>
                  <p className="text-xs text-white/80">Serve callers instantly, worldwide.</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-white/15 flex items-center justify-center text-lg font-semibold">
                  92%
                </div>
                <div>
                  <p className="text-sm font-semibold">Positive Sentiment</p>
                  <p className="text-xs text-white/80">Delightful experiences out of the box.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Login Form */}
          <div className="p-8 md:p-10 bg-white">
            <div className="mb-8">
              <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Welcome back</p>
              <h1 className="text-2xl font-bold text-gray-900 mt-2">Sign in to continue</h1>
              <p className="text-sm text-gray-500 mt-1">Use your admin credentials to access the dashboard.</p>
            </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-gray-700 text-sm font-medium mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="your@email.com"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="password" className="block text-gray-700 text-sm font-medium">
                    Password
                  </label>
                  <span className="text-xs text-blue-600 hover:text-blue-700 cursor-pointer">
                    Forgot?
                  </span>
                </div>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <p className="text-xs text-gray-400 mt-6 text-center">
              Secured access • Encrypted authentication • Nimantran integrated
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login

