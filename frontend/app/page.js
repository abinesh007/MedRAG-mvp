'use client';
import { useState, useRef, useEffect } from 'react';

const SUGGESTIONS = [
  'Can I eat mango?',
  'Is grapefruit safe with my tablets?',
  'Can I have rice at night?',
  'Should I avoid alcohol?',
];

const WELCOME = {
  role: 'bot',
  text:
    "Hi! Upload the prescription and illness details on the left, then ask me about any food. " +
    "I answer from your own documents.",
};

export default function Home() {
  const [patient, setPatient] = useState('patient1');
  const [file, setFile] = useState(null);
  const [illness, setIllness] = useState('');
  const [status, setStatus] = useState({ text: '', error: false });
  const [uploading, setUploading] = useState(false);
  const [drawer, setDrawer] = useState(false);

  const [messages, setMessages] = useState([WELCOME]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const endRef = useRef(null);
  const boxRef = useRef(null);

  // Keep the newest message in view
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Auto-grow the message box
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 140) + 'px';
  }, [input]);

  const upload = async (e) => {
    e.preventDefault();
    if (!file && !illness.trim()) {
      setStatus({ text: 'Add a file or type the illness.', error: true });
      return;
    }
    const form = new FormData();
    form.append('patient_id', patient);
    form.append('illness', illness);
    if (file) form.append('file', file);

    setUploading(true);
    setStatus({ text: 'Saving...', error: false });
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      const data = await res.json();
      if (res.ok) {
        setStatus({ text: `Saved (${data.chunks} chunks). You can ask now.`, error: false });
        setDrawer(false);
      } else {
        setStatus({ text: data.error || 'Upload failed', error: true });
      }
    } catch {
      setStatus({ text: 'Could not reach the server.', error: true });
    }
    setUploading(false);
  };

  const send = async (text) => {
    const q = (text ?? input).trim();
    if (!q || loading) return;
    setMessages((m) => [...m, { role: 'user', text: q }]);
    setInput('');
    setLoading(true);
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, patient_id: patient }),
      });
      const data = await res.json();
      setMessages((m) => [
        ...m,
        { role: 'bot', text: data.answer || data.error || 'No answer received.', sources: data.sources },
      ]);
    } catch {
      setMessages((m) => [...m, { role: 'bot', text: 'Something went wrong. Is the backend running?' }]);
    }
    setLoading(false);
  };

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <>
      <div className="backdrop" />
      <svg className="ecg" viewBox="0 0 1200 120" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 60 H260 L290 60 L310 20 L335 100 L360 60 H620 L650 60 L670 15 L695 105 L720 60 H1200" />
      </svg>

      <div className="app">
        {/* ---------- Left panel: patient context ---------- */}
        <aside className={`card side ${drawer ? 'open' : ''}`}>
          <div className="brand">
            <div className="brand-icon">🩺</div>
            <div>
              <h1>Medical Food Assistant</h1>
              <p>Context-aware guidance from your prescription</p>
            </div>
          </div>

          <form onSubmit={upload} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label htmlFor="pid">Patient ID</label>
              <input id="pid" type="text" value={patient} onChange={(e) => setPatient(e.target.value)} />
            </div>

            <div>
              <label>📄 Prescription document</label>
              <label className="drop">
                <strong>{file ? file.name : 'Choose a file'}</strong>
                PDF, DOCX or TXT
                <input type="file" accept=".pdf,.docx,.txt" onChange={(e) => setFile(e.target.files[0] || null)} />
              </label>
            </div>

            <div>
              <label htmlFor="ill">💊 Illness / condition</label>
              <textarea
                id="ill"
                rows={3}
                value={illness}
                onChange={(e) => setIllness(e.target.value)}
                placeholder="e.g. Type 2 diabetes, hypertension"
              />
            </div>

            <button className="btn" type="submit" disabled={uploading}>
              {uploading ? 'Saving...' : 'Save patient context'}
            </button>
            <div className={`status ${status.error ? 'err' : ''}`}>{status.text}</div>
          </form>

          <div className="stack-note">
            <b>How it works:</b> your document is split into chunks, embedded, and stored locally.
            Each question retrieves the most relevant chunks before the model answers.
            <br />
            <br />
            Runs locally with Ollama, ChromaDB and Flask.
          </div>
        </aside>

        {/* ---------- Right panel: chat ---------- */}
        <main className="card chat">
          <div className="chat-head">
            <div>
              <h2>Ask about food and your medicines</h2>
              <span>Patient: {patient}</span>
            </div>
            <button className="menu-btn" onClick={() => setDrawer((d) => !d)} aria-label="Toggle patient panel">
              ☰
            </button>
          </div>

          <div className="messages">
            {messages.map((m, i) => (
              <div key={i} className={`msg ${m.role}`}>
                <div className="avatar">{m.role === 'user' ? '🧑' : '🤖'}</div>
                <div>
                  <div className="bubble">{m.text}</div>
                  {m.sources?.length > 0 && (
                    <details className="sources">
                      <summary>Show the document text used ({m.sources.length})</summary>
                      {m.sources.map((s, j) => (
                        <p key={j}>{s}</p>
                      ))}
                    </details>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="msg bot">
                <div className="avatar">🤖</div>
                <div className="bubble">
                  <span className="typing"><i /><i /><i /></span>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {messages.length === 1 && (
            <div className="chips">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="chip" onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          )}

          <div className="composer">
            <textarea
              ref={boxRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder="Can I eat mango with my current medicines?"
            />
            <button className="btn" onClick={() => send()} disabled={loading || !input.trim()}>
              Send
            </button>
          </div>
          <div className="disclaimer">
            Information assistant only. It does not replace your doctor or pharmacist.
          </div>
        </main>
      </div>
    </>
  );
}