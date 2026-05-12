-- 0009_role_tiers.sql
--
-- Switches every role from claude-opus-4-7 to the free-first Workers AI
-- tier. Only rows that still hold the legacy default are touched, so
-- this migration is idempotent and won't override an operator who has
-- manually flipped a role to Anthropic via the System screen.

-- Llama 4 Scout — long context + multimodal + writing quality.
UPDATE role_definitions
   SET provider = 'workers_ai',
       model = '@cf/meta/llama-4-scout-17b-16e-instruct'
 WHERE model = 'claude-opus-4-7'
   AND name IN (
     'ingestion_critic',
     'claim_extraction',
     'argument_mapper',
     'tier_projector',
     'solution_inventory_builder',
     'interrogator',
     'gap_surfacer',
     'genealogy_tracer'
   );

-- Llama 3.3 70B — reliable tool-calling, deterministic decisions.
UPDATE role_definitions
   SET provider = 'workers_ai',
       model = '@cf/meta/llama-3.3-70b-instruct-fp8-fast'
 WHERE model = 'claude-opus-4-7'
   AND name IN (
     'entity_resolver',
     'claim_deduplicator',
     'indicator_validator'
   );

-- QwQ-32B — reasoning chain for adversarial, calibration, and audit work.
UPDATE role_definitions
   SET provider = 'workers_ai',
       model = '@cf/qwen/qwq-32b'
 WHERE model = 'claude-opus-4-7'
   AND name IN (
     'novelty_surfacer',
     'red_team',
     'steelman',
     'premortem',
     'assumption_auditor',
     'verifier',
     'calibration'
   );

-- Allow per-role Anthropic override on the three roles where prose
-- quality and citations most clearly justify the spend.
UPDATE role_definitions
   SET allow_anthropic_override = 1
 WHERE name IN ('tier_projector', 'genealogy_tracer', 'verifier');
