---
id: net-casting-a-practice-for-turning-ai-research-into-a-generative-mind-
title: "Net-Casting: A Practice for Turning AI Research Into a Generative, Mind-Changing Craft"
kind: "Research"
topic: "McLuhan & media theory"
date: "2026-09-01"
shelf: ""
listed_in_library: true
source_file: "uploads/archive-3/net-casting-ai-research-practice.md"
---

# Net-Casting: A Practice for Turning AI Research Into a Generative, Mind-Changing Craft

The core finding is that AI research agents drift toward consensus by default, so novelty does not come from better questions alone. It comes from a deliberate practice that pushes the AI away from what is "cognitively available," grades each catch by which assumption it overturns, and tests it against primary evidence before it goes into a video. The best-documented way to do this is Don Swanson's "undiscovered public knowledge" method: connecting findings that are public but have never met. Your McLuhan tetrad and a set of ontology questions are the lures you cast with, and your forensic-journalism habits are the filter that decides what you keep.

## TL;DR

- **Novelty has a structure, and you can design for it.** Murray Davis's 1971 study of "interesting" theories found they all take the form "what seems to be X is in reality non-X." Swanson's work shows that real discoveries often sit between fields that never cite each other. Build prompts to search for denied assumptions and missing bridges, not for "insights."
- **The AI's default pull is toward the average, and it gets stronger the longer you iterate.** The NeurIPS 2025 Best Paper "Artificial Hivemind" study found large language models (LLMs) repeat themselves and converge across vendors, and Doshi and Hauser (Science Advances, 2024) found AI help narrows collective diversity. Their ideas look more novel than they turn out to be once someone executes them. The countermeasures are specific: ask for distributions rather than single answers, push the AI into unfamiliar territory, bring in outside seed material (your own observations, primary documents, peer-to-peer claims), and test every catch before you believe it.
- **Recommended format: "Undiscovered Public Knowledge," a forensic video and essay series that uses Swanson-style bridging on current media and labour phenomena, backed by a small personal slip-box you build on Cloudflare.** A ready-made pilot exists: three court and legislative decisions on gig work that disagree about what "waiting" is.

## Key Findings

1. **"Interesting" is a relationship with the audience's assumptions, not a property of facts.** Davis argued that a theorist is remembered "not because his theories are true, but because they are interesting." He sorted interesting propositions into 12 logical categories, all reducible to "what seems to be X is in reality non-X." Up to a point, the more strongly an audience holds an assumption, the more interesting they find a proposition that denies it. This separates a mind-changing catch from trivia: trivia adds a fact, while a catch overturns something you were standing on.

2. **The most reliable engine of discovery is bridging, not brainstorming.** In 1986 Swanson noticed that one medical literature linked fish oil to lower blood viscosity and platelet aggregation, while another linked Raynaud's syndrome to exactly those problems. The two literatures never cited each other. His hypothesis was later supported by clinical trials, and he repeated the method with migraine and magnesium. His definition is the best short description of Chris's goal: knowledge can be "public, yet undiscovered, if independently created fragments are logically related but never retrieved, brought together, and interpreted."

3. **Outsiders produce the surprises.** Shi and Evans (Nature Communications, 2023) found that surprising combinations of research content and context are associated with higher impact, and that they tend to come from scientists crossing in from distant disciplines. Zhang and Evans (2025) found that papers an LLM finds most "perplexing" have bimodal fates: they are over-represented among the most celebrated work and also among the most dismissed, and they collect fewer short-term citations. Radical catches will often look wrong at first. That is a feature to manage, not a reason to throw them out.

4. **LLMs left alone regress to the mean, even across vendors.** The "Artificial Hivemind" study (Jiang et al., NeurIPS 2025 Best Paper Award) tested more than 70 models on 26,000 open-ended queries. It found "intra-model repetition" and, "more so," "inter-model homogeneity, where different models produce strikingly similar outputs." So switching to another model does not reliably give you a second opinion.

