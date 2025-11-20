import { Outlet, Link, useNavigate } from 'react-router-dom'
import { 
  HomeIcon, 
  ChatBubbleLeftRightIcon,
  UserGroupIcon,
  ArrowRightOnRectangleIcon
} from '@heroicons/react/24/outline'

const Layout = () => {
  const navigate = useNavigate()

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


