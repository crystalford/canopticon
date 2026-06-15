-- 0002_phase0_spike_seed.sql — seed the "It Looks Like Teslas" segment
-- so POST /spike has something to render against without going through
-- the editorial brain (which Phase 1 builds).
--
-- The payload_json is the §7b contract shaped fixture matching the
-- handoff doc §7. Lifted into D1 so the Worker reads it the same way
-- it'll read Phase 1's generated segments — no special code path.

INSERT OR REPLACE INTO segments (
  id, status, source_rubric_score, template, forensic_turn, needs_human, payload_json
) VALUES (
  'phase0-carney-it-looks-like-teslas',
  'approved',
  4.7,
  'claim_vs_ground',
  'Same government. Same weeks. One side says relax — probably Teslas. The other puts the surveillance risk in writing.',
  0,
  json('{
    "id": "phase0-carney-it-looks-like-teslas",
    "title": "It Looks Like Teslas",
    "template": "claim_vs_ground",
    "length_s": 70,
    "forensic_turn": {
      "text": "Same government. Same weeks. One side says relax — probably Teslas. The other puts the surveillance risk in writing.",
      "needs_human": false,
      "approved_by": "phase0-fixture",
      "approved_at": "2026-06-15T00:00:00Z"
    },
    "beats": [
      {
        "t_in_s": 0,
        "t_out_s": 4,
        "type": "cold_open",
        "vo": null,
        "clip": { "src": "fixtures/carney-clip.mp4", "in_s": 412, "out_s": 416, "audio": "surface" },
        "chrome": [
          { "kind": "lower_third", "speaker": "Mark Carney", "network": "CBC", "timestamp_label": "June 1" }
        ],
        "source": "CBC, Jun 1 2026"
      },
      {
        "t_in_s": 4,
        "t_out_s": 9,
        "type": "thesis",
        "vo": "The data doesn''t say that. And his own government said something it would rather you didn''t connect to it.",
        "clip": null,
        "chrome": [{ "kind": "caption", "text": "The data doesn''t say that." }],
        "source": null
      },
      {
        "t_in_s": 9,
        "t_out_s": 22,
        "type": "evidence",
        "vo": "In May, 2,910 Chinese-built EVs landed in Canada — the first month of imports.",
        "clip": null,
        "chrome": [
          { "kind": "data_callout", "label": "FIRST MONTH", "value": "2,910", "units": "EVs · MAY 2026" },
          { "kind": "callout", "text": "models not identified", "emphasis": "strong" }
        ],
        "source": "Global Affairs Canada via CBC, Jun 1 2026"
      },
      {
        "t_in_s": 22,
        "t_out_s": 32,
        "type": "evidence",
        "vo": "The deal that opened the door dropped the tariff from one hundred percent to six.",
        "clip": null,
        "chrome": [
          { "kind": "animated_chart", "title": "Chinese EV tariff drop", "chart_type": "line", "points": [
            { "label": "Before deal", "value": 100 },
            { "label": "After deal", "value": 6.1 }
          ]}
        ],
        "source": "CBC, Jun 1 2026"
      },
      {
        "t_in_s": 32,
        "t_out_s": 46,
        "type": "forensic_turn",
        "vo": "Same government. Same weeks. One side says relax — probably Teslas. The other puts the surveillance risk in writing.",
        "clip": null,
        "chrome": [
          { "kind": "side_by_side", "left_label": "Carney, June 1", "right_label": "Federal memo, late May", "left_src": "fixtures/carney-clip.mp4", "right_src": "fixtures/memo-still.png" }
        ],
        "source": "Federal memo (ATIP), Canadian Press"
      },
      {
        "t_in_s": 46,
        "t_out_s": 58,
        "type": "steelman",
        "vo": "To be fair — most Canadians wanted these cars. And any connected car is a data risk.",
        "clip": null,
        "chrome": [
          { "kind": "data_callout", "label": "IN FAVOUR", "value": "61%", "units": "Leger, Feb 2026" }
        ],
        "source": "Leger poll, Feb 2026"
      },
      {
        "t_in_s": 58,
        "t_out_s": 66,
        "type": "implication",
        "vo": "A deal sold as affordability and sovereignty — where the investment is only expected, the brands are unconfirmed, and the surveillance memo is real.",
        "clip": null,
        "chrome": [
          { "kind": "freeze_annotate", "clip_src": "fixtures/carney-clip.mp4", "freeze_at_s": 413, "hold_ms": 1500, "annotation": "expected. unconfirmed. real." }
        ],
        "source": null
      },
      {
        "t_in_s": 66,
        "t_out_s": 70,
        "type": "tag",
        "vo": "It looks like Teslas. The data doesn''t say.",
        "clip": null,
        "chrome": [
          { "kind": "caption", "text": "canopticon · sources: CBC, Global Affairs Canada, Canadian Press · June 2026" }
        ],
        "source": null
      }
    ],
    "music": { "bed": "forensic_low", "drop_at_s": 32 },
    "voice": { "provider": "fixture", "voice_id": "fixtures/narrator.wav" },
    "sources": ["CBC", "Global Affairs Canada", "Canadian Press"],
    "variants": ["1080x1920"]
  }')
);