5. **AI ideas look novel, then shrink when executed.** In Si, Yang and Hashimoto's Stanford study with more than 100 NLP researchers (ICLR 2025), reviewers judged LLM-generated ideas "more novel (p < 0.05) than human expert ideas while being judged slightly weaker on feasibility." In the follow-up, 43 experts each spent over 100 hours executing randomly assigned ideas. After execution, the LLM ideas' scores fell significantly more than the human ideas' "on all evaluation metrics (novelty, excitement, effectiveness, and overall; p < 0.05)," and "for many metrics there is a flip in rankings where human ideas score higher than LLM ideas" (Si, Hashimoto and Yang, "The Ideation-Execution Gap," 2025). This is the empirical version of "plausible-sounding but hollow synthesis."

6. **Long AI sessions pull toward the model's familiar themes.** In a 2026 paper, Artiles et al. showed that when Claude Opus 4.7 was asked for novel-yet-feasible idea combinations, its ten most-used concepts appeared in 95.7% of outputs. For Gemini 3.1 Pro the figure was 76.7%, versus 34.3% for a sampler that deliberately avoided "cognitively available" combinations. In an iterative research loop, Claude's reports drifted from 2 of 10 on interpretability to 8 of 10, even though the ideas had not started there. The practical lesson for Chris: a long, friendly back-and-forth with one model is exactly where novelty dies.

7. **The feeling of insight is not evidence.** Laukkonen, Kaveladze, Tangen and Schooler showed in a preregistered study ("The dark side of Eureka," Cognition, 2020) that an "Aha!" moment triggered by solving an unrelated anagram made false statements feel truer (n = 300, d = .629). In three experiments with more than 4,000 participants ("Irrelevant insights make worldviews ring true," Scientific Reports, 2022), irrelevant Aha moments also made worldviews feel truer. Any net-casting practice needs a cooling-off step between "wow" and "publish."

8. **The tetrad works as a probe, not as a law.** Tom Tyler's "A Procrustean Probe" (Game Studies, 2008) calls the tetrad "far too vague" as a universal scientific method and notes that "a sufficiently creative mind can imagine, for almost any human artefact, a huge range of things" for each quadrant. As a scientific theory it is too loose; as an exploratory probe it "can provide illuminating insights." Use it to generate candidates, then test them against evidence.

## Details

### 1. Prior art: people who already treat information as raw material

**Literature-based discovery (Swanson, Arrowsmith).** The procedure is A–B–C. Find a problem literature (C), list its mechanisms (B), then search for a separate literature where something (A) acts on B, with no A–C citations between them. Swanson and Neil Smalheiser built this into the Arrowsmith system. Later researchers automated it and reproduced his discoveries. For a journalist, the key point is that A–B–C works on court rulings, patents, terms of service, investor filings and forum threads as well as on medicine.

**"Alien" AI (Sourati and Evans, Evans lab).** In Nature Human Behaviour (2023), Sourati and Evans showed that modelling *which humans are likely to make which inferences* improved AI prediction of future discoveries by up to 400%. Reversing the model, by tuning the AI to "avoid the crowd," produced promising "alien" hypotheses that people were unlikely to pursue. The Artiles et al. follow-up turns this into a design rule: score ideas on two separate axes, **coherence** (does it hang together?) and **availability** (is anyone already positioned to say it?), then look for the high-coherence, low-availability corner. You can run a human version of this in any prompt.

**Luhmann's Zettelkasten.** Niklas Luhmann described his slip-box as a "communication partner" and wrote that "one of the most basic presuppositions of communication is that the partners can mutually surprise each other." He deliberately avoided organising cards by topic, using fixed positions and branching links so that queries would "provoke possibilities of making relations which could not be traced prior to it." This is the older, non-AI version of what Chris wants: a system designed to talk back.

