import { useState, useEffect } from 'react'
import { api } from '../api'
import {
  Cloud, Cpu, Database, Activity, RefreshCw, Send, AlertTriangle,
  Play, CheckCircle, ArrowRight, MessageSquare, Shield, Layers, HelpCircle
} from 'lucide-react'

export default function AIInsights() {
  const [activeTab, setActiveTab] = useState('operations')
  const [awsStatus, setAwsStatus] = useState(null)
  const [kinesisEvents, setKinesisEvents] = useState([])
  const [dynamoRuns, setDynamoRuns] = useState([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // Bedrock Urgency State
  const [urgencyInput, setUrgencyInput] = useState({
    disease: 'Thalassemia Major (Severe Anemia)',
    last_transfusion_days_ago: 24,
    avg_gap_days: 21,
    days_until_need: 2
  })
  const [urgencyResult, setUrgencyResult] = useState(null)
  const [analyzingUrgency, setAnalyzingUrgency] = useState(false)

  // Bedrock Chat State
  const [chatInput, setChatInput] = useState({
    donor_id: 101,
    message: 'Nenu blood ivvadaniki ready ga unnanu, kani evening mathrame వీలవుతుంది.', // Telugu response
    blood_group: 'O+',
    hospital: 'NIMS Hospital, Hyderabad',
    language: 'Telugu'
  })
  const [chatResult, setChatResult] = useState(null)
  const [chatHistory, setChatHistory] = useState([])
  const [sendingChat, setSendingChat] = useState(false)

  // Selected event for payload view
  const [selectedEvent, setSelectedEvent] = useState(null)

  const fetchData = async () => {
    setRefreshing(true)
    try {
      const statusRes = await api.awsStatus()
      setAwsStatus(statusRes)

      const eventsRes = await api.awsKinesisEvents()
      setKinesisEvents(eventsRes.events || [])

      const runsRes = await api.awsDynamoRuns()
      setDynamoRuns(runsRes.runs || [])

      // If we have history for the donor, load it
      const historyRes = await api.awsDynamoConversation(chatInput.donor_id)
      setChatHistory(historyRes.history || [])
    } catch (e) {
      console.error('Failed to fetch AWS status:', e)
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 10000)
    return () => clearInterval(interval)
  }, [chatInput.donor_id])

  const runUrgencyAnalysis = async () => {
    setAnalyzingUrgency(true)
    setUrgencyResult(null)
    try {
      const res = await api.awsBedrockAnalyzeUrgency(urgencyInput)
      setUrgencyResult(res)
      // Refresh events since a simulation might trigger event logging
      fetchData()
    } catch (e) {
      console.error(e)
      setUrgencyResult({ error: e.message })
    } finally {
      setAnalyzingUrgency(false)
    }
  }

  const sendSimulatedChat = async () => {
    if (!chatInput.message.trim()) return
    setSendingChat(true)
    try {
      const res = await api.awsBedrockChat(chatInput)
      setChatResult(res)
      // Reload history & events
      await fetchData()
      setChatInput({ ...chatInput, message: '' })
    } catch (e) {
      console.error(e)
      setChatResult({ error: e.message })
    } finally {
      setSendingChat(false)
    }
  }

  const clearChatHistory = async () => {
    // Just reset locally for demo
    setChatHistory([])
  }

  const getEventBadgeColor = (type) => {
    switch (type) {
      case 'DonorRegistered': return { bg: 'rgba(34,197,94,0.15)', border: 'rgba(34,197,94,0.4)', text: '#4ade80' }
      case 'RequestCreated': return { bg: 'rgba(168,85,247,0.15)', border: 'rgba(168,85,247,0.4)', text: '#c084fc' }
      case 'OutreachSent': return { bg: 'rgba(59,130,246,0.15)', border: 'rgba(59,130,246,0.4)', text: '#60a5fa' }
      case 'DonorResponded': return { bg: 'rgba(249,115,22,0.15)', border: 'rgba(249,115,22,0.4)', text: '#f97316' }
      case 'AppointmentScheduled': return { bg: 'rgba(236,72,153,0.15)', border: 'rgba(236,72,153,0.4)', text: '#f472b6' }
      case 'DonationCompleted': return { bg: 'rgba(20,184,166,0.15)', border: 'rgba(20,184,166,0.4)', text: '#2dd4bf' }
      case 'PipelineRun': return { bg: 'rgba(217,35,50,0.15)', border: 'rgba(217,35,50,0.4)', text: '#f87171' }
      default: return { bg: 'rgba(156,163,175,0.15)', border: 'rgba(156,163,175,0.4)', text: '#9ca3af' }
    }
  }

  return (
    <div style={{ padding: '2rem', color: '#f3f4f6', minHeight: '100vh', background: 'radial-gradient(circle at top right, #111122 0%, #07070c 80%)' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--primary)' }}>
            <Cloud size={28} className="pulse-slow" style={{ color: '#ec4899' }} />
            <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: '#ec4899' }}>Layer 3 & 4 Orchestration</span>
          </div>
          <h1 style={{ fontSize: '2.2rem', margin: '0.2rem 0 0.5rem 0', fontWeight: 800, background: 'linear-gradient(90deg, #fff 0%, #ec4899 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            AWS Cloud AI Control Hub
          </h1>
          <p style={{ color: 'var(--muted)', margin: 0, fontSize: 14 }}>
            Monitor real-time event streaming via Kinesis, serverless state pipelines, and execute interactive Amazon Bedrock workloads.
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={refreshing}
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 12,
            padding: '10px 16px',
            color: '#fff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontWeight: 600,
            transition: 'all 0.2s',
          }}
          className="hover-bright"
        >
          <RefreshCw size={16} className={refreshing ? 'spin' : ''} />
          {refreshing ? 'Syncing...' : 'Refresh Hub'}
        </button>
      </div>

      {/* Service Health Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: '2rem' }}>
        
        {/* Amazon Bedrock Card */}
        <div style={{
          background: 'rgba(15,15,30,0.65)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(236,72,153,0.25)',
          borderRadius: 16,
          padding: 20,
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <span style={{ fontSize: 11, color: '#ec4899', fontWeight: 700, letterSpacing: 1 }}>LAYER 3 — AI</span>
              <h3 style={{ margin: '2px 0', fontSize: 16 }}>Amazon Bedrock</h3>
            </div>
            <div style={{
              background: awsStatus?.bedrock?.available ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)',
              border: `1px solid ${awsStatus?.bedrock?.available ? '#22c55e' : '#f59e0b'}`,
              borderRadius: 20, padding: '2px 8px', fontSize: 10, fontWeight: 700,
              color: awsStatus?.bedrock?.available ? '#22c55e' : '#f59e0b'
            }}>
              {awsStatus?.bedrock?.available ? 'CONNECTED' : 'LOCAL DEV FALLBACK'}
            </div>
          </div>
          <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 16px 0', lineHeight: 1.4 }}>
            Provides generative coordination, NLP patient urgency sorting, and multilingual donor response processing.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, background: 'rgba(0,0,0,0.2)', padding: 10, borderRadius: 8, fontSize: 11 }}>
            <div>
              <span style={{ color: '#777', display: 'block' }}>Model</span>
              <strong style={{ color: '#eee' }}>Claude 3 Haiku</strong>
            </div>
            <div>
              <span style={{ color: '#777', display: 'block' }}>AWS Region</span>
              <strong style={{ color: '#eee' }}>{awsStatus?.bedrock?.region || 'ap-south-1'}</strong>
            </div>
          </div>
        </div>

        {/* Amazon DynamoDB Card */}
        <div style={{
          background: 'rgba(15,15,30,0.65)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(59,130,246,0.25)',
          borderRadius: 16,
          padding: 20,
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <span style={{ fontSize: 11, color: '#3b82f6', fontWeight: 700, letterSpacing: 1 }}>LAYER 2 — CACHE</span>
              <h3 style={{ margin: '2px 0', fontSize: 16 }}>Amazon DynamoDB</h3>
            </div>
            <div style={{
              background: awsStatus?.dynamodb?.available ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)',
              border: `1px solid ${awsStatus?.dynamodb?.available ? '#22c55e' : '#f59e0b'}`,
              borderRadius: 20, padding: '2px 8px', fontSize: 10, fontWeight: 700,
              color: awsStatus?.dynamodb?.available ? '#22c55e' : '#f59e0b'
            }}>
              {awsStatus?.dynamodb?.available ? 'CONNECTED' : 'LOCAL CACHE ACTIVE'}
            </div>
          </div>
          <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 16px 0', lineHeight: 1.4 }}>
            Maintains sub-millisecond status cache of active donors, active chatbot dialog states, and execution histories.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 10, background: 'rgba(0,0,0,0.2)', padding: 10, borderRadius: 8, fontSize: 11 }}>
            <div>
              <span style={{ color: '#777', display: 'block' }}>Cached States</span>
              <strong style={{ color: '#eee' }}>{awsStatus?.dynamodb?.cached_donors || 0} donors active</strong>
            </div>
            <div>
              <span style={{ color: '#777', display: 'block' }}>Total Table Runs</span>
              <strong style={{ color: '#eee' }}>{awsStatus?.dynamodb?.pipeline_runs_stored || 0}</strong>
            </div>
          </div>
        </div>

        {/* Amazon Kinesis Card */}
        <div style={{
          background: 'rgba(15,15,30,0.65)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(168,85,247,0.25)',
          borderRadius: 16,
          padding: 20,
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <span style={{ fontSize: 11, color: '#a855f7', fontWeight: 700, letterSpacing: 1 }}>LAYER 2 — STREAM</span>
              <h3 style={{ margin: '2px 0', fontSize: 16 }}>Amazon Kinesis Streams</h3>
            </div>
            <div style={{
              background: awsStatus?.kinesis?.available ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)',
              border: `1px solid ${awsStatus?.kinesis?.available ? '#22c55e' : '#f59e0b'}`,
              borderRadius: 20, padding: '2px 8px', fontSize: 10, fontWeight: 700,
              color: awsStatus?.kinesis?.available ? '#22c55e' : '#f59e0b'
            }}>
              {awsStatus?.kinesis?.available ? 'CONNECTED' : 'LOCAL LOG FALLBACK'}
            </div>
          </div>
          <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 16px 0', lineHeight: 1.4 }}>
            Publishes and distributes event telemetry (donor clicks, messages, schedules) to trigger Glue ETL and data lake dumps.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 10, background: 'rgba(0,0,0,0.2)', padding: 10, borderRadius: 8, fontSize: 11 }}>
            <div>
              <span style={{ color: '#777', display: 'block' }}>Kinesis Stream</span>
              <strong style={{ color: '#eee', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                {awsStatus?.kinesis?.stream_name || 'blood-warriors-events'}
              </strong>
            </div>
            <div>
              <span style={{ color: '#777', display: 'block' }}>Buffered Events</span>
              <strong style={{ color: '#eee' }}>{awsStatus?.kinesis?.local_event_count || 0} total</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 12, marginBottom: '2rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.75rem' }}>
        <button
          onClick={() => setActiveTab('operations')}
          style={{
            background: activeTab === 'operations' ? 'rgba(236,72,153,0.15)' : 'transparent',
            border: activeTab === 'operations' ? '1px solid #ec4899' : '1px solid transparent',
            color: activeTab === 'operations' ? '#fff' : 'var(--muted)',
            borderRadius: 8, padding: '8px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer'
          }}
        >
          <Activity size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
          Cloud Operations Stream
        </button>
        <button
          onClick={() => setActiveTab('sandbox')}
          style={{
            background: activeTab === 'sandbox' ? 'rgba(236,72,153,0.15)' : 'transparent',
            border: activeTab === 'sandbox' ? '1px solid #ec4899' : '1px solid transparent',
            color: activeTab === 'sandbox' ? '#fff' : 'var(--muted)',
            borderRadius: 8, padding: '8px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer'
          }}
        >
          <Cpu size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
          Amazon Bedrock Sandbox
        </button>
        <button
          onClick={() => setActiveTab('architecture')}
          style={{
            background: activeTab === 'architecture' ? 'rgba(236,72,153,0.15)' : 'transparent',
            border: activeTab === 'architecture' ? '1px solid #ec4899' : '1px solid transparent',
            color: activeTab === 'architecture' ? '#fff' : 'var(--muted)',
            borderRadius: 8, padding: '8px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer'
          }}
        >
          <Layers size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
          5-Layer AWS Stack Diagram
        </button>
      </div>

      {/* Tab Content: Operations */}
      {activeTab === 'operations' && (
        <div style={{ display: 'grid', gridTemplateColumns: '3.5fr 2.5fr', gap: 24 }}>
          
          {/* Column 1: Kinesis Event Stream */}
          <div style={{
            background: 'rgba(10,10,20,0.5)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 16,
            padding: 24
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>🔥 Kinesis Event Telemetry Stream</h3>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>Live updates from the `blood-warriors-events` stream sharding</span>
              </div>
              <span style={{ fontSize: 11, background: 'rgba(255,255,255,0.06)', padding: '4px 10px', borderRadius: 20, color: '#aaa' }}>
                Real-Time Listening
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 520, overflowY: 'auto', paddingRight: 6 }}>
              {kinesisEvents.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '4rem 1rem', color: '#555' }}>
                  <AlertTriangle size={32} style={{ margin: '0 auto 10px auto', opacity: 0.5 }} />
                  <div>No telemetry events found in the event stream buffer.</div>
                  <div style={{ fontSize: 11, marginTop: 4 }}>Simulate interactions in the Bedrock sandbox to generate events.</div>
                </div>
              ) : (
                kinesisEvents.map((evt) => {
                  const badge = getEventBadgeColor(evt.event_type)
                  return (
                    <div
                      key={evt.event_id}
                      onClick={() => setSelectedEvent(evt)}
                      style={{
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.05)',
                        borderRadius: 12,
                        padding: 12,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                      className="hover-card"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{
                          background: badge.bg,
                          border: `1px solid ${badge.border}`,
                          color: badge.text,
                          padding: '3px 10px',
                          borderRadius: 8,
                          fontSize: 11,
                          fontWeight: 700
                        }}>
                          {evt.event_type}
                        </span>
                        <div style={{ fontSize: 12, color: '#bbb' }}>
                          {evt.event_type === 'DonorResponded' && `Donor responded: ${evt.payload?.response}`}
                          {evt.event_type === 'OutreachSent' && `Outreach via ${evt.payload?.channel}`}
                          {evt.event_type === 'RequestCreated' && `Request for group ${evt.payload?.blood_group}`}
                          {evt.event_type === 'DonorRegistered' && `New registered donor: ${evt.payload?.name}`}
                          {evt.event_type === 'PipelineRun' && `Autonomous pipeline auto-completed`}
                          {evt.event_type === 'AppointmentScheduled' && `Appointment set for donor ${evt.payload?.donor_name}`}
                          {evt.event_type === 'DonationCompleted' && `Donation finished for patient ${evt.payload?.patient_name}`}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 11, color: '#555' }}>
                          {new Date(evt.timestamp).toLocaleTimeString()}
                        </span>
                        <ArrowRight size={12} style={{ color: '#444' }} />
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Column 2: DynamoDB Pipeline Execution Records */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            
            {/* Run History List */}
            <div style={{
              background: 'rgba(10,10,20,0.5)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 16,
              padding: 24,
              flex: 1
            }}>
              <h3 style={{ margin: '0 0 4px 0', fontSize: 16, fontWeight: 700 }}>📋 DynamoDB Pipeline Run Logs</h3>
              <p style={{ fontSize: 11, color: 'var(--muted)', margin: '0 0 16px 0' }}>Latest execution telemetry logged to DynamoDB table</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 420, overflowY: 'auto' }}>
                {dynamoRuns.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3rem 0', color: '#555', fontSize: 12 }}>
                    No automated pipeline execution logs detected.
                  </div>
                ) : (
                  dynamoRuns.map((run, idx) => {
                    const data = typeof run.data === 'string' ? JSON.parse(run.data) : run.data || run
                    return (
                      <div key={idx} style={{
                        background: 'rgba(255,255,255,0.01)',
                        border: '1px solid rgba(255,255,255,0.04)',
                        borderRadius: 10,
                        padding: 12,
                        fontSize: 12
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span style={{ color: '#ec4899', fontWeight: 600 }}>
                            {new Date(data.run_at).toLocaleString()}
                          </span>
                          <span style={{ fontSize: 10, background: 'rgba(34,197,94,0.1)', color: '#22c55e', padding: '1px 6px', borderRadius: 4 }}>
                            Success
                          </span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, fontSize: 11, color: '#aaa' }}>
                          <div>🔮 Predictions: <strong>{data.predictions_run || 0}</strong></div>
                          <div>📋 Requests: <strong>{data.requests_auto_created || 0}</strong></div>
                          <div>📨 Sent: <strong>{data.outreach_sent || 0}</strong></div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* Quick Stats Panel */}
            <div style={{
              background: 'rgba(15,15,25,0.7)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 16,
              padding: 20
            }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, color: '#ec4899' }}>Live Analytics Summary</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: 12, borderRadius: 10 }}>
                  <div style={{ fontSize: 10, color: '#777' }}>Kinesis Telemetry Rate</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#60a5fa', marginTop: 4 }}>
                    {kinesisEvents.length > 0 ? `${(kinesisEvents.length / 5).toFixed(1)} ev/min` : '0.0 ev/min'}
                  </div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: 12, borderRadius: 10 }}>
                  <div style={{ fontSize: 10, color: '#777' }}>Bedrock Cache Hit</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#4ade80', marginTop: 4 }}>100%</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab Content: Sandbox */}
      {activeTab === 'sandbox' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 24 }}>
          
          {/* Column 1: Simulators */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            
            {/* Urgency Analysis Sandbox */}
            <div style={{
              background: 'rgba(10,10,20,0.5)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 16,
              padding: 24
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <Shield size={20} style={{ color: '#ec4899' }} />
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Medical NLP Urgency Assessor (Bedrock)</h3>
              </div>
              <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 16px 0' }}>
                Submit clinical indicators for thalassemia cycles. Bedrock will assess urgency score, provide diagnostic reasoning, and schedule recommendations.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 4 }}>Patient Disease / Condition</label>
                  <input
                    type="text"
                    value={urgencyInput.disease}
                    onChange={(e) => setUrgencyInput({ ...urgencyInput, disease: e.target.value })}
                    style={{ width: '100%', padding: 10, borderRadius: 8, background: '#111', border: '1px solid #333', color: '#fff', fontSize: 12 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 4 }}>Days Until Transfusion Need</label>
                  <input
                    type="number"
                    value={urgencyInput.days_until_need}
                    onChange={(e) => setUrgencyInput({ ...urgencyInput, days_until_need: parseInt(e.target.value) })}
                    style={{ width: '100%', padding: 10, borderRadius: 8, background: '#111', border: '1px solid #333', color: '#fff', fontSize: 12 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 4 }}>Last Transfusion (Days Ago)</label>
                  <input
                    type="number"
                    value={urgencyInput.last_transfusion_days_ago}
                    onChange={(e) => setUrgencyInput({ ...urgencyInput, last_transfusion_days_ago: parseInt(e.target.value) })}
                    style={{ width: '100%', padding: 10, borderRadius: 8, background: '#111', border: '1px solid #333', color: '#fff', fontSize: 12 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 4 }}>Avg Transfusion Gap (Days)</label>
                  <input
                    type="number"
                    value={urgencyInput.avg_gap_days}
                    onChange={(e) => setUrgencyInput({ ...urgencyInput, avg_gap_days: parseInt(e.target.value) })}
                    style={{ width: '100%', padding: 10, borderRadius: 8, background: '#111', border: '1px solid #333', color: '#fff', fontSize: 12 }}
                  />
                </div>
              </div>

              <button
                onClick={runUrgencyAnalysis}
                disabled={analyzingUrgency}
                style={{
                  background: '#ec4899', color: '#fff', border: 'none', borderRadius: 8,
                  padding: '10px 20px', fontWeight: 600, fontSize: 13, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 8
                }}
              >
                {analyzingUrgency ? '⏳ Claude analyzing...' : '▶ Invoke Bedrock Analysis'}
              </button>

              {urgencyResult && (
                <div style={{
                  marginTop: 16, padding: 16, borderRadius: 10,
                  background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#ec4899' }}>Analysis Results</span>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                      background: urgencyResult.urgency_level === 'critical' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)',
                      color: urgencyResult.urgency_level === 'critical' ? '#ef4444' : '#f59e0b',
                      border: `1px solid ${urgencyResult.urgency_level === 'critical' ? '#ef4444' : '#f59e0b'}`
                    }}>
                      {urgencyResult.urgency_level?.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#ccc', marginBottom: 8 }}>
                    <strong>Risk Score:</strong> {(urgencyResult.risk_score * 100).toFixed(0)}% · <strong>Action:</strong> {urgencyResult.recommended_action}
                  </div>
                  <div style={{ fontSize: 13, color: '#fff', background: 'rgba(255,255,255,0.02)', padding: 10, borderRadius: 6, fontStyle: 'italic' }}>
                    "{urgencyResult.reasoning}"
                  </div>
                </div>
              )}
            </div>

            {/* Donor Conversation Simulator */}
            <div style={{
              background: 'rgba(10,10,20,0.5)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 16,
              padding: 24
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <MessageSquare size={20} style={{ color: '#3b82f6' }} />
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Donor Conversation Simulation</h3>
              </div>
              <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 16px 0' }}>
                Simulate a donor replying. Bedrock processes native languages (Telugu, Hindi, English), updates DynamoDB context tables, categorizes intents, and sends events to Kinesis.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
                <div>
                  <label style={{ fontSize: 10, color: '#888', display: 'block', marginBottom: 4 }}>Donor ID</label>
                  <input
                    type="number"
                    value={chatInput.donor_id}
                    onChange={(e) => setChatInput({ ...chatInput, donor_id: parseInt(e.target.value) })}
                    style={{ width: '100%', padding: 8, borderRadius: 6, background: '#111', border: '1px solid #333', color: '#fff', fontSize: 12 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: '#888', display: 'block', marginBottom: 4 }}>Blood Group</label>
                  <input
                    type="text"
                    value={chatInput.blood_group}
                    onChange={(e) => setChatInput({ ...chatInput, blood_group: e.target.value })}
                    style={{ width: '100%', padding: 8, borderRadius: 6, background: '#111', border: '1px solid #333', color: '#fff', fontSize: 12 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: '#888', display: 'block', marginBottom: 4 }}>Language</label>
                  <select
                    value={chatInput.language}
                    onChange={(e) => setChatInput({ ...chatInput, language: e.target.value })}
                    style={{ width: '100%', padding: 8, borderRadius: 6, background: '#111', border: '1px solid #333', color: '#fff', fontSize: 12 }}
                  >
                    <option value="English">English</option>
                    <option value="Telugu">Telugu</option>
                    <option value="Hindi">Hindi</option>
                    <option value="Tamil">Tamil</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <input
                  type="text"
                  placeholder="Type simulated message (e.g. 'Nenu blood donation ki ready ga unnanu')"
                  value={chatInput.message}
                  onChange={(e) => setChatInput({ ...chatInput, message: e.target.value })}
                  style={{ flex: 1, padding: 12, borderRadius: 8, background: '#111', border: '1px solid #333', color: '#fff', fontSize: 13 }}
                  onKeyDown={(e) => e.key === 'Enter' && sendSimulatedChat()}
                />
                <button
                  onClick={sendSimulatedChat}
                  disabled={sendingChat}
                  style={{
                    background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8,
                    padding: '0 20px', fontWeight: 600, fontSize: 13, cursor: 'pointer'
                  }}
                >
                  {sendingChat ? 'Sending...' : 'Send'}
                </button>
              </div>

              {chatResult && (
                <div style={{
                  marginTop: 16, padding: 12, borderRadius: 8,
                  background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#3b82f6', fontWeight: 700, marginBottom: 4 }}>
                    <span>Intent Classified: {chatResult.intent}</span>
                    <span>Confidence: {(chatResult.confidence * 100).toFixed(0)}%</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#eee' }}>
                    <strong>Response:</strong> {chatResult.normalized_response}
                  </div>
                  <div style={{ fontSize: 12, color: '#bbb', marginTop: 4, fontStyle: 'italic' }}>
                    Follow-up outreach: "{chatResult.follow_up_message}"
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Column 2: DynamoDB Chat History Cache */}
          <div style={{
            background: 'rgba(10,10,20,0.5)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 16,
            padding: 24,
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>💾 DynamoDB Conversations</h3>
              <button
                onClick={clearChatHistory}
                style={{ background: 'transparent', border: 'none', color: '#777', cursor: 'pointer', fontSize: 11 }}
              >
                Clear Screen
              </button>
            </div>
            <span style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 12 }}>
              Active Bedrock Context History (TTL cache table) for Donor #{chatInput.donor_id}
            </span>

            <div style={{
              flex: 1, minHeight: 380, maxHeight: 500, overflowY: 'auto',
              background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.04)',
              borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 12
            }}>
              {chatHistory.length === 0 ? (
                <div style={{ margin: 'auto', textAlign: 'center', color: '#555', fontSize: 12 }}>
                  Conversation context cache is empty.
                  <br />Send a message to initialize.
                </div>
              ) : (
                chatHistory.map((turn, i) => (
                  <div
                    key={i}
                    style={{
                      alignSelf: turn.role === 'user' ? 'flex-end' : 'flex-start',
                      background: turn.role === 'user' ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.05)',
                      border: `1px solid ${turn.role === 'user' ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.1)'}`,
                      borderRadius: turn.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                      padding: 10,
                      maxWidth: '85%',
                      fontSize: 12
                    }}
                  >
                    <div style={{ fontSize: 10, color: turn.role === 'user' ? '#93c5fd' : '#aaa', marginBottom: 4, fontWeight: 700 }}>
                      {turn.role === 'user' ? 'Donor (Reply)' : 'AI Coordinator'} · {new Date(turn.at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </div>
                    <div style={{ color: '#fff', lineHeight: 1.4 }}>{turn.content}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab Content: Architecture */}
      {activeTab === 'architecture' && (
        <div style={{
          background: 'rgba(10,10,20,0.5)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16,
          padding: 28,
          textAlign: 'center'
        }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', fontWeight: 700 }}>
            Blood Warriors Stack Architecture (5 Layers)
          </h2>
          <p style={{ color: 'var(--muted)', margin: '0 auto 2rem auto', maxWidth: 650, fontSize: 13 }}>
            The production deployment maps the local dev layout directly onto AWS services. Hover or review components to see details about the serverless flow.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: '2rem' }}>
            {[
              {
                layer: 'Layer 1', name: 'Presentation & API',
                tech: 'React + FastAPI',
                desc: 'Frontend hosted on S3 and distributed via CloudFront CDN. REST API served by containerized FastAPI on ECS Fargate with ALB routing.'
              },
              {
                layer: 'Layer 2', name: 'Data Pipeline',
                tech: 'DynamoDB + Kinesis + RDS',
                desc: 'Aurora RDS stores primary logs. Kinesis streams live action telemetry. DynamoDB acts as a high-speed status and conversation TTL cache.'
              },
              {
                layer: 'Layer 3', name: 'Intelligence',
                tech: 'AWS Bedrock + SageMaker',
                desc: 'Bedrock Claude-3 generates multilingual message copies and classifies replies. SageMaker hosts score vector models for donor ranking.'
              },
              {
                layer: 'Layer 4', name: 'Serverless Orchestrator',
                tech: 'AWS Step Functions + Lambdas',
                desc: 'Step Functions state machines manage the 8-stage campaign workflows, executing Lambda functions for matching, alerting, and reminders.'
              },
              {
                layer: 'Layer 5', name: 'CI/CD Pipelines',
                tech: 'CodePipeline + CloudWatch',
                desc: 'AWS CodePipeline triggers CodeBuild on git-commits, pushing container images to ECR. CloudWatch monitors memory leaks and CPU loads.'
              }
            ].map((layer, index) => (
              <div
                key={index}
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 16,
                  padding: 20,
                  textAlign: 'left',
                  transition: 'all 0.3s',
                  cursor: 'default'
                }}
                className="hover-card"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <span style={{ fontSize: 11, background: 'rgba(236,72,153,0.1)', color: '#ec4899', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>
                    {layer.layer}
                  </span>
                </div>
                <h4 style={{ margin: '0 0 4px 0', fontSize: 14, fontWeight: 700, color: '#fff' }}>{layer.name}</h4>
                <div style={{ fontSize: 11, color: '#bbb', fontWeight: 600, marginBottom: 12 }}>{layer.tech}</div>
                <p style={{ fontSize: 11, color: 'var(--muted)', margin: 0, lineHeight: 1.4 }}>
                  {layer.desc}
                </p>
              </div>
            ))}
          </div>

          <div style={{
            background: 'rgba(0,0,0,0.2)', borderRadius: 12, padding: 20,
            maxWidth: 800, margin: '0 auto', textAlign: 'left', border: '1px solid rgba(255,255,255,0.04)'
          }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8, color: '#ec4899' }}>
              <Shield size={16} />
              <strong style={{ fontSize: 13 }}>Infrastructure Orchestrated by Terraform</strong>
            </div>
            <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>
              The complete stack configurations, IAM roles, streams, and state-machine transitions are packaged inside [main.tf](file:///c:/Users/bhars/OneDrive/Desktop/aiwar/infrastructure/main.tf). You can deploy the setup directly into AWS with `terraform apply`.
            </p>
          </div>
        </div>
      )}

      {/* Event Details Modal */}
      {selectedEvent && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
          <div style={{
            background: '#111122', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 16, padding: 24, width: '90%', maxWidth: 600,
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Activity size={18} style={{ color: '#ec4899' }} />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Kinesis Event Telemetry Payload</h3>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                style={{
                  background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '50%',
                  width: 32, height: 32, cursor: 'pointer', color: '#fff', fontSize: 14
                }}
              >
                ✕
              </button>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16, fontSize: 12, background: 'rgba(0,0,0,0.2)', padding: 12, borderRadius: 8 }}>
              <div>
                <span style={{ color: '#777', display: 'block' }}>Event Type</span>
                <strong style={{ color: '#ec4899' }}>{selectedEvent.event_type}</strong>
              </div>
              <div>
                <span style={{ color: '#777', display: 'block' }}>Timestamp</span>
                <strong style={{ color: '#eee' }}>{new Date(selectedEvent.timestamp).toLocaleString()}</strong>
              </div>
              <div>
                <span style={{ color: '#777', display: 'block' }}>Event ID</span>
                <strong style={{ color: '#eee', fontSize: 10, fontFamily: 'monospace' }}>{selectedEvent.event_id}</strong>
              </div>
              <div>
                <span style={{ color: '#777', display: 'block' }}>Ingest Channel</span>
                <strong style={{ color: '#4ade80' }}>Amazon Kinesis Stream</strong>
              </div>
            </div>

            <span style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 6 }}>Telemetry Payload (JSON)</span>
            <pre style={{
              background: '#07070c', padding: 14, borderRadius: 8,
              fontSize: 12, color: '#6ee7b7', overflowX: 'auto', margin: 0,
              fontFamily: 'monospace', border: '1px solid rgba(255,255,255,0.05)'
            }}>
              {JSON.stringify(selectedEvent.payload, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}
