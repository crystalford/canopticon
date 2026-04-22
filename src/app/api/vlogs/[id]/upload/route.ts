import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

export const maxDuration = 30

// Returns a presigned R2 upload URL — client uploads the video file directly to R2,
// keeping it out of Next.js memory entirely.
export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: vlog } = await supabase.from('vlogs').select('id, title').eq('id', params.id).single()
  if (!vlog) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretKey = process.env.R2_SECRET_ACCESS_KEY
  const bucket = process.env.R2_BUCKET_NAME

  if (!accountId || !accessKeyId || !secretKey || !bucket) {
    return NextResponse.json({ error: 'R2 not configured' }, { status: 500 })
  }

  const r2Key = `vlogs/${params.id}/raw.mp4`

  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey: secretKey },
  })

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: r2Key,
    ContentType: 'video/mp4',
  })

  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 3600 })

  await supabase.from('vlogs').update({ r2_key: r2Key }).eq('id', params.id)

  return NextResponse.json({ upload_url: uploadUrl, r2_key: r2Key })
}
