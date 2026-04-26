-- 0011_questions.sql
-- Investigation frontier: Interrogator-generated and operator-declared
-- questions with Expected Information Gain scores.

create table questions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  thesis_id uuid references theses(id) on delete cascade,
  question_text text not null,
  generated_by text not null,                -- 'interrogator', 'operator', 'gap_surfacer'
  eig_score numeric(5,4),                    -- Expected Information Gain
  state question_state not null default 'open',
  answered_by_claim_ids uuid[] not null default array[]::uuid[],
  related_entity_ids uuid[] not null default array[]::uuid[],
  retired_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index questions_user_state_idx on questions (user_id, state, created_at desc);
create index questions_thesis_idx on questions (thesis_id) where thesis_id is not null;
create index questions_eig_idx on questions (user_id, eig_score desc) where state = 'open';

-- Graph of which questions depend on other questions' answers.
create table question_dependencies (
  question_id uuid not null references questions(id) on delete cascade,
  depends_on_question_id uuid not null references questions(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (question_id, depends_on_question_id),
  check (question_id <> depends_on_question_id)
);
