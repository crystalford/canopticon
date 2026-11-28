---
slug: "find-the-restock-gaps"
title: "Find the restock gaps in a routine"
dek: "List what a daily routine rests on, find the supplies, payments and services that are kept up only when they run out, and move each reminder ahead of the failure, so one missing thing stops one thing."
theory: "the-restock-gap"
version: 1
date: "2026-11-28"
glance_formula: "routine → what it rests on → restocked only on running out? → reminder moved ahead of failure"
use_when: "When a routine keeps failing for reasons that seem random, when setting up a new routine, or before relying on one that other things depend on."
input: "A routine, or a few, described as they actually run: what happens, how often, and what it uses."
output: "A table of what each routine rests on, how often it is used against how often it is restocked, what prompts the restock, what depends on the routine, and for each gap an earlier reminder, a fixed occasion and a fallback."
steps:
  - step: "Walk through the routine once and name every supply, payment, service and person it needs."
  - step: "For each, note how often the routine uses it and how often it is restocked, paid or renewed."
  - step: "Note what prompts the restock. If the only prompt is running out, that is a gap."
  - step: "Find the carriers: habits other behaviours are tied to, and what those behaviours need if the carrier stops."
  - step: "Move each reminder ahead of failure: a second unit in reserve, bought when it is opened, or a level at which to restock."
  - step: "Tie each upkeep task to an occasion that already happens, and give each carrier a fallback."
  - step: "Write the list down and check it on a fixed day."
---

This method turns the theory of [the restock gap](/theories/the-restock-gap) into a procedure. Habits run on their own, but the supplies, money and services they need are kept up by occasional tasks that nobody tracks, and the routine fails when one lapses. The method finds those tasks and gives each one a reminder that comes before the failure.

## What it rests on

- **Habits need frequent, stable repetition.** Automaticity builds over weeks to months of repeating a behaviour in a fixed context; tasks done weekly or less, at varying times, stay deliberate.
- **Deliberate tasks with an immediate cost are put off.** And a task prompted only by running out is reminded at the worst moment.
- **Routines run as chunks.** Behaviours done in sequence are joined into one unit, so a routine fails at its least automatic link and takes what is tied to it along.
- **An early reminder works.** The two-bin system, used in hospital stockrooms, keeps a second supply and reorders when it is opened. Monitoring helps goals hold, most of all when it is recorded.

The studies, their numbers and what was read of each are on the [theory's page](/theories/the-restock-gap).

## Steps

1. **List what the routine rests on.** Walk through it once and name every supply, payment, service and person it needs.
2. **Compare the rates.** How often the routine uses each thing, and how often it is restocked, paid or renewed.
3. **Find what prompts each restock.** Running out is a prompt that comes too late.
4. **Find the carriers.** Habits that other behaviours are tied to, and what those behaviours would need if the carrier stopped.
5. **Move the reminder ahead of failure.** Keep a second unit in reserve and buy when you open it, or set a level at which you restock.
6. **Tie the upkeep task to a fixed occasion, and give each carrier a fallback.** Put the item on a standing list or a trip that already happens weekly; decide in advance what the tied behaviour does if the carrier is missing.
7. **Write the list down and check it on a fixed day.**

## The instruction

Paste this, followed by a description of your routine or routines, into a conversation with a language model, or download it as a skill below.

```text
Find the restock gaps in a routine: the supplies, payments, services and people a habit rests on that are kept up only when they run out.

The routine follows, described as it actually runs. If anything below cannot be told from the description, ask before answering.

1. Walk through the routine step by step and list everything it rests on: supplies (food, drink, hygiene, medication, equipment that needs charging or replacing), money and services (subscriptions, payments, accounts), and people.

2. For each item, give:
   - how often the routine uses it;
   - how often it is restocked, paid or renewed;
   - what prompts the restock today. If the only prompt is running out or a failure notice, mark it as a gap.

3. Find the carriers: habits that other behaviours are tied to (a supplement taken with coffee, work that starts after the coffee). For each, say what the tied behaviour would need if the carrier failed.

4. For each gap, propose:
   - an earlier reminder: a second unit in reserve, bought when it is opened, or a level at which to restock;
   - a fixed occasion to attach the upkeep task to, chosen from what already happens weekly in the routine described;
   - for a carrier, a fallback that keeps the tied behaviour going.

5. Give the result as a table: item, uses, restocks, current prompt, gap (yes or no), earlier reminder, fixed occasion, fallback. Then list the gaps in order of what fails with them.

6. End with the short list to check on a fixed day each week.

Do not judge which habits are worth keeping. Do not suggest buying more than one spare unit.
```

## Worked example

**Morning coffee.** Coffee is made every day. Cream is bought weekly, and the only reminder is an empty carton. A supplement is taken in the coffee, and the coffee starts the morning's work.

| Item | Uses | Restocks | Prompt | Gap | Earlier reminder | Occasion | Fallback |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Cream | Daily | Weekly | Empty carton | Yes | Keep a second carton; buy one when it is opened | The weekly shop | Milk powder in the cupboard |
| Coffee | Daily | Every two to three weeks | Empty bag | Yes | Keep one bag in reserve | The weekly shop | None needed with a spare |
| Supplement | Daily, in the coffee | Monthly | Empty bottle | Yes | Reorder when the last strip is opened | First of the month | Take it with water if there is no coffee |

The coffee is a carrier: the supplement and the start of work are tied to it. The bad morning had been blamed on the morning, and traced, it was the cream.

More worked examples, flossing and an office printer, are on the [theory's page](/theories/the-restock-gap).

## Where it fails

- **Habits recover.** A missed day does not reset a habit, so a supply failure costs a bad morning more than the habit, unless failures repeat.
- **Some supply tasks are already habits.** A weekly shop on the same day at the same store may close the gap without a list. The method matters most where restocking is ad hoc.
- **A broken chain can be an opportunity.** Behaviour change works better after a disruption such as a move; a failed carrier is a chance to rebuild the routine on purpose.
- **The parts were studied in different settings.** Habit formation with health behaviours, chunking with button presses and maze-running rats, the two-bin system in hospital stockrooms. That they combine in household routines has not been tested.
