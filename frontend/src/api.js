const API_BASE = import.meta.env.VITE_API_URL || '/api/v1'

async function fetchJSON(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `API error: ${res.status}`)
  }
  return res.json()
}

export const api = {
  // Dashboard & Analytics
  dashboard: () => fetchJSON('/dashboard/v2'),
  analytics: () => fetchJSON('/analytics'),

  // Patients
  patients: (params = {}) => fetchJSON(`/patients?${new URLSearchParams(params)}`),
  createPatient: (body) => fetchJSON('/patients', { method: 'POST', body: JSON.stringify(body) }),
  getPatient: (id) => fetchJSON(`/patients/${id}`),

  // Donors
  donors: (params = {}) => fetchJSON(`/donors?${new URLSearchParams(params)}`),
  createDonor: (body) => fetchJSON('/donors', { method: 'POST', body: JSON.stringify(body) }),
  donorMemory: (id) => fetchJSON(`/donors/${id}/memory`),

  // Predictions
  predict: (patientId) => fetchJSON('/predict', { method: 'POST', body: JSON.stringify({ patient_id: patientId }) }),
  predictDirect: (form) => fetchJSON('/predict', {
    method: 'POST',
    body: JSON.stringify({
      last_transfusion_date: form.last_date || null,
      avg_gap_days: form.avg_gap_days || 21,
    })
  }),
  runPredictions: () => fetchJSON('/predictions/run', { method: 'POST' }),
  upcomingPredictions: (days = 30) => fetchJSON(`/predictions/upcoming?within_days=${days}`),
  storedPredictions: (params = {}) => fetchJSON(`/predictions/stored?${new URLSearchParams(params)}`),
  createRequestFromPrediction: (patientId) =>
    fetchJSON(`/predictions/${patientId}/create-request`, { method: 'POST' }),

  // Blood Requests
  requests: (status) => fetchJSON(`/requests${status ? `?status=${status}` : ''}`),
  createRequest: (body) => fetchJSON('/requests', { method: 'POST', body: JSON.stringify(body) }),
  getRequest: (id) => fetchJSON(`/requests/${id}`),

  // Matching
  match: (requestId) => fetchJSON('/match', { method: 'POST', body: JSON.stringify({ request_id: requestId }) }),
  getMatches: (requestId) => fetchJSON(`/requests/${requestId}/matches`),
  escalate: (requestId) => fetchJSON(`/requests/${requestId}/escalate`, { method: 'POST' }),

  // Outreach & Notifications
  generateMessage: (body) => fetchJSON('/generate-message', { method: 'POST', body: JSON.stringify(body) }),
  runOutreach: (requestId) => fetchJSON(`/requests/${requestId}/outreach`, { method: 'POST' }),
  approveOutreach: (requestId) => fetchJSON(`/requests/${requestId}/approve`, { method: 'POST' }),
  completeRequest: (requestId) => fetchJSON(`/requests/${requestId}/complete`, { method: 'POST' }),
  remind: (requestId) => fetchJSON(`/requests/${requestId}/remind`, { method: 'POST' }),
  confirmAppointment: (requestId) => fetchJSON(`/requests/${requestId}/confirm-appointment`, { method: 'POST' }),
  outreachStatus: (requestId) => fetchJSON(`/requests/${requestId}/outreach`),
  respondNotification: (notifId, response) =>
    fetchJSON(`/notifications/${notifId}/respond`, { method: 'POST', body: JSON.stringify({ response }) }),
  notifications: (params = {}) => fetchJSON(`/notifications?${new URLSearchParams(params)}`),
  getPatientAppointments: (patientId) => fetchJSON(`/patients/${patientId}/appointments`),
  completeDonation: (requestId) => fetchJSON(`/requests/${requestId}/complete-donation`, { method: 'POST' }),

  // Donor History & Smart Stats
  donorHistory: (donorId) => fetchJSON(`/donors/${donorId}/history`),

  // Pipeline Control
  pipelineStatus: () => fetchJSON('/pipeline/status'),
  pipelineRun: () => fetchJSON('/pipeline/run', { method: 'POST' }),
  pipelineStart: () => fetchJSON('/pipeline/start', { method: 'POST' }),
  pipelineStop: () => fetchJSON('/pipeline/stop', { method: 'POST' }),

  // Protocol Engine (feature page)
  protocol: () => fetchJSON('/protocol'),
  failures: () => fetchJSON('/protocol/failures'),
  simulateFailure: (bridgeId, bloodGroup) =>
    fetchJSON(`/protocol/failure?bridge_id=${bridgeId}&blood_group=${bloodGroup}`, { method: 'POST' }),

  // Bridges / Chat (feature pages)
  bridges: (limit = 50) => fetchJSON(`/bridges?limit=${limit}`),
  chat: (userId, message) =>
    fetchJSON('/chat', { method: 'POST', body: JSON.stringify({ user_id: userId, message }) }),
  outreach: (donorId, bloodGroup, bridgeId) =>
    fetchJSON(`/outreach?donor_id=${donorId}&blood_group=${bloodGroup}${bridgeId ? `&bridge_id=${bridgeId}` : ''}`, { method: 'POST' }),

  // Demo & Seed
  demoRahul: () => fetchJSON('/demo/rahul-story', { method: 'POST' }),
  seed: (force = false) => fetchJSON(`/seed?force=${force}`, { method: 'POST' }),

  // AWS Integrations
  awsStatus: () => fetchJSON('/aws/status'),
  awsKinesisEvents: (params = {}) => fetchJSON(`/aws/kinesis/events?${new URLSearchParams(params)}`),
  awsDynamoRuns: (params = {}) => fetchJSON(`/aws/dynamodb/runs?${new URLSearchParams(params)}`),
  awsDynamoConversation: (donorId) => fetchJSON(`/aws/dynamodb/conversations/${donorId}`),
  awsBedrockChat: (body) => fetchJSON('/aws/bedrock/chat', { method: 'POST', body: JSON.stringify(body) }),
  awsBedrockAnalyzeUrgency: (body) => fetchJSON('/aws/bedrock/analyze-urgency', { method: 'POST', body: JSON.stringify(body) }),
}

