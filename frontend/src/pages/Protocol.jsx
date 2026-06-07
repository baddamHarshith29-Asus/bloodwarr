import { useEffect, useState } from 'react'
import { Shield, Zap, Clock, RefreshCw, AlertTriangle, CheckCircle, Activity } from 'lucide-react'
import { api } from '../api'

const Stat = ({ label, value, color, suffix = '' }) => (
  <div className="stat-card" style={{ padding: '1.25rem' }}>
    <div className="label">{label}</div>
    <div className="value" style={{ fontSize: '1.75rem', color: color || 'inherit' }}>
      {value}{suffix}
    </div>
  </div>
)

export default function Protocol() {
  const [protocol, setProtocol]       = useState(null)
  const [failures, setFailures]       = useState([])
  const [simulating, setSimulating]   = useState(false)
  const [refreshing, setRefreshing]   = useState(false)

  const load = () => {
    setRefreshing(true)
    Promise.all([
      api.protocol().then(setProtocol),
      api.failures().then((f) => setFailures(f.failures || []))
    ]).finally(() => setRefreshing(false))
  }

  useEffect(load, [])

  const simulateFailure = async () => {
    setSimulating(true)
    try {
      await api.simulateFailure('demo-bridge-id-001', 'O Positive')
      load()
    } finally {
      setSimulating(false)
    }
  }

  const liveStats = protocol?.live_stats

  return (
    <>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2><Shield size={20} style={{ display: 'inline', marginRight: 10, color: 'var(--accent)' }} />Self-Healing Protocol Engine</h2>
          <p>AI-adaptive outreach orchestration — learns from failures and auto-optimizes coordination rules</p>
        </div>
        <button className="btn btn-secondary" onClick={load} disabled={refreshing}>
          <RefreshCw size={14} className={refreshing ? 'spin' : ''} /> Refresh
        </button>
      </div>

      <div className="innovation-banner">
        <h3>🔧 Innovation #3: Adaptive Failure Learning</h3>
        <p>
          When outreach fails (no donor response within escalation window), the system analyzes context — response rate,
          time-of-day, blood group rarity — and generates an improved protocol. Escalation thresholds, donors-per-round,
          and retry intervals auto-adapt. In production: Amazon Bedrock + Parameter Store for persistent protocol versioning.
        </p>
      </div>

      {/* Live Protocol Stats */}
      {liveStats && (
        <div className="card" style={{ borderColor: 'rgba(16, 185, 129, 0.15)' }}>
          <h3>
            <Activity size={16} style={{ marginRight: 8, color: 'var(--success)' }} />
            Live Network Stats
            <span style={{ marginLeft: 10, fontSize: 11, color: 'var(--muted)', fontWeight: 400 }}>
              (auto-adapts protocol parameters below)
            </span>
          </h3>
          <div className="stats-grid" style={{ marginBottom: 0 }}>
            <div className="stat-card success" style={{ padding: '1.1rem' }}>
              <div className="label">Response Rate</div>
              <div className="value">{liveStats.response_rate_pct}%</div>
              <div style={{ marginTop: 6, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${liveStats.response_rate_pct}%`, background: 'var(--success)', borderRadius: 2 }} />
              </div>
            </div>
            <div className="stat-card info" style={{ padding: '1.1rem' }}>
              <div className="label">Total Notifications</div>
              <div className="value">{liveStats.total_notifications}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>outreach messages sent</div>
            </div>
            <div className="stat-card" style={{ padding: '1.1rem' }}>
              <div className="label">Responded</div>
              <div className="value" style={{ color: 'var(--success)', fontSize: '1.6rem' }}>{liveStats.responded}</div>
            </div>
            <div className="stat-card" style={{ padding: '1.1rem' }}>
              <div className="label">Declined</div>
              <div className="value" style={{ color: 'var(--accent)', fontSize: '1.6rem' }}>{liveStats.declined}</div>
            </div>
            <div className="stat-card warning" style={{ padding: '1.1rem' }}>
              <div className="label">Escalated Requests</div>
              <div className="value" style={{ fontSize: '1.6rem' }}>{liveStats.requests_escalated}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>advanced to next round</div>
            </div>
          </div>
        </div>
      )}

      {/* Active Protocol Config */}
      {protocol && (
        <div className="card">
          <h3>
            <Shield size={16} style={{ marginRight: 8, color: 'var(--accent)' }} />
            Active Protocol
            <span className="protocol-version" style={{ marginLeft: 10 }}>v{protocol.version}</span>
            {failures.length > 0 && (
              <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--warning)', fontWeight: 400 }}>
                — auto-adapted from {failures.length} learning event{failures.length > 1 ? 's' : ''}
              </span>
            )}
          </h3>

          <div className="stats-grid" style={{ marginBottom: '1.25rem' }}>
            <div className="stat-card" style={{ padding: '1.1rem' }}>
              <div className="label"><Clock size={10} style={{ display: 'inline', marginRight: 3 }} />Escalation Window</div>
              <div className="value" style={{ fontSize: '1.6rem', color: protocol.escalation_hours <= 4 ? 'var(--warning)' : 'inherit' }}>
                {protocol.escalation_hours}h
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                {protocol.escalation_hours <= 4 ? '⬇ Reduced (adaptive)' : 'Standard interval'}
              </div>
            </div>
            <div className="stat-card" style={{ padding: '1.1rem' }}>
              <div className="label"><Zap size={10} style={{ display: 'inline', marginRight: 3 }} />Donors / Round</div>
              <div className="value" style={{ fontSize: '1.6rem', color: protocol.donors_per_round >= 7 ? 'var(--warning)' : 'inherit' }}>
                {protocol.donors_per_round}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                {protocol.donors_per_round >= 7 ? '⬆ Increased (adaptive)' : 'Standard batch'}
              </div>
            </div>
            <div className="stat-card" style={{ padding: '1.1rem' }}>
              <div className="label">Max Rounds</div>
              <div className="value" style={{ fontSize: '1.6rem' }}>{protocol.max_outreach_rounds}</div>
            </div>
            <div className="stat-card" style={{ padding: '1.1rem' }}>
              <div className="label">Retry Interval</div>
              <div className="value" style={{ fontSize: '1.6rem' }}>{protocol.retry_interval_minutes}m</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
            {protocol.channels?.map(ch => (
              <span key={ch} className="reason-tag" style={{ background: 'rgba(58, 109, 124, 0.08)', borderColor: 'rgba(58, 109, 124, 0.2)', color: '#60a5fa' }}>
                {ch === 'WhatsApp' ? '📱' : ch === 'SMS' ? '💬' : '📧'} {ch}
              </span>
            ))}
          </div>

          {protocol.notes && (
            <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(245, 158, 11, 0.05)', borderRadius: 6, border: '1px solid rgba(245, 158, 11, 0.12)', fontSize: 12, color: 'var(--muted)' }}>
              🤖 {protocol.notes}
            </div>
          )}
        </div>
      )}

      {/* Simulate Failure */}
      <div className="card">
        <h3><AlertTriangle size={16} style={{ marginRight: 8, color: 'var(--warning)' }} />Simulate Failure &amp; Self-Heal</h3>
        <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '1.25rem', lineHeight: 1.7 }}>
          Trigger a simulated 6-hour escalation failure for a blood request. The AI analyzes the failure context,
          generates an improved protocol (increased donors per round, reduced escalation window), and stores it for
          future requests. Each failure makes the system smarter.
        </p>
        <button className="btn btn-primary" onClick={simulateFailure} disabled={simulating}>
          {simulating ? (
            <><RefreshCw size={14} className="spin" /> Learning from failure...</>
          ) : (
            <><Zap size={14} /> Simulate Failure → Auto-Improve Protocol</>
          )}
        </button>
      </div>

      {/* Failure Learning History */}
      {failures.length > 0 && (
        <div className="card">
          <h3><CheckCircle size={16} style={{ marginRight: 8, color: 'var(--success)' }} />Failure Learning History ({failures.length} events)</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {failures.map((f, i) => (
              <div className="match-card" key={i} style={{ borderLeft: '3px solid rgba(245, 158, 11, 0.4)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <strong style={{ fontSize: '0.9rem' }}>{f.trigger || `Failure ${f.request_id}`}</strong>
                    <div style={{ fontSize: '0.8rem', color: 'var(--muted)', margin: '0.35rem 0' }}>
                      Outreach: {f.outreach_count} messages · Responses: {f.responses} · Duration: {f.duration_hours}h
                    </div>
                  </div>
                  <div className="protocol-version" style={{ marginTop: 0 }}>
                    v{f.recommended_protocol?.version}
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                  {f.changes?.map((c) => (
                    <span key={c} className="reason-tag" style={{ color: 'var(--warning)', borderColor: 'rgba(245, 158, 11, 0.2)', background: 'rgba(245, 158, 11, 0.06)' }}>
                      ↑ {c}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Guardrails Info */}
      <div className="card">
        <h3>🛡️ Innovation #5: Consent-Aware Guardrails</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem', marginTop: '0.75rem' }}>
          {[
            { icon: '✅', title: 'Identity Disclosure', desc: 'All messages must identify as Blood Warriors initiative' },
            { icon: '🚫', title: 'No Pressure Language', desc: 'Blocked: urgency pressure, guilt, emotional manipulation' },
            { icon: '🔒', title: 'Data Minimization', desc: 'Only blood group and city — no sensitive personal data requested' },
            { icon: '📋', title: 'Audit Trail', desc: 'All blocked messages logged to CloudWatch for compliance review' },
          ].map(item => (
            <div key={item.title} style={{ padding: '1rem', background: 'rgba(21, 24, 33, 0.5)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.04)' }}>
              <div style={{ fontSize: '1.2rem', marginBottom: '0.35rem' }}>{item.icon}</div>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{item.title}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
