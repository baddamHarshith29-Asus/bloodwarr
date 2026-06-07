import { useState, useRef, useEffect } from 'react'
import { MessageSquare, Send, Trash2, User, Bot, Sparkles } from 'lucide-react'
import { api } from '../api'

const STARTER_PROMPTS = [
  "I can donate blood next Tuesday",
  "Is my blood type compatible with O Positive requests?",
  "When was my last donation?",
  "I'd like to help with the current urgent request",
  "What's my donation history?",
]

export default function Chat() {
  const [userId, setUserId]   = useState('donor-demo-001')
  const [messages, setMessages] = useState([])
  const [input, setInput]     = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const inputRef  = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const send = async (text) => {
    const userMsg = (text || input).trim()
    if (!userMsg) return
    setInput('')
    setMessages((m) => [...m, { role: 'user', content: userMsg }])
    setLoading(true)
    try {
      const res = await api.chat(userId, userMsg)
      setMessages((m) => [...m, { role: 'assistant', content: res.reply, memory: res.memory_used }])
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', content: `⚠️ Error: ${e.message}`, isError: true }])
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  const clearChat = () => {
    setMessages([])
    setUserId(id => id)
    inputRef.current?.focus()
  }

  return (
    <>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2><MessageSquare size={20} style={{ display: 'inline', marginRight: 10, color: 'var(--accent)' }} />Donor Conversational AI</h2>
          <p>Memory-enabled chat — BloodMind remembers context across sessions for personalized donor engagement</p>
        </div>
        {messages.length > 0 && (
          <button className="btn btn-secondary" onClick={clearChat} style={{ gap: 6 }}>
            <Trash2 size={14} /> Clear Chat
          </button>
        )}
      </div>

      <div className="innovation-banner">
        <h3><Sparkles size={14} style={{ display: 'inline', marginRight: 6 }} />Innovation #4: Vector Memory Conversations</h3>
        <p>
          Try: <em>"I can donate next Tuesday"</em> then later <em>"Is that still ok?"</em> — BloodMind stores conversation 
          context as vector embeddings and retrieves relevant memories for each new message, enabling continuity across sessions.
          Donor availability, preferences, and past commitments are remembered automatically.
        </p>
      </div>

      {/* User ID selector */}
      <div className="card" style={{ padding: '1.25rem 1.75rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ minWidth: 220, margin: 0, flex: 'none' }}>
            <label><User size={11} style={{ display: 'inline', marginRight: 4 }} />Donor User ID</label>
            <input
              value={userId}
              onChange={(e) => { setUserId(e.target.value); setMessages([]) }}
              placeholder="donor-demo-001"
            />
          </div>
          <div style={{ flex: 1, display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end', paddingBottom: 2 }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', width: '100%', marginBottom: 4 }}>Quick Prompts:</div>
            {STARTER_PROMPTS.map(p => (
              <button
                key={p}
                className="btn btn-secondary"
                style={{ fontSize: 11, padding: '0.25rem 0.65rem', borderRadius: 20 }}
                onClick={() => send(p)}
                disabled={loading}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chat area */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {/* Messages */}
        <div className="chat-messages" style={{ borderRadius: 0, border: 'none', height: 460, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          {messages.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '1rem', color: 'var(--muted)' }}>
              <Bot size={44} style={{ opacity: 0.2 }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Start a conversation</div>
                <div style={{ fontSize: 12 }}>Ask about donation availability, blood compatibility, or past requests</div>
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`chat-msg ${m.role}`}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem', flexDirection: m.role === 'user' ? 'row-reverse' : 'row' }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  background: m.role === 'user' ? 'linear-gradient(135deg, var(--accent), #b81624)' : 'rgba(58, 109, 124, 0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: `1px solid ${m.role === 'user' ? 'rgba(217,35,50,0.3)' : 'rgba(58,109,124,0.3)'}`,
                }}>
                  {m.role === 'user'
                    ? <User size={14} color="#fff" />
                    : <Bot size={14} color="#60a5fa" />
                  }
                </div>
                <div style={{ maxWidth: '75%' }}>
                  <div className="bubble" style={m.isError ? { borderColor: 'rgba(217,35,50,0.3)', color: 'var(--accent)' } : {}}>
                    {m.content}
                  </div>
                  {m.memory?.length > 0 && (
                    <div style={{ fontSize: '0.68rem', color: 'var(--muted)', marginTop: '0.3rem', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      <span style={{ color: 'var(--info)', fontWeight: 600 }}>🧠 Memory:</span>
                      {m.memory.map((mem, j) => (
                        <span key={j} style={{ background: 'rgba(58,109,124,0.1)', border: '1px solid rgba(58,109,124,0.2)', padding: '1px 6px', borderRadius: 4 }}>
                          {mem}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {loading && (
            <div className="chat-msg assistant">
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem' }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: 'rgba(58, 109, 124, 0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '1px solid rgba(58,109,124,0.3)',
                }}>
                  <Bot size={14} color="#60a5fa" />
                </div>
                <div className="bubble" style={{ padding: '0.75rem 1rem' }}>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    {[0, 0.2, 0.4].map(delay => (
                      <div key={delay} style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: 'var(--muted)',
                        animation: `typing-dot 1.2s ${delay}s infinite`,
                      }} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input row */}
        <div className="chat-input-row" style={{ padding: '1rem 1.5rem' }}>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="Type a message... (Enter to send)"
            disabled={loading}
            style={{ fontSize: 13.5 }}
          />
          <button className="btn btn-primary" onClick={() => send()} disabled={loading || !input.trim()}>
            <Send size={14} /> Send
          </button>
        </div>
      </div>

      <style>{`
        @keyframes typing-dot {
          0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
          30% { opacity: 1; transform: translateY(-3px); }
        }
      `}</style>
    </>
  )
}