**Tools for thought.** Andy Matuschak and Michael Nielsen's 2019 essay "How can we develop transformative tools for thought?" draws on Alan Kay: the more powerful aim is to build "a new medium for thought" in which new kinds of thoughts become possible. That framing fits McLuhan well. The research practice is itself a medium, and it will shape what thoughts Chris can have.

**Data humanism and data art.** Giorgia Lupi's "Data Humanism" manifesto (Print Magazine, January 2017) grew out of *Dear Data*, a year-long project in which she and Stefanie Posavec mailed each other hand-drawn weekly postcards charting their everyday lives. Her premise: "as banal as it sounds — data does not exist," meaning it is always made by human hands. This justifies treating Chris's own observations as valid data rather than as anecdotes to apologise for.

**Forensic Architecture and investigative aesthetics.** Eyal Weizman's agency at Goldsmiths treats architecture as "the object of investigation, the method of research, and the mode of presentation." In *Investigative Aesthetics* (Verso, 2021) with Matthew Fuller, they extend this to Bellingcat, WikiLeaks and citizen counter-forensics, where sensory and aesthetic skill *is* the investigative method. This is the closest existing model for Chris's combination of filmmaker and forensic journalist. The presentation is not packaging added afterwards; it is how the finding is made.

**Creative constraint decks.** Brian Eno and Peter Schmidt published *Oblique Strategies: Over One Hundred Worthwhile Dilemmas* in January 1975, as 113 cards in a signed edition of 500. Eno said they came from studio panic making him forget "that there were other ways of working." A clear precedent is John Cage's use of the I Ching. The lesson: a random, respected prompt breaks habitual lines of attack better than willpower does.

**Other lineages worth mining** (named here as leads, not researched in depth for this report):
- Charles Peirce's *abduction*: reasoning to the hypothesis that would make a surprising fact unsurprising. This is the logical form of every good catch.
- Fauconnier and Turner's *conceptual blending*, from *The Way We Think*: new meaning emerges from fusing two input frames.
- Media archaeology (Jussi Parikka, Wolfgang Ernst): reading new media through forgotten or failed earlier ones, which overlaps with the tetrad's "retrieve."
- Commonplace books: the Renaissance practice of copying striking passages under headings to recombine later.

**Peer-to-peer and folk-theory communities.** A large research literature treats users' "folk theories" of algorithms as real knowledge.
- DeVito, Gergle and Birnholtz studied the #RIPTwitter backlash against algorithmic feeds.
- Eslami et al. documented how Facebook users infer their feed's logic ("First I 'like' it, then I hide it").
- Sophie Bishop documented "algorithmic gossip" among YouTubers.
- DeVito later described a hierarchy from *functional* theories ("it buries my posts") to *structural* theories (how the system actually weighs signals), and argued that people move up it by testing and revising.
- A 2024 study showed millions of fans building collective theories of platform algorithms and coordinating action on them.

This confirms Chris's instinct that social media is empirically grounded. It also defines the craft: peer-to-peer claims are usually functional theories. They are rich in observation and weak on mechanism, so the job is to extract the observation, drop the explanation, and test the mechanism yourself.

### 2. What makes a catch mind-changing and not merely surprising

Putting the sources together, a high-quality catch passes four tests. This is my synthesis, not an established instrument.

| Test | Question to ask | Grounding |
|---|---|---|
| **Denial** | Which assumption I actually hold does it deny? Can I state it as "X seems A, is actually B"? | Davis 1971 |
| **Distance** | Did it come from a field or community that normally never talks to this one? Who would already say this routinely? | Swanson; Shi and Evans; Sourati and Evans (availability) |
| **Grip** | Does it explain an anomaly I had no explanation for, or predict something checkable? | Peirce's abduction |
| **Proof** | Does it survive contact with primary evidence 24+ hours after the "aha"? | Laukkonen (aha misattribution); Si et al. (ideation–execution gap) |

