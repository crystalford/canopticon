#!/bin/bash
set -e

echo "Starting git push for automation fixes..."

# Configure git
git config user.email "v0@vercel.com"
git config user.name "v0"

# Check status
echo "Current git status:"
git status

# Add all changes
echo "Adding changes..."
git add -A

# Commit
echo "Committing changes..."
git commit -m "fix: resolve automation workflow to enable end-to-end article processing

- Add runSignalAnalysis() to Phase 1 to score signals with AI
- Remove 5-minute publishing delay (minArticleAge: 5 -> 0)
- Add comprehensive logging to automation endpoint
- Signals now properly approved when score >= threshold
- Articles now synthesized and published automatically
- Complete documentation and troubleshooting guides added"

# Push to current branch
echo "Pushing to git..."
git push origin HEAD

echo "Push completed successfully!"
