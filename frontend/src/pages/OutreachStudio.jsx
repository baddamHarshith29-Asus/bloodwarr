import { useEffect, useState } from 'react'
import { api } from '../api'

export default function OutreachStudio() {
  const [requests, setRequests] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [status, setStatus] = useState(null)
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [countdown, setCountdown] = useState(null)
  const [reminderSent, setReminderSent] = useState(false)
  const [conversations, setConversations] = useState({})
  const [chatInputs, setChatInputs] = useState({})
  const [sendingChats, setSendingChats] = useState({})

  useEffect(() => {
    api.requests().then((d) => {
      const active = (d.requests || []).filter((r) => r.status !== 'Completed')
      setRequests(active)
      if (active.length) setSelectedId(String(active[0].id))
    })
  }, [])

  const loadConversations = async (notifications) => {
    if (!notifications || notifications.length === 0) return
    const logs = {}
    for (const n of notifications) {
      try {
        const historyRes = await api.awsDynamoConversation(n.donor_id)
        logs[n.donor_id] = historyRes.history || []
      } catch (e) {
        console.error(`Failed to load chat history for donor ${n.donor_id}:`, e)
      }
    }
    setConversations(logs)
  }

  const loadStatus = async () => {
    if (!selectedId) return
    const newStatus = await api.outreachStatus(selectedId)
    setStatus(newStatus)
    if (newStatus && newStatus.notifications) {
      loadConversations(newStatus.notifications)
    }
  }

  useEffect(() => { loadStatus() }, [selectedId])

  useEffect(() => {
    let timer
    if (status && (status.status === 'Searching Donors' || status.status === 'Pending') && (!status.notifications || status.notifications.length === 0)) {
      setCountdown(300)
      timer = setInterval(() => {
        setCountdown((c) => {
          if (c === null) return null
          if (c <= 1) {
            clearInterval(timer)
            generateAndSend()
            return null
          }
          return c - 1
        })
      }, 1000)
    } else {
      setCountdown(null)
    }
    return () => clearInterval(timer)
  }, [status])

  const generateAndSend = async () => {
    if (!selectedId) return
    setLoading(true)
    try {
      await api.runOutreach(selectedId)
      await loadStatus()
    } catch (e) {
      alert(e.message)
    } finally {
      setLoading(false)
    }
  }

  const approve = async () => {
    await api.approveOutreach(selectedId)
    await loadStatus()
  }

  const complete = async () => {
    await api.completeRequest(selectedId)
    await loadStatus()
    const r = await api.requests()
    setRequests((r.requests || []).filter((x) => x.status !== 'Completed'))
  }

  const respond = async (notifId, response) => {
    await api.respondNotification(notifId, response)
    await loadStatus()
  }

  const sendChat = async (notif, messageText) => {
    const userMsg = messageText || chatInputs[notif.donor_id] || ''
    if (!userMsg.trim()) return
    
    setSendingChats(prev => ({ ...prev, [notif.donor_id]: true }))
    try {
      const res = await api.awsBedrockChat({
        donor_id: notif.donor_id,
        message: userMsg,
        blood_group: status.blood_group || 'O+',
        hospital: status.appointment?.hospital || 'Apollo Hospital',
        language: 'English'
      })
      
      setChatInputs(prev => ({ ...prev, [notif.donor_id]: '' }))
      
      if (res.normalized_response === 'YES' || res.intent === 'YES') {
        await api.respondNotification(notif.id, 'YES')
      } else if (res.normalized_response === 'NO' || res.intent === 'NO') {
        await api.respondNotification(notif.id, 'NO')
      }
      
      await loadStatus()
    } catch (e) {
      alert(`Chat error: ${e.message}`)
    } finally {
      setSendingChats(prev => ({ ...prev, [notif.donor_id]: false }))
    }
  }

  const sendReminder = async () => {
    setLoading(true)
    try {
      await api.remind(selectedId)
      setReminderSent(true)
      setTimeout(() => setReminderSent(false), 5000)
      await loadStatus()
    } catch (e) {
      alert(e.message)
    } finally {
      setLoading(false)
    }
  }

  const previewMessage = async (donorId) => {
    const msg = await api.generateMessage({ donor_id: donorId, request_id: +selectedId })
    setPreview(msg)
  }

  const formatTime = (secs) => {
    if (secs === null || secs === undefined) return ''
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${s < 10 ? '0' : ''}${s}`
  }

  return (
    <>
      <div className="page-header">
        <h2>Outreach Studio</h2>
        <p>Emergency workflow: Match → AI Message → Coordinator Review → Confirm</p>
      </div>

      <div className="innovation-banner">
        <h3>Emergency Request Workflow</h3>
        <p>New Request → Match Donors → Generate AI Message → Coordinator Reviews → Donation Confirmed → Completed</p>
      </div>

      <div className="card">
        <div className="form-row">
          <div className="form-group">
            <label>Blood Request</label>
            <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
              {requests.map((r) => (
                <option key={r.id} value={r.id}>#{r.id} — {r.patient_name} [{r.status}]</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={generateAndSend} disabled={loading || (status?.notifications?.length > 0)}>1. Generate AI Messages</button>
            <button className="btn btn-secondary" onClick={approve} disabled={loading || !status?.notifications?.some(n => n.status === 'pending_review')}>2. Coordinator Approve</button>
            <button className="btn btn-secondary" onClick={complete} disabled={loading || status?.status === 'Completed'}>4. Mark Completed</button>
          </div>
        </div>
        {status && (
          <div style={{ marginTop: '1rem', fontSize: '0.85rem' }}>
            Status: <span className="badge active">{status.status}</span> · Round {status.escalation_round}
          </div>
        )}
      </div>

      {countdown !== null && (
        <div className="card" style={{ borderColor: 'rgba(245, 158, 11, 0.4)', background: 'rgba(245, 158, 11, 0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ color: 'var(--warning)', margin: 0 }}>⏳ Automated Outreach Scheduled</h3>
              <p style={{ color: 'var(--muted)', fontSize: '0.85rem', margin: '4px 0 0 0' }}>
                AI translation need generator will auto-send outreach messages to top matched donors in <strong>{formatTime(countdown)}</strong>.
              </p>
            </div>
            <button className="btn btn-primary" onClick={generateAndSend} disabled={loading}>
              Trigger Now
            </button>
          </div>
        </div>
      )}

      {status?.appointment && (
        <div className="card" style={{ borderColor: 'rgba(16, 185, 129, 0.4)', background: 'rgba(16, 185, 129, 0.02)' }}>
          <h3 style={{ color: 'var(--success)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            🤝 Appointment Scheduled & Paired
          </h3>
          <p style={{ color: 'var(--muted)', fontSize: '0.875rem', marginTop: 4 }}>
            Donor <strong>{status.appointment.donor_name}</strong> ({status.appointment.donor_contact}) has accepted! Patient and donor are paired.
          </p>
          <div style={{ marginTop: 12, padding: 12, background: 'rgba(255, 255, 255, 0.02)', borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase' }}>Donation Date & Time Slot</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--success)' }}>
                {status.appointment.donation_date} @ {status.appointment.scheduled_time}
              </div>
            </div>
            <button className="btn btn-primary" onClick={sendReminder} disabled={loading || reminderSent}>
              {reminderSent ? 'Reminder Sent!' : 'Send Pre-Donation Reminder'}
            </button>
          </div>
        </div>
      )}

      {preview && (
        <div className="card">
          <h3>AI Message Preview — {preview.donor_name}</h3>
          <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '0.5rem' }}>{preview.memory_note}</div>
          <div className="grid-2">
            <div><strong>SMS</strong><div className="outreach-preview">{preview.formats?.SMS}</div></div>
            <div><strong>WhatsApp</strong><div className="outreach-preview">{preview.formats?.WhatsApp}</div></div>
          </div>
          <div style={{ marginTop: '1rem' }}><strong>Email</strong><div className="outreach-preview" style={{ whiteSpace: 'pre-wrap' }}>{preview.formats?.Email}</div></div>
        </div>
      )}

      {status?.notifications?.length > 0 && (
        <div className="card">
          <h3>Generated Outreach Messages</h3>
          {status.notifications.map((n) => (
            <div className="match-card" key={n.id} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>{n.donor_name}</strong>
                <span className={`badge ${n.status === 'pending_review' ? 'staging' : n.status === 'responded' ? 'eligible' : 'active'}`}>{n.status}</span>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{n.channel}</div>
              <div className="outreach-preview">{n.message}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary" style={{ padding: '0.3rem 0.8rem', fontSize: '0.75rem' }} onClick={() => previewMessage(n.donor_id)}>View All Formats</button>
                {n.status === 'sent' && (
                  <>
                    <button className="btn btn-primary" style={{ padding: '0.3rem 0.8rem', fontSize: '0.75rem' }} onClick={() => respond(n.id, 'YES')}>3. Donor Says YES</button>
                    <button className="btn btn-secondary" style={{ padding: '0.3rem 0.8rem', fontSize: '0.75rem' }} onClick={() => respond(n.id, 'NO')}>Donor Says NO</button>
                  </>
                )}
              </div>

              {/* Chat Conversation & Reply Simulator */}
              <div style={{
                marginTop: 6,
                borderTop: '1px solid rgba(255,255,255,0.06)',
                paddingTop: 10
              }}>
                <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 6, fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
                  <span>💬 Real-Time Conversation Session (DynamoDB TTL Cache)</span>
                  <span>Donor ID: #{n.donor_id}</span>
                </div>
                
                <div style={{
                  maxHeight: 180,
                  overflowY: 'auto',
                  background: 'rgba(0,0,0,0.15)',
                  borderRadius: 8,
                  padding: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  marginBottom: 10
                }}>
                  {(!conversations[n.donor_id] || conversations[n.donor_id].length === 0) ? (
                    <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', padding: '10px 0' }}>
                      No chat sessions recorded. Use the simulator below to reply as the donor!
                    </div>
                  ) : (
                    conversations[n.donor_id].map((turn, idx) => (
                      <div
                        key={idx}
                        style={{
                          alignSelf: turn.role === 'user' ? 'flex-end' : 'flex-start',
                          background: turn.role === 'user' ? 'rgba(217,35,50,0.15)' : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${turn.role === 'user' ? 'rgba(217,35,50,0.25)' : 'rgba(255,255,255,0.08)'}`,
                          borderRadius: 8,
                          padding: '6px 10px',
                          maxWidth: '85%',
                          fontSize: 11
                        }}
                      >
                        <div style={{ fontSize: 9, color: turn.role === 'user' ? '#f472b6' : '#9ca3af', marginBottom: 2, fontWeight: 700 }}>
                          {turn.role === 'user' ? 'Donor (Reply)' : 'AI Coordinator'}
                        </div>
                        <div style={{ color: '#fff', lineHeight: 1.3 }}>{turn.content}</div>
                      </div>
                    ))
                  )}
                </div>

                {n.status === 'sent' && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="text"
                      placeholder="Type simulated reply as the donor (e.g. 'Yes I can come tomorrow' or in Telugu)..."
                      value={chatInputs[n.donor_id] || ''}
                      onChange={(e) => setChatInputs(prev => ({ ...prev, [n.donor_id]: e.target.value }))}
                      onKeyDown={(e) => e.key === 'Enter' && sendChat(n, e.target.value)}
                      disabled={sendingChats[n.donor_id]}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        background: 'rgba(0,0,0,0.2)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 6,
                        color: '#fff',
                        fontSize: 12
                      }}
                    />
                    <button
                      className="btn btn-primary"
                      onClick={() => sendChat(n)}
                      disabled={sendingChats[n.donor_id]}
                      style={{ padding: '0 16px', fontSize: 12 }}
                    >
                      {sendingChats[n.donor_id] ? 'Sending...' : 'Send'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
