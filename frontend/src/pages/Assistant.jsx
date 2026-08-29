import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { useEndpoint, useGrid } from '../state';
import { Badge, Card, Loading } from '../components/ui';
import { AssistantIcon, SparklesIcon } from '../components/icons';

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

  if (!suggestions) return <Loading what="AI assistant" />;

  return (
    <>
      <div className="page-head">
        <h2>GridFlex AI Assistant</h2>
        <p>
          Answers are computed directly from the live optimization plan, not generated freehand.
          {suggestions.backend === 'gemini'
            ? ' Gemini phrases the response using only the computed facts and is instructed never to invent numbers.'
            : ' Running on deterministic explainer engine — configure GEMINI_API_KEY for LLM natural language responses.'}
        </p>
      </div>

      <div className="row" style={{ marginBottom: 16 }}>
        <Badge severity={suggestions.backend === 'gemini' ? 'watch' : 'plain'}>
          {suggestions.backend === 'gemini' ? 'Gemini 1.5 Pro' : 'Explainer Engine'}
        </Badge>
        <span className="faint" style={{ fontSize: 12.5 }}>
          Context: <strong>{sim?.scenario?.label}</strong> at <strong>{sim?.label}</strong>
        </span>
        <div className="spacer" />
        <button className="btn ghost" onClick={() => setShowFacts((v) => !v)}>
          {showFacts ? 'Hide' : 'Show'} Context Facts
        </button>
      </div>

      {showFacts && facts && (
        <Card sub="This is the entire audited context passed to the assistant." className="pad-0" style={{ marginBottom: 18 }}>
          <pre style={{
            margin: 0, padding: 18, maxHeight: 300, overflow: 'auto',
            fontSize: 11.5, lineHeight: 1.6, color: 'var(--text-dim)', background: 'var(--bg-sunken)',
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
              <div className="row" style={{ marginBottom: 6, color: 'var(--watch)' }}>
                <AssistantIcon size={18} />
                <strong style={{ fontSize: 13 }}>GridFlex Assistant Ready</strong>
              </div>
              Ask me about the energy forecast, shortage predictions, battery dispatch, or demand response recommendations.
              I answer strictly from the current optimization plan.
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
          {busy && (
            <div className="msg bot faint">
              <div className="row">
                <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                <span>Thinking...</span>
              </div>
            </div>
          )}
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
          <button className="btn primary" type="submit" disabled={busy || !input.trim()}>
            <SparklesIcon size={16} />
            <span>Ask</span>
          </button>
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
