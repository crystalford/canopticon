# Studio probe

Claude Code's sandbox cannot reach `canopticon.com` — the egress proxy
refuses the CONNECT outright, for every host on that domain. So the
deployed Studio has been unverifiable from here, and one route in
particular has been stuck because of it: `POST /project/:id/read` is the
only path that needs the Workers AI binding, the binding exists only in
production, and production was unreachable.

`.github/workflows/studio-probe.yml` runs a single request from a GitHub
runner and commits the response into this directory, one file per `label`.

    method: POST
    path:   /v1/project/ingest
    body:   {"essay":"..."}
    label:  ingest

Read the result at `ops/studio-probe/<label>.json`.

Notes:

- Studio is **not** behind Cloudflare Access, so no service-token headers
  are sent. If that ever changes, this workflow needs them and should say
  so rather than silently 403ing into a committed file.
- The timeout is 120s, not the Record probe's 30s: reading a dozen scenes
  is a dozen model calls.
- Triggered only. No cron, no loops — Actions minutes are not where this
  system does its compute.
