// Cost meter — Cloudflare Containers price per second for standard-4.
// The numbers below are conservative starting points; the operator
// updates them from the Cloudflare dashboard once Phase 0 has real
// metrics to calibrate against.
//
// Cloudflare's "Container active utilization" pricing (Nov 2025) is
// roughly:
//   $0.00002 per vCPU-second
//   $0.0000025 per GiB-second
//   $0.00000007 per GB-second of disk
// standard-4 = 4 vCPU, 12 GiB, ~20 GB disk
//
// Per second of wall-clock:
//   CPU:    4 × $0.00002       = $0.00008
//   Memory: 12 × $0.0000025    = $0.00003
//   Disk:   20 × $0.00000007   = $0.0000014
//   Total ≈ $0.0001114 / sec = 0.01114 ¢ / sec
//
// Round up a bit for safety:
const STANDARD_4_CENTS_PER_SECOND = 0.012;

export function estimateContainerCostCents(walltimeMs: number): number {
  return (walltimeMs / 1000) * STANDARD_4_CENTS_PER_SECOND;
}
