import { useEffect, useState } from 'react'
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, RadialBarChart, RadialBar
} from 'recharts'
import { Activity, TrendingUp, Users, Heart, Award, Target } from 'lucide-react'
import { api } from '../api'

const COLORS   = ['#D92332', '#10B981', '#3A6D7C', '#F59E0B', '#685A8A', '#60a5fa', '#fb923c', '#a78bfa']
const BG_SHORT = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+']

const CustomTooltipStyle = {
  background: '#1a1d2e',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 8,
  color: '#fff',
  fontSize: 12,
  padding: '8px 12px',
}

export default function Analytics() {
  const [data, setData]       = useState(null)
  const [engage, setEngage]   = useState(null)

  useEffect(() => {
    api.analytics().then(setData).catch(console.error)
    // Load engagement analytics
    fetch('/api/v1/analytics/engagement')
      .then(r => r.json())
      .then(setEngage)
      .catch(() => {})
  }, [])

  if (!data) return <div className="loading">Loading analytics...</div>

  const bgData = Object.entries(data.requests_by_blood_group || {})
    .map(([name, value]) => ({ name: name.replace(' Positive', '+').replace(' Negative', '-'), value }))
    .sort((a, b) => b.value - a.value)

  const statusData = Object.entries(data.request_status_breakdown || {})
    .map(([name, value]) => ({ name, value }))
    .filter(d => d.value > 0)

  const futureData = (data.predicted_future_detail || [])
    .slice(0, 10)
    .map(p => ({
      name: p.patient_name.split(' ')[0],
      days: p.days_until,
      blood: p.blood_group?.replace(' Positive', '+').replace(' Negative', '-'),
    }))

  const radialData = engage ? [
    { name: 'Active', value: Math.round((engage.active_donors / (engage.active_donors + engage.inactive_donors)) * 100), fill: '#10B981' },
    { name: 'Response', value: Math.round(engage.retention_rate * 100), fill: '#3A6D7C' },
    { name: 'Success', value: Math.round(data.donation_success_rate * 100), fill: '#D92332' },
  ] : []

  const successPct  = Math.round(data.donation_success_rate * 100)
  const retentionPct = engage ? Math.round(engage.retention_rate * 100) : '—'

  return (
    <>
      <div className="page-header">
        <h2><Activity size={20} style={{ display: 'inline', marginRight: 10, color: 'var(--accent)' }} />Analytics Dashboard</h2>
        <p>Deep-dive into network performance — requests, predictions, donor engagement, and supply forecasting</p>
      </div>

      {/* KPI Row */}
      <div className="stats-grid">
        <div className="stat-card success">
          <div className="label"><Award size={11} style={{ display: 'inline', marginRight: 4 }} />Success Rate</div>
          <div className="value">{successPct}%</div>
          <div style={{ marginTop: 6 }}>
            <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${successPct}%`, background: 'var(--success)', borderRadius: 2, transition: 'width 1s' }} />
            </div>
          </div>
        </div>
        <div className="stat-card accent">
          <div className="label"><Users size={11} style={{ display: 'inline', marginRight: 4 }} />Active Donors</div>
          <div className="value">{data.active_donors}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
            {engage ? `${retentionPct}% retention rate` : 'loading...'}
          </div>
        </div>
        <div className="stat-card warning">
          <div className="label"><TrendingUp size={11} style={{ display: 'inline', marginRight: 4 }} />Predicted (7d)</div>
          <div className="value">{data.predicted_future_requests}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>upcoming transfusion needs</div>
        </div>
        <div className="stat-card info">
          <div className="label"><Heart size={11} style={{ display: 'inline', marginRight: 4 }} />Completed</div>
          <div className="value">{data.completed_donations}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>donations fulfilled</div>
        </div>
        {engage && (
          <>
            <div className="stat-card">
              <div className="label"><Target size={11} style={{ display: 'inline', marginRight: 4 }} />Avg Calls / Donor</div>
              <div className="value" style={{ fontSize: '1.75rem' }}>{engage.avg_calls_per_donor}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>outreach touchpoints</div>
            </div>
            <div className="stat-card">
              <div className="label">Avg Donations</div>
              <div className="value" style={{ fontSize: '1.75rem' }}>{engage.avg_donations_per_donor}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>per donor lifetime</div>
            </div>
          </>
        )}
      </div>

      {/* Charts Row 1 */}
      <div className="grid-2">
        <div className="card">
          <h3>Requests by Blood Group</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={bgData} margin={{ top: 0, right: 10, left: -25, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fill: '#8b9cb3', fontSize: 11 }} />
              <YAxis tick={{ fill: '#8b9cb3', fontSize: 11 }} />
              <Tooltip contentStyle={CustomTooltipStyle} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={36}>
                {bgData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3>Request Status Breakdown</h3>
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={statusData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={3}
                  label={({ name, value }) => `${value}`}
                  labelLine={false}
                >
                  {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={CustomTooltipStyle} />
                <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ color: '#9AA0B1', fontSize: 11 }}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>
              No request data yet. Run the demo workflow!
            </div>
          )}
        </div>
      </div>

      {/* Upcoming Needs Timeline */}
      {futureData.length > 0 && (
        <div className="card">
          <h3><TrendingUp size={16} style={{ marginRight: 8, color: 'var(--warning)' }} />Upcoming Demand Timeline (Days Until Need)</h3>
          <p style={{ color: 'var(--muted)', fontSize: 12, marginBottom: '1.5rem' }}>
            Patients predicted to need transfusion within 30 days — sorted by urgency
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={futureData.sort((a, b) => a.days - b.days)} layout="vertical" margin={{ top: 0, right: 30, left: 60, bottom: 0 }}>
              <XAxis type="number" tick={{ fill: '#8b9cb3', fontSize: 11 }} />
              <YAxis dataKey="name" type="category" tick={{ fill: '#9AA0B1', fontSize: 11 }} width={55} />
              <Tooltip
                contentStyle={CustomTooltipStyle}
                formatter={(v, n, p) => [`${v} days`, `${p.payload.blood} patient`]}
              />
              <Bar dataKey="days" radius={[0, 4, 4, 0]} maxBarSize={18}>
                {futureData.map((d, i) => (
                  <Cell key={i} fill={d.days <= 3 ? '#D92332' : d.days <= 7 ? '#F59E0B' : '#3A6D7C'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.75rem', fontSize: 11, color: 'var(--muted)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: '#D92332', display: 'inline-block' }} /> ≤3 days (critical)</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: '#F59E0B', display: 'inline-block' }} /> 4–7 days (urgent)</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: '#3A6D7C', display: 'inline-block' }} /> 8+ days (planned)</span>
          </div>
        </div>
      )}

      {/* Donor Engagement Panel */}
      {engage && (
        <div className="grid-2">
          <div className="card">
            <h3><Users size={16} style={{ marginRight: 8, color: 'var(--info)' }} />Donor Engagement Breakdown</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
              {[
                { label: 'Active Donors', value: engage.active_donors, total: engage.active_donors + engage.inactive_donors, color: 'var(--success)' },
                { label: 'Retention Rate', value: Math.round(engage.retention_rate * 100), total: 100, suffix: '%', color: 'var(--info)' },
                { label: 'Success Rate', value: Math.round(data.donation_success_rate * 100), total: 100, suffix: '%', color: 'var(--accent)' },
              ].map(item => (
                <div key={item.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
                    <span style={{ color: 'var(--muted)' }}>{item.label}</span>
                    <span style={{ color: item.color, fontWeight: 600 }}>{item.value}{item.suffix || ''}</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${Math.round((item.value / item.total) * 100)}%`,
                      background: item.color,
                      borderRadius: 3,
                      transition: 'width 1.2s ease',
                    }} />
                  </div>
                </div>
              ))}

              <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'rgba(21, 24, 33, 0.5)', borderRadius: 8, fontSize: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <div><span style={{ color: 'var(--muted)' }}>Active donors:</span> <strong style={{ color: 'var(--success)' }}>{engage.active_donors}</strong></div>
                  <div><span style={{ color: 'var(--muted)' }}>Inactive:</span> <strong style={{ color: 'var(--accent)' }}>{engage.inactive_donors}</strong></div>
                  <div><span style={{ color: 'var(--muted)' }}>Avg calls:</span> <strong>{engage.avg_calls_per_donor}</strong></div>
                  <div><span style={{ color: 'var(--muted)' }}>Avg donations:</span> <strong>{engage.avg_donations_per_donor}</strong></div>
                </div>
              </div>
            </div>
          </div>

          {/* Predicted Future Detail Table */}
          <div className="card">
            <h3>Predicted Future Requests</h3>
            <div style={{ overflowY: 'auto', maxHeight: 280 }}>
              <table>
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>Blood</th>
                    <th>Date</th>
                    <th>Days</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.predicted_future_detail || []).slice(0, 12).map((p) => (
                    <tr key={p.patient_id}>
                      <td style={{ fontWeight: 500 }}>{p.patient_name}</td>
                      <td>
                        <span className="badge staging" style={{ fontSize: 10 }}>
                          {p.blood_group?.replace(' Positive', '+').replace(' Negative', '-')}
                        </span>
                      </td>
                      <td style={{ color: 'var(--muted)', fontSize: 11 }}>{p.predicted_date}</td>
                      <td style={{
                        color: p.days_until <= 3 ? 'var(--accent)' : p.days_until <= 7 ? 'var(--warning)' : 'var(--success)',
                        fontWeight: 600
                      }}>
                        {p.days_until}d
                      </td>
                    </tr>
                  ))}
                  {(data.predicted_future_detail || []).length === 0 && (
                    <tr><td colSpan={4} style={{ color: 'var(--muted)', textAlign: 'center' }}>No predictions yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
