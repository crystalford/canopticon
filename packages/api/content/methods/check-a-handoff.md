---
slug: "check-a-handoff"
title: "Check a conclusion before handing it on"
dek: "Before a conclusion goes to someone, or something, that will act on it, attach its reason and a way to find out it is wrong. Works in both directions: on the instruction you give an AI, and on the answer it gives back."
theory: "the-certainty-handoff"
version: 1
date: "2026-11-28"
glance_formula: "conclusion → its reason + its hunches → a test that fails if it is wrong → handed on together"
use_when: "Before giving an AI agent an instruction that rests on a hunch, before acting on an AI's confident answer, and at any handover where someone else will build on your conclusion."
input: "The conclusion about to be handed on or acted on, and what it is for."
output: "Answers to the four questions, the reason in one sentence, the parts that are hunches, a test that would fail if the conclusion were wrong, and the handoff rewritten to carry them."
steps:
  - step: "Write the conclusion's reason in one sentence. If it will not come, the conclusion has not been checked."
  - step: "Mark what is a hunch: the parts you have not checked."
  - step: "Turn the reason into something the receiver can run: a test that fails if the conclusion is wrong, the case that prompted it, or the one thing that would change your mind."
  - step: "Ask for the conclusion back in the receiver's words; ask an AI to state the reason it will act on before it acts."
  - step: "Treat a fluent answer as unchecked until it has been run."
---

This method turns the theory of [the certainty handoff](/theories/the-certainty-handoff) into a procedure. A conclusion handed on carries the sender's confidence and leaves the reasons behind, so the sender does not check it and the receiver cannot. The method attaches the reasons and a test before it goes.

## What it rests on

- **Senders overrate how well they are understood.** People think their meaning comes across far more often than it does, and an instruction that is clear to its writer is often ambiguous to its reader.
- **Confidence travels without grounds.** A conclusion that feels right is less likely to be checked by the person who reached it, and the person who receives it has nothing to check it with.
- **Language models are inclined to agree.** Models tend to go along with a user's stated view, which makes a hunch handed to an agent harder to catch.
- **A runnable check closes the gap.** Clinical research on premature closure recommends rechecking findings against the first diagnosis and its alternatives.

The studies, their numbers and what was read of each are on the [theory's page](/theories/the-certainty-handoff).

## Steps

1. **Write the reason in one sentence.** If the sentence will not come, the conclusion has not been checked.
2. **Mark what is a hunch.** Say "I think" where you have not checked, so the receiver knows which parts to test.
3. **Turn the reason into something the receiver can run.** A test that fails if the conclusion is wrong, an example of the case that prompted it, or the one thing that would change your mind.
4. **Ask for the conclusion back in the receiver's words.** For an AI, ask it to state the reason it will act on before it acts.
5. **Treat a fluent answer as unchecked until it has been run.** Apply the same rules to what comes back.

## The instruction

Paste this, followed by the conclusion and what it is for, into a conversation with a language model, or download it as a skill below. It works on an instruction you are about to give, and on an answer you have been given.

```text
Check a conclusion before it is handed on or acted on, so that it carries its reason and a way to find out it is wrong.

The conclusion follows. It is either an instruction someone is about to give (to a person or an AI), or an answer someone has received and is about to act on. Say which.

1. Ask the four questions and answer each yes or no, with one line of why:
   a. Can the reason it is true be said in one sentence?
   b. Has it been checked, or does it only feel right?
   c. Does the receiver have what they would need to find out it is wrong?
   d. If it were wrong, would anything fail before the work built on it is done?

2. Write the reason in one sentence. If no single sentence fits, say so: the conclusion is not yet checked.

3. List the parts that are hunches: stated as fact but not checked.

4. Propose one test the receiver can run that would fail if the conclusion were wrong. Prefer the actual case that prompted the conclusion. If no test is possible, name the one observation that would change the conclusion.

5. Rewrite the handoff so it carries the reason, marks the hunches, and includes the test. Keep it short.

6. If the conclusion came from an AI, do not judge it by how convincing the explanation is. Say what would have to be run or looked up to confirm it, and whether that has been done.

Do not agree with the conclusion to be helpful. If a question is answered no, say so plainly.
```

## Worked example

**Renaming with an agent.** A developer tells a coding agent: "Rename `processItems` to `syncRecords` everywhere."

| Question | Answer |
| --- | --- |
| Reason in one sentence? | Yes: the function no longer processes items; it syncs records to the server. |
| Checked? | No. The new name has not been tried against every place the function is used. |
| Can the receiver find out it is wrong? | No. The agent has not been told why, so it cannot tell a right rename from a wrong one. |
| Would anything fail first if it were wrong? | No. Nothing would flag a call site where the old name was still the right one. |

Three noes. The rewritten handoff: "Rename `processItems` to `syncRecords`: it now syncs records to the server instead of processing items locally. I have not checked the two calls in the import script; flag them if they still process locally. Then run the sync test, which calls it on the case that prompted this." One sentence of reason, one marked hunch, one test.

Two more worked examples, an answer from an AI and a clinical shift handover, are on the [theory's page](/theories/the-certainty-handoff).

## Where it fails

- **Stating grounds has costs.** Putting a forming idea into words can disrupt it. Run the check once the idea has formed, and keep it for conclusions others will build on, not every remark.
- **Experienced people may already adjust.** Professionals delegating long tasks to AI already write rigid, exhaustive instructions. The method matters most for people new to directing an AI, and for those who have stopped being careful.
- **Parts of the evidence were gathered for other purposes.** The studies of overestimation used ambiguous sentences and email tone, not technical instructions, and the cost of rework in AI-directed work has not been measured.
- **Models change.** The tendency to agree was measured in models of 2023 and 2024, and later training may narrow it.
