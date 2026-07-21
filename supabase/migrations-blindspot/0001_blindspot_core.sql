-- 0001_blindspot_core.sql — The Blind Spot instrument core schema.
--
-- Separate D1 (canopticon-blindspot) from the publication + video.
-- Numbering restarts at 0001 because this migration tree is independent.
--
-- The instrument stores official wealth statistics under three methods
-- (survey, Pareto, capitalization), the snapshots they were read from,
-- and the computed Invisibility Index. The central honesty of the data
-- model: the scope mismatch is ENFORCED, not papered over. The
-- capitalization method estimates FINANCIAL ASSETS; the Pareto/survey
-- methods estimate NET WORTH. Different denominators. The `scope` column
-- and its CHECK constraints make that impossible to silently conflate.
--
-- Provenance is structural: every fact row carries `snapshot_r2_key`,
-- the R2 key of the exact bytes it was read from. Nothing is published
-- that isn't traceable to a stored snapshot.

-- Time periods (annual, sometimes quarterly for the behavior strip).
CREATE TABLE period (
  id          TEXT PRIMARY KEY,          -- e.g. "2023" or "2023-Q2"
  year        INTEGER NOT NULL,
  quarter     INTEGER,                    -- 1..4, NULL for annual
  label       TEXT NOT NULL,              -- display label, e.g. "2023"
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX period_year_idx ON period (year DESC, quarter DESC);

-- Distribution slices we track (top 1%, top 0.1%, top quintile, …).
CREATE TABLE distribution_category (
  id          TEXT PRIMARY KEY,          -- e.g. "top_1pct"
  label       TEXT NOT NULL,             -- "Top 1%"
  rank_order  INTEGER NOT NULL,          -- for stable sorting, 1 = topmost
  fractile    REAL                       -- 0.01 for top 1%, 0.001 for top 0.1%
);

-- Wealth components + their SCOPE. The scope firewall lives here.
CREATE TABLE wealth_component (
  id          TEXT PRIMARY KEY,          -- e.g. "net_worth_household"
  label       TEXT NOT NULL,
  scope       TEXT NOT NULL
    CHECK (scope IN ('net_worth', 'financial_assets')),
  note        TEXT
);

-- The core fact table: what share of `component` the `category` holds
-- in `period`, under `method`. The (period, category, component, method,
-- scope) tuple is unique — three methods can each report the same slice
-- and we keep all three side by side, never averaging across scopes.
CREATE TABLE wealth_share (
  id              TEXT PRIMARY KEY,
  period_id       TEXT NOT NULL REFERENCES period(id),
  category_id     TEXT NOT NULL REFERENCES distribution_category(id),
  component_id    TEXT NOT NULL REFERENCES wealth_component(id),
  method          TEXT NOT NULL
    CHECK (method IN ('survey', 'pareto', 'capitalization')),
  scope           TEXT NOT NULL
    CHECK (scope IN ('net_worth', 'financial_assets')),
  value           REAL NOT NULL,          -- the share, 0..1
  revised_flag    INTEGER NOT NULL DEFAULT 0,
  source_url      TEXT,
  snapshot_r2_key TEXT,                    -- provenance: the stored bytes
  ingested_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (period_id, category_id, component_id, method, scope)
);
CREATE INDEX wealth_share_lookup_idx
  ON wealth_share (category_id, component_id, method, period_id);

-- Top-tail series (share + threshold + family count) per method. Feeds
-- the spread chart and the Where You Stand percentile placement.
CREATE TABLE top_tail_series (
  id              TEXT PRIMARY KEY,
  period_id       TEXT NOT NULL REFERENCES period(id),
  method          TEXT NOT NULL
    CHECK (method IN ('survey', 'pareto', 'capitalization')),
  percentile      REAL NOT NULL,          -- e.g. 0.99 for the top 1% cut
  share           REAL,                    -- share of total held above cut
  threshold_cad   REAL,                    -- net-worth cut in CAD
  family_count    INTEGER,
  scope           TEXT NOT NULL
    CHECK (scope IN ('net_worth', 'financial_assets')),
  source_url      TEXT,
  snapshot_r2_key TEXT,
  ingested_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (period_id, method, percentile, scope)
);
CREATE INDEX top_tail_series_idx ON top_tail_series (method, percentile, period_id);

-- National Balance Sheet Accounts flows — the behavior strip's inputs
-- (financial vs non-financial asset ratio, debt-to-disposable-income).
CREATE TABLE nbsa_flows (
  id              TEXT PRIMARY KEY,
  period_id       TEXT NOT NULL REFERENCES period(id),
  indicator_code  TEXT NOT NULL,          -- StatCan vector / coordinate
  label           TEXT,
  value           REAL NOT NULL,
  source_url      TEXT,
  snapshot_r2_key TEXT,
  ingested_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (period_id, indicator_code)
);
CREATE INDEX nbsa_flows_idx ON nbsa_flows (indicator_code, period_id);

-- Capitalization factors: the income → wealth-stock multipliers the
-- capitalization method applies, per asset class. Documented, tunable.
CREATE TABLE capitalization_factors (
  id           TEXT PRIMARY KEY,
  period_id    TEXT REFERENCES period(id),
  asset_class  TEXT NOT NULL,
  factor       REAL NOT NULL,
  source_url   TEXT,
  source_note  TEXT
);

-- The computed Invisibility Index, one row per period. total_gap_cad is
-- the dollar spread between the highest and lowest method at the top;
-- the four channels decompose where that missing wealth hides. The
-- channels sum to total_gap_cad (enforced by the calc, tested).
CREATE TABLE invisibility_index (
  period_id            TEXT PRIMARY KEY REFERENCES period(id),
  total_gap_cad        REAL NOT NULL,
  ch_unrealized_cad    REAL NOT NULL DEFAULT 0,  -- unrealized capital gains
  ch_private_equity_cad REAL NOT NULL DEFAULT 0, -- closely-held business
  ch_offshore_cad      REAL NOT NULL DEFAULT 0,  -- offshore wealth
  ch_nonresponse_cad   REAL NOT NULL DEFAULT 0,  -- survey non-response
  recovery_ratio       REAL,                      -- pareto_share / cap_share
  computed_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Ingest audit trail. Every fetch, snapshot, and ingest logs here.
CREATE TABLE update_log (
  id              TEXT PRIMARY KEY,
  ts              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  source          TEXT NOT NULL,          -- "statcan", "cra", "pbo", "nbsa"
  action          TEXT NOT NULL
    CHECK (action IN ('fetched', 'snapshot_new', 'snapshot_same', 'ingested', 'failed')),
  result          TEXT,                    -- human-readable outcome / error
  snapshot_r2_key TEXT
);
CREATE INDEX update_log_ts_idx ON update_log (ts DESC);

-- Change detection: last-seen signature per source cube so a refresh
-- can skip re-snapshotting unchanged data (snapshot_same).
CREATE TABLE change_detection (
  cube_pid       TEXT PRIMARY KEY,        -- StatCan product id / source key
  last_signature TEXT,                    -- content hash / release date
  last_checked   TEXT
);

-- ---- Seed the dimension tables (methods + scopes are stable) --------------

INSERT INTO distribution_category (id, label, rank_order, fractile) VALUES
  ('top_0_1pct', 'Top 0.1%', 1, 0.001),
  ('top_1pct',   'Top 1%',   2, 0.01),
  ('top_5pct',   'Top 5%',   3, 0.05),
  ('quintile_5', 'Top quintile', 4, 0.20),
  ('quintile_1', 'Bottom quintile', 5, 0.20);

INSERT INTO wealth_component (id, label, scope, note) VALUES
  ('net_worth_household', 'Household net worth', 'net_worth',
    'Total assets minus liabilities. The denominator for the survey + Pareto methods.'),
  ('financial_assets',    'Financial assets', 'financial_assets',
    'Deposits, equities, bonds, investment funds. The denominator the capitalization method estimates from investment income.'),
  ('real_estate',         'Real estate', 'net_worth',
    'Owner-occupied + other real estate. Part of net worth; largely outside the capitalization estimate.'),
  ('pension_plans',       'Pension + retirement', 'net_worth',
    'Employer pensions + registered retirement savings. Part of net worth.');
