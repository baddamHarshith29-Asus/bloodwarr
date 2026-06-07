import { useEffect, useState } from 'react'
import { Users, Plus, Filter } from 'lucide-react'
import { api } from '../api'

const BLOOD_GROUPS = ['', 'O Positive', 'O Negative', 'A Positive', 'A Negative', 'B Positive', 'B Negative', 'AB Positive', 'AB Negative']
const CHANNELS = ['WhatsApp', 'SMS', 'Email']
const LANGUAGES = ['English', 'Hindi', 'Telugu']

export default function DonorManagement() {
  const [donors, setDonors] = useState([])
  const [total, setTotal] = useState(0)
  const [availableOnly, setAvailableOnly] = useState(false)
  const [bloodGroupFilter, setBloodGroupFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    name: '', blood_group: 'O Positive', city: 'Hyderabad', contact: '',
    preferred_language: 'English', preferred_channel: 'WhatsApp', preferred_time_period: 'Morning'
  })
  const [creating, setCreating] = useState(false)

  const load = () => {
    setLoading(true)
    const params = { limit: 100 }
    if (availableOnly) params.available_only = true
    if (bloodGroupFilter) params.blood_group = bloodGroupFilter
    api.donors(params)
      .then((d) => { setDonors(d.donors || []); setTotal(d.total || 0) })
      .finally(() => setLoading(false))
  }

  useEffect(load, [availableOnly, bloodGroupFilter])

  const createDonor = async (e) => {
    e.preventDefault()
    setCreating(true)
    try {
      await api.createDonor(form)
      setForm({ name: '', blood_group: 'O Positive', city: 'Hyderabad', contact: '', preferred_language: 'English', preferred_channel: 'WhatsApp', preferred_time_period: 'Morning' })
      setShowForm(false)
      load()
    } catch (e) {
      alert(e.message)
    } finally {
      setCreating(false)
    }
  }

  return (
    <>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2>Donor Management</h2>
          <p>{total} donors — profiles with language, channel preferences, and response rates</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          <Plus size={14} /> {showForm ? 'Cancel' : 'Register Donor'}
        </button>
      </div>

      {showForm && (
        <div className="card">
          <h3><Plus size={16} style={{ marginRight: 8, color: 'var(--accent)' }} />Register New Donor</h3>
          <form onSubmit={createDonor}>
            <div className="form-row">
              <div className="form-group">
                <label>Full Name</label>
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ramesh Kumar" />
              </div>
              <div className="form-group">
                <label>Blood Group</label>
                <select value={form.blood_group} onChange={(e) => setForm({ ...form, blood_group: e.target.value })}>
                  {BLOOD_GROUPS.filter(Boolean).map(g => <option key={g}>{g}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>City</label>
                <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Hyderabad" />
              </div>
              <div className="form-group">
                <label>Contact</label>
                <input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} placeholder="+91 9XXXXXXXXX" />
              </div>
              <div className="form-group">
                <label>Preferred Language</label>
                <select value={form.preferred_language} onChange={(e) => setForm({ ...form, preferred_language: e.target.value })}>
                  {LANGUAGES.map(l => <option key={l}>{l}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Preferred Channel</label>
                <select value={form.preferred_channel} onChange={(e) => setForm({ ...form, preferred_channel: e.target.value })}>
                  {CHANNELS.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Preferred Time Period</label>
                <select value={form.preferred_time_period} onChange={(e) => setForm({ ...form, preferred_time_period: e.target.value })}>
                  <option value="Morning">Morning (09:00 - 12:00)</option>
                  <option value="Afternoon">Afternoon (12:00 - 16:00)</option>
                  <option value="Evening">Evening (16:00 - 20:00)</option>
                  <option value="Night">Night (20:00 - 22:00)</option>
                </select>
              </div>
            </div>
            <button className="btn btn-primary" type="submit" disabled={creating}>
              {creating ? 'Registering...' : 'Register Donor'}
            </button>
          </form>
        </div>
      )}

      <div className="card">
        <div className="form-row" style={{ marginBottom: 0 }}>
          <div className="form-group" style={{ maxWidth: 200 }}>
            <label><Filter size={11} style={{ display: 'inline', marginRight: 4 }} />Availability</label>
            <select value={availableOnly} onChange={(e) => setAvailableOnly(e.target.value === 'true')}>
              <option value="false">All Donors</option>
              <option value="true">Available Only</option>
            </select>
          </div>
          <div className="form-group" style={{ maxWidth: 220 }}>
            <label>Blood Group</label>
            <select value={bloodGroupFilter} onChange={(e) => setBloodGroupFilter(e.target.value)}>
              {BLOOD_GROUPS.map(g => <option key={g} value={g}>{g || 'All Groups'}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={load}>Refresh</button>
          </div>
        </div>
      </div>

      <div className="card">
        <h3><Users size={16} style={{ marginRight: 8 }} />{loading ? 'Loading...' : `Showing ${donors.length} of ${total} donors`}</h3>
        {loading ? (
          <div className="loading">Loading donors from database...</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>ID</th><th>Name</th><th>Blood</th><th>City</th><th>Contact</th>
                <th>Status</th><th>Donations</th><th>Language</th><th>Channel</th><th>Time Preference</th><th>Response Rate</th>
              </tr>
            </thead>
            <tbody>
              {donors.length === 0 && (
                <tr><td colSpan={10} style={{ textAlign: 'center', color: 'var(--muted)' }}>No donors found</td></tr>
              )}
              {donors.map((d) => (
                <tr key={d.id}>
                  <td style={{ fontFamily: 'monospace', color: 'var(--muted)' }}>{d.id}</td>
                  <td style={{ fontWeight: 500 }}>{d.name}</td>
                  <td><span className="badge staging">{d.blood_group?.replace(' Positive', '+').replace(' Negative', '-')}</span></td>
                  <td>{d.city}</td>
                  <td style={{ color: 'var(--muted)', fontSize: 12 }}>{d.contact || '—'}</td>
                  <td>
                    <span className={`badge ${d.availability_status === 'available' ? 'eligible' : ''}`}>
                      {d.availability_status}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600 }}>{d.donation_count}</td>
                  <td style={{ color: 'var(--muted)' }}>{d.preferred_language}</td>
                  <td style={{ color: 'var(--muted)' }}>{d.preferred_channel}</td>
                  <td style={{ color: 'var(--muted)', fontSize: 12 }}>{d.preferred_time || 'Morning'}</td>
                  <td>
                    <span style={{ color: d.response_rate > 0.7 ? 'var(--success)' : d.response_rate > 0.4 ? 'var(--warning)' : 'var(--accent)', fontWeight: 600 }}>
                      {(d.response_rate * 100).toFixed(0)}%
                    </span>
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
