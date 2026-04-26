-- 0017_triggers.sql
-- Triggers enforce constitutional discipline at the schema level.
--   - Provenance discipline: claims must have at least one claim_sources row.
--   - Append-only: *_versions tables forbid UPDATE/DELETE.
--   - Event emission: state transitions write orchestrator_events.

-- Generic updated_at maintenance.
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'users','sources','entities','claims','theses','assumptions','indicators',
      'predictions','contradictions','five_whys_chains','solution_inventories',
      'argument_maps','frame_genealogies','articles','books','book_chapters',
      'productions','scripts','beats','production_publishes','questions',
      'role_definitions','workflow_runs','solution_entries','entity_relations',
      'cost_whitelists'
    ])
  loop
    execute format($p$
      create trigger %I_set_updated_at before update on public.%I
        for each row execute procedure set_updated_at()
    $p$, t || '_uat', t);
  end loop;
end;
$$;

-- Append-only enforcement on *_versions tables.
create or replace function forbid_modify() returns trigger
language plpgsql as $$
begin
  raise exception 'append-only table: % rows cannot be % once inserted',
    tg_table_name, tg_op;
end;
$$;

do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'claim_versions','thesis_versions','article_versions',
      'orchestrator_events','ingestion_actions','indicator_observations',
      'role_invocations','article_corrections'
    ])
  loop
    execute format($p$
      create trigger %I_no_update before update on public.%I
        for each row execute procedure forbid_modify()
    $p$, t || '_nu', t);
    execute format($p$
      create trigger %I_no_delete before delete on public.%I
        for each row execute procedure forbid_modify()
    $p$, t || '_nd', t);
  end loop;
end;
$$;

-- Provenance discipline: prevent flipping claim.verification_status to
-- 'grounded' if there is no claim_sources row.
create or replace function check_claim_has_source() returns trigger
language plpgsql as $$
begin
  if new.verification_status = 'grounded' and not exists (
    select 1 from claim_sources where claim_id = new.id and supports = true
  ) then
    raise exception 'claim % cannot be grounded without at least one supporting claim_sources row', new.id;
  end if;
  return new;
end;
$$;

create trigger claims_check_grounded
  before insert or update of verification_status on public.claims
  for each row execute procedure check_claim_has_source();

-- Coined-phrase requirement: theses cannot flip is_public=true without a
-- coined_phrase set.
create or replace function check_thesis_publish_gates() returns trigger
language plpgsql as $$
begin
  if new.is_public = true and (old.is_public is distinct from true) then
    if new.coined_phrase is null or length(trim(new.coined_phrase)) = 0 then
      raise exception 'thesis % cannot be published without coined_phrase', new.id;
    end if;
    if new.is_falsifiable = false then
      raise exception 'thesis % cannot be published without falsifying_observation', new.id;
    end if;
    if new.primary_operator is null or length(trim(new.primary_operator)) = 0 then
      raise exception 'thesis % cannot be published without primary_operator (named accountability)', new.id;
    end if;
  end if;
  return new;
end;
$$;

create trigger theses_check_publish
  before update of is_public on public.theses
  for each row execute procedure check_thesis_publish_gates();

-- Articles: author must be set before is_public flips.
create or replace function check_article_publish_gates() returns trigger
language plpgsql as $$
begin
  if new.is_public = true and (old.is_public is distinct from true) then
    if new.author is null or length(trim(new.author)) = 0 then
      raise exception 'article % cannot be published without author (named accountability)', new.id;
    end if;
  end if;
  return new;
end;
$$;

create trigger articles_check_publish
  before update of is_public on public.articles
  for each row execute procedure check_article_publish_gates();

-- Predictions: confidence_pct + resolution criterion + horizon already
-- enforced by NOT NULL; nothing further needed at trigger level.

-- Cache invalidation: when an article/thesis flips is_public, mark its
-- cache row for refresh by deleting it (Worker repopulates).
create or replace function invalidate_pub_cache() returns trigger
language plpgsql as $$
begin
  if tg_table_name = 'articles' then
    if (old.is_public is distinct from new.is_public) or (old.current_version_id is distinct from new.current_version_id) then
      delete from pub_articles_cache where article_id = new.id;
    end if;
  elsif tg_table_name = 'theses' then
    if (old.is_public is distinct from new.is_public) or (old.current_version_id is distinct from new.current_version_id) then
      delete from pub_theses_cache where thesis_id = new.id;
    end if;
  end if;
  return new;
end;
$$;

create trigger articles_invalidate_cache
  after update on public.articles
  for each row execute procedure invalidate_pub_cache();

create trigger theses_invalidate_cache
  after update on public.theses
  for each row execute procedure invalidate_pub_cache();
