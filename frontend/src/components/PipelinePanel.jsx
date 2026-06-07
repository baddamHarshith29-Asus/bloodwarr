import { useState, useEffect } from 'react'
import { api } from '../api'

const pill = (label, color) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 4,
    background: `${color}22`, border: `1px solid ${color}55`,
    color, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700,
  }}>{label}</span>
)

export default function PipelinePanel({ compact = false }) {
  const [status, setStatus] = useState(null)
  const [running, setRunning] = useState(false)
  const [log, setLog] = useState(null)

  const fetchStatus = async () => {
    try {
      const s = await api.pipelineStatus()
      setStatus(s)
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    fetchStatus()
    const t = setInterval(fetchStatus, 15000)
    return () => clearInterval(t)
  }, [])

  const handleRun = async () => {
    setRunning(true)
    try {
      const res = await api.pipelineRun()
      setLog(res.result)
      fetchStatus()
    } catch (e) {
      setLog({ errors: [String(e)] })
    }
    setRunning(false)
  }

  const handleToggle = async () => {
    if (status?.running) {
      await api.pipelineStop()
    } else {
      await api.pipelineStart()
    }
    fetchStatus()
  }

  const lastRun = status?.last_run

  if (compact) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        background: 'rgba(217,35,50,0.08)', border: '1px solid rgba(217,35,50,0.25)',
        borderRadius: 12, padding: '10px 16px',
      }}>
        <div style={{
          width: 10, height: 10, borderRadius: '50%',
          background: status?.running ? '#22c55e' : '#888',
          boxShadow: status?.running ? '0 0 8px #22c55e' : 'none',
          animation: status?.running ? 'pulse 2s infinite' : 'none',
        }} />
        <span style={{ fontSize: 13, color: '#ccc' }}>
          AI Pipeline: <strong style={{ color: status?.running ? '#22c55e' : '#aaa' }}>
            {status?.running ? 'ACTIVE — auto-runs every 5 min' : 'Paused'}
          </strong>
        </span>
        {lastRun && (
          <span style={{ fontSize: 11, color: '#666', marginLeft: 'auto' }}>
            Last: {new Date(lastRun.run_at).toLocaleTimeString()} · 
            {lastRun.requests_matched} matched · {lastRun.outreach_sent} sent
          </span>
        )}
        <button
          onClick={handleRun}
          disabled={running}
          style={{
            background: '#D92332', color: 'white', border: 'none',
            borderRadius: 8, padding: '5px 12px', fontSize: 12,
            cursor: running ? 'not-allowed' : 'pointer', fontWeight: 700,
            opacity: running ? 0.6 : 1,
          }}
        >
          {running ? '⏳ Running...' : '▶ Run Now'}
        </button>
      </div>
    )
  }

  return (
    <div style={{
      background: 'rgba(15,15,25,0.8)', backdropFilter: 'blur(12px)',
      border: '1px solid rgba(217,35,50,0.3)', borderRadius: 16, padding: 24,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 14, height: 14, borderRadius: '50%',
            background: status?.running ? '#22c55e' : '#888',
            boxShadow: status?.running ? '0 0 12px #22c55e' : 'none',
          }} />
          <h3 style={{ margin: 0, fontSize: 17, color: '#eee' }}>
            🤖 Autonomous AI Pipeline
          </h3>
          {status?.running ? pill('ACTIVE', '#22c55e') : pill('PAUSED', '#888')}
          {status?.stepfunctions && pill(
            status.stepfunctions.available ? 'AWS STEP FUNCTIONS' : 'LOCAL SCHEDULER',
            status.stepfunctions.available ? '#ec4899' : '#3b82f6'
          )}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={handleToggle}
            style={{
              background: status?.running ? 'rgba(255,100,100,0.2)' : 'rgba(34,197,94,0.2)',
              border: `1px solid ${status?.running ? '#ff6464' : '#22c55e'}`,
              color: status?.running ? '#ff6464' : '#22c55e',
              borderRadius: 8, padding: '7px 16px', fontSize: 12,
              cursor: 'pointer', fontWeight: 700,
            }}
          >
            {status?.running ? '⏹ Pause Auto-Run' : '▶ Start Auto-Run'}
          </button>
          <button
            onClick={handleRun}
            disabled={running}
            style={{
              background: '#D92332', color: 'white', border: 'none',
              borderRadius: 8, padding: '7px 16px', fontSize: 12,
              cursor: running ? 'not-allowed' : 'pointer', fontWeight: 700,
              opacity: running ? 0.6 : 1,
            }}
          >
            {running ? '⏳ Running...' : '⚡ Run Full Pipeline Now'}
          </button>
        </div>
      </div>

      {/* Pipeline Steps */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8, marginBottom: 20,
      }}>
        {[
          { emoji: '🔄', label: 'Reset Donors', key: 'donors_reset', color: '#4ecdc4' },
          { emoji: '🔮', label: 'Predict Needs', key: 'predictions_run', color: '#a78bfa' },
          { emoji: '📋', label: 'Auto Requests', key: 'requests_auto_created', color: '#f59e0b' },
          { emoji: '🎯', label: 'Match Donors', key: 'requests_matched', color: '#3b82f6' },
          { emoji: '📨', label: 'Send Outreach', key: 'outreach_sent', color: '#D92332' },
          { emoji: '✅', label: 'Auto-Approved', key: 'outreach_approved', color: '#22c55e' },
        ].map(step => (
          <div key={step.key} style={{
            background: `${step.color}11`, border: `1px solid ${step.color}33`,
            borderRadius: 10, padding: '10px 8px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 20 }}>{step.emoji}</div>
            <div style={{ fontSize: 10, color: '#aaa', marginTop: 4 }}>{step.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: step.color, marginTop: 4 }}>
              {lastRun?.[step.key] ?? '—'}
            </div>
          </div>
        ))}
      </div>

      {/* Last run metadata */}
      {lastRun && (
        <div style={{
          background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '10px 14px',
          fontSize: 12, color: '#888', borderTop: '1px solid rgba(255,255,255,0.06)',
        }}>
          <span>⏱ Last run: <strong style={{ color: '#ccc' }}>{new Date(lastRun.run_at).toLocaleString()}</strong></span>
          &nbsp;·&nbsp;
          <span>🔁 Auto-interval: <strong style={{ color: '#ccc' }}>every 5 minutes</strong></span>
          {lastRun.errors?.length > 0 && (
            <div style={{ marginTop: 6, color: '#ff6464' }}>
              ⚠ Errors: {lastRun.errors.join(' | ')}
            </div>
          )}
        </div>
      )}

      {/* Manual run log */}
      {log && (
        <div style={{
          marginTop: 12, background: 'rgba(0,255,0,0.05)', border: '1px solid rgba(0,255,0,0.15)',
          borderRadius: 8, padding: '10px 14px', fontSize: 11, color: '#6ee7b7',
          fontFamily: 'monospace',
        }}>
          <div>✅ Pipeline Run Complete</div>
          <div>Donors Reset: {log.donors_reset} · Predictions: {log.predictions_run} · New Requests: {log.requests_auto_created}</div>
          <div>Matched: {log.requests_matched} · Outreach Sent: {log.outreach_sent} · Auto-Approved: {log.outreach_approved}</div>
          {log.errors?.length > 0 && <div style={{ color: '#fca5a5' }}>Errors: {log.errors.join(', ')}</div>}
        </div>
      )}
    </div>
  )
}
