import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Conversations from './pages/Conversations'
import ConversationDetail from './pages/ConversationDetail'
import Agents from './pages/Agents'
import Prompts from './pages/Prompts'
import TalkToAgent from './pages/TalkToAgent'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="conversations" element={<Conversations />} />
          <Route path="conversations/:id" element={<ConversationDetail />} />
          <Route path="agents" element={<Agents />} />
          <Route path="prompts" element={<Prompts />} />
        </Route>
        {/* Talk to Agent route - full screen, no sidebar */}
        <Route
          path="/talk-to"
          element={
            <ProtectedRoute>
              <TalkToAgent />
            </ProtectedRoute>
          }
        />
        <Route
          path="/talk-to/:agentId"
          element={
            <ProtectedRoute>
              <TalkToAgent />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  )
}

export default App


