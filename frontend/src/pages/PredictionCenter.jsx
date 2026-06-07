import { useEffect, useState } from 'react'
import { Brain, TrendingUp, AlertCircle } from 'lucide-react'
import { api } from '../api'

const BLOOD_GROUPS = ['O Positive', 'O Negative', 'A Positive', 'A Negative', 'B Positive', 'B Negative', 'AB Positive', 'AB Negative']

export default function PredictionCenter() {
  const [patients, setPatients] = useState([])
  const [selectedPatientId, setSelectedPatientId] = useState('')
  const [result, setResult] = useState(null)
  const [stored, setStored] = useState([])
  const [loading, setLoading] = useState(false)
  const [storedLoading, setStoredLoading] = useState(true)

  // For quick standalone prediction
  const [form, setForm] = useState({ blood_group: 'O Positive', avg_gap_days: 21, last_date: '' })
  const [standaloneResult, setStandaloneResult] = useState(null)
  const [urgencyAnalysis, setUrgencyAnalysis] = useState(null)

  useEffect(() => {
    api.patients({ limit: 200 }).then((d) => {
      const p = d.patients || []
      setPatients(p)
      if (p.length) setSelectedPatientId(String(p[0].id))
    })
    api.storedPredictions({ limit: 20 }).then((d) => {
      setStored(d.predictions || [])
    }).finally(() => setStoredLoading(false))
  }, [])

  const predictForPatient = async () => {
    if (!selectedPatientId) return
    setLoading(true)
    setResult(null)
    setUrgencyAnalysis(null)
    try {
      const r = await api.predict(+selectedPatientId)
      setResult(r)
      
      // Call Bedrock Urgency Analysis
      const patientObj = patients.find(p => String(p.id) === String(selectedPatientId))
      if (patientObj) {
        let lastTransfusionDaysAgo = 15
        if (patientObj.last_transfusion_date) {
          const days = Math.floor((new Date() - new Date(patientObj.last_transfusion_date)) / (1000 * 60 * 60 * 24))
          if (days >= 0) lastTransfusionDaysAgo = days
        }
        
        try {
          const urgencyRes = await api.awsBedrockAnalyzeUrgency({
            disease: patientObj.medical_notes || 'Thalassemia Major',
            last_transfusion_days_ago: lastTransfusionDaysAgo,
            avg_gap_days: patientObj.avg_gap_days || 21,
            days_until_need: r.days_until
          })
          setUrgencyAnalysis(urgencyRes)
        } catch (e) {
          console.error("Failed Bedrock urgency analysis:", e)
        }
      }

      // reload stored
      api.storedPredictions({ limit: 20 }).then((d) => setStored(d.predictions || []))
    } catch (e) {
      alert(e.message)
    } finally {
      setLoading(false)
    }
  }

  const predictStandalone = async (e) => {
    e.preventDefault()
    setLoading(true)
    setStandaloneResult(null)
    try {
      const r = await api.predictDirect(form)
      setStandaloneResult(r)
    } catch (e) {
      alert(e.message)
    } finally {
      setLoading(false)
    }
  }

  const createRequest = async (patientId) => {
    try {
      const r = await api.createRequestFromPrediction(patientId)
      alert(`Blood request #${r.request_id} created with status: ${r.status}`)
      api.storedPredictions({ limit: 20 }).then((d) => setStored(d.predictions || []))
    } catch (e) {
      alert(e.message)
    }
  }

  return (
    <>
      <div className="page-header">
        <h2>Prediction Center</h2>
        <p>AI-powered blood transfusion cycle forecasting — Thalassemia patient models</p>
      </div>

      <div className="innovation-banner">
        <h3><Brain size={16} style={{ marginRight: 8 }} />How the AI Predicts Transfusion Needs</h3>
        <p>
          Historical transfusion dates + individual cycle variance → Linear regression on patient-specific cycle length → Predicts next need date with ±2 day confidence. 
          Adjusts for seasonal variation, recent trend acceleration, and hospital protocol differences.
        </p>
      </div>

      {/* Patient-Based Prediction */}
      <div className="card">
        <h3><TrendingUp size={16} style={{ marginRight: 8, color: 'var(--warning)' }} />Predict for Registered Patient</h3>
        <div className="form-row">
          <div className="form-group">
            <label>Select Patient</label>
            <select value={selectedPatientId} onChange={(e) => setSelectedPatientId(e.target.value)}>
              {patients.length === 0 && <option>Loading patients...</option>}
              {patients.map((p) => (
                <option key={p.id} value={p.id}>{p.name} — {p.blood_group} ({p.hospital})</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button className="btn btn-primary" onClick={predictForPatient} disabled={loading || !selectedPatientId}>
              <Brain size={14} /> {loading ? 'Predicting...' : 'Generate Prediction'}
            </button>
          </div>
        </div>

        {result && (
          <div className="prediction-result" style={{ marginTop: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: 4 }}>Next Blood Need Predicted</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: result.days_until <= 3 ? 'var(--accent)' : result.days_until <= 7 ? 'var(--warning)' : 'var(--success)' }}>
                  {result.predicted_need_date}
                </div>
                <div style={{ fontSize: '0.9rem', color: 'var(--muted)', marginTop: 4 }}>
                  {result.days_until} days from today
                  {result.days_until <= 3 && <span style={{ color: 'var(--accent)', marginLeft: 8 }}>⚠ Urgent!</span>}
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: 4 }}>Confidence Score</div>
                <div style={{
                  fontSize: '2rem', fontWeight: 800,
                  color: result.confidence > 0.8 ? 'var(--success)' : result.confidence > 0.6 ? 'var(--warning)' : 'var(--muted)'
                }}>
                  {result.confidence ? (result.confidence * 100).toFixed(0) : '—'}%
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--muted)' }}>Blood Group:</span> <strong>{result.blood_group}</strong>
                </div>
                <div style={{ fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--muted)' }}>Cycle (avg):</span> <strong>{result.avg_gap_days} days</strong>
                </div>
                <div style={{ fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--muted)' }}>Model:</span> <span style={{ color: 'var(--info)', fontSize: 12 }}>{result.model_used}</span>
                </div>
                {result.patient_id && (
                  <button className="btn btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={() => createRequest(result.patient_id)}>
                    Auto-Create Blood Request
                  </button>
                )}
              </div>
            </div>

            {urgencyAnalysis && (
              <div style={{
                marginTop: '1.25rem',
                paddingTop: '1.25rem',
                borderTop: '1px solid rgba(255,255,255,0.06)',
                display: 'grid',
                gridTemplateColumns: '1.5fr 1fr',
                gap: '1.5rem'
              }}>
                <div>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: '#ec4899', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                    🧠 Bedrock Clinical AI Urgency Assessor
                  </h4>
                  <div style={{
                    fontSize: '0.9rem',
                    color: '#fff',
                    fontStyle: 'italic',
                    background: 'rgba(255, 255, 255, 0.02)',
                    padding: '10px 14px',
                    borderRadius: 8,
                    borderLeft: '3px solid #ec4899',
                    lineHeight: 1.5
                  }}>
                    "{urgencyAnalysis.reasoning}"
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.8rem' }}>
                  <div style={{ background: 'rgba(0,0,0,0.15)', padding: 10, borderRadius: 8 }}>
                    <span style={{ color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Urgency Level</span>
                    <span className={`badge ${
                      urgencyAnalysis.urgency_level === 'critical' ? 'urgent' :
                      urgencyAnalysis.urgency_level === 'high' ? 'active' : 'staging'
                    }`} style={{ fontSize: 10, fontWeight: 700 }}>
                      {urgencyAnalysis.urgency_level?.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.15)', padding: 10, borderRadius: 8 }}>
                    <span style={{ color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Risk Score</span>
                    <strong style={{ fontSize: 14, color: urgencyAnalysis.risk_score > 0.8 ? 'var(--accent)' : 'var(--warning)' }}>
                      {(urgencyAnalysis.risk_score * 100).toFixed(0)}%
                    </strong>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.15)', padding: 10, borderRadius: 8, gridColumn: 'span 2' }}>
                    <span style={{ color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Recommended Action</span>
                    <strong style={{ color: '#fff', fontSize: 12 }}>
                      {urgencyAnalysis.recommended_action?.replace('_', ' ').toUpperCase()}
                    </strong>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Standalone Quick Prediction */}
      <div className="card">
        <h3><AlertCircle size={16} style={{ marginRight: 8, color: 'var(--info)' }} />Quick Standalone Prediction</h3>
        <p style={{ color: 'var(--muted)', fontSize: '0.875rem', marginBottom: '1rem' }}>Predict for any unregistered patient using their blood group and cycle data.</p>
        <form onSubmit={predictStandalone}>
          <div className="form-row">
            <div className="form-group">
              <label>Blood Group</label>
              <select value={form.blood_group} onChange={(e) => setForm({ ...form, blood_group: e.target.value })}>
                {BLOOD_GROUPS.map(g => <option key={g}>{g}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Avg Gap (days)</label>
              <input type="number" value={form.avg_gap_days} onChange={(e) => setForm({ ...form, avg_gap_days: +e.target.value })} min={7} max={120} />
            </div>
            <div className="form-group">
              <label>Last Transfusion Date</label>
              <input type="date" value={form.last_date} onChange={(e) => setForm({ ...form, last_date: e.target.value })} />
            </div>
            <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button className="btn btn-secondary" type="submit" disabled={loading}>
                <Brain size={14} /> Quick Predict
              </button>
            </div>
          </div>
        </form>
        {standaloneResult && (
          <div className="prediction-result" style={{ marginTop: '1rem', padding: '1rem' }}>
            <div style={{ fontSize: 14 }}>
              Predicted: <strong style={{ color: 'var(--warning)', fontSize: 18 }}>{standaloneResult.predicted_need_date}</strong>
              &nbsp; ({standaloneResult.days_until} days)
              &nbsp; | Confidence: <strong>{standaloneResult.confidence ? (standaloneResult.confidence * 100).toFixed(0) : '—'}%</strong>
            </div>
          </div>
        )}
      </div>

      {/* Stored Predictions Table */}
      <div className="card">
        <h3>Recent Stored Predictions ({stored.length})</h3>
        {storedLoading ? (
          <div className="loading">Loading predictions...</div>
        ) : (
          <table>
            <thead>
              <tr><th>ID</th><th>Patient</th><th>Blood</th><th>Predicted Date</th><th>Days Until</th><th>Confidence</th><th>Status</th><th>Action</th></tr>
            </thead>
            <tbody>
              {stored.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--muted)' }}>No predictions yet. Run a prediction above!</td></tr>
              )}
              {stored.map((p) => (
                <tr key={p.id}>
                  <td style={{ fontFamily: 'monospace', color: 'var(--muted)' }}>{p.id}</td>
                  <td>{p.patient_name}</td>
                  <td><span className="badge staging">{p.blood_group?.replace(' Positive', '+').replace(' Negative', '-')}</span></td>
                  <td>{p.predicted_date}</td>
                  <td style={{ color: p.days_until <= 3 ? 'var(--accent)' : p.days_until <= 7 ? 'var(--warning)' : 'var(--success)', fontWeight: 600 }}>
                    {p.days_until}d
                  </td>
                  <td>
                    <span style={{ color: p.confidence > 0.8 ? 'var(--success)' : 'var(--warning)' }}>
                      {p.confidence ? (p.confidence * 100).toFixed(0) : '—'}%
                    </span>
                  </td>
                  <td><span className={`badge ${p.request_created ? 'eligible' : 'staging'}`}>{p.request_created ? 'Request Created' : 'Pending'}</span></td>
                  <td>
                    {!p.request_created && (
                      <button className="btn btn-primary" style={{ padding: '0.3rem 0.7rem', fontSize: '0.75rem' }} onClick={() => createRequest(p.patient_id)}>
                        Create Request
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
