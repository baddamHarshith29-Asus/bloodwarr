import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { AlertTriangle, Play, RefreshCw, TrendingUp, Users, Heart, Activity } from 'lucide-react'
import { api } from '../api'
import PipelinePanel from '../components/PipelinePanel'

const STATUS_COLORS = {
  Pending: '#F59E0B',
  'Searching Donors': '#3A6D7C',
  'Donor Confirmed': '#10B981',
  Completed: '#10B981',
  Fulfilled: '#10B981',
  Critical: '#D92332',
}

const BG_COLORS = ['#D92332', '#10B981', '#3A6D7C', '#F59E0B', '#685A8A', '#60a5fa', '#fb923c', '#a78bfa']

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [demo, setDemo] = useState(null)
  const [error, setError] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = () => {
    setRefreshing(true)
    api.dashboard()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setRefreshing(false))
  }

  useEffect(load, [])

  const runDemo = async () => {
    try {
      const r = await api.demoRahul()
      setDemo(r)
      load()
    } catch (e) {
      alert(e.message)
    }
  }

  if (error) return (
    <div className="error">
      <AlertTriangle size={16} style={{ display: 'inline', marginRight: 6 }} />
      Backend error: {error}
    </div>
  )
  if (!data) return <div className="loading">Loading BloodMind dashboard...</div>

  const bgData = Object.entries(data.blood_group_distribution || {})
    .map(([name, value]) => ({ name: name.replace(' Positive', '+').replace(' Negative', '-'), value }))
    .sort((a, b) => b.value - a.value)

  const statusData = [
    { name: 'Pending', value: data.pending_requests || 0 },
    { name: 'Searching', value: data.searching_donors || 0 },
    { name: 'Confirmed', value: data.donor_confirmed || 0 },
    { name: 'Completed', value: data.completed_donations || 0 },
  ].filter(d => d.value > 0)

  return (
    <>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2>AI Coordination Dashboard</h2>
          <p>Real-time blood network overview — {data.total_patients || 0} patients · {data.total_donors || 0} donors</p>
        </div>
        <button className="btn btn-secondary" onClick={load} disabled={refreshing} style={{ marginTop: '0.25rem' }}>
          <RefreshCw size={14} className={refreshing ? 'spin' : ''} /> Refresh
        </button>
      </div>

      {/* AI Pipeline Status — always visible */}
      <PipelinePanel compact={true} />

      {/* Critical Alerts Banner */}
      {data.critical_alerts && (
        <div className="error" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '2rem', marginTop: '1rem' }}>
          <AlertTriangle size={18} />
          <strong>CRITICAL:</strong> One or more blood requests have escalated to Critical status — immediate coordinator action required.
        </div>
      )}

      {/* KPI Stat Cards */}
      <div className="stats-grid">
        <div className="stat-card accent">
          <div className="label">Total Donors</div>
          <div className="value">{data.total_donors}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{data.available_donors} available now</div>
        </div>
        <div className="stat-card info">
          <div className="label">Active Requests</div>
          <div className="value">{data.active_requests}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{data.pending_requests} pending</div>
        </div>
        <div className="stat-card warning">
          <div className="label">Predicted (3 days)</div>
          <div className="value">{data.predicted_requests}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{data.upcoming_transfusions_7d} within 7d</div>
        </div>
        <div className="stat-card success">
          <div className="label">Completed</div>
          <div className="value">{data.completed_donations}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{(data.donor_response_rate * 100).toFixed(0)}% response rate</div>
        </div>
        <div className="stat-card">
          <div className="label">Searching Donors</div>
          <div className="value">{data.searching_donors}</div>
        </div>
        <div className="stat-card success">
          <div className="label">Donor Confirmed</div>
          <div className="value">{data.donor_confirmed}</div>
        </div>
      </div>

      {/* Demo Story Card */}
      <div className="card">
        <h3>
          <Play size={16} style={{ marginRight: 8, color: 'var(--accent)' }} />
          Judge Demo — Full Workflow Simulation
        </h3>
        <p style={{ color: 'var(--muted)', fontSize: '0.875rem', marginBottom: '1.25rem', lineHeight: 1.6 }}>
          Runs the complete Blood Warriors pipeline: Rahul Kumar (Thalassemia) →  Predict 18-day cycle → Auto-Create Request → Match Top 5 Donors → Generate AI Messages
        </p>
        <button className="btn btn-primary" onClick={runDemo}>
          <Play size={14} /> Run Full Demo Workflow
        </button>
        {demo && (
          <div style={{ marginTop: '1.25rem', background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.15)', borderRadius: 8, padding: '1rem', fontSize: '0.875rem', lineHeight: 1.6 }}>
            <div style={{ color: 'var(--success)', fontWeight: 700, marginBottom: 4 }}>✓ {demo.story}</div>
            <div><strong>{demo.patient}</strong> — Predicted: <span style={{ color: 'var(--warning)' }}>{demo.prediction?.predicted_need_date}</span> ({demo.prediction?.days_until} days away)</div>
            <div style={{ marginTop: 4 }}>Request <strong>#{demo.request_id}</strong> · Messages Generated: <strong>{demo.messages_generated}</strong></div>
            <div style={{ marginTop: 4, color: 'var(--muted)' }}>
              Top Donors: {demo.top_donors?.map((d) => `${d.name} (${d.score}pts)`).join(' · ')}
            </div>
          </div>
        )}
      </div>

      {/* Charts Row */}
      <div className="grid-2">
        <div className="card">
          <h3>Blood Group Distribution ({data.total_donors} donors)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={bgData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fill: '#9AA0B1', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9AA0B1', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#222736', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, color: '#fff' }} />
              <Bar dataKey="value" fill="#D92332" radius={[4, 4, 0, 0]}>
                {bgData.map((_, i) => (
                  <Cell key={i} fill={BG_COLORS[i % BG_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h3>Request Status Breakdown</h3>
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                  {statusData.map((entry, i) => (
                    <Cell key={i} fill={STATUS_COLORS[entry.name] || BG_COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#222736', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, color: '#fff' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>No active requests yet. Run the demo!</div>
          )}
        </div>
      </div>

      {/* Upcoming Predictions + Recent Requests */}
      <div className="grid-2">
        <div className="card">
          <h3>
            <TrendingUp size={16} style={{ marginRight: 8, color: 'var(--warning)' }} />
            Upcoming Predictions (7d)
          </h3>
          <table>
            <thead>
              <tr><th>Patient</th><th>Blood</th><th>Predicted</th><th>Days</th></tr>
            </thead>
            <tbody>
              {(data.upcoming_predictions || []).length === 0 && (
                <tr><td colSpan={4} style={{ color: 'var(--muted)', textAlign: 'center' }}>No upcoming predictions</td></tr>
              )}
              {(data.upcoming_predictions || []).map((p) => (
                <tr key={p.patient_id}>
                  <td>{p.patient_name}</td>
                  <td><span className="badge staging">{p.blood_group?.replace(' Positive', '+').replace(' Negative', '-')}</span></td>
                  <td style={{ fontSize: 11, color: 'var(--muted)' }}>{p.predicted_date}</td>
                  <td style={{ color: p.days_until <= 3 ? 'var(--accent)' : 'var(--warning)', fontWeight: 600 }}>
                    {p.days_until <= 0 ? '⚠ Overdue' : `${p.days_until}d`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h3>
            <Activity size={16} style={{ marginRight: 8, color: 'var(--info)' }} />
            Recent Requests
          </h3>
          <table>
            <thead>
              <tr><th>ID</th><th>Patient</th><th>Blood</th><th>Status</th><th>Source</th></tr>
            </thead>
            <tbody>
              {(data.recent_requests || []).length === 0 && (
                <tr><td colSpan={5} style={{ color: 'var(--muted)', textAlign: 'center' }}>No requests yet</td></tr>
              )}
              {(data.recent_requests || []).map((r) => (
                <tr key={r.id} style={r.status === 'Critical' ? { background: 'rgba(217,35,50,0.03)' } : {}}>
                  <td style={{ fontFamily: 'monospace', color: 'var(--muted)', fontSize: 11 }}>#{r.id}</td>
                  <td style={{ fontWeight: 500 }}>{r.patient_name}</td>
                  <td>
                    <span className="badge staging" style={{ fontSize: 10 }}>
                      {r.blood_group?.replace(' Positive', '+').replace(' Negative', '-')}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${r.status === 'Completed' ? 'eligible' : r.status === 'Donor Confirmed' ? 'active' : r.status === 'Critical' ? 'urgent' : 'staging'}`}>
                      {r.status}
                    </span>
                  </td>
                  <td style={{ color: 'var(--muted)', fontSize: 11 }}>{r.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Outreach Activity Feed */}
      <RecentActivity />
    </>
  )
}

function RecentActivity() {
  const [notifs, setNotifs] = useState(null)

  useEffect(() => {
    fetch('/api/v1/notifications?limit=8')
      .then(r => r.json())
      .then(d => setNotifs(d.notifications || []))
      .catch(() => setNotifs([]))
  }, [])

  if (!notifs || notifs.length === 0) return null

  const statusColors = { responded: 'var(--success)', sent: 'var(--warning)', declined: 'var(--accent)', pending_review: 'var(--muted)' }

  return (
    <div className="card">
      <h3>
        <Users size={16} style={{ marginRight: 8, color: 'var(--purple)' }} />
        Recent Outreach Activity
        <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--muted)', fontWeight: 400 }}>last {notifs.length} notifications</span>
      </h3>
      <div>
        {notifs.map(n => (
          <div key={n.id} className="feed-item">
            <div className="feed-dot" style={{ background: statusColors[n.status] || 'var(--muted)' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 500, fontSize: 13 }}>{n.donor_name}</span>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                  <span className={`badge ${n.status === 'responded' ? 'eligible' : n.status === 'declined' ? 'urgent' : 'staging'}`} style={{ fontSize: 10 }}>
                    {n.status}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--muted)' }}>{n.channel}</span>
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                Request #{n.request_id}
                {n.donor_response && <span style={{ marginLeft: 6, color: n.donor_response === 'YES' ? 'var(--success)' : 'var(--accent)' }}>→ {n.donor_response}</span>}
                {n.sent_at && <span style={{ marginLeft: 6 }}>{new Date(n.sent_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}


