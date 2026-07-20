import React, { useState, useEffect, useRef } from 'react';
import {
  getSession, createSession, addPollToSession, setSessionIndex, setSessionActive,
  getResponses, addResponse, loadTemplates, saveTemplate, deleteTemplate, revealPollAnswer,
} from './lib/db';

function makeCode() {
  return String(Math.floor(100000 + Math.random() * 900000)); // 6-digit numeric
}

function buildStaticUrl() {
  try {
    const url = new URL(window.location.href);
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch (e) {
    return '';
  }
}
const STATIC_URL = buildStaticUrl();
const STATIC_QR_SRC = STATIC_URL
  ? `https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=8&data=${encodeURIComponent(STATIC_URL)}`
  : null;

// The public QR/link never includes ?present=1, so scanning it only ever
// reaches the audience join screen — "Present a Session" isn't shown or
// reachable at all unless you're on the separate bookmarked presenter URL.
// This is obscurity, not real access control (there's no login system —
// see README), but it stops attendees from stumbling into presenter controls.
function isPresenterLink() {
  try {
    return new URLSearchParams(window.location.search).get('present') === '1';
  } catch (e) {
    return false;
  }
}
const IS_PRESENTER_LINK = isPresenterLink();

// ---------- AMERIND brand tokens ----------
// Navy #003882 and accent blue #2e75b6 are the only brand colors.
// Green/red below are functional status colors (live indicator, danger action), not brand palette.
const COLORS = {
  bg: '#F4F6F9',
  panel: '#FFFFFF',
  panelEdge: '#DDE4EC',
  navy: '#003882',
  accent: '#2E75B6',
  text: '#1B2733',
  textDim: '#5B6B7C',
  live: '#1E7E5A',
  danger: '#B3261E',
};

const fontDisplay = "'Domine', Georgia, serif";
const fontBody = "'Open Sans', system-ui, -apple-system, sans-serif";
const fontUtility = "ui-monospace, 'SF Mono', Menlo, monospace";

function Dot({ live }) {
  return (
    <span style={{
      display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
      background: live ? COLORS.live : COLORS.textDim,
      boxShadow: live ? `0 0 6px ${COLORS.live}88` : 'none',
      marginRight: 8,
    }} />
  );
}

function Panel({ children, style }) {
  return (
    <div style={{
      background: COLORS.panel, border: `1px solid ${COLORS.panelEdge}`,
      borderRadius: 10, padding: 20,
      boxShadow: '0 1px 3px rgba(0,56,130,0.06)',
      ...style,
    }}>
      {children}
    </div>
  );
}

function Button({ children, onClick, variant = 'primary', disabled, style }) {
  const base = {
    fontFamily: fontBody, fontWeight: 700, fontSize: 14, padding: '10px 18px',
    borderRadius: 8, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1, transition: 'transform 0.1s ease',
  };
  const variants = {
    primary: { background: COLORS.navy, color: '#FFFFFF' },
    ghost: { background: 'transparent', color: COLORS.navy, border: `1px solid ${COLORS.panelEdge}` },
    danger: { background: 'transparent', color: COLORS.danger, border: `1px solid ${COLORS.danger}55` },
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseDown={(e) => { if (!disabled) e.currentTarget.style.transform = 'scale(0.97)'; }}
      onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
      style={{ ...base, ...variants[variant], ...style }}
    >
      {children}
    </button>
  );
}

const POLL_TYPES = [
  { id: 'mc', label: 'Multiple Choice' },
  { id: 'cloud', label: 'Word Cloud' },
  { id: 'likert', label: 'Likert Scale' },
  { id: 'qa', label: 'Q&A (Upvote)' },
];
const LIKERT_LABELS = ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'];

// ---------- app shell ----------
export default function App() {
  const [role, setRole] = useState(IS_PRESENTER_LINK ? null : 'join'); // 'present' | 'join'

  return (
    <div style={{
      minHeight: '100vh', background: COLORS.bg, color: COLORS.text,
      fontFamily: fontBody, display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '32px 16px',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Domine:wght@400;600;700&family=Open+Sans:wght@400;600;700&display=swap');
        * { box-sizing: border-box; }
        input, select, textarea { font-family: inherit; }
        ::selection { background: ${COLORS.accent}33; }
        @keyframes riseIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .rise { animation: riseIn 0.25s ease both; }
      `}</style>

      <div style={{ width: '100%', maxWidth: 640 }}>
        <header style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 28, borderBottom: `3px solid ${COLORS.navy}`, paddingBottom: 14,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 6, background: COLORS.navy,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontFamily: fontDisplay, fontWeight: 700, fontSize: 15,
            }}>A</div>
            <div>
              <div style={{ fontFamily: fontDisplay, fontSize: 19, fontWeight: 700, color: COLORS.navy, lineHeight: 1.1 }}>
                AMERIND Live Poll
              </div>
              <div style={{ fontSize: 11, color: COLORS.textDim, letterSpacing: 0.4, textTransform: 'uppercase' }}>
                Risk Control · Training Engagement Tool
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {STATIC_QR_SRC && (
              <img
                src={STATIC_QR_SRC}
                alt="QR code linking to this tool"
                width={40} height={40}
                style={{ borderRadius: 6, border: `1px solid ${COLORS.panelEdge}` }}
              />
            )}
            {IS_PRESENTER_LINK && role && (
              <button
                onClick={() => setRole(null)}
                style={{ background: 'none', border: 'none', color: COLORS.textDim, fontSize: 13, cursor: 'pointer', fontFamily: fontBody }}
              >
                ← Start Over
              </button>
            )}
          </div>
        </header>

        {!role && <RoleSelect onSelect={setRole} />}
        {role === 'present' && <Presenter />}
        {role === 'join' && <Audience />}
      </div>
    </div>
  );
}

function RoleSelect({ onSelect }) {
  return (
    <div className="rise">
      <p style={{ color: COLORS.textDim, fontSize: 14, marginBottom: 20, lineHeight: 1.6 }}>
        Run a series of live polls during a Tribal training session. This link and QR never change — the presenter broadcasts a new 6-digit code for each session.
      </p>

      {STATIC_QR_SRC && (
        <Panel style={{ marginBottom: 16, display: 'flex', gap: 16, alignItems: 'center' }}>
          <img
            src={STATIC_QR_SRC}
            alt="QR code linking to this tool"
            width={90} height={90}
            style={{ borderRadius: 8, border: `1px solid ${COLORS.panelEdge}`, flexShrink: 0 }}
          />
          <div>
            <div style={{ fontSize: 12, color: COLORS.textDim, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, marginBottom: 4 }}>
              Permanent Entry Point
            </div>
            <div style={{ fontSize: 13, color: COLORS.textDim, lineHeight: 1.5 }}>
              Print this once, post it, or save it in a slide deck. Scanning it always brings you here — enter whatever code the presenter broadcasts that day.
            </div>
          </div>
        </Panel>
      )}

      <div style={{ display: 'grid', gap: 12 }}>
        <Panel style={{ cursor: 'pointer' }}>
          <div onClick={() => onSelect('present')}>
            <div style={{ fontFamily: fontDisplay, fontWeight: 700, fontSize: 16, color: COLORS.navy, marginBottom: 4 }}>
              Present a Session
            </div>
            <div style={{ fontSize: 13, color: COLORS.textDim }}>Create a series of polls, get a code to broadcast, and run them live.</div>
          </div>
        </Panel>
        <Panel style={{ cursor: 'pointer' }}>
          <div onClick={() => onSelect('join')}>
            <div style={{ fontFamily: fontDisplay, fontWeight: 700, fontSize: 16, color: COLORS.navy, marginBottom: 4 }}>
              Join with a Code
            </div>
            <div style={{ fontSize: 13, color: COLORS.textDim }}>Enter the 6-digit code the presenter is broadcasting right now.</div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

// ---------- shared poll builder ----------
function PollBuilder({ type, onTypeChange, question, setQuestion, options, setOptions, correctAnswer, setCorrectAnswer, onSubmit, submitLabel, onCancel }) {
  const updateOption = (i, val) => {
    const next = [...options];
    next[i] = val;
    if (correctAnswer && !next.includes(correctAnswer)) setCorrectAnswer(null);
    setOptions(next);
  };
  const needsOptions = type === 'mc' || type === 'likert';
  const canSubmit = question.trim().length > 0 && (!needsOptions || options.filter(o => o.trim()).length >= 2);

  const [templates, setTemplates] = useState([]);
  const [showSave, setShowSave] = useState(false);
  const [templateName, setTemplateName] = useState('');

  useEffect(() => {
    loadTemplates().then(setTemplates);
  }, []);

  const applyTemplate = (t) => {
    onTypeChange(t.type);
    setQuestion(t.question);
    setOptions(t.options && t.options.length ? [...t.options] : defaultOptionsFor(t.type));
    if (setCorrectAnswer) setCorrectAnswer(t.correctAnswer || null);
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) return;
    const entry = {
      name: templateName.trim(), type, question: question.trim(),
      options: options.filter(o => o.trim()), correctAnswer: correctAnswer || null,
    };
    const next = await saveTemplate(entry);
    setTemplates(next);
    setShowSave(false);
    setTemplateName('');
  };

  const handleDeleteTemplate = async (id) => {
    const next = await deleteTemplate(id);
    setTemplates(next);
  };

  return (
    <div>
      {templates.length > 0 && (
        <Panel style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, color: COLORS.textDim, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>
            Your Templates
          </label>
          <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
            {templates.map(t => (
              <div key={t.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                border: `1px solid ${COLORS.panelEdge}`, borderRadius: 8, padding: '8px 10px',
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>{t.name}</div>
                  <div style={{ fontSize: 11, color: COLORS.textDim, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {POLL_TYPES.find(pt => pt.id === t.type)?.label} · {t.question}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 8 }}>
                  <button
                    onClick={() => applyTemplate(t)}
                    style={{
                      background: 'none', border: `1px solid ${COLORS.navy}`, borderRadius: 6,
                      color: COLORS.navy, fontSize: 12, fontWeight: 700, padding: '4px 10px', cursor: 'pointer', fontFamily: fontBody,
                    }}
                  >
                    Use
                  </button>
                  <button
                    onClick={() => handleDeleteTemplate(t.id)}
                    aria-label="Delete template"
                    style={{ background: 'none', border: 'none', color: COLORS.textDim, cursor: 'pointer', fontSize: 14 }}
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <Panel style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 12, color: COLORS.textDim, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>
          Poll Type
        </label>
        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          {POLL_TYPES.map(t => (
            <button
              key={t.id}
              onClick={() => onTypeChange(t.id)}
              style={{
                padding: '8px 14px', borderRadius: 20, fontSize: 13, cursor: 'pointer',
                border: `1px solid ${type === t.id ? COLORS.navy : COLORS.panelEdge}`,
                background: type === t.id ? `${COLORS.navy}12` : 'transparent',
                color: type === t.id ? COLORS.navy : COLORS.textDim, fontFamily: fontBody, fontWeight: 700,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </Panel>

      <Panel style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 12, color: COLORS.textDim, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>
          Question
        </label>
        <textarea
          value={question}
          onChange={e => setQuestion(e.target.value)}
          placeholder={type === 'qa' ? "What should we cover next in this session?" : type === 'cloud' ? 'One word for how you feel about this topic' : type === 'likert' ? 'I feel confident applying this standard in the field' : 'Which finding is the highest priority?'}
          rows={2}
          style={{
            width: '100%', marginTop: 8, background: COLORS.bg, color: COLORS.text,
            border: `1px solid ${COLORS.panelEdge}`, borderRadius: 8, padding: 12, fontSize: 15, resize: 'vertical',
          }}
        />
        {needsOptions && (
          <div style={{ marginTop: 14 }}>
            <label style={{ fontSize: 12, color: COLORS.textDim, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>
              {type === 'likert' ? 'Scale Points' : 'Options'}
            </label>
            <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
              {options.map((opt, i) => (
                <div key={i} style={{ display: 'flex', gap: 6 }}>
                  <input
                    value={opt}
                    onChange={e => updateOption(i, e.target.value)}
                    placeholder={type === 'likert' ? `Point ${i + 1}` : `Option ${i + 1}`}
                    style={{
                      flex: 1, background: COLORS.bg, color: COLORS.text, border: `1px solid ${COLORS.panelEdge}`,
                      borderRadius: 8, padding: '10px 12px', fontSize: 14,
                    }}
                  />
                  {options.length > 2 && (
                    <button
                      onClick={() => setOptions(options.filter((_, j) => j !== i))}
                      aria-label="Remove"
                      style={{
                        background: 'none', border: `1px solid ${COLORS.panelEdge}`, borderRadius: 8,
                        color: COLORS.textDim, cursor: 'pointer', width: 36, fontSize: 16, fontFamily: fontBody,
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={() => setOptions([...options, ''])}
              style={{ marginTop: 8, background: 'none', border: 'none', color: COLORS.accent, fontSize: 13, cursor: 'pointer', fontFamily: fontBody, fontWeight: 700 }}
            >
              + Add {type === 'likert' ? 'Scale Point' : 'Option'}
            </button>
          </div>
        )}

        {type === 'mc' && options.filter(o => o.trim()).length >= 2 && (
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${COLORS.panelEdge}` }}>
            <label style={{ fontSize: 12, color: COLORS.textDim, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>
              Correct Answer (optional — enables quiz mode)
            </label>
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              {options.filter(o => o.trim()).map(opt => (
                <button
                  key={opt}
                  onClick={() => setCorrectAnswer(correctAnswer === opt ? null : opt)}
                  style={{
                    padding: '6px 12px', borderRadius: 16, fontSize: 12, cursor: 'pointer', fontFamily: fontBody, fontWeight: 700,
                    border: `1px solid ${correctAnswer === opt ? COLORS.live : COLORS.panelEdge}`,
                    background: correctAnswer === opt ? `${COLORS.live}15` : 'transparent',
                    color: correctAnswer === opt ? COLORS.live : COLORS.textDim,
                  }}
                >
                  {opt}{correctAnswer === opt ? ' ✓' : ''}
                </button>
              ))}
            </div>
          </div>
        )}
      </Panel>

      {showSave ? (
        <Panel style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, color: COLORS.textDim, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>
            Template Name
          </label>
          <input
            value={templateName}
            onChange={e => setTemplateName(e.target.value)}
            placeholder="e.g. Post-Training Confidence Check"
            onKeyDown={e => e.key === 'Enter' && handleSaveTemplate()}
            style={{
              display: 'block', width: '100%', marginTop: 8, background: COLORS.bg, color: COLORS.text,
              border: `1px solid ${COLORS.panelEdge}`, borderRadius: 8, padding: '10px 12px', fontSize: 14,
            }}
          />
          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            <Button onClick={handleSaveTemplate} disabled={!templateName.trim()}>Save Template</Button>
            <Button variant="ghost" onClick={() => { setShowSave(false); setTemplateName(''); }}>Cancel</Button>
          </div>
        </Panel>
      ) : (
        <button
          onClick={() => setShowSave(true)}
          disabled={!canSubmit}
          style={{
            display: 'block', marginBottom: 12, background: 'none', border: 'none',
            color: canSubmit ? COLORS.accent : COLORS.textDim, fontSize: 13, cursor: canSubmit ? 'pointer' : 'not-allowed',
            fontFamily: fontBody, fontWeight: 700, opacity: canSubmit ? 1 : 0.5,
          }}
        >
          💾 Save as Template
        </button>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <Button onClick={onSubmit} disabled={!canSubmit}>{submitLabel}</Button>
        {onCancel && <Button variant="ghost" onClick={onCancel}>Cancel</Button>}
      </div>
    </div>
  );
}

function freshOptions() { return ['', '']; }
function defaultOptionsFor(type) {
  if (type === 'mc') return ['', ''];
  if (type === 'likert') return [...LIKERT_LABELS];
  return [];
}

// ---------- presenter ----------
function Presenter() {
  const [stage, setStage] = useState('build'); // build | live
  const [type, setType] = useState('mc');
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(freshOptions());
  const [code, setCode] = useState(null);
  const [session, setSession] = useState(null);
  const [responses, setResponses] = useState([]);
  const [status, setStatus] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [correctAnswer, setCorrectAnswer] = useState(null);
  const [projecting, setProjecting] = useState(false);
  const [draftPolls, setDraftPolls] = useState([]);
  const [showResume, setShowResume] = useState(false);
  const [resumeInput, setResumeInput] = useState('');
  const [resumeError, setResumeError] = useState('');
  const pollTimer = useRef(null);

  const resumeSession = async () => {
    const c = resumeInput.trim();
    if (c.length !== 6) { setResumeError('Please enter the 6-digit code.'); return; }
    setResumeError('');
    const sess = await getSession(c);
    if (!sess) { setResumeError('No session was found for that code.'); return; }
    setCode(c);
    setSession(sess);
    setStage('live');
  };

  const handleTypeChange = (t) => {
    setType(t);
    setOptions(defaultOptionsFor(t));
    setCorrectAnswer(null);
  };

  const finalOptions = (t, opts) => (t === 'mc' || t === 'likert') ? opts.filter(o => o.trim()) : [];

  const currentDraft = () => ({
    type, question: question.trim(), options: finalOptions(type, options),
    correctAnswer: type === 'mc' ? (correctAnswer || null) : null,
  });

  const addDraftPoll = () => {
    setDraftPolls([...draftPolls, currentDraft()]);
    setQuestion(''); setOptions(freshOptions()); setType('mc'); setCorrectAnswer(null);
  };

  const removeDraftPoll = (idx) => {
    setDraftPolls(draftPolls.filter((_, i) => i !== idx));
  };

  const launch = async () => {
    const pending = question.trim() ? [currentDraft()] : [];
    const polls = [...draftPolls, ...pending];
    if (polls.length === 0) { setStatus('Add at least one question before launching.'); return; }
    setStatus('Creating session…');
    const newCode = makeCode();
    const sess = await createSession(newCode, polls);
    if (!sess) { setStatus('Session could not be created — please try again.'); return; }
    setCode(newCode);
    setSession(sess);
    setDraftPolls([]);
    setStage('live');
  };

  const addPollToSeries = async () => {
    const poll = { type, question: question.trim(), options: finalOptions(type, options), correctAnswer: type === 'mc' ? (correctAnswer || null) : null };
    const nextIdx = session.polls.length;
    const updated = await addPollToSession(code, poll, nextIdx);
    if (!updated) return;
    setSession(updated);
    setShowAdd(false);
    setQuestion(''); setOptions(freshOptions()); setType('mc'); setCorrectAnswer(null);
  };

  const goTo = async (idx) => {
    if (!session || idx < 0 || idx >= session.polls.length) return;
    await setSessionIndex(code, idx);
    setSession({ ...session, currentIndex: idx });
  };

  const endSession = async () => {
    await setSessionActive(code, false);
    setSession({ ...session, active: false });
    if (pollTimer.current) clearInterval(pollTimer.current);
  };

  const revealAnswer = async () => {
    if (!currentPoll) return;
    const ok = await revealPollAnswer(currentPoll.id);
    if (!ok) return;
    const polls = session.polls.map(p => p.id === currentPoll.id ? { ...p, revealed: true } : p);
    setSession({ ...session, polls });
  };

  const downloadResults = async () => {
    const escapeCsv = (val) => {
      const s = String(val ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = [['Question #', 'Poll Type', 'Question', 'Correct Answer', 'Response', 'Is Correct', 'Votes', 'Submitted At']];
    for (let i = 0; i < session.polls.length; i++) {
      const p = session.polls[i];
      const typeLabel = (POLL_TYPES.find(t => t.id === p.type) || {}).label || p.type;
      const list = await getResponses(p.id);
      if (list.length === 0) {
        rows.push([i + 1, typeLabel, p.question, p.correctAnswer || '', '', '', '', '']);
        continue;
      }
      list.forEach(r => {
        rows.push([
          i + 1,
          typeLabel,
          p.question,
          p.correctAnswer || '',
          r.value,
          p.correctAnswer ? (r.value === p.correctAnswer ? 'Yes' : 'No') : '',
          p.type === 'qa' ? (r.votes || 0) : '',
          new Date(r.ts).toISOString(),
        ]);
      });
    }
    const csv = rows.map(row => row.map(escapeCsv).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `amerind-poll-session-${code}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const newSession = () => {
    if (pollTimer.current) clearInterval(pollTimer.current);
    setStage('build'); setCode(null); setSession(null); setResponses([]);
    setQuestion(''); setOptions(freshOptions()); setType('mc'); setShowAdd(false);
    setCorrectAnswer(null); setProjecting(false); setDraftPolls([]);
  };

  const currentPoll = session ? session.polls[session.currentIndex] : null;

  useEffect(() => {
    if (stage !== 'live' || !code || !currentPoll) return;
    const tick = async () => {
      const s = await getSession(code);
      if (s) setSession(s);
      const r = await getResponses(currentPoll.id);
      setResponses(r);
    };
    tick();
    pollTimer.current = setInterval(tick, 1500);
    return () => clearInterval(pollTimer.current);
  }, [stage, code, currentPoll && currentPoll.id]);

  if (stage === 'build') {
    return (
      <div className="rise">
        {showResume ? (
          <Panel style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, color: COLORS.textDim, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>
              Resume Session — Enter Its Code
            </label>
            <input
              value={resumeInput}
              onChange={e => setResumeInput(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="123456"
              inputMode="numeric"
              maxLength={6}
              onKeyDown={e => e.key === 'Enter' && resumeSession()}
              style={{
                display: 'block', width: '100%', marginTop: 10, background: COLORS.bg, color: COLORS.text,
                border: `1px solid ${COLORS.panelEdge}`, borderRadius: 8, padding: '14px 12px',
                fontFamily: fontUtility, fontSize: 24, letterSpacing: 6, textAlign: 'center',
              }}
            />
            {resumeError && <div style={{ color: COLORS.danger, fontSize: 13, marginTop: 10 }}>{resumeError}</div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <Button onClick={resumeSession}>Resume</Button>
              <Button variant="ghost" onClick={() => { setShowResume(false); setResumeInput(''); setResumeError(''); }}>Cancel</Button>
            </div>
          </Panel>
        ) : (
          <button
            onClick={() => setShowResume(true)}
            style={{
              display: 'block', marginBottom: 16, background: 'none', border: 'none',
              color: COLORS.accent, fontSize: 13, cursor: 'pointer', fontFamily: fontBody, fontWeight: 700,
            }}
          >
            Built a session earlier? Resume it with its code →
          </button>
        )}

        {draftPolls.length > 0 && (
          <Panel style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, color: COLORS.textDim, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>
              Questions Queued ({draftPolls.length})
            </label>
            <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
              {draftPolls.map((p, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  border: `1px solid ${COLORS.panelEdge}`, borderRadius: 8, padding: '8px 10px',
                }}>
                  <div style={{ minWidth: 0 }}>
                    <span style={{ fontFamily: fontUtility, fontSize: 11, color: COLORS.textDim, marginRight: 8 }}>#{i + 1}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>
                      {(POLL_TYPES.find(pt => pt.id === p.type) || {}).label}
                    </span>
                    <div style={{ fontSize: 12, color: COLORS.textDim, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.question}
                    </div>
                  </div>
                  <button
                    onClick={() => removeDraftPoll(i)}
                    aria-label="Remove"
                    style={{ background: 'none', border: 'none', color: COLORS.textDim, cursor: 'pointer', fontSize: 16, flexShrink: 0, marginLeft: 8 }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </Panel>
        )}

        <PollBuilder
          type={type} onTypeChange={handleTypeChange}
          question={question} setQuestion={setQuestion}
          options={options} setOptions={setOptions}
          correctAnswer={correctAnswer} setCorrectAnswer={setCorrectAnswer}
          onSubmit={addDraftPoll}
          submitLabel="+ Add to Session"
        />

        <div style={{ marginTop: 4 }}>
          <Button onClick={launch} disabled={draftPolls.length === 0 && !question.trim()}>
            Launch Session {draftPolls.length > 0 ? `(${draftPolls.length} Question${draftPolls.length === 1 ? '' : 's'})` : ''} →
          </Button>
        </div>
        {status && <div style={{ marginTop: 10, fontSize: 13, color: COLORS.textDim }}>{status}</div>}
      </div>
    );
  }

  if (projecting) {
    return (
      <div className="rise" key={currentPoll.id}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {STATIC_QR_SRC && (
              <img
                src={STATIC_QR_SRC}
                alt="QR code linking to this tool"
                width={44} height={44}
                style={{ borderRadius: 6, border: `1px solid ${COLORS.panelEdge}` }}
              />
            )}
            <div style={{ fontFamily: fontUtility, fontSize: 22, fontWeight: 700, color: COLORS.navy, letterSpacing: 3 }}>
              {code}
            </div>
          </div>
          <button
            onClick={() => setProjecting(false)}
            style={{ background: 'none', border: 'none', color: COLORS.textDim, fontSize: 13, cursor: 'pointer', fontFamily: fontBody }}
          >
            Exit Projector View
          </button>
        </div>

        <Panel style={{ padding: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <span style={{ fontSize: 12, color: COLORS.textDim, fontFamily: fontUtility, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Question {session.currentIndex + 1} of {session.polls.length}
            </span>
            <span style={{ display: 'flex', alignItems: 'center' }}>
              <Dot live={session.active} />
              <span style={{ fontSize: 12, color: COLORS.textDim, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>
                {responses.length} Response{responses.length === 1 ? '' : 's'}
              </span>
            </span>
          </div>
          <div style={{ fontFamily: fontDisplay, fontWeight: 700, fontSize: 30, color: COLORS.text, marginBottom: 28, lineHeight: 1.25 }}>
            {currentPoll.question}
          </div>
          <ResultsView type={currentPoll.type} options={currentPoll.options} responses={responses} correctAnswer={currentPoll.correctAnswer} revealed={currentPoll.revealed} />
          {currentPoll.type === 'mc' && currentPoll.correctAnswer && !currentPoll.revealed && (
            <Button onClick={revealAnswer} style={{ marginTop: 16 }}>Reveal Correct Answer</Button>
          )}
        </Panel>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 18 }}>
          <Button variant="ghost" onClick={() => goTo(session.currentIndex - 1)} disabled={session.currentIndex === 0}>← Previous</Button>
          <Button variant="ghost" onClick={() => goTo(session.currentIndex + 1)} disabled={session.currentIndex >= session.polls.length - 1}>Next →</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rise">
      <Panel style={{ marginBottom: 16, textAlign: 'center', borderTop: `3px solid ${COLORS.navy}` }}>
        {STATIC_QR_SRC && (
          <img
            src={STATIC_QR_SRC}
            alt="QR code linking to this tool"
            width={120} height={120}
            style={{ borderRadius: 8, border: `1px solid ${COLORS.panelEdge}`, marginBottom: 14 }}
          />
        )}
        <div style={{ fontSize: 12, color: COLORS.textDim, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, fontWeight: 700 }}>
          Broadcast This Code
        </div>
        <div style={{ fontFamily: fontUtility, fontSize: 48, fontWeight: 700, letterSpacing: 6, color: COLORS.navy }}>
          {code}
        </div>
        <div style={{ fontSize: 12, color: COLORS.textDim, marginTop: 6 }}>
          Scan the QR to open the tool, then enter this code
        </div>
        <div style={{ marginTop: 10, fontSize: 11, color: COLORS.textDim }}>
          This code stays valid for every question in this session — no need to rescan between questions.
        </div>
      </Panel>

      <Panel style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Dot live={session.active} />
            <span style={{ fontSize: 12, color: COLORS.textDim, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>
              {session.active ? `Live — ${responses.length} Response${responses.length === 1 ? '' : 's'}` : 'Session Ended'}
            </span>
          </div>
          <span style={{ fontSize: 12, color: COLORS.textDim, fontFamily: fontUtility }}>
            Question {session.currentIndex + 1} of {session.polls.length}
          </span>
        </div>
        <div style={{ fontFamily: fontDisplay, fontWeight: 700, fontSize: 18, margin: '10px 0 18px', color: COLORS.text }}>
          {currentPoll.question}
        </div>
        <ResultsView type={currentPoll.type} options={currentPoll.options} responses={responses} correctAnswer={currentPoll.correctAnswer} revealed={currentPoll.revealed} />
        {currentPoll.type === 'mc' && currentPoll.correctAnswer && !currentPoll.revealed && (
          <Button onClick={revealAnswer} style={{ marginTop: 16 }}>Reveal Correct Answer</Button>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20, paddingTop: 16, borderTop: `1px solid ${COLORS.panelEdge}` }}>
          <Button variant="ghost" onClick={() => goTo(session.currentIndex - 1)} disabled={session.currentIndex === 0}>← Previous</Button>
          <Button variant="ghost" onClick={() => goTo(session.currentIndex + 1)} disabled={session.currentIndex >= session.polls.length - 1}>Next →</Button>
        </div>
      </Panel>

      {showAdd ? (
        <Panel style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: fontDisplay, fontWeight: 700, fontSize: 15, color: COLORS.navy, marginBottom: 12 }}>
            Add the Next Question
          </div>
          <PollBuilder
            type={type} onTypeChange={handleTypeChange}
            question={question} setQuestion={setQuestion}
            options={options} setOptions={setOptions}
            correctAnswer={correctAnswer} setCorrectAnswer={setCorrectAnswer}
            onSubmit={addPollToSeries}
            submitLabel="Add & Go Live"
            onCancel={() => { setShowAdd(false); setQuestion(''); setOptions(freshOptions()); setType('mc'); setCorrectAnswer(null); }}
          />
        </Panel>
      ) : (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {session.active && <Button onClick={() => setShowAdd(true)}>+ Add Question to Series</Button>}
          <Button variant="ghost" onClick={() => setProjecting(true)}>🖥 Projector View</Button>
          <Button variant="ghost" onClick={downloadResults}>⬇ Download Results (CSV)</Button>
          {session.active && <Button variant="danger" onClick={endSession}>End Session</Button>}
          <Button variant="ghost" onClick={newSession}>New Session</Button>
        </div>
      )}
    </div>
  );
}

// ---------- results rendering ----------
function ResultsView({ type, options, responses, correctAnswer, revealed }) {
  if (responses.length === 0) {
    return <div style={{ color: COLORS.textDim, fontSize: 14, fontStyle: 'italic' }}>Waiting for responses…</div>;
  }

  if (type === 'mc') {
    const counts = {};
    options.forEach(o => counts[o] = 0);
    responses.forEach(r => { if (counts[r.value] !== undefined) counts[r.value]++; });
    const max = Math.max(1, ...Object.values(counts));
    const total = responses.length;
    const showAnswer = !!correctAnswer && !!revealed;
    const pctCorrect = showAnswer ? Math.round(((counts[correctAnswer] || 0) / total) * 100) : null;
    return (
      <div>
        {correctAnswer && !revealed && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, padding: '8px 12px',
            background: `${COLORS.textDim}0d`, border: `1px solid ${COLORS.panelEdge}`, borderRadius: 8,
          }}>
            <span style={{ fontSize: 12, color: COLORS.textDim, fontStyle: 'italic' }}>
              Quiz mode — correct answer hidden until you reveal it
            </span>
          </div>
        )}
        {showAnswer && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, padding: '8px 12px',
            background: `${COLORS.live}12`, border: `1px solid ${COLORS.live}33`, borderRadius: 8,
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.live }}>✓ {pctCorrect}% Correct</span>
            <span style={{ fontSize: 12, color: COLORS.textDim }}>— correct answer: {correctAnswer}</span>
          </div>
        )}
        <div style={{ display: 'grid', gap: 12 }}>
          {options.map(opt => {
            const isCorrect = showAnswer && correctAnswer === opt;
            return (
              <div key={opt}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span style={{ fontWeight: isCorrect ? 700 : 400, color: isCorrect ? COLORS.live : COLORS.text }}>
                    {opt}{isCorrect ? ' ✓' : ''}
                  </span>
                  <span style={{ fontFamily: fontUtility, color: COLORS.textDim }}>{counts[opt]}</span>
                </div>
                <div style={{ height: 10, background: COLORS.bg, borderRadius: 6, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${(counts[opt] / max) * 100}%`,
                    background: isCorrect ? COLORS.live : COLORS.navy, borderRadius: 6, transition: 'width 0.4s ease',
                  }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (type === 'likert') {
    const counts = {};
    options.forEach(l => counts[l] = 0);
    responses.forEach(r => { if (counts[r.value] !== undefined) counts[r.value]++; });
    const max = Math.max(1, ...Object.values(counts));
    return (
      <div style={{ display: 'grid', gap: 10 }}>
        {options.map(label => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 130, fontSize: 12, color: COLORS.textDim, textAlign: 'right' }}>{label}</div>
            <div style={{ flex: 1, height: 16, background: COLORS.bg, borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${(counts[label] / max) * 100}%`,
                background: COLORS.accent, transition: 'width 0.4s ease',
              }} />
            </div>
            <div style={{ width: 20, fontFamily: fontUtility, fontSize: 12, color: COLORS.textDim }}>{counts[label]}</div>
          </div>
        ))}
      </div>
    );
  }

  if (type === 'cloud') {
    const freq = {};
    responses.forEach(r => {
      const w = (r.value || '').trim().toLowerCase();
      if (w) freq[w] = (freq[w] || 0) + 1;
    });
    const entries = Object.entries(freq).sort((a, b) => b[1] - a[1]);
    const max = Math.max(1, ...entries.map(e => e[1]));
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 14px', alignItems: 'baseline', padding: '8px 0' }}>
        {entries.map(([word, count]) => {
          const scale = 0.5 + (count / max) * 1.3;
          return (
            <span key={word} style={{
              fontFamily: fontDisplay,
              fontSize: `${14 * scale}px`, fontWeight: count === max ? 700 : 600,
              color: count === max ? COLORS.navy : COLORS.text, opacity: 0.55 + 0.45 * (count / max),
            }}>
              {word}
            </span>
          );
        })}
      </div>
    );
  }

  if (type === 'qa') {
    const sorted = [...responses].sort((a, b) => (b.votes || 0) - (a.votes || 0));
    return (
      <div style={{ display: 'grid', gap: 8 }}>
        {sorted.map(r => (
          <div key={r.id} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: COLORS.bg, border: `1px solid ${COLORS.panelEdge}`, borderRadius: 8, padding: '10px 12px',
          }}>
            <span style={{ fontSize: 14 }}>{r.value}</span>
            <span style={{ fontFamily: fontUtility, fontSize: 13, color: COLORS.accent, fontWeight: 700 }}>▲ {r.votes || 0}</span>
          </div>
        ))}
      </div>
    );
  }

  return null;
}

// ---------- audience ----------
function Audience() {
  const [codeInput, setCodeInput] = useState('');
  const [code, setCode] = useState(null);
  const [session, setSession] = useState(null);
  const [error, setError] = useState('');
  const [answered, setAnswered] = useState(() => new Set());
  const [textVal, setTextVal] = useState('');
  const pollTimer = useRef(null);

  const join = async () => {
    const c = codeInput.trim();
    if (c.length !== 6) { setError('Please enter the 6-digit code.'); return; }
    setError('');
    const sess = await getSession(c);
    if (!sess) { setError('No session was found for that code.'); return; }
    setSession(sess);
    setCode(c);
  };

  useEffect(() => {
    if (!code) return;
    const tick = async () => {
      const sess = await getSession(code);
      if (sess) setSession(sess);
    };
    pollTimer.current = setInterval(tick, 1200);
    return () => clearInterval(pollTimer.current);
  }, [code]);

  const currentPoll = session ? session.polls[session.currentIndex] : null;

  const submit = async (value) => {
    if (!currentPoll) return;
    await addResponse(currentPoll.id, value);
    setAnswered(prev => new Set(prev).add(currentPoll.id));
    setTextVal('');
  };

  if (!code) {
    return (
      <div className="rise">
        <Panel>
          <label style={{ fontSize: 12, color: COLORS.textDim, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>
            Join Code
          </label>
          <input
            value={codeInput}
            onChange={e => setCodeInput(e.target.value.replace(/[^0-9]/g, ''))}
            placeholder="123456"
            inputMode="numeric"
            maxLength={6}
            onKeyDown={e => e.key === 'Enter' && join()}
            style={{
              display: 'block', width: '100%', marginTop: 10, background: COLORS.bg, color: COLORS.text,
              border: `1px solid ${COLORS.panelEdge}`, borderRadius: 8, padding: '14px 12px',
              fontFamily: fontUtility, fontSize: 24, letterSpacing: 6, textAlign: 'center',
            }}
          />
          {error && <div style={{ color: COLORS.danger, fontSize: 13, marginTop: 10 }}>{error}</div>}
          <Button onClick={() => join()} style={{ marginTop: 14, width: '100%' }}>Join</Button>
        </Panel>
      </div>
    );
  }

  if (!session || !session.active) {
    return <Panel className="rise"><div style={{ color: COLORS.textDim }}>This session has ended.</div></Panel>;
  }

  if (!currentPoll) {
    return <Panel className="rise"><div style={{ color: COLORS.textDim }}>Waiting for the first question…</div></Panel>;
  }

  if (answered.has(currentPoll.id)) {
    return (
      <Panel className="rise">
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
          <Dot live />
          <span style={{ fontSize: 13, color: COLORS.textDim }}>Response received — thank you.</span>
        </div>
        <div style={{ fontSize: 15, color: COLORS.text }}>Watch the presenter's screen for live results. This page will update automatically when the next question opens.</div>
      </Panel>
    );
  }

  return (
    <div className="rise" key={currentPoll.id}>
      <Panel>
        <div style={{ fontSize: 11, color: COLORS.textDim, marginBottom: 8, fontFamily: fontUtility, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Question {session.currentIndex + 1} of {session.polls.length}
        </div>
        <div style={{ fontFamily: fontDisplay, fontWeight: 700, fontSize: 18, marginBottom: 18, color: COLORS.text }}>
          {currentPoll.question}
        </div>

        {currentPoll.type === 'mc' && (
          <div style={{ display: 'grid', gap: 10 }}>
            {currentPoll.options.map(opt => (
              <button
                key={opt}
                onClick={() => submit(opt)}
                style={{
                  textAlign: 'left', padding: '12px 14px', borderRadius: 8, cursor: 'pointer',
                  border: `1px solid ${COLORS.panelEdge}`, background: COLORS.bg, color: COLORS.text,
                  fontSize: 15, fontFamily: fontBody,
                }}
              >
                {opt}
              </button>
            ))}
          </div>
        )}

        {currentPoll.type === 'likert' && (
          <div style={{ display: 'grid', gap: 10 }}>
            {currentPoll.options.map(label => (
              <button
                key={label}
                onClick={() => submit(label)}
                style={{
                  textAlign: 'left', padding: '12px 14px', borderRadius: 8, cursor: 'pointer',
                  border: `1px solid ${COLORS.panelEdge}`, background: COLORS.bg, color: COLORS.text,
                  fontSize: 15, fontFamily: fontBody,
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {(currentPoll.type === 'cloud' || currentPoll.type === 'qa') && (
          <div>
            <input
              value={textVal}
              onChange={e => setTextVal(e.target.value)}
              placeholder={currentPoll.type === 'cloud' ? 'Type one word…' : 'Type your question…'}
              onKeyDown={e => e.key === 'Enter' && textVal.trim() && submit(textVal.trim())}
              style={{
                width: '100%', background: COLORS.bg, color: COLORS.text,
                border: `1px solid ${COLORS.panelEdge}`, borderRadius: 8, padding: '12px 14px', fontSize: 15,
              }}
            />
            <Button
              onClick={() => textVal.trim() && submit(textVal.trim())}
              disabled={!textVal.trim()}
              style={{ marginTop: 12, width: '100%' }}
            >
              Submit
            </Button>
          </div>
        )}
      </Panel>
    </div>
  );
}
