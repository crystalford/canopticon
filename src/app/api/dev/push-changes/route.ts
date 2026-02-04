import { NextResponse } from 'next/server'
import { execSync } from 'child_process'

export async function GET() {
  try {
    console.log('[v0] Starting git push for automation fixes...')

    // Configure git
    execSync('git config user.email "v0@vercel.com"')
    execSync('git config user.name "v0"')

    // Add all changes
    console.log('[v0] Adding changes...')
    execSync('git add -A')

    // Check if there are changes to commit
    const status = execSync('git status --porcelain', { encoding: 'utf-8' })
    if (!status.trim()) {
      return NextResponse.json({
        success: false,
        message: 'No changes to commit',
      })
    }

    // Commit
    console.log('[v0] Committing changes...')
    execSync('git commit -m "fix: resolve automation workflow to enable end-to-end article processing\n\n- Add runSignalAnalysis() to Phase 1 to score signals with AI\n- Remove 5-minute publishing delay (minArticleAge: 5 -> 0)\n- Add comprehensive logging to automation endpoint\n- Signals now properly approved when score >= threshold\n- Articles now synthesized and published automatically"')

    // Push to current branch
    console.log('[v0] Pushing to git...')
    const pushOutput = execSync('git push origin HEAD', { encoding: 'utf-8' })
    console.log('[v0] Push output:', pushOutput)

    return NextResponse.json({
      success: true,
      message: 'Changes pushed to GitHub successfully',
      output: pushOutput,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[v0] Git error:', message)
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    )
  }
}
