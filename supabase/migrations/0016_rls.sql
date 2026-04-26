-- 0016_rls.sql
-- Row-Level Security: deny by default; per-user isolation on every table
-- that carries user_id; service-role bypass only for Worker bookkeeping.
--
-- Public-cache tables get an additional anon SELECT policy so the public
-- site can read them without auth.

-- Helper: does the requesting JWT belong to this user_id?
create or replace function auth_user_owns(target_user_id uuid) returns boolean
language sql stable as $$
  select target_user_id = (select id from users where auth_user_id = auth.uid())
$$;

-- Enable RLS and deny-all on every table.
do $$
declare
  t record;
begin
  for t in
    select tablename from pg_tables
    where schemaname = 'public'
      and tablename not like 'mv_%'
  loop
    execute format('alter table public.%I enable row level security', t.tablename);
    execute format('alter table public.%I force row level security', t.tablename);
  end loop;
end;
$$;

-- Per-user policies on every owned table.
-- The pattern: SELECT/INSERT/UPDATE/DELETE all gated by auth_user_owns(user_id).
do $$
declare
  t text;
begin
  for t in
    select tablename from pg_tables
    where schemaname = 'public'
      and tablename in (
        'users','cost_ledger','cost_whitelists','cost_approvals',
        'sources','ingestion_critic_reports','ingestion_actions',
        'entities','entity_mentions','entity_relations','entity_resolution_log',
        'entity_merge_history','entity_resolution_queue',
        'claims','claim_versions','claim_entities','claim_sources','claim_relations',
        'claim_deduplication_queue',
        'theses','thesis_versions','thesis_claims','thesis_watch_sets',
        'thesis_concept_spine','thesis_inbox','coined_phrase_first_uses',
        'assumptions','assumption_supporting_claims','indicators','indicator_observations',
        'predictions','contradictions',
        'five_whys_chains','five_whys_levels','solution_inventories','solution_entries',
        'argument_maps','argument_layers','frame_genealogies','frame_propagation_events',
        'articles','article_versions','article_claims','article_corrections',
        'books','book_chapters',
        'productions','scripts','beats','production_publishes','production_perf',
        'questions','question_dependencies',
        'red_team_objections','premortem_reports','gap_surfacer_reports',
        'role_definitions','role_invocations','cascade_runs','workflow_runs','orchestrator_events'
      )
  loop
    -- users table is special: gate by auth_user_id, not user_id.
    if t = 'users' then
      execute format($p$
        create policy users_self_select on public.users
          for select using (auth_user_id = auth.uid())
      $p$);
      execute format($p$
        create policy users_self_modify on public.users
          for update using (auth_user_id = auth.uid())
      $p$);
    else
      execute format($p$
        create policy %I_owner_all on public.%I
          for all using (auth_user_owns(user_id))
          with check (auth_user_owns(user_id))
      $p$, t || '_owner', t);
    end if;
  end loop;
end;
$$;

-- Public read-only access for the cache tables (anon role gets SELECT only).
-- These are populated by the Worker using the service role; the anon key
-- in the public site only sees rows here.
do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'pub_articles_cache','pub_theses_cache','pub_predictions_cache',
      'pub_contradictions_cache','pub_entities_cache','pub_sources_cache',
      'pub_claims_cache'
    ])
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format($p$
      create policy %I_anon_read on public.%I
        for select to anon using (true)
    $p$, t || '_anon', t);
    execute format($p$
      create policy %I_owner_all on public.%I
        for all using (auth_user_owns(user_id))
        with check (auth_user_owns(user_id))
    $p$, t || '_owner', t);
  end loop;
end;
$$;

-- Subscriptions: operator owns; anon can INSERT (subscribe form) but not SELECT.
alter table public.pub_subscriptions enable row level security;
alter table public.pub_subscriptions force row level security;

create policy pub_subscriptions_owner_all on public.pub_subscriptions
  for all using (auth_user_owns(user_id))
  with check (auth_user_owns(user_id));

create policy pub_subscriptions_anon_insert on public.pub_subscriptions
  for insert to anon with check (true);
