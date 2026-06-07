import { useEffect, useState } from 'react'
import { Zap, ChevronDown, AlertTriangle, Map, List } from 'lucide-react'
import { api } from '../api'
import DonorMap from '../components/DonorMap'

const RANK_COLORS = ['#22c55e', '#D92332', '#f59e0b', '#3b82f6', '#a78bfa']

export default function DonorMatching() {
  const [requests, setRequests] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(false)
  const [escalating, setEscalating] = useState(false)
  const [escalateResult, setEscalateResult] = useState(null)
  const [viewMode, setViewMode] = useState('split') // 'split' | 'map' | 'list'
  const [patientInfo, setPatientInfo] = useState(null)

  useEffect(() => {
    api.requests().then((d) => {
      const active = (d.requests || []).filter((r) =>
        ['Pending', 'Searching Donors', 'Donor Confirmed', 'Critical'].includes(r.status)
      )
      setRequests(active)
      if (active.length) setSelectedId(String(active[0].id))
    })
  }, [])

  const runMatch = async () => {
    if (!selectedId) return
    setLoading(true)
    setEscalateResult(null)
    try {
      const result = await api.match(+selectedId)
      setMatches(result.matches || [])
    } catch (e) {
      alert(e.message)
    } finally {
      setLoading(false)
    }
  }

  const loadMatches = async () => {
    if (!selectedId) return
    const result = await api.getMatches(selectedId)
    setMatches(result.matches || [])
  }

  const escalate = async () => {
    setEscalating(true)
    try {
      const result = await api.escalate(+selectedId)
      setEscalateResult(result)
      await loadMatches()
    } catch (e) {
      alert(e.message)
    } finally {
      setEscalating(false)
    }
  }

  useEffect(() => {
    if (!selectedId) return
    loadMatches()
    // Load patient info for map
    const req = requests.find(r => String(r.id) === selectedId)
    if (req?.patient_id) {
      api.getPatient(req.patient_id).then(setPatientInfo).catch(() => {})
    }
  }, [selectedId])

  const selectedRequest = requests.find(r => String(r.id) === selectedId)
  const latestRound = matches.length ? Math.max(...matches.map(m => m.round)) : 1
  const latestMatches = matches.filter(m => m.round === latestRound)

  // Enrich donors with patient coords for map offset
  const mapDonors = latestMatches.map((m, idx) => ({
    ...m,
    latitude: patientInfo
      ? patientInfo.latitude + (Math.random() - 0.5) * 0.06
      : 17.39 + (Math.random() - 0.5) * 0.06,
    longitude: patientInfo
      ? patientInfo.longitude + (Math.random() - 0.5) * 0.06
      : 78.46 + (Math.random() - 0.5) * 0.06,
  }))

  return (
    <>
      <div className="page-header">
        <h2>Donor Matching Engine</h2>
        <p>AI-ranked top donors — blood compatibility, distance, availability & response history</p>
      </div>

      <div className="innovation-banner">
        <h3>🎯 Smart Scoring Algorithm + Radar Map</h3>
        <p>
          Scores each compatible donor out of 100 pts: +40 exact blood match, +30 within 5km, +15 available now,
          +15 response rate, +10 experienced. View donors on the live radar map with 5km / 15km / 30km rings.
        </p>
      </div>

      {/* Controls Row */}
      <div className="card">
        <div className="form-row">
          <div className="form-group" style={{ flex: 2 }}>
            <label><ChevronDown size={11} style={{ display: 'inline', marginRight: 4 }} />Select Blood Request</label>
            <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
              {requests.length === 0 && <option>No active requests</option>}
              {requests.map((r) => (
                <option key={r.id} value={r.id}>
                  #{r.id} — {r.patient_name} · {r.blood_group?.replace(' Positive', '+').replace(' Negative', '-')} [{r.status}]
                </option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={runMatch} disabled={loading || !selectedId}>
              <Zap size={14} />{loading ? 'Matching...' : 'Run Match (Top 5)'}
            </button>
            <button className="btn btn-secondary" onClick={escalate} disabled={escalating || !selectedId}>
              <AlertTriangle size={14} />{escalating ? 'Escalating...' : 'Escalate Round'}
            </button>
          </div>
          {/* View Mode Toggle */}
          <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', paddingBottom: 0 }}>
            {[
              { id: 'split', icon: <List size={13} />, label: 'Split' },
              { id: 'map', icon: <Map size={13} />, label: 'Map' },
              { id: 'list', icon: <List size={13} />, label: 'List' },
            ].map(v => (
              <button
                key={v.id}
                onClick={() => setViewMode(v.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '6px 12px', borderRadius: 8, border: '1px solid',
                  borderColor: viewMode === v.id ? 'var(--accent)' : 'rgba(255,255,255,0.1)',
                  background: viewMode === v.id ? 'rgba(217,35,50,0.15)' : 'transparent',
                  color: viewMode === v.id ? 'var(--accent)' : 'var(--muted)',
                  cursor: 'pointer', fontSize: 12, fontWeight: 600,
                }}
              >
                {v.icon} {v.label}
              </button>
            ))}
          </div>
        </div>

        {selectedRequest && (
          <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: 'rgba(21, 24, 33, 0.5)', borderRadius: 8, fontSize: '0.875rem', display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
            <span>Patient: <strong>{selectedRequest.patient_name}</strong></span>
            <span>Blood: <strong>{selectedRequest.blood_group}</strong></span>
            <span>Urgency: <span style={{ color: selectedRequest.urgency === 'high' ? 'var(--accent)' : 'var(--warning)', fontWeight: 600 }}>{selectedRequest.urgency}</span></span>
            <span>Status: <span className={`badge ${selectedRequest.status === 'Critical' ? 'urgent' : 'active'}`}>{selectedRequest.status}</span></span>
            <span>Round: <strong>{selectedRequest.escalation_round || 0}</strong></span>
          </div>
        )}
      </div>

      {escalateResult && (
        <div className="card" style={{ borderColor: escalateResult.status === 'Critical' ? 'rgba(217, 35, 50, 0.4)' : 'rgba(16, 185, 129, 0.2)' }}>
          <h3 style={{ color: escalateResult.status === 'Critical' ? 'var(--accent)' : 'var(--success)' }}>
            {escalateResult.escalated ? `Escalated to Round ${escalateResult.round}` : 'Escalation Check Complete'}
          </h3>
          <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>
            {escalateResult.message || `${escalateResult.new_donors_contacted || 0} new donors contacted in round ${escalateResult.round}.`}
          </p>
        </div>
      )}

      {/* Main Content: Map + List */}
      {latestMatches.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: viewMode === 'split' ? '1fr 1fr' : '1fr',
          gap: 16,
        }}>
          {/* Map Panel */}
          {(viewMode === 'split' || viewMode === 'map') && (
            <div className="card" style={{ padding: 0, overflow: 'hidden', minHeight: 480 }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Map size={16} style={{ color: 'var(--accent)' }} />
                <span style={{ fontWeight: 700, fontSize: 14 }}>Donor Radar</span>
                <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 4 }}>
                  {latestMatches.length} donors · Hyderabad
                </span>
              </div>
              <DonorMap
                patient={patientInfo}
                donors={mapDonors}
                style={{ height: 440 }}
              />
            </div>
          )}

          {/* Donor List Panel */}
          {(viewMode === 'split' || viewMode === 'list') && (
            <div className="card">
              <h3>
                <Zap size={16} style={{ marginRight: 8, color: 'var(--warning)' }} />
                Top {latestMatches.length} Matches — Round {latestRound}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {latestMatches.slice(0, 5).map((m, idx) => (
                  <div className="match-card" key={m.id} style={{
                    borderLeft: `3px solid ${RANK_COLORS[idx] || '#888'}`,
                    borderColor: idx === 0 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255, 255, 255, 0.05)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: '50%',
                          background: `${RANK_COLORS[idx]}22`,
                          border: `2px solid ${RANK_COLORS[idx] || '#888'}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 700, fontSize: 13, color: RANK_COLORS[idx] || '#aaa',
                        }}>
                          {m.rank}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600 }}>{m.donor_name}</div>
                          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                            {m.preferred_language} · via {m.preferred_channel} · ⏰ {m.preferred_time || 'Morning'}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <span className="badge eligible">{m.blood_group?.replace(' Positive', '+').replace(' Negative', '-')}</span>
                        <div className="match-score">{m.score}</div>
                      </div>
                    </div>
                    <div style={{ marginTop: 8, fontSize: '0.85rem', color: 'var(--muted)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                      <span>
                        📍 {m.distance_km} km away ·
                        Status: <span className={`badge ${m.status === 'appointed' ? 'eligible' : m.status === 'responded' ? 'active' : m.status === 'declined' ? 'urgent' : 'staging'}`} style={{ textTransform: 'capitalize' }}>{m.status}</span>
                      </span>
                      {m.scheduled_time && (
                        <span style={{ color: 'var(--success)', fontWeight: 600 }}>
                          ✅ {m.donation_date} @ {m.scheduled_time}
                        </span>
                      )}
                    </div>
                    <div style={{ marginTop: 6 }}>
                      {(m.reasons || []).map((r) => (
                        <span key={r} className="reason-tag">{r}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {matches.length > latestMatches.length && (
                <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(21, 24, 33, 0.5)', borderRadius: 8 }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '0.5rem' }}>
                    Previous rounds ({matches.filter(m => m.round < latestRound).length} donors):
                  </div>
                  {matches.filter(m => m.round < latestRound).map(m => (
                    <span key={m.id} style={{ fontSize: '0.8rem', color: 'var(--muted)', marginRight: 8 }}>
                      {m.donor_name} (R{m.round}, {m.status})
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {latestMatches.length === 0 && selectedId && !loading && (
        <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎯</div>
          <div style={{ fontSize: 16, marginBottom: 8 }}>No matches yet for this request</div>
          <div style={{ fontSize: 13 }}>Click "Run Match" to find and rank the top 5 compatible donors.</div>
        </div>
      )}
    </>
  )
}
