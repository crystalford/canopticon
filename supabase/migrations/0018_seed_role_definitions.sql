-- 0018_seed_role_definitions.sql
-- Seeds the 18 role_definitions rows for any user that signs in. Triggered
-- on auth.users insert; prompt_template is a placeholder that
-- `pnpm sync-skills` overwrites with the SKILL.md content.

create or replace function seed_role_definitions_for_user(target_user_id uuid)
returns void
language plpgsql security definer as $$
declare
  r role_name;
begin
  for r in
    select unnest(enum_range(null::role_name))
  loop
    insert into role_definitions (user_id, name, prompt_template)
    values (target_user_id, r, '<see packages/shared/skills/' || replace(r::text, '_', '-') || '/SKILL.md — run pnpm sync-skills>')
    on conflict (user_id, name) do nothing;
  end loop;
end;
$$;

-- Trigger: on a new auth.users row, ensure a public.users row exists and
-- seed its role_definitions.
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
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure on_auth_user_created();
