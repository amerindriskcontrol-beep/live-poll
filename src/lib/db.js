import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.error(
    'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. ' +
    'Copy .env.example to .env.local and fill in your Supabase project values, ' +
    'or set them as environment variables in your Cloudflare Pages project settings.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

function shapePoll(row) {
  return {
    id: row.id,
    type: row.type,
    question: row.question,
    options: row.options || [],
    correctAnswer: row.correct_answer || null,
  };
}

function shapeResponse(row) {
  return {
    id: row.id,
    value: row.value,
    ts: new Date(row.created_at).getTime(),
    votes: row.votes || 0,
  };
}

// ---------- sessions ----------
export async function getSession(code) {
  const { data: sessionRow, error: sessionErr } = await supabase
    .from('sessions').select('*').eq('code', code).maybeSingle();
  if (sessionErr || !sessionRow) return null;

  const { data: pollRows, error: pollErr } = await supabase
    .from('polls').select('*').eq('session_code', code).order('idx', { ascending: true });
  if (pollErr) return null;

  return {
    createdAt: new Date(sessionRow.created_at).getTime(),
    active: sessionRow.active,
    currentIndex: sessionRow.current_index,
    polls: (pollRows || []).map(shapePoll),
  };
}

export async function createSession(code, poll) {
  const { error: sErr } = await supabase.from('sessions').insert({ code, active: true, current_index: 0 });
  if (sErr) return null;
  const { error: pErr } = await supabase.from('polls').insert({
    session_code: code, idx: 0, type: poll.type, question: poll.question,
    options: poll.options, correct_answer: poll.correctAnswer,
  });
  if (pErr) return null;
  return getSession(code);
}

export async function addPollToSession(code, poll, nextIdx) {
  const { error: pErr } = await supabase.from('polls').insert({
    session_code: code, idx: nextIdx, type: poll.type, question: poll.question,
    options: poll.options, correct_answer: poll.correctAnswer,
  });
  if (pErr) return null;
  await supabase.from('sessions').update({ current_index: nextIdx }).eq('code', code);
  return getSession(code);
}

export async function setSessionIndex(code, idx) {
  const { error } = await supabase.from('sessions').update({ current_index: idx }).eq('code', code);
  return !error;
}

export async function setSessionActive(code, active) {
  const { error } = await supabase.from('sessions').update({ active }).eq('code', code);
  return !error;
}

// ---------- responses ----------
export async function getResponses(pollId) {
  const { data, error } = await supabase
    .from('responses').select('*').eq('poll_id', pollId).order('created_at', { ascending: true });
  if (error || !data) return [];
  return data.map(shapeResponse);
}

export async function addResponse(pollId, value) {
  const { error } = await supabase.from('responses').insert({ poll_id: pollId, value });
  return !error;
}

// ---------- personal poll template library ----------
// Note: with no auth layer, "personal" is aspirational — see schema.sql's RLS
// comment. Anyone who opens the Presenter screen on this deployment can see
// and use these templates. Fine for a small internal team; worth revisiting
// if this tool is ever shared more broadly.
export async function loadTemplates() {
  const { data, error } = await supabase
    .from('poll_templates').select('*').order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map(t => ({
    id: t.id, name: t.name, type: t.type, question: t.question,
    options: t.options || [], correctAnswer: t.correct_answer || null,
  }));
}

export async function saveTemplate(entry) {
  await supabase.from('poll_templates').insert({
    name: entry.name, type: entry.type, question: entry.question,
    options: entry.options, correct_answer: entry.correctAnswer,
  });
  return loadTemplates();
}

export async function deleteTemplate(id) {
  await supabase.from('poll_templates').delete().eq('id', id);
  return loadTemplates();
}
