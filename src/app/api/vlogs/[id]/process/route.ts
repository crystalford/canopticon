import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 300

// Called after a video is uploaded to R2.
// If a transcript is provided (e.g. from YouTube auto-captions or manual paste), use it directly.
// Otherwise if a youtube_url is set, fetch the transcript from YouTube's caption track.
// Then push to intake queue for entity/claim extraction.

async function fetchYouTubeTranscript(youtubeUrl: string): Promise<string | null> {
  try {
    // Extract video ID
    const match = youtubeUrl.match(/(?:v=|youtu\.be\/)([^&?/]+)/)
    if (!match) return null
    const videoId = match[1]

    // Fetch the timedtext API — works for any video with auto-captions
    const captionRes = await fetch(
      `https://www.youtube.com/watch?v=${videoId}`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    )
    const html = await captionRes.text()

    // Extract caption track URL from page HTML
    const captionMatch = html.match(/"captionTracks":\s*\[.*?"baseUrl":"([^"]+)"/)
    if (!captionMatch) return null

    const captionUrl = captionMatch[1].replace(/\\u0026/g, '&')
    const xmlRes = await fetch(captionUrl)
    const xml = await xmlRes.text()

    // Strip XML tags to get plain transcript text
    return xml.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim()
  } catch {
    return null
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const manualTranscript: string | undefined = body.transcript

  const { data: vlog } = await supabase
    .from('vlogs')
    .select('id, title, youtube_url, script, transcript, r2_key')
    .eq('id', params.id)
    .single()

  if (!vlog) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await supabase.from('vlogs').update({ processing_status: 'transcribing' }).eq('id', params.id)

  // Resolve transcript: manual paste > existing saved > YouTube auto-caption > existing script
  let transcript = manualTranscript ?? vlog.transcript ?? null

  if (!transcript && vlog.youtube_url) {
    transcript = await fetchYouTubeTranscript(vlog.youtube_url)
  }

  if (!transcript && vlog.script) {
    // Use the script as a proxy for transcript content
    transcript = vlog.script
  }

  if (!transcript) {
    await supabase.from('vlogs').update({
      processing_status: 'error',
      processing_error: 'No transcript available. Paste transcript manually or add a YouTube URL with captions.',
    }).eq('id', params.id)
    return NextResponse.json({ error: 'No transcript available' }, { status: 422 })
  }

  // Save transcript
  await supabase.from('vlogs').update({ transcript, processing_status: 'extracting' }).eq('id', params.id)

  // Use Claude to summarize the transcript into structured intelligence
  // before pushing to intake (keeps the intake item focused and clean)
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const summary = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    system: 'You are a Canadian political intelligence analyst. Summarize video transcripts into structured intelligence: key claims, named entities, relationships, and funding flows. Be specific and factual.',
    messages: [{
      role: 'user',
      content: `Video title: "${vlog.title}"\n\nTranscript:\n${transcript.substring(0, 12000)}\n\nWrite a structured intelligence summary. Include: named individuals and their roles, organizations mentioned, key claims made, any funding or power relationships described, and significant allegations or findings.`,
    }],
  })

  const summaryText = summary.content[0].type === 'text' ? summary.content[0].text : transcript

  // Push to intake queue
  const { data: intake } = await supabase
    .from('intake_queue')
    .insert({
      raw_content: `[VLOG: ${vlog.title}]\n\n${summaryText}`,
      source_url: vlog.youtube_url ?? `r2://vlogs/${params.id}`,
      status: 'pending',
      submitted_by: user.id,
    })
    .select('id')
    .single()

  await supabase.from('vlogs').update({
    processing_status: 'done',
    processing_error: null,
    intake_ids: intake ? [intake.id] : [],
  }).eq('id', params.id)

  return NextResponse.json({
    ok: true,
    transcript_length: transcript.length,
    intake_id: intake?.id ?? null,
    message: 'Transcript extracted and pushed to intake queue. Run Intake Classifier to build the graph.',
  })
}
