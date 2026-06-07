import { useState } from 'react'
import { api } from '../api'

const BLOOD_GROUPS = ['O Positive', 'O Negative', 'A Positive', 'A Negative', 'B Positive', 'B Negative', 'AB Positive', 'AB Negative']

export default function Matching() {
  const [bloodGroup, setBloodGroup] = useState('O Positive')
  const [bridgeId, setBridgeId] = useState('')
  const [candidates, setCandidates] = useState([])
  const [outreach, setOutreach] = useState(null)
  const [loading, setLoading] = useState(false)
  const [protocolVersion, setProtocolVersion] = useState('')

  const runMatch = async () => {
    setLoading(true)
    setOutreach(null)
    try {
      const result = await api.match({
        bridge_id: bridgeId || 'demo-bridge',
        blood_group: bloodGroup,
        quantity: 1,
      })
      setCandidates(result.candidates || [])
      setProtocolVersion(result.protocol_version)
    } catch (e) {
      alert(e.message)
    } finally {
      setLoading(false)
    }
  }

  const sendOutreach = async (donorId) => {
    const msg = await api.outreach(donorId, bloodGroup, bridgeId || undefined)
    setOutreach(msg)
  }

  return (
    <>
      <div className="page-header">
        <h2>Smart Matching & Outreach</h2>
        <p>Donor Psychographic Engine — right person, right moment, right message</p>
      </div>

      <div className="innovation-banner">
        <h3>🎯 Innovation #2: Personalized Multi-Channel Outreach</h3>
        <p>Matches by blood compatibility, distance, response rate, and bridge history. Bedrock-style message generation per donor profile.</p>
      </div>

      <div className="card">
        <div className="form-row">
          <div className="form-group">
            <label>Blood Group Required</label>
            <select value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)}>
              {BLOOD_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Bridge ID (optional)</label>
            <input value={bridgeId} onChange={(e) => setBridgeId(e.target.value)} placeholder="Paste bridge ID for bridge-donor boost" />
          </div>
        </div>
        <button className="btn btn-primary" onClick={runMatch} disabled={loading}>
          {loading ? 'Matching...' : 'Find Best Donors'}
        </button>
        {protocolVersion && <span className="protocol-version" style={{ marginLeft: '1rem' }}>Protocol v{protocolVersion}</span>}
      </div>

      {candidates.length > 0 && (
        <div className="card">
          <h3>Top {candidates.length} Matches for {bloodGroup}</h3>
          {candidates.map((c) => (
            <div className="match-card" key={c.user_id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong>{c.user_id.slice(0, 16)}...</strong>
                  <span className="badge eligible" style={{ marginLeft: '0.5rem' }}>{c.blood_group}</span>
                </div>
                <div className="match-score">{c.match_score}</div>
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--muted)', marginTop: '0.5rem' }}>
                {c.distance_km} km · {c.donations_till_date} donations · {(c.response_rate * 100).toFixed(0)}% response rate
              </div>
              <div style={{ fontSize: '0.8rem', marginTop: '0.35rem' }}>
                Best contact: {c.best_contact_hour}:00 via {c.preferred_channel} · Tone: {c.preferred_tone}
              </div>
              <div style={{ marginTop: '0.5rem' }}>
                {c.reasons.map((r) => <span key={r} className="reason-tag">{r}</span>)}
              </div>
              <button className="btn btn-secondary" style={{ marginTop: '0.75rem' }} onClick={() => sendOutreach(c.user_id)}>
                Generate Personalized Outreach
              </button>
            </div>
          ))}
        </div>
      )}

      {outreach && (
        <div className="card">
          <h3>Generated Outreach Message</h3>
          <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
            Channel: {outreach.channel} · Language: {outreach.language} · Tone: {outreach.tone} · Scheduled: {new Date(outreach.scheduled_at).toLocaleString()}
          </div>
          <div className="outreach-preview">{outreach.message}</div>
        </div>
      )}
    </>
  )
}