Two refinements matter.

- **A transplant is not a discovery, but it is still gold for an audience.** If a labour historian would find your gig-work insight obvious, it is not new to the world. It may still be new to your audience, and Davis's point is that interestingness is relative to the audience's assumptions. Label transplants honestly ("labour historians have known this since…"). The label protects your credibility, and a transplant with a named source is often a better video than an unsourced "original" take.
- **Expect bimodality.** Zhang and Evans's finding suggests the catches most likely to matter will also be the ones most likely to look foolish at first. Keep a "strange but unresolved" shelf rather than discarding anything that does not validate quickly.

### 3. Prompting research agents for novelty: failure modes and countermeasures

**Failure modes, with evidence:**
- **Regression to the mean and cross-model convergence** (Artificial Hivemind). Asking a second model is not a real second opinion.
- **Typicality bias.** Zhang et al. (2025, "Verbalized Sampling") trace mode collapse partly to human raters' systematic preference for familiar text in alignment data. The model has been trained to hand you the most typical answer.
- **Collective homogenisation.** Anil Doshi (UCL) and Oliver Hauser (Exeter) (Science Advances, 2024) found that AI story ideas made individual writers' stories more creative but made the stories *more similar to each other*, describing "an increase in individual creativity at the risk of losing collective novelty." The authors call this a social dilemma. If everyone in Chris's niche prompts the same models, the whole niche converges.
- **Hollow synthesis.** Ideas that look novel on paper and shrink when executed (the ideation–execution gap).
- **Attractor drift over long sessions.** Iterative refinement pulls toward the model's favourite themes (Artiles et al.).
- **Self-evaluation failure.** Si et al. found LLMs were unreliable at judging their own ideas. Do not let the model grade its own catch.

**Countermeasures and matching prompt patterns:**

1. **Ask for a distribution, not an answer.** Verbalized Sampling asks for, say, five responses with a probability for each, then samples from the tail. The authors report a 1.6–2.1× gain in diversity for creative writing. Always ask for the low-probability tail explicitly.
2. **Name the crowd, then avoid it.** Before asking for insight, ask the model to list who would *normally* say what about the topic: the consensus takes, the standard critics, the expected contrarians. Then ask only for coherent claims *none* of those groups is positioned to make. This is a manual version of Sourati and Evans's availability axis.
3. **Force a Swanson bridge.** Give it C (your phenomenon), ask it to enumerate the Bs (mechanisms), then ask for As from literatures that never cite C, with named works for each.
4. **Transplant a field.** "How would a hydrologist / canon lawyer / actuary / set designer / epidemiologist of rumours describe this?" Pick fields at random, Oblique-Strategies style, rather than the obvious neighbours.
5. **Invert the default.** Ask what would follow if the opposite of the consensus framing were true, then look for any real evidence consistent with the inversion.
6. **Map disagreement.** Ask where credentialed experts actually disagree, with names. Disagreement shows where the ground is soft.
7. **Hunt anomalies.** Ask for data points or cases the dominant explanation cannot account for.
8. **Extract, then stress-test, folk claims.** Paste peer-to-peer posts. Have the model separate *observations* from *explanations*, then design tests for each explanation.
9. **Break the session.** Use fresh sessions for each lure, run at least two model families, and never refine one idea for more than a few turns in the same thread. This follows directly from the attractor-drift finding.
10. **Separate the generator from the judge.** Grade catches yourself, or with a fresh session given only the rubric and not the conversation.

### 4. Ontology and media theory as repeatable inquiry machines

**Ontology probes** ask what categories exist in a domain and where things have been sorted into the wrong box. Four repeatable moves:
- **Category audit:** "What kinds of things does this domain officially contain? What does it treat as one kind that behaves as two, or as two that behave as one?"
- **Boundary object:** "Which single thing is classified differently by law, by the platform's code, by users and by accountants?" Disagreement between classification systems is where the story is.
- **Unit-of-analysis shift:** Davis's "what seems individual is really holistic" (or the reverse).
- **Figure/ground swap:** "What is treated as background that is actually doing the work?" This is McLuhan's own move.

