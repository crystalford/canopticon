# Commissioning research for Canopticon

A template for asking a deep-research tool for a report the record can use well. It keeps three things apart: what you want to know about the world, what you have already decided, and what you want for your own project.

## The prompt

```
QUESTION (about the world, one sentence)
<e.g. "When AI assistants do the shopping, who can tell an advertiser what an ad actually did?">

WHY I'M ASKING (two or three sentences, my words)
<what I'm trying to figure out, and why it matters to me>

DECIDED — treat as given, do not argue it
<e.g. "We will send the newsletter ourselves.">
Mark every passage that depends on these with "Given your decision…".

STAY ON THIS QUESTION
Do not frame findings through Marshall McLuhan or media theory, and do not
bring in my other projects or earlier research from memory, unless this
question is about them. If you think a connection matters, put it in one
sentence under Open questions, marked "outside the question".

WHAT I WANT BACK
1. Findings: what is true in the world, each claim with an inline source.
   Anything without a source is your inference — say so.
2. Beyond my project: what these findings mean for anyone working on this,
   not just for me. Keep my project's name out of this section.
3. Open questions: what nobody has measured, built or settled — stated plainly.
4. For my project (last, clearly headed): recommendations, options, kill lines.
```

## Why each part is there

- **One question about the world.** "How should my project track ads?" produces advice; "who can measure an ad when AI buys?" produces findings. Articles are built from findings.
- **Why I'm asking.** Becomes the first lines of any article that draws on the report — the author's own reason, not one the drafter invents.
- **Decided.** Your decisions come back as sentences that sound like evidence ("…so delivery is verified by construction") but are the report agreeing with you. Marking them lets the read tag them as **premise**, and premises are never quoted as evidence.
- **Stay on this question.** Research tools carry memory between runs. Without this line they frame unrelated topics through McLuhan (23 non-McLuhan documents in the record mention him — polling, fentanyl, feeds; `scan/mcluhan-bias.json`) and pull the author's projects into public findings. Any McLuhan mention in a non-McLuhan document is flagged by that audit before an article quotes it.
- **Inline sources.** The read sorts every passage into finding, reasoning, recommendation or premise. A source on each factual claim makes that sort reliable.
- **Beyond my project.** The material a public article can use. Project specifics stay in the last section, where the read files them as recommendation.

## Two kinds of report

- **Inquiry** — a question about the world. Feeds articles, concepts and open problems.
- **Build brief** — research for a project (Ancaster, Aldershot, Attenuate). Feeds the desk and the project page. Its findings can be cited; its recommendations and premises cannot.

Say which one you are commissioning at the top of the prompt. A build brief that turns up a finding worth an article can be followed by an inquiry on that finding.
