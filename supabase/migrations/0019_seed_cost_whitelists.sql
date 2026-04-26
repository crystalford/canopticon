-- 0019_seed_cost_whitelists.sql
-- Seeds default cost-whitelist rules for new users. Conservative caps —
-- operator can raise via System screen.

create or replace function seed_cost_whitelists_for_user(target_user_id uuid)
returns void
language plpgsql security definer as $$
begin
  insert into cost_whitelists (user_id, operation_type, enabled, per_op_max_cents, daily_max_cents, monthly_max_cents, notes)
  values
    (target_user_id, 'anthropic_role.ingestion_critic',     true, 5,   100,  2000, 'auto-approve grading on every source'),
    (target_user_id, 'anthropic_role.claim_extraction',     true, 10,  200,  3000, 'auto-approve claim extraction up to caps'),
    (target_user_id, 'anthropic_role.entity_resolver',      true, 5,   100,  1500, 'auto-approve ER on routine mentions'),
    (target_user_id, 'anthropic_role.claim_deduplicator',   true, 5,   100,  1500, 'auto-approve dedup on routine claims'),
    (target_user_id, 'anthropic_role.tier_projector',       true, 25,  300,  4000, 'auto-approve tier regen each cascade'),
    (target_user_id, 'anthropic_role.indicator_validator',  true, 5,    50,   500, 'cheapest validation'),
    (target_user_id, 'anthropic_role.calibration',          true, 10,  100,  1000, 'nightly Brier sweep'),
    (target_user_id, 'transcription_assemblyai',           false, null, null, null, 'requires explicit operator approval'),
    (target_user_id, 'anthropic_role.solution_inventory_builder', false, null, null, null, 'operator-invoked, requires approval'),
    (target_user_id, 'anthropic_role.argument_mapper',     false, null, null, null, 'operator-invoked, requires approval'),
    (target_user_id, 'anthropic_role.genealogy_tracer',    false, null, null, null, 'operator-invoked, requires approval')
  on conflict (user_id, operation_type) do nothing;
end;
$$;

-- Extend the auth-user-created trigger function to also seed whitelists.
create or replace function on_auth_user_created()
returns trigger
language plpgsql security definer as $$
declare
  new_user_id uuid;
begin
  insert into public.users (auth_user_id, email)
  values (new.id, new.email)
  on conflict (auth_user_id) do update set email = excluded.email
  returning id into new_user_id;

  perform seed_role_definitions_for_user(new_user_id);
  perform seed_cost_whitelists_for_user(new_user_id);
  return new;
end;
$$;
