import { execSync } from 'child_process'

console.log('Starting git push for automation fixes...')

try {
  // Configure git
  execSync('git config user.email "v0@vercel.com"')
  execSync('git config user.name "v0"')

  // Check status
  console.log('Current git status:')
  console.log(execSync('git status', { encoding: 'utf-8' }))

  // Add all changes
  console.log('Adding changes...')
  execSync('git add -A')

  // Commit
  console.log('Committing changes...')
  execSync('git commit -m "fix: resolve automation workflow to enable end-to-end article processing\n\n- Add runSignalAnalysis() to Phase 1 to score signals with AI\n- Remove 5-minute publishing delay (minArticleAge: 5 -> 0)\n- Add comprehensive logging to automation endpoint\n- Signals now properly approved when score >= threshold\n- Articles now synthesized and published automatically"')

  // Push to current branch
  console.log('Pushing to git...')
  execSync('git push origin HEAD', { stdio: 'inherit' })

  console.log('Push completed successfully!')
} catch (error) {
  console.error('Error:', error)
  process.exit(1)
}