**Worked example: the ontology of waiting in gig work.** The research subagent confirmed three rulings that together make a textbook "category error" story:
- **Uber BV v Aslam [2021] UKSC 5 (19 February 2021).** A unanimous UK Supreme Court held that Uber drivers are "workers." Their working time was "not limited (as Uber argued) to periods when they were actually driving passengers to their destinations," but "included any period when the driver was logged into the Uber app within the territory… and was ready and willing to accept trips."
- **Ontario's Digital Platform Workers' Rights Act, 2022.** Royal Assent 11 April 2022; in force 1 July 2025. It sets minimum wage "for each work assignment," which starts when a worker *accepts* an assignment and excludes travel before and after. Logged-in waiting time is unpaid. The Act also sidesteps classification altogether: its stated purpose is to give rights to workers "regardless of whether those workers are employees."
- **Uber Technologies Inc. v. Heller, 2020 SCC 16 (26 June 2020, 8–1).** The Supreme Court of Canada never ruled on employee status. It struck down Uber's arbitration clause, which required mediation and arbitration in the Netherlands with US$14,500 in up-front fees, as unconscionable. The Ontario Act's section 12, requiring disputes to be resolved in Ontario, reads like a response, though that link is an inference.

So two common-law jurisdictions looked at the same phenomenon, a person with an app open waiting for a ping, and put it in *opposite ontological categories*: work in the UK, not-work in Ontario. That is Davis's "what seems to be X is in reality non-X" happening in law. It is also a question McLuhan would enjoy: in an app-mediated economy, *is availability itself the product being sold?* That last framing is my extrapolation and should be tested before it is asserted.

**Tetrad as an inquiry machine.** McLuhan and Eric McLuhan's *Laws of Media* (1988) poses four simultaneous questions: what does it enhance, obsolesce, retrieve, and reverse into when pushed to the extreme? Harold Jarche's point that retrieval is the hardest quadrant, and often the most revealing, is a useful rule of thumb. To make the tetrad generative rather than decorative:
- Run it at **multiple scales** (feature, app, platform, economy).
- Require **one piece of evidence per quadrant**.
- **Chain tetrads**, treating each reversal as the input to a new tetrad.
- Use media archaeology for "retrieve" by asking for *failed or forgotten* precursors, not famous ones.

Speculative tetrad on the gig app (my extrapolation, offered as a starting point):
- Enhances: instant matching of labour to demand.
- Obsolesces: the shift, the boss and the timesheet.
- Retrieves: piecework and the day-labour "shape-up."
- Reverses into: the worker's *waiting* becoming the unpaid inventory the platform sells to customers as speed.

The legal split turns that reversal from an aphorism into a checkable claim.

## Recommendations: the Net-Casting Practice

### The workflow (one cycle ≈ one week, or one video)

