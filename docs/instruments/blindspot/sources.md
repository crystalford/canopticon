# The Blind Spot — Sources

> **Runtime source of truth:** `packages/blindspot/src/sources/registry.ts`
> (rendered at `blindspot.canopticon.com/sources`). This file is the readable
> mirror.

Every published number is traceable to a stored R2 snapshot of one of these.

## Official statistics · pulled & snapshotted

| id | Source | Publisher | Method | Cadence | Role |
|----|--------|-----------|--------|---------|------|
| `sfs` | Survey of Financial Security | Statistics Canada | survey | ~3 yrs | Direct survey; top 1% ≈ 13.7% (lowest). |
| `dhea` | Distributions of Household Economic Accounts | Statistics Canada | capitalization | quarterly | Distributional accounts; top 1% ≈ 26.6% (highest). Cube 36-10-0660-01. |
| `pbo-hnw` | High-net-worth family estimates | Parliamentary Budget Officer | pareto | occasional | Pareto tail correction; top 1% ≈ 24%; threshold ≈ $7.4M / ~169,400 families (2023). |
| `cra-t1` | T1 Final Statistics | Canada Revenue Agency | capitalization | annual | Capital-income flows the capitalization method turns into stocks. |
| `nbsa` | National Balance Sheet Accounts | Statistics Canada | — | quarterly | Behavior strip inputs. Cube 36-10-0580-01. |

## Academic grounding · the four channels

| id | Source | Grounds |
|----|--------|---------|
| `ksz-zwick` | Kopczuk–Smith–Zidar–Zwick & predecessors | The capitalization method + its rate-of-return sensitivity. |
| `fox-liscow` | Unrealized-gains / buy–borrow–die literature | The unrealized-gains channel (largest). |
| `ajz` | Alstadsæter–Johannesen–Zucman | The offshore channel. |
| `sfs-technical` | SFS technical + non-response docs | The survey non-response channel. |
