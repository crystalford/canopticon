import { NextRequest, NextResponse } from 'next/server'
import { runQuery } from '@/lib/neo4j/client'

export const maxDuration = 15

function verifyCron(request: NextRequest) {
  const secret = request.headers.get('authorization')?.replace('Bearer ', '')
  return secret === process.env.CRON_SECRET
}

export async function GET(request: NextRequest) {
  if (!verifyCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await runQuery(
      `MERGE (k:_Keepalive {id: 'canopticon-v2'}) SET k.last_ping = datetime() RETURN k.last_ping as ping`
    )
    return NextResponse.json({ status: 'ok', ping: new Date().toISOString() })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
