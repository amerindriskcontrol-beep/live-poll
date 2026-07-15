-- AMERIND Live Poll — Supabase schema
-- Run this once in your Supabase project's SQL Editor (Project > SQL Editor > New query).

create extension if not exists pgcrypto;

create table if not exists sessions (
  code text primary key,
  created_at timestamptz not null default now(),
  active boolean not null default true,
  current_index integer not null default 0
);

create table if not exists polls (
  id uuid primary key default gen_random_uuid(),
  session_code text not null references sessions(code) on delete cascade,
  idx integer not null,
  type text not null,
  question text not null,
  options jsonb not null default '[]'::jsonb,
  correct_answer text,
  created_at timestamptz not null default now()
);
create index if not exists polls_session_idx on polls(session_code, idx);

create table if not exists responses (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references polls(id) on delete cascade,
  value text not null,
  votes integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists responses_poll_idx on responses(poll_id);

create table if not exists poll_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null,
  question text not null,
  options jsonb not null default '[]'::jsonb,
  correct_answer text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- IMPORTANT — read this before you assume this is "secured":
-- This app has no login system. Every visitor (presenter AND audience) connects
-- with the same public "anon" key, which ships inside the JS bundle and is
-- visible to anyone who opens dev tools. There is no way for the database to
-- tell "the presenter" apart from "a random person with the link" — so the
-- policies below allow anyone to read, insert, and update all four tables.
-- That mirrors the original Claude-artifact version's security model (anyone
-- with the session code could already do everything), so this isn't a
-- regression — it's just now visible at the infrastructure level instead of
-- hidden inside Claude's storage sandbox.
--
-- If this ever needs real access control (e.g. only you can end a session or
-- see raw responses before the training group does), that requires adding
-- actual authentication — a bigger lift than this schema, and worth a
-- separate conversation before you rely on it for anything sensitive.
-- ---------------------------------------------------------------------------
alter table sessions enable row level security;
alter table polls enable row level security;
alter table responses enable row level security;
alter table poll_templates enable row level security;

create policy "public read sessions" on sessions for select using (true);
create policy "public insert sessions" on sessions for insert with check (true);
create policy "public update sessions" on sessions for update using (true);

create policy "public read polls" on polls for select using (true);
create policy "public insert polls" on polls for insert with check (true);

create policy "public read responses" on responses for select using (true);
create policy "public insert responses" on responses for insert with check (true);

create policy "public read templates" on poll_templates for select using (true);
create policy "public insert templates" on poll_templates for insert with check (true);
create policy "public delete templates" on poll_templates for delete using (true);
