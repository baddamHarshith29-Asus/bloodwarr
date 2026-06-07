import { useEffect, useState } from 'react'
import { api } from '../api'

const BLOOD_GROUPS = ['O Positive', 'O Negative', 'A Positive', 'A Negative', 'B Positive', 'B Negative', 'AB Positive', 'AB Negative']

export default function Donors() {
  const [donors, setDonors] = useState([])
  const [total, setTotal] = useState(0)
  const [bloodGroup, setBloodGroup] = useState('')
  const [eligibleOnly, setEligibleOnly] = useState(true)
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    const params = { limit: 50 }
    if (bloodGroup) params.blood_group = bloodGroup
    if (eligibleOnly) params.eligible_only = true
    api.donors(params)
      .then((d) => { setDonors(d.donors || []); setTotal(d.total) })
      .finally(() => setLoading(false))
  }

  useEffect(load, [bloodGroup, eligibleOnly])

  return (
    <>
      <div className="page-header">
        <h2>Donor Network</h2>
        <p>{total.toLocaleString()} donors in network — psychographic profiles power personalized outreach</p>
      </div>

      <div className="card">
        <div className="form-row">
          <div className="form-group">
            <label>Blood Group</label>
            <select value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)}>
              <option value="">All Groups</option>
              {BLOOD_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Filter</label>
            <select value={eligibleOnly} onChange={(e) => setEligibleOnly(e.target.value === 'true')}>
              <option value="true">Eligible Only</option>
              <option value="false">All Donors</option>
            </select>
          </div>
        </div>

        {loading ? <div className="loading">Loading...</div> : (
          <table>
            <thead>
              <tr>
                <th>Donor ID</th>
                <th>Role</th>
                <th>Blood Group</th>
                <th>Eligibility</th>
                <th>Donations</th>
                <th>Status</th>
                <th>Type</th>
              </tr>
            </thead>
            <tbody>
              {donors.map((d) => (
                <tr key={d.user_id_full}>
                  <td>{d.user_id}</td>
                  <td>{d.role}</td>
                  <td>{d.blood_group}</td>
                  <td><span className={`badge ${d.eligibility_status === 'eligible' ? 'eligible' : ''}`}>{d.eligibility_status}</span></td>
                  <td>{d.donations_till_date}</td>
                  <td>{d.user_donation_active_status}</td>
                  <td>{d.donor_type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
