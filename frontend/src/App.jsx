import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Users, Heart, Zap, Send, Activity,
  ClipboardList, Brain, GitMerge, MessageSquare, Settings, Cloud
} from 'lucide-react'
import Dashboard from './pages/Dashboard'
import RequestCenter from './pages/RequestCenter'
import DonorManagement from './pages/DonorManagement'
import PatientManagement from './pages/PatientManagement'
import PredictionCenter from './pages/PredictionCenter'
import DonorMatching from './pages/DonorMatching'
import OutreachStudio from './pages/OutreachStudio'
import CompatibilityGraph from './pages/CompatibilityGraph'
import Chat from './pages/Chat'
import Protocol from './pages/Protocol'
import Analytics from './pages/Analytics'
import AIInsights from './pages/AIInsights'

function App() {
  return (
    <BrowserRouter>
      <div className="app-layout">
        <aside className="sidebar">
          <div className="logo">
            <div className="logo-icon">🩸</div>
            <div>
              <h1>BloodMind</h1>
              <span>Blood Warriors AI</span>
            </div>
          </div>
          <nav>
            <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <LayoutDashboard size={18} /> <span>Dashboard</span>
            </NavLink>
            <NavLink to="/requests" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <ClipboardList size={18} /> <span>Request Center</span>
            </NavLink>
            <NavLink to="/patients" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Heart size={18} /> <span>Patient Management</span>
            </NavLink>
            <NavLink to="/donors" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Users size={18} /> <span>Donor Management</span>
            </NavLink>
            <NavLink to="/predictions" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Brain size={18} /> <span>Prediction Center</span>
            </NavLink>
            <NavLink to="/graph" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <GitMerge size={18} /> <span>Biological Graph</span>
            </NavLink>
            <NavLink to="/matching" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Zap size={18} /> <span>Donor Matching</span>
            </NavLink>
            <NavLink to="/outreach" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Send size={18} /> <span>Outreach Studio</span>
            </NavLink>
            <NavLink to="/chat" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <MessageSquare size={18} /> <span>Donor AI Chat</span>
            </NavLink>
            <NavLink to="/protocol" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Settings size={18} /> <span>Self-Healing Protocol</span>
            </NavLink>
            <NavLink to="/aws-insights" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Cloud size={18} /> <span>AWS AI Insights</span>
            </NavLink>
            <NavLink to="/analytics" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Activity size={18} /> <span>Analytics</span>
            </NavLink>
          </nav>
          <div style={{ marginTop: 'auto', padding: '1rem 0.5rem', fontSize: '0.7rem', color: 'var(--muted)' }}>
            <Activity size={12} style={{ display: 'inline', marginRight: 4 }} />
            BloodMind v2 · DB-backed
          </div>
        </aside>
        <main className="main">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/requests" element={<RequestCenter />} />
            <Route path="/patients" element={<PatientManagement />} />
            <Route path="/donors" element={<DonorManagement />} />
            <Route path="/predictions" element={<PredictionCenter />} />
            <Route path="/graph" element={<CompatibilityGraph />} />
            <Route path="/matching" element={<DonorMatching />} />
            <Route path="/outreach" element={<OutreachStudio />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/protocol" element={<Protocol />} />
            <Route path="/aws-insights" element={<AIInsights />} />
            <Route path="/analytics" element={<Analytics />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

export default App
