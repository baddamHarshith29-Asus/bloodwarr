import { useEffect, useState } from 'react'
import { Heart, Plus, Search, Calendar, Activity, RefreshCw } from 'lucide-react'
import { api } from '../api'

const BLOOD_GROUPS = ['O Positive', 'O Negative', 'A Positive', 'A Negative', 'B Positive', 'B Negative', 'AB Positive', 'AB Negative']
const CITIES = ['Hyderabad', 'Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Kolkata', 'Pune', 'Ahmedabad']

const BG_BADGE_COLORS = {
  'O Positive': '#D92332', 'O Negative': '#b81624',
  'A Positive': '#3A6D7C', 'A Negative': '#2a5563',
  'B Positive': '#685A8A', 'B Negative': '#533f75',
  'AB Positive': '#10B981', 'AB Negative': '#0a8a5f',
}

function BloodBadge({ group }) {
  const short = group?.replace(' Positive', '+').replace(' Negative', '-')
  const bg    = BG_BADGE_COLORS[group] || '#D92332'
  return (
    <span style={{
      background: bg + '22', color: bg,
      border: `1px solid ${bg}44`,
      padding: '2px 8px', borderRadius: 4,
      fontFamily: 'monospace', fontWeight: 700, fontSize: 12,
      letterSpacing: '0.02em',
    }}>
      {short}
    </span>
  )
}

function DaysUntilBadge({ lastDate, gapDays }) {
  if (!lastDate) return <span style={{ color: 'var(--muted)' }}>—</span>
  const next  = new Date(lastDate)
  next.setDate(next.getDate() + gapDays)
  const today = new Date()
  const days  = Math.round((next - today) / 86400000)
  const color = days <= 0 ? 'var(--accent)' : days <= 3 ? 'var(--accent)' : days <= 7 ? 'var(--warning)' : 'var(--success)'
  return (
    <span style={{ color, fontWeight: 600, fontSize: 12 }}>
      {days <= 0 ? '⚠ Overdue' : `${days}d`}
    </span>
  )
}

