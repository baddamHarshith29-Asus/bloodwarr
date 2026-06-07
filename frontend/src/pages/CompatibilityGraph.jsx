import { useState } from 'react'

const BLOOD_GROUPS = [
  { group: 'O Negative', x: 250, y: 50, desc: 'Universal Donor', bg: '#D92332' },
  { group: 'O Positive', x: 390, y: 110, desc: 'Compatible with O+, O-', bg: '#D92332' },
  { group: 'A Negative', x: 450, y: 250, desc: 'Compatible with A-, O-', bg: '#D92332' },
  { group: 'A Positive', x: 390, y: 390, desc: 'Compatible with A+, A-, O+, O-', bg: '#D92332' },
  { group: 'B Negative', x: 250, y: 450, desc: 'Compatible with B-, O-', bg: '#D92332' },
  { group: 'B Positive', x: 110, y: 390, desc: 'Compatible with B+, B-, O+, O-', bg: '#D92332' },
  { group: 'AB Negative', x: 50, y: 250, desc: 'Compatible with AB-, A-, B-, O-', bg: '#D92332' },
  { group: 'AB Positive', x: 110, y: 110, desc: 'Universal Recipient', bg: '#D92332' },
]

const COMPATIBILITY_RULES = {
  'O Negative': {
    canGiveTo: ['O Negative', 'O Positive', 'A Negative', 'A Positive', 'B Negative', 'B Positive', 'AB Negative', 'AB Positive'],
    canReceiveFrom: ['O Negative'],
  },
  'O Positive': {
    canGiveTo: ['O Positive', 'A Positive', 'B Positive', 'AB Positive'],
    canReceiveFrom: ['O Negative', 'O Positive'],
  },
  'A Negative': {
    canGiveTo: ['A Negative', 'A Positive', 'AB Negative', 'AB Positive'],
    canReceiveFrom: ['O Negative', 'A Negative'],
  },
  'A Positive': {
    canGiveTo: ['A Positive', 'AB Positive'],
    canReceiveFrom: ['O Negative', 'O Positive', 'A Negative', 'A Positive'],
  },
  'B Negative': {
    canGiveTo: ['B Negative', 'B Positive', 'AB Negative', 'AB Positive'],
    canReceiveFrom: ['O Negative', 'B Negative'],
  },
  'B Positive': {
    canGiveTo: ['B Positive', 'AB Positive'],
    canReceiveFrom: ['O Negative', 'O Positive', 'B Negative', 'B Positive'],
  },
  'AB Negative': {
    canGiveTo: ['AB Negative', 'AB Positive'],
    canReceiveFrom: ['O Negative', 'A Negative', 'B Negative', 'AB Negative'],
  },
  'AB Positive': {
    canGiveTo: ['AB Positive'],
    canReceiveFrom: ['O Negative', 'O Positive', 'A Negative', 'A Positive', 'B Negative', 'B Positive', 'AB Negative', 'AB Positive'],
  },
}

