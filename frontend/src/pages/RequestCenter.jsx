import { useEffect, useState } from 'react'
import { ClipboardList, Plus, RefreshCw, AlertTriangle, CheckCircle, Clock, Search } from 'lucide-react'
import { api } from '../api'

const STATUSES = ['', 'Pending', 'Searching Donors', 'Donor Confirmed', 'Completed', 'Critical']
const BLOOD_GROUPS = ['O Positive', 'O Negative', 'A Positive', 'A Negative', 'B Positive', 'B Negative', 'AB Positive', 'AB Negative']

const STATUS_META = {
  'Pending':          { cls: 'staging',  icon: '⏳' },
  'Searching Donors': { cls: 'active',   icon: '🔍' },
  'Donor Confirmed':  { cls: 'eligible', icon: '✅' },
  'Completed':        { cls: 'eligible', icon: '✓' },
  'Fulfilled':        { cls: 'eligible', icon: '✓' },
  'Critical':         { cls: 'urgent',   icon: '🚨' },
}

export default function RequestCenter() {
  const [requests, setRequests]     = useState([])
  const [patients, setPatients]     = useState([])
  const [filter, setFilter]         = useState('')
  const [loading, setLoading]       = useState(true)
  const [creating, setCreating]     = useState(false)
  const [showForm, setShowForm]     = useState(false)
  const [form, setForm]             = useState({ patient_id: '', blood_group: '', quantity: 1, urgency: 'normal' })
  const [refreshing, setRefreshing] = useState(false)

  const load = () => {
    setRefreshing(true)
    api.requests(filter || undefined)
      .then((d) => setRequests(d.requests || []))
      .finally(() => { setLoading(false); setRefreshing(false) })
  }

  useEffect(() => {
    api.patients({ limit: 200 }).then(d => {
      setPatients(d.patients || [])
      if (d.patients?.length) setForm(f => ({ ...f, patient_id: String(d.patients[0].id) }))
    })
  }, [])

  useEffect(load, [filter])

  const handlePatientChange = (e) => {
    const pid = e.target.value
    const p = patients.find(x => String(x.id) === pid)
    setForm(f => ({ ...f, patient_id: pid, blood_group: p?.blood_group || f.blood_group }))
  }

  const createRequest = async (e) => {
    e.preventDefault()
    setCreating(true)
    try {
      await api.createRequest({ patient_id: +form.patient_id, blood_group: form.blood_group || undefined, quantity: +form.quantity, urgency: form.urgency })
      setShowForm(false)
      load()
    } catch (err) {
      alert(err.message)
    } finally {
      setCreating(false)
    }
  }

  // Summary stats from requests list
  const total    = requests.length
  const pending  = requests.filter(r => r.status === 'Pending').length
  const critical = requests.filter(r => r.status === 'Critical').length
  const done     = requests.filter(r => r.status === 'Completed' || r.status === 'Fulfilled').length

  return (
    <>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2><ClipboardList size={20} style={{ display: 'inline', marginRight: 10, color: 'var(--accent)' }} />Request Center</h2>
          <p>All blood requests — auto-created from predictions and manually submitted</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={load} disabled={refreshing}>
            <RefreshCw size={14} className={refreshing ? 'spin' : ''} /> Refresh
          </button>
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            <Plus size={14} /> {showForm ? 'Cancel' : 'New Request'}
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="stat-card info">
          <div className="label">Total</div>
          <div className="value">{total}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>all time requests</div>
        </div>
        <div className="stat-card warning">
          <div className="label">Pending</div>
          <div className="value">{pending}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>awaiting action</div>
        </div>
        <div className="stat-card accent">
          <div className="label">Critical</div>
          <div className="value">{critical}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
            {critical > 0 ? '⚠ Immediate action needed' : 'No critical cases'}
          </div>
        </div>
        <div className="stat-card success">
          <div className="label">Completed</div>
          <div className="value">{done}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>successfully fulfilled</div>
        </div>
      </div>

      {/* Critical Alert Banner */}
      {critical > 0 && (
        <div className="error" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertTriangle size={18} />
          <strong>CRITICAL ALERT:</strong> {critical} request{critical > 1 ? 's have' : ' has'} escalated to Critical status. Immediate coordinator action required.
        </div>
      )}

      {/* Create Request Form */}
      {showForm && (
        <div className="card" style={{ borderColor: 'rgba(217, 35, 50, 0.2)' }}>
          <h3><Plus size={16} style={{ marginRight: 8, color: 'var(--accent)' }} />Create Blood Request</h3>
          <form onSubmit={createRequest}>
            <div className="form-row">
              <div className="form-group">
                <label>Patient</label>
                <select required value={form.patient_id} onChange={handlePatientChange}>
                  {patients.length === 0 && <option>Loading patients...</option>}
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>{p.name} — {p.blood_group}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Blood Group</label>
                <select value={form.blood_group} onChange={e => setForm(f => ({ ...f, blood_group: e.target.value }))}>
                  <option value="">Auto (from patient)</option>
                  {BLOOD_GROUPS.map(g => <option key={g}>{g}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Units Required</label>
                <input type="number" min={1} max={10} value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Urgency</label>
                <select value={form.urgency} onChange={e => setForm(f => ({ ...f, urgency: e.target.value }))}>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>
            <button className="btn btn-primary" type="submit" disabled={creating}>
              {creating ? 'Creating...' : 'Submit Request'}
            </button>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem 1.75rem' }}>
        <div className="form-row" style={{ marginBottom: 0 }}>
          <div className="form-group" style={{ maxWidth: 240 }}>
            <label><Search size={11} style={{ display: 'inline', marginRight: 4 }} />Filter by Status</label>
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              {STATUSES.map((s) => <option key={s} value={s}>{s || 'All Statuses'}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Requests Table */}
      <div className="card">
        <h3>
          <ClipboardList size={16} style={{ marginRight: 8 }} />
          {loading ? 'Loading...' : `${requests.length} Request${requests.length !== 1 ? 's' : ''}${filter ? ` — ${filter}` : ''}`}
        </h3>
        {loading ? (
          <div className="loading">Loading requests...</div>
        ) : requests.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>
            <ClipboardList size={40} style={{ marginBottom: '1rem', opacity: 0.3 }} />
            <div>No requests found{filter ? ` with status "${filter}"` : ''}.</div>
            <div style={{ marginTop: 8, fontSize: 12 }}>Run the demo workflow from the Dashboard or create one above.</div>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Patient</th>
                <th>Blood Group</th>
                <th>Units</th>
                <th>Status</th>
                <th>Urgency</th>
                <th>Source</th>
                <th>Round</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => {
                const meta = STATUS_META[r.status] || { cls: 'staging', icon: '—' }
                return (
                  <tr key={r.id} style={r.status === 'Critical' ? { background: 'rgba(217, 35, 50, 0.03)' } : {}}>
                    <td style={{ fontFamily: 'monospace', color: 'var(--muted)', fontSize: 12 }}>#{r.id}</td>
                    <td style={{ fontWeight: 500 }}>{r.patient_name}</td>
                    <td>
                      <span className="badge staging" style={{ fontSize: 10 }}>
                        {r.blood_group?.replace(' Positive', '+').replace(' Negative', '-')}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600, color: r.quantity > 1 ? 'var(--warning)' : 'inherit' }}>{r.quantity}</td>
                    <td>
                      <span className={`badge ${meta.cls}`}>
                        {meta.icon} {r.status}
                      </span>
                    </td>
                    <td>
                      <span style={{
                        color: r.urgency === 'critical' ? 'var(--accent)' : r.urgency === 'high' ? 'var(--warning)' : 'var(--muted)',
                        fontWeight: r.urgency !== 'normal' ? 600 : 400,
                        fontSize: 12
                      }}>
                        {r.urgency}
                      </span>
                    </td>
                    <td style={{ color: 'var(--muted)', fontSize: 11 }}>{r.source}</td>
                    <td style={{ color: r.escalation_round > 1 ? 'var(--warning)' : 'var(--muted)', fontWeight: r.escalation_round > 1 ? 600 : 400 }}>
                      R{r.escalation_round || 0}
                    </td>
                    <td style={{ color: 'var(--muted)', fontSize: 11 }}>
                      {r.created_at ? new Date(r.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
