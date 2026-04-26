-- 0015_materialized_views.sql
-- Materialized views for analytics. Refreshed by Calibration role
-- on indicator_observation events and after prediction resolution.

create materialized view mv_brier_rolling as
select
  user_id,
  domain,
  count(*) filter (where status in ('resolved_correct','resolved_incorrect','resolved_ambiguous')) as resolved_count,
  count(*) filter (where status = 'active') as active_count,
  case
    when count(*) filter (where brier_contribution is not null) > 0
      then round(avg(brier_contribution) filter (where brier_contribution is not null)::numeric, 4)
    else null
  end as rolling_brier
from predictions
group by user_id, domain;

create unique index mv_brier_rolling_pk on mv_brier_rolling (user_id, coalesce(domain, ''));

create or replace function refresh_mv_brier_rolling() returns void
language plpgsql security definer as $$
begin
  refresh materialized view concurrently mv_brier_rolling;
end;
$$;
