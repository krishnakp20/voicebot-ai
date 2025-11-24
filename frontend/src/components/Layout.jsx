import { Outlet, Link, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { 
  HomeIcon, 
  ChatBubbleLeftRightIcon,
  UserGroupIcon,
  DocumentTextIcon,
  ArrowRightOnRectangleIcon
} from '@heroicons/react/24/outline'
import api from '../services/api'

const Layout = () => {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)

  useEffect(() => {
    fetchUserInfo()
  }, [])

  const fetchUserInfo = async () => {
    try {
      const response = await api.get('/auth/me')
      setUser(response.data)
    } catch (error) {
      console.error('Error fetching user info:', error)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar - fixed so it stays in place while content scrolls */}
      <aside className="fixed inset-y-0 left-0 w-64 bg-white shadow-lg">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-gray-800">DialdeskBot AI</h1>
          {user?.receiver_name && (
            <div className="mt-2 text-sm text-gray-600">
              <span className="font-medium">Receiver:</span> {user.receiver_name}
              {user.receiver_number && (
                <span className="text-gray-500 ml-1">({user.receiver_number})</span>
              )}
            </div>
          )}
        </div>
        
        <nav className="mt-8">
          <Link
            to="/dashboard"
            className="flex items-center px-6 py-3 text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <HomeIcon className="w-5 h-5 mr-3" />
            Dashboard
          </Link>
          <Link
            to="/conversations"
            className="flex items-center px-6 py-3 text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <ChatBubbleLeftRightIcon className="w-5 h-5 mr-3" />
            Conversations
          </Link>
          <Link
            to="/agents"
            className="flex items-center px-6 py-3 text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <UserGroupIcon className="w-5 h-5 mr-3" />
            Agents
          </Link>
          <Link
            to="/prompts"
            className="flex items-center px-6 py-3 text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <DocumentTextIcon className="w-5 h-5 mr-3" />
            Prompts
          </Link>
        </nav>

        <div className="absolute bottom-0 w-64 p-6">
          <button
            onClick={handleLogout}
            className="flex items-center w-full px-6 py-3 text-gray-700 hover:bg-gray-100 transition-colors rounded-lg"
          >
            <ArrowRightOnRectangleIcon className="w-5 h-5 mr-3" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content - shifted right to make room for the fixed sidebar */}
      <main className="flex-1 ml-64">
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

export default Layout