export default function CompatibilityGraph() {
  const [selectedGroup, setSelectedGroup] = useState('O Negative')
  const [mode, setMode] = useState('give') // 'give' or 'receive'
  const [testPatient, setTestPatient] = useState('A Positive')
  const [testDonor, setTestDonor] = useState('O Negative')

  const currentRules = COMPATIBILITY_RULES[selectedGroup]
  const connectedGroups = mode === 'give' ? currentRules.canGiveTo : currentRules.canReceiveFrom

  const isCompatible = (donor, patient) => {
    return COMPATIBILITY_RULES[patient].canReceiveFrom.includes(donor)
  }

  return (
    <>
      <div className="page-header">
        <h2>Biological Compatibility Graph</h2>
        <p>Interactive donor-recipient blood mapping engine with high contrast vector path rendering</p>
      </div>

      <div className="innovation-banner">
        <h3>🧬 Interactive Blood Graph Guidelines</h3>
        <p>
          Select a blood group from the network below to visualize compatibility flow. Lines colored in 
          <strong style={{ color: '#00e5ff' }}> Muted Teal (#3A6D7C)</strong> indicate donor pathways, and 
          <strong style={{ color: '#c084fc' }}> Soft Purple (#685A8A)</strong> indicate recipient pathways.
        </p>
      </div>

      <div className="grid-2">
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
          <div style={{ alignSelf: 'stretch', display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', zIndex: 5 }}>
            <h3 style={{ margin: 0 }}>Visual Network Map</h3>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button 
                className={`btn ${mode === 'give' ? 'btn-primary' : 'btn-secondary'}`} 
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                onClick={() => setMode('give')}
              >
                Can Donate To
              </button>
              <button 
                className={`btn ${mode === 'receive' ? 'btn-primary' : 'btn-secondary'}`} 
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                onClick={() => setMode('receive')}
              >
                Can Receive From
              </button>
            </div>
          </div>

          <div style={{ position: 'relative', width: '500px', height: '500px', maxWidth: '100%' }}>
            <svg width="100%" height="100%" viewBox="0 0 500 500" style={{ pointerEvents: 'all' }}>
              <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="28" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#3A6D7C" />
                </marker>
                <marker id="arrow-purple" viewBox="0 0 10 10" refX="28" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#685A8A" />
                </marker>
              </defs>

              {/* Draw Connections */}
              {BLOOD_GROUPS.map((source) => {
                return BLOOD_GROUPS.map((target) => {
                  const isMatch = mode === 'give' 
                    ? (source.group === selectedGroup && COMPATIBILITY_RULES[selectedGroup].canGiveTo.includes(target.group))
                    : (target.group === selectedGroup && COMPATIBILITY_RULES[selectedGroup].canReceiveFrom.includes(source.group))

                  if (!isMatch || source.group === target.group) return null

                  const strokeColor = mode === 'give' ? '#3A6D7C' : '#685A8A'
                  const markerId = mode === 'give' ? 'url(#arrow)' : 'url(#arrow-purple)'

                  return (
                    <line
                      key={`${source.group}-${target.group}`}
                      x1={source.x}
                      y1={source.y}
                      x2={target.x}
                      y2={target.y}
                      stroke={strokeColor}
                      strokeWidth={selectedGroup === source.group || selectedGroup === target.group ? 3 : 1}
                      strokeDasharray={selectedGroup === source.group || selectedGroup === target.group ? "none" : "5,5"}
                      opacity={selectedGroup === source.group || selectedGroup === target.group ? 0.95 : 0.25}
                      markerEnd={markerId}
                    />
                  )
                })
              })}

              {/* Draw Nodes */}
              {BLOOD_GROUPS.map((node) => {
                const isSelected = node.group === selectedGroup
                const isConnected = connectedGroups.includes(node.group)
                
                let glowColor = 'rgba(217, 35, 50, 0.2)'
                let borderColor = 'rgba(255, 255, 255, 0.15)'
                let nodeBg = 'rgba(34, 39, 54, 0.9)'

                if (isSelected) {
                  glowColor = 'rgba(217, 35, 50, 0.65)'
                  borderColor = '#D92332'
                  nodeBg = '#D92332'
                } else if (isConnected) {
                  glowColor = mode === 'give' ? 'rgba(58, 109, 124, 0.5)' : 'rgba(104, 90, 138, 0.5)'
                  borderColor = mode === 'give' ? '#3A6D7C' : '#685A8A'
                  nodeBg = 'rgba(21, 24, 33, 0.95)'
                }

                return (
                  <g 
                    key={node.group} 
                    transform={`translate(${node.x}, ${node.y})`}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelectedGroup(node.group)}
                  >
                    <circle 
                      r="25" 
                      fill={nodeBg} 
                      stroke={borderColor} 
                      strokeWidth="2" 
                      style={{
                        filter: isSelected || isConnected ? `drop-shadow(0 0 8px ${borderColor})` : 'none',
                        transition: 'all 0.3s'
                      }}
                    />
                    <text 
                      textAnchor="middle" 
                      dy=".3em" 
                      fill="#FFFFFF" 
                      fontSize="11px" 
                      fontWeight="700"
                      letterSpacing="-0.02em"
                    >
                      {node.group.replace(' Positive', '+').replace(' Negative', '-')}
                    </text>
                  </g>
                )
              })}
            </svg>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div className="card">
            <h3>Selected Group: <span style={{ color: '#D92332', marginLeft: '0.5rem' }}>{selectedGroup}</span></h3>
            <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              {BLOOD_GROUPS.find(n => n.group === selectedGroup)?.desc}
            </p>

            <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)', marginBottom: '0.5rem' }}>
              Can Donate To ({currentRules.canGiveTo.length} groups)
            </h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.5rem' }}>
              {currentRules.canGiveTo.map(g => (
                <span key={g} className="badge eligible" style={{ background: 'rgba(58, 109, 124, 0.1)', color: '#00e5ff', borderColor: 'rgba(58, 109, 124, 0.3)' }}>
                  {g}
                </span>
              ))}
            </div>

            <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)', marginBottom: '0.5rem' }}>
              Can Receive From ({currentRules.canReceiveFrom.length} groups)
            </h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {currentRules.canReceiveFrom.map(g => (
                <span key={g} className="badge staging" style={{ background: 'rgba(104, 90, 138, 0.1)', color: '#c084fc', borderColor: 'rgba(104, 90, 138, 0.3)' }}>
                  {g}
                </span>
              ))}
            </div>
          </div>

          <div className="card">
            <h3>Compatibility Quick Match</h3>
            <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              Simulate compatibility verification between a target patient and a donor prospect.
            </p>

            <div className="form-row">
              <div className="form-group">
                <label>Recipient Patient Group</label>
                <select value={testPatient} onChange={(e) => setTestPatient(e.target.value)}>
                  {BLOOD_GROUPS.map(n => <option key={n.group} value={n.group}>{n.group}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Donor Prospect Group</label>
                <select value={testDonor} onChange={(e) => setTestDonor(e.target.value)}>
                  {BLOOD_GROUPS.map(n => <option key={n.group} value={n.group}>{n.group}</option>)}
                </select>
              </div>
            </div>

            <div style={{ 
              marginTop: '1.5rem', 
              padding: '1rem', 
              borderRadius: '8px', 
              background: 'rgba(21, 24, 33, 0.6)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              border: '1px solid rgba(255, 255, 255, 0.05)'
            }}>
              {isCompatible(testDonor, testPatient) ? (
                <div style={{ textAlign: 'center', color: '#10B981' }}>
                  <strong style={{ fontSize: '1.1rem' }}>✓ BIOLOGICALLY COMPATIBLE</strong>
                  <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
                    {testDonor} can safely be transfused to {testPatient} recipient.
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', color: '#D92332' }}>
                  <strong style={{ fontSize: '1.1rem' }}>✗ NOT COMPATIBLE</strong>
                  <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
                    Risk of acute hemolytic reaction. {testDonor} cannot donate to {testPatient}.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
