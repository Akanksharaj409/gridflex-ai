import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { useEndpoint, useGrid } from '../state';
import { Badge, Card, Loading } from '../components/ui';

export default function Assistant() {
  const { sim } = useGrid();
  const { data: suggestions } = useEndpoint(api.aiSuggestions);
  const [log, setLog] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [showFacts, setShowFacts] = useState(false);
  const { data: facts } = useEndpoint(api.aiFacts);
  const bottom = useRef(null);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth' }); }, [log, busy]);

  async function ask(question) {
    const q = question.trim();
    if (!q || busy) return;
    setInput('');
    setLog((l) => [...l, { role: 'user', text: q }]);
    setBusy(true);
    try {
      const res = await api.ask(q);
      setLog((l) => [...l, {
        role: 'bot', text: res.answer, source: res.source, model: res.model, note: res.note,
      }]);
    } catch (err) {
      setLog((l) => [...l, { role: 'bot', text: `Could not answer: ${err.message}`, source: 'error' }]);
    } finally {
      setBusy(false);
    }
  }

  if (!suggestions) return <Loading what="assistant" />;

  return (
    <>
      <div className="page-head">
        <h2>Assistant</h2>
        <p>
          Answers are computed from the live plan, not generated freehand.
          {suggestions.backend === 'gemini'
            ? ' Gemini phrases the response, but it is given only the computed facts and told not to invent numbers.'
            : ' Running on the deterministic explainer — set GEMINI_API_KEY to have Gemini phrase the same facts.'}
        </p>
      </div>

      <div className="row" style={{ marginBottom: 14 }}>
        <Badge severity={suggestions.backend === 'gemini' ? 'watch' : 'plain'}>
          {suggestions.backend === 'gemini' ? 'Gemini' : 'Explainer'}
        </Badge>
        <span className="faint" style={{ fontSize: 12 }}>
          Context: {sim?.scenario?.label} at {sim?.label}
        </span>
        <div className="spacer" />
        <button className="btn ghost" onClick={() => setShowFacts((v) => !v)}>
          {showFacts ? 'Hide' : 'Show'} the facts it can cite
        </button>
      </div>

      {showFacts && facts && (
        <Card sub="This is the entire context the assistant is given. Anything not here, it will not claim." className="pad-0" style={{ marginBottom: 16 }}>
          <pre style={{
            margin: 0, padding: 16, maxHeight: 320, overflow: 'auto',
            fontSize: 11.5, lineHeight: 1.6, color: 'var(--text-dim)',
          }}
          >
            {JSON.stringify(facts, null, 2)}
          </pre>
        </Card>
      )}

      <Card className="chat">
        <div className="chat-log">
          {log.length === 0 && (
            <div className="msg bot">
              Ask me about the forecast, the shortage, the battery, or what to do about any of it.
              I answer from the plan the optimiser just produced.
            </div>
          )}
          {log.map((m, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <div className={`msg ${m.role}`} key={i}>
              {m.text}
              {m.role === 'bot' && m.source && (
                <div className="meta">
                  {m.source === 'gemini' ? `Gemini ${m.model}` : m.source === 'error' ? 'error' : 'deterministic explainer'}
                  {m.note ? ` · ${m.note}` : ''}
                </div>
              )}
            </div>
          ))}
          {busy && <div className="msg bot faint">Thinking...</div>}
          <div ref={bottom} />
        </div>

        <form
          className="chat-input"
          onSubmit={(e) => { e.preventDefault(); ask(input); }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Why will there be a shortage this evening?"
            disabled={busy}
          />
          <button className="btn primary" type="submit" disabled={busy || !input.trim()}>Ask</button>
        </form>

        <div className="chips">
          {suggestions.questions.map((q) => (
            <button className="chip" key={q} onClick={() => ask(q)} disabled={busy}>{q}</button>
          ))}
        </div>
      </Card>
    </>
  );
}
