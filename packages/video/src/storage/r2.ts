// R2 helpers — minimal Phase 0 surface.
//
// The Container uploads final MP4s to the ASSETS bucket using a
// pre-signed PUT URL the Worker mints per render. The Worker hands the
// signed URL to the Container in the /render request body; the
// Container PUTs the bytes; the Worker reads the key back.
//
// Phase 0 takes a shortcut: the Container streams the MP4 back in the
// /render response and the Worker writes to R2 directly via the binding.
// Pre-signed PUTs come in Phase 1 when chunked rendering needs them.

export async function putAsset(
  bucket: R2Bucket,
  key: string,
  body: ArrayBuffer | ReadableStream,
  contentType: string,
): Promise<void> {
  await bucket.put(key, body, {
    httpMetadata: { contentType },
  });
}

export async function signedAssetUrl(
  bucket: R2Bucket,
  key: string,
  _ttlSeconds: number = 24 * 60 * 60,
): Promise<string | null> {
  // R2 binding doesn't sign URLs directly — that needs an S3-compatible
  // credentials call. For Phase 0, the status page reads the MP4 via the
  // Worker's own /assets/:key proxy below; no signed URL needed.
  const obj = await bucket.head(key);
  if (!obj) return null;
  return `/assets/${encodeURIComponent(key)}`;
}
