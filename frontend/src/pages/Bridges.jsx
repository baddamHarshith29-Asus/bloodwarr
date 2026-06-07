import { useEffect, useState } from 'react'
import { api } from '../api'

export default function Bridges() {
  const [bridges, setBridges] = useState([])
  const [predictions, setPredictions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api.bridges(), api.predictions(14)])
      .then(([b, p]) => {
        setBridges(b.bridges || [])
        setPredictions(p.predictions || [])
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="loading">Loading bridges...</div>

  return (
    <>
      <div className="page-header">
        <h2>Bridges & Transfusion Predictions</h2>
        <p>Transfusion Cycle Predictor — 72-hour pre-staging before need arises</p>
      </div>

      <div className="innovation-banner">
        <h3>🧬 Innovation #1: Before They Ask</h3>
        <p>
          {predictions.filter(p => p.pre_staging_due).length} bridges are in pre-staging window.
          SageMaker-style time-series model predicts next transfusion with 90%+ accuracy from historical cycles.
        </p>
      </div>

      <div className="card">
        <h3>Upcoming Transfusions (14 days) — {predictions.length} predicted</h3>
        <table>
          <thead>
            <tr>
              <th>Bridge</th>
              <th>Blood Group</th>
              <th>Last Transfusion</th>
              <th>Predicted Next</th>
              <th>Days Until</th>
              <th>Confidence</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {predictions.slice(0, 20).map((p) => (
              <tr key={p.bridge_id}>
                <td>{p.bridge_id.slice(0, 12)}...</td>
                <td>{p.bridge_blood_group}</td>
                <td>{p.last_transfusion_date || '—'}</td>
                <td>{p.predicted_next_date}</td>
                <td>{p.days_until_need}</td>
                <td>{(p.confidence * 100).toFixed(0)}%</td>
                <td>
                  {p.pre_staging_due ? (
                    <span className="badge staging">Pre-Staging</span>
                  ) : p.days_until_need <= 7 ? (
                    <span className="badge urgent">Upcoming</span>
                  ) : (
                    <span className="badge active">Scheduled</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>All Blood Bridges ({bridges.length})</h3>
        <table>
          <thead>
            <tr>
              <th>Bridge ID</th>
              <th>Blood Group</th>
              <th>Frequency</th>
              <th>Active Donors</th>
              <th>Next Expected</th>
            </tr>
          </thead>
          <tbody>
            {bridges.slice(0, 15).map((b) => (
              <tr key={b.bridge_id_full}>
                <td>{b.bridge_id}</td>
                <td>{b.bridge_blood_group}</td>
                <td>{b.frequency_in_days} days</td>
                <td>{b.active_donors}</td>
                <td>{b.expected_next_transfusion_date || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