export default function PatientManagement() {
  const [patients, setPatients]   = useState([])
  const [total, setTotal]         = useState(0)
  const [showForm, setShowForm]   = useState(false)
  const [loading, setLoading]     = useState(true)
  const [creating, setCreating]   = useState(false)
  const [search, setSearch]       = useState('')
  const [appointments, setAppointments] = useState({})
  const [form, setForm] = useState({
    name: '', blood_group: 'O Positive', hospital: '',
    city: 'Hyderabad', avg_gap_days: 21, medical_notes: '',
    last_transfusion_date: '',
  })

  const load = () => {
    setLoading(true)
    api.patients({ limit: 500 })
      .then(async (d) => {
        const patientList = d.patients || []
        setPatients(patientList)
        setTotal(d.total)
        
        const apptsMap = {}
        await Promise.all(patientList.map(async (p) => {
          try {
            const res = await api.getPatientAppointments(p.id)
            if (res.appointments && res.appointments.length > 0) {
              apptsMap[p.id] = res.appointments
            }
          } catch (err) {
            console.error("Error fetching appointments for patient", p.id, err)
          }
        }))
        setAppointments(apptsMap)
      })
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const create = async (e) => {
    e.preventDefault()
    setCreating(true)
    try {
      const body = { ...form }
      if (!body.last_transfusion_date) delete body.last_transfusion_date
      await api.createPatient(body)
      setForm({ name: '', blood_group: 'O Positive', hospital: '', city: 'Hyderabad', avg_gap_days: 21, medical_notes: '', last_transfusion_date: '' })
      setShowForm(false)
      load()
    } catch (err) {
      alert(err.message)
    } finally {
      setCreating(false)
    }
  }

  const filtered = patients.filter(p =>
    !search ||
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.hospital.toLowerCase().includes(search.toLowerCase()) ||
    p.blood_group.toLowerCase().includes(search.toLowerCase())
  )

  const bgDistribution = patients.reduce((acc, p) => {
    const key = p.blood_group?.replace(' Positive', '+').replace(' Negative', '-')
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})

  return (
    <>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2><Heart size={20} style={{ display: 'inline', marginRight: 10, color: 'var(--accent)' }} />Patient Management</h2>
          <p>{total} Thalassemia patients — transfusion cycle tracking and upcoming need prediction</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={load} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
          </button>
          <button className="btn btn-primary" onClick={() => setShowForm(f => !f)}>
            <Plus size={14} /> {showForm ? 'Cancel' : 'Add Patient'}
          </button>
        </div>
      </div>

      {/* Blood Group Distribution */}
      {patients.length > 0 && (
        <div className="card" style={{ padding: '1.25rem 1.75rem', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>
            Blood Group Distribution
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {Object.entries(bgDistribution).sort((a, b) => b[1] - a[1]).map(([bg, count]) => (
              <div key={bg} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <BloodBadge group={Object.keys(BG_BADGE_COLORS).find(k => k.replace(' Positive', '+').replace(' Negative', '-') === bg) || ''} />
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Pairs Panel */}
      {Object.keys(appointments).length > 0 && (
        <div className="card" style={{ borderColor: 'rgba(16, 185, 129, 0.3)' }}>
          <h3 style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Activity size={16} /> Active Appointed Donor Pairs
          </h3>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: '1rem' }}>
            The following Thalassemia patients have been successfully paired with blood donors:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {Object.entries(appointments).flatMap(([patId, appts]) =>
              appts.map((appt) => {
                const patient = patients.find(pat => String(pat.id) === String(patId))
                return (
                  <div key={appt.match_id} className="match-card" style={{ borderColor: 'rgba(16, 185, 129, 0.2)', background: 'rgba(16, 185, 129, 0.02)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                      <div>
                        <span style={{ fontWeight: 600, color: 'var(--text)' }}>Patient: {patient?.name || 'Patient'}</span>
                        <span style={{ color: 'var(--muted)', margin: '0 8px' }}>↔</span>
                        <span style={{ fontWeight: 600, color: 'var(--success)' }}>Donor: {appt.donor_name}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <span className="badge eligible">Donor: {appt.donor_blood_group?.replace(' Positive', '+').replace(' Negative', '-')}</span>
                        <span className="badge active">Patient: {patient?.blood_group?.replace(' Positive', '+').replace(' Negative', '-')}</span>
                      </div>
                    </div>
                    <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                      <span>Hospital: <strong>{appt.hospital}</strong></span>
                      <span>Scheduled Date: <strong style={{ color: 'var(--success)' }}>{appt.donation_date}</strong></span>
                      <span>Time Slot: <strong style={{ color: 'var(--success)' }}>{appt.scheduled_time}</strong></span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* Create Form */}
      {showForm && (
        <div className="card" style={{ borderColor: 'rgba(217, 35, 50, 0.2)' }}>
          <h3><Plus size={16} style={{ marginRight: 8, color: 'var(--accent)' }} />Register New Patient</h3>
          <form onSubmit={create}>
            <div className="form-row">
              <div className="form-group">
                <label>Full Name</label>
                <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Rahul Kumar" />
              </div>
              <div className="form-group">
                <label>Blood Group</label>
                <select value={form.blood_group} onChange={e => setForm(f => ({ ...f, blood_group: e.target.value }))}>
                  {BLOOD_GROUPS.map(g => <option key={g}>{g}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Hospital</label>
                <input required value={form.hospital} onChange={e => setForm(f => ({ ...f, hospital: e.target.value }))} placeholder="Apollo Hospital" />
              </div>
              <div className="form-group">
                <label>City</label>
                <select value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))}>
                  {CITIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label><Calendar size={11} style={{ display: 'inline', marginRight: 3 }} />Last Transfusion</label>
                <input type="date" value={form.last_transfusion_date} onChange={e => setForm(f => ({ ...f, last_transfusion_date: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Avg Cycle (days)</label>
                <input type="number" value={form.avg_gap_days} min={7} max={120}
                  onChange={e => setForm(f => ({ ...f, avg_gap_days: +e.target.value }))} />
              </div>
              <div className="form-group" style={{ flex: 2, minWidth: 280 }}>
                <label>Medical Notes</label>
                <input value={form.medical_notes} onChange={e => setForm(f => ({ ...f, medical_notes: e.target.value }))}
                  placeholder="Thalassemia Major, HbH Disease..." />
              </div>
            </div>
            <button className="btn btn-primary" type="submit" disabled={creating}>
              {creating ? 'Registering...' : 'Register Patient'}
            </button>
          </form>
        </div>
      )}

      {/* Search + Table */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <h3 style={{ margin: 0 }}>
            <Heart size={16} style={{ marginRight: 8 }} />
            {loading ? 'Loading...' : `${filtered.length} Patient${filtered.length !== 1 ? 's' : ''}${search ? ` matching "${search}"` : ''}`}
          </h3>
          <div style={{ position: 'relative', maxWidth: 240 }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name, hospital..."
              style={{
                padding: '0.5rem 0.75rem 0.5rem 2rem',
                background: 'rgba(21,24,33,0.6)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 6,
                color: 'var(--text)',
                fontSize: 12,
                width: '100%',
              }}
            />
          </div>
        </div>

        {loading ? (
          <div className="loading">Loading patients...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>
            <Heart size={40} style={{ marginBottom: '1rem', opacity: 0.2 }} />
            <div>No patients found{search ? ` matching "${search}"` : ''}.</div>
            <div style={{ marginTop: 8, fontSize: 12 }}>Register a patient above or run the seed/demo workflow.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Blood Group</th>
                  <th>Hospital</th>
                  <th>City</th>
                  <th>Last Transfusion</th>
                  <th>Cycle</th>
                  <th>Next Due</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id}>
                    <td style={{ fontFamily: 'monospace', color: 'var(--muted)', fontSize: 11 }}>{p.id}</td>
                    <td style={{ fontWeight: 500 }}>
                      <div>{p.name}</div>
                      {appointments[p.id]?.map((appt) => (
                        <div key={appt.match_id} style={{
                          fontSize: 10,
                          color: 'var(--success)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          marginTop: 4,
                          background: 'rgba(16, 185, 129, 0.08)',
                          border: '1px solid rgba(16, 185, 129, 0.2)',
                          padding: '1px 6px',
                          borderRadius: 4,
                          fontWeight: 600
                        }}>
                          🤝 Appointed: {appt.donor_name} @ {appt.scheduled_time}
                        </div>
                      ))}
                    </td>
                    <td><BloodBadge group={p.blood_group} /></td>
                    <td style={{ fontSize: 12 }}>{p.hospital}</td>
                    <td style={{ fontSize: 12, color: 'var(--muted)' }}>{p.city}</td>
                    <td style={{ fontSize: 11, color: 'var(--muted)' }}>
                      {p.last_transfusion_date
                        ? new Date(p.last_transfusion_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })
                        : '—'}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--muted)' }}>{p.avg_gap_days}d</td>
                    <td>
                      <DaysUntilBadge lastDate={p.last_transfusion_date} gapDays={p.avg_gap_days} />
                    </td>
                    <td style={{ fontSize: 11, color: 'var(--muted)', maxWidth: 180 }}>{p.medical_notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
