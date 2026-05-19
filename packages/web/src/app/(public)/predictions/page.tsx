// Top-level alias for /p/predictions. The spec wants the predictions
// ledger reachable at canopticon.com/predictions (no /p prefix). The
// underlying rendering still lives at (public)/p/predictions for now;
// this is a 301 redirect so old /p URLs keep working. When we
// consolidate URL structure, the rendering moves here and /p/predictions
// becomes the redirect.

import { redirect } from "next/navigation";

export const runtime = "edge";

export default function PredictionsRedirect() {
  redirect("/p/predictions");
}
