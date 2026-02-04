# Implementation Checklist

## ✅ Phase 1: Deploy New Synthesis (NOW - Ready)

- [x] Improved AI prompts (ARTICLE_SYNTHESIS_V1, RESEARCH_ANALYSIS_V1)
- [x] Multi-source synthesis in synthesizeArticle()
- [x] Research enrichment pipeline
- [x] Enhanced prompts registry
- [x] Logging and error handling

**What to do:**
- [ ] Push code to GitHub/Vercel
- [ ] Test with 1 approved signal
- [ ] Check article length (should be 1500-2500 words)
- [ ] Verify research section present
- [ ] Monitor cost in OpenAI dashboard

**Expected time:** 30 minutes

---

## ⏳ Phase 2: Add News Source Feeds (This Week)

### Step 1: Create RSS Ingestion Workers
- [ ] Create `/src/app/api/ingest/major-news/route.ts`
- [ ] Add sources: CBC, Globe, National Post, CTV
- [ ] Test each RSS feed manually

**Expected time:** 1-2 hours

### Step 2: Integrate into Automation
- [ ] Update `/src/lib/orchestration/workflow.ts`
- [ ] Add to ingestion phase: `await fetch('/api/ingest/major-news')`
- [ ] Test automation cycle

**Expected time:** 30 minutes

### Step 3: Monitor
- [ ] Track articles ingested per day (should be 100+)
- [ ] Monitor ingestion success rate
- [ ] Set up alerts for broken feeds

**Expected time:** 30 minutes

**Total Phase 2: 2-3 hours**

---

## 🚀 Phase 3: Add Grassroots Signals (This Week)

### Step 1: Reddit Integration
- [ ] Create `/src/lib/ingestion/reddit-fetcher.ts`
- [ ] Add r/CanadaPolitics source
- [ ] Test fetch and parsing

**Expected time:** 1 hour

### Step 2: Bluesky Integration
- [ ] Create `/src/lib/ingestion/bluesky-fetcher.ts`
- [ ] Configure API endpoint
- [ ] Test fetch (should work - open federation)

**Expected time:** 1 hour

### Step 3: Add to Automation
- [ ] Create `/src/app/api/ingest/social/route.ts`
- [ ] Wire into workflow
- [ ] Test both sources

**Expected time:** 1 hour

**Total Phase 3: 3 hours**

---

## 🔍 Phase 4: Government & Policy Sources (Next Week)

### Step 1: Web Scraping Setup
- [ ] Verify scraper-util works
- [ ] Create gov scraper template
- [ ] Test on PM Office website

**Expected time:** 1-2 hours

### Step 2: Add Sources
- [ ] PM Office Newsroom
- [ ] Privy Council Office
- [ ] CSIS reports

**Expected time:** 2-3 hours

### Step 3: Hansard Integration
- [ ] Check if API available
- [ ] Or set up scraping
- [ ] Parse structure

**Expected time:** 2-3 hours

**Total Phase 4: 5-8 hours (advanced)**

---

## 📊 Quality Assurance

### Content Quality Testing
- [ ] Generate 5 test articles
- [ ] Verify word count (1500-2500)
- [ ] Check for research section
- [ ] Verify multi-source synthesis
- [ ] Read for coherence and quality
- [ ] Check entity recognition (tags)

### Automation Testing
- [ ] Run full cycle (ingest → signal → synthesize → publish)
- [ ] Verify automation rules applied
- [ ] Check social distribution (Bluesky, Mastodon)
- [ ] Monitor logs for errors

### Cost Testing
- [ ] Track spend vs. budget
- [ ] Calculate cost per article
- [ ] Identify optimization opportunities
- [ ] Set alerts for overages

### Source Health Testing
- [ ] All sources returning data
- [ ] No broken feeds/APIs
- [ ] Response times acceptable
- [ ] Error rates <5%

---

## 🎯 Performance Targets

After each phase, verify:

| Metric | Target | Actual |
|--------|--------|--------|
| Article word count | 1500-2500 | _____ |
| Sources per article | 3-5 | _____ |
| Articles per day | 50-100 | _____ |
| Synthesis time | <3 min | _____ |
| Cost per article | <$0.50 | _____ |
| Success rate | >95% | _____ |

---

## 🚨 Common Issues & Fixes

### Issue: Articles still 200 words
- Check: Is new synthesis code deployed?
- Fix: Verify `/src/lib/synthesis/index.ts` has all changes
- Test: Check API logs for synthesis calls

### Issue: Research section missing
- Check: Is Google News RSS accessible?
- Fix: Test manually: `curl "https://news.google.com/rss/search?q=test"`
- Try: Add fallback empty research context

### Issue: Cost too high
- Check: Which prompts are expensive?
- Fix: Switch to gpt-4o-mini for synthesis (saves $0.10)
- Try: Only research high-significance signals

### Issue: Source ingestion failing
- Check: Is RSS feed URL correct?
- Fix: Test manually: `curl "https://example.com/feed.xml"`
- Try: Add error handling and retry logic

### Issue: Synthesis times out
- Check: Is cluster too large (>10 articles)?
- Fix: Limit to top 5 articles
- Try: Run synthesis async instead of blocking

---

## ✅ Final Verification

Before calling this complete:

- [ ] **Phase 1 Deployed**: New synthesis active
- [ ] **Phase 1 Tested**: Generated 5 test articles, all 1500+ words
- [ ] **Phase 1 Monitored**: Cost tracking shows sustainable spend
- [ ] **Phase 2 Complete**: Major news sources feeding (100+ articles/day)
- [ ] **Phase 3 Complete**: Grassroots signals added (50+ posts/day)
- [ ] **Automation Running**: Full cycle works end-to-end
- [ ] **Quality Verified**: Articles are publication-worthy
- [ ] **Cost Sustainable**: <$2/day for full automation

---

## 📝 Rollback Plan

If something breaks:

1. **Revert synthesis file**: `git revert src/lib/synthesis/index.ts`
2. **Use old prompts**: Switch to `ARTICLE_SUMMARY_V1` (simpler)
3. **Disable research**: Comment out `enrichArticleWithResearch()`
4. **Keep sources**: New sources won't hurt

**Worst case: Back to 200-word articles in 5 minutes**

---

## 🎉 Success Indicators

You'll know it's working when:

✅ Generated articles are 2000+ words
✅ Articles cite multiple sources
✅ Articles have research context (history, implications)
✅ Auto-publish to Bluesky/Mastodon works
✅ Cost is <$0.50/article
✅ Articles read like real journalism
✅ System runs 24/7 with no manual work

---

## Support

If you get stuck:

1. **Check logs**: `/api/automation/logs` endpoint
2. **Read docs**: See `CONTENT_QUALITY_ROADMAP.md`
3. **Test manually**: Use source guide in `SOURCE_INTEGRATION_GUIDE.md`
4. **Debug**: Add console.log("[v0] ...") statements
5. **Revert**: Use rollback plan above

---

## Timeline

- **Today**: Deploy Phase 1 (30 min)
- **This week**: Phase 2 + 3 (5 hours total)
- **Next week**: Phase 4 if desired (5-8 hours)
- **Ongoing**: Monitor, optimize, iterate

**Full system up and running: 1-2 weeks**

---

## Next: After Success

Once synthesis is working well:

1. **Monitor metrics** - track word count, sources, engagement
2. **Optimize costs** - find cheapest model combinations
3. **Expand sources** - add policy research, international
4. **Add features** - fact-checking, bias analysis, video generation
5. **Build audience** - distribute to your channels

You now have a **real automated intelligence platform**, not a news aggregator.

Good luck! 🚀