1. **Seed (raw observation, 10 min).** Voice-dictate the observation as you already do. Then add three lines: *what I currently believe about this*, *what would change my mind*, and *where I saw it* (post, place, document). The first line gives you the assumption-ground Davis says interestingness depends on.
2. **Tie lures (query design, 15 min).** Draw 2–3 lures from a fixed deck: ontology audit, tetrad, Swanson bridge, field transplant, inversion, disagreement map, anomaly hunt, folk-claim extraction. Drawing at random fights your own habits.
3. **Cast (parallel, 30–60 min).** Run each lure in a fresh session on at least two model families. Always ask for a distribution with a low-probability tail and named sources. Do not iterate past three turns in any thread.
4. **Triage (the catch log, 30 min).** Pull every candidate into a table. Score it on Denial / Distance / Grip / Proof, and write it as "X seems A, is actually B." Tag each as **discovery**, **transplant** (credit the field) or **strange-unresolved** (shelve it, don't kill it).
5. **Quarantine (24 h).** Revisit anything that gave you a jolt. If it still grips after a night's sleep, go to primary sources (rulings, filings, datasets, the original posts) and verify.
6. **Fold in.** Write each surviving catch as an atomic, linked note in a Luhmann-style slip-box, linked by *argument*, not by topic, and stored with its source and its test.
7. **Create.** Each verified catch becomes a video, essay or thread. The catch log itself becomes public, showing receipts.

### Format ideas (big swings)

**A. ★ RECOMMENDED — "Undiscovered Public Knowledge" (forensic series).** Each episode finds two bodies of public information that should be talking but aren't, such as:
- court rulings and app interface patents;
- terms of service and investor calls;
- a subreddit's folk theory and a platform's own engineering blog.

Chris then performs the Swanson bridge on camera, Forensic-Architecture style, with the documents on screen. The pilot is ready: "The Ontology of Waiting," built on Aslam vs. Ontario's Act vs. Heller.

*Why this one:* It uses Chris's rarest assets together (investigative method, filmmaking, McLuhan thinking). It rests on the one discovery method with a decades-long record. It produces claims that can be checked, which protects his forensic credibility. And it resists AI homogenisation, because the seed material is primary documents and his own observations, not what the model already contains.

**B. "Category Errors" (ontology series).** Short, punchy videos, each built on one Davis flip: "What kind of thing is an AI chatbot, really: a tool, a medium, a publisher, a pharmacy?" Test each proposed category against law, code, economics and user behaviour, and show where they disagree.

**C. "The Tetrad Desk" (live broadcast).** A weekly live show that runs a tetrad on the week's biggest media event. It requires one receipt per quadrant, uses audience submissions for "retrieve," and chains the reversal into next week's episode. This uses Chris's live-broadcasting background, and chaining makes the series a single long argument.

**D. "Folk Theory Lab" (peer-to-peer mining, done responsibly).** Collect a circulating folk theory from creators, drivers or sellers, separate observation from explanation, design a small test, and publish the verdict. Credit or anonymise sources and never amplify private posts. Over time this builds a public ledger of which folk theories held up, which would be a genuinely new dataset.

**E. "Alien Sampler for One" (tool on Cloudflare).** A personal version of the Artiles and Sourati–Evans idea:
- Break Chris's notes and saved sources into "idea atoms."
- Embed them (Workers AI plus a vector index).
- Log which combinations he, his usual sources and the default models already produce: his *personal availability map*.
- Each morning, surface one coherent combination he is *least* likely to reach on his own.

It is an anti-recommendation engine for thought. It could later become a product for other creators, which would be ambitious and new.

**F. "Probe Deck" (physical and digital product).** An Oblique-Strategies-style deck of about 52 cards combining McLuhan's tetrad, ontology moves and Davis's 12 categories, each with a paste-ready prompt on the back. A daily card draw becomes a recurring content slot, and the deck becomes merchandise and a signature.

**G. "The Catch" (insight-journal-as-show).** A monthly episode showing the month's catch log: what was cast, what came back, what was thrown away and why, and what survived the 24-hour quarantine. It makes the *process* the content, which is rare, fits McLuhan's thinking, and builds trust.

### Starter prompts (paste-ready)

**1. The crowd-avoidance cast**
> Topic: [X]. First, list the 6–8 positions that are already widely held about this. For each, name the group that holds it (industry, critics, academics, contrarians, platform users). Then give me 5 claims about [X] that are internally coherent, supported by at least one real named source, and that *none* of those groups is positioned to make. Give each a rough probability that a typical analyst would arrive at it, and include at least two under 10%. No generic synthesis.

**2. Swanson bridge**
> My phenomenon (C) is: [observation]. Step 1: list the 5–8 underlying mechanisms (B) that drive C. Step 2: for each B, find a separate field or body of documents (A) that studies or produces B but almost never refers to C. Name specific works, rulings, datasets or authors. Step 3: propose the 3 most promising A→B→C links nobody seems to have connected, and what primary evidence would confirm or kill each.

**3. Ontology audit**
> What kind of thing is [X] really? List every category it is currently filed under by (a) law and regulators, (b) the company's own code/terms, (c) users, (d) accountants/investors, (e) historians of earlier media. Where do these classifications contradict each other? Build the strongest case that [X] is actually a different kind of thing than its dominant category, in the form "what seems to be X is in reality non-X," and tell me what evidence would falsify it.

**4. Evidence-bound tetrad, chained**
> Run McLuhan's tetrad on [new medium/feature] at three scales: the feature, the platform, and the wider economy. For each quadrant (enhance, obsolesce, retrieve, reverse), give one claim and one concrete, checkable piece of evidence. For "retrieve," favour forgotten or failed precursors over famous ones. Then take the strongest "reverse" and run a second tetrad on *that*.

**5. Field transplant (random)**
> Describe [phenomenon] entirely in the vocabulary and methods of [randomly chosen field: e.g., hydrology / canon law / insurance underwriting / stage magic / epidemiology]. Which concept from that field reveals something the usual media-and-tech commentary misses? Name the source concept and a real text where it's defined.

**6. Folk-theory extractor**
> Below are posts from [community] about how [platform/system] works. Separate every *observation* (what people saw happen) from every *explanation* (why they think it happened). Group the explanations into competing folk theories. For each, say whether it's functional or structural, what cheap test would distinguish it from its rivals, and what public documentation (patents, engineering blogs, filings, rulings) bears on it. [paste posts]

**7. Disagreement and anomaly map**
> On [topic], where do credentialed experts actually disagree? Name them and their positions. Then list the anomalies: cases or data points the dominant explanation fails to account for. Which anomaly, if taken seriously, would force the biggest reframing?

**8. The independent judge (fresh session)**
> Here is a candidate insight: "[catch]." Do not improve it. Score it 1–5 on: Denial (which widely held assumption does it deny?), Distance (who would already find this obvious? name the field), Grip (what anomaly does it explain or what does it predict?), Proof (what primary evidence exists right now?). Then give the single strongest reason it's wrong.

**9. Figure/ground flip**
> In the current conversation about [phenomenon], what is being treated as *figure* (what everyone's looking at), and what is the *ground* (the environment, infrastructure, or default doing the real work)? Make the case that the ground is the real story, with evidence.

## Caveats

- **Evidence strength varies.** The findings on LLM homogeneity, the ideation–execution gap and aha misattribution come from peer-reviewed or major-venue studies. The Artiles et al. "alien space" paper is a recent preprint, and its model-specific numbers describe particular model versions on one research corpus (LLM papers), so they may not carry over directly to journalism. Treat the four-test rubric and the workflow as my synthesis, not validated instruments.
- **Some framings are speculative.** The gig-app tetrad, the "availability is the product" framing, and the link between Heller and section 12 of the Ontario Act are my extrapolations, flagged as such. The legal facts themselves (dates, holdings, vote counts, quotes) come from the judgments, the UK Supreme Court press summary and ontario.ca. The UK quotes are from the official press summary, which formally "does not form part of the reasons."
- **The tetrad's looseness cuts both ways.** Critics are right that almost anything can be fitted into its four quadrants. Its value comes from requiring evidence, not from the quadrants themselves.
- **Mining social media carries ethical obligations.** Folk theories are valuable, but amplifying individuals' posts can expose them. Anonymise by default, credit by permission, and never treat a viral claim as verified.
- **Novelty is not the same as truth or importance.** Davis himself separated "interesting" from "true," and later management scholars pushed back that "interesting" should serve "important." The quarantine and proof steps exist to make sure the most exciting catches earn their place.
