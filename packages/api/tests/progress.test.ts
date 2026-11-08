// While Claude works the page shows where a report stands, in true counts
// (write/progress.ts), and Stop ends a turn at its next step.

import { describe, expect, it } from "vitest";
import type { Env } from "../src/env";
import { logHtml, stepsSummary } from "../src/site/pages/write";
import { runTurn } from "../src/write/agent";
import { memoryDrafts } from "../src/write/drafts";
import { WORKERS_MESSAGE_CAP_CENTS } from "../src/write/engines";
import { reportState, stageOf, wordCount } from "../src/write/progress";

const BODY = `# Rent bans

## TL;DR

_(to write)_

## Details

### 1. What the bans removed

The registry counts listings [1].

### 2. What happened to rents

_(to write)_

## Sources

1. [Registry](https://a.example)
`;

describe("where a report stands", () => {
  it("counts sections laid out and written, and the parts still to write", () => {
    expect(reportState(BODY)).toEqual({ outlined: true, sections: 2, written: 1, partsLeft: 1 });
    expect(reportState("# Just a title")).toMatchObject({ outlined: false, sections: 0 });
  });

  it("names the stage from the body and who is at work", () => {
    expect(stageOf("", { researchers: 0, reviewers: 0 }).stage).toBe("plan");
    expect(stageOf(BODY, { researchers: 3, reviewers: 0 }).stage).toBe("research");
    expect(stageOf(BODY, { researchers: 0, reviewers: 0 }).stage).toBe("write");
    expect(stageOf(BODY, { researchers: 0, reviewers: 2 }).stage).toBe("review");
    const all = BODY.replace(
      "### 2. What happened to rents\n\n_(to write)_",
      "### 2. What happened to rents\n\nThey rose [1].",
    );
    expect(stageOf(all, { researchers: 0, reviewers: 0 })).toMatchObject({
      stage: "summary",
      written: 2,
    });
  });

  it("counts words without the Sources list, headings or blanks", () => {
    expect(wordCount(BODY)).toBe(5);
  });
});

describe("steps in the chat", () => {
  it("folds a run of steps into one line with counts", () => {
    expect(
      stepsSummary([
        "Searched the web: rent bans",
        "§2 Read: https://a.example",
        "Read: https://b.example",
        "Noted: rents rose",
        "Wrote section 1",
      ]),
    ).toBe("5 steps · searched 1 · read 2 pages · noted 1 · wrote 1");
    const html = logHtml([
      { who: "you", text: "Go" },
      { who: "activity", text: "Searched the web: a" },
      { who: "activity", text: "Read: https://a.example" },
      { who: "claude", text: "Done." },
      { who: "activity", text: "Wrote the draft" },
    ]);
    expect(html).toContain('<details class="ws-steps"><summary>2 steps · searched 1 · read 1 page');
    // A single step stays a plain line.
    expect(html).toContain('<div class="ws-act">Wrote the draft</div>');
  });
});

describe("Stop", () => {
  it("ends the turn at its next step, keeping what was done", async () => {
    const store = memoryDrafts();
    const d = await store.create("research");
    let calls = 0;
    const env = {
      LOG_LEVEL: "error",
      AI: {
        run: async () => {
          calls++;
          // Chris presses Stop while the first step is running.
          const now = await store.get(d.id);
          await store.save(d.id, {
            meta: { ...now?.meta, stopAt: new Date(Date.now() + 5).toISOString() },
          });
          return {
            choices: [
              {
                message: {
                  role: "assistant",
                  content: null,
                  tool_calls: [
                    {
                      id: `t${calls}`,
                      type: "function",
                      function: { name: "list_documents", arguments: "{}" },
                    },
                  ],
                },
                finish_reason: "tool_calls",
              },
            ],
            usage: { prompt_tokens: 100, completion_tokens: 10 },
          };
        },
      },
    } as unknown as Env;
    const events: Array<{ type: string; text?: string }> = [];
    await new Promise((r) => setTimeout(r, 10));
    await runTurn({
      stream: null,
      defaultEngine: "@cf/deepseek-ai/deepseek-v4.1-flash-1017",
      env,
      store,
      draftId: d.id,
      text: "Did the bans lower rents?",
      maxSteps: 10,
      emit: (e) => events.push(e as never),
    });
    expect(calls).toBe(1);
    expect(
      events.some((e) => e.type === "activity" && /^Stopped, as you asked/.test(e.text ?? "")),
    ).toBe(true);
    expect(events.at(-1)?.type).toBe("done");
    // The conversation is kept, and the next message can carry on.
    expect((await store.messages(d.id)).length).toBeGreaterThan(2);
  });

  it("stops a message at the spending cap, whatever the model does", async () => {
    const store = memoryDrafts();
    const d = await store.create("research");
    let calls = 0;
    const env = {
      LOG_LEVEL: "error",
      AI: {
        // A runaway: every step asks for more, and each costs about $1.
        run: async () => {
          calls++;
          return {
            choices: [
              {
                message: {
                  role: "assistant",
                  content: null,
                  tool_calls: [
                    {
                      id: `t${calls}`,
                      type: "function",
                      function: { name: "list_documents", arguments: "{}" },
                    },
                  ],
                },
                finish_reason: "tool_calls",
              },
            ],
            usage: { prompt_tokens: 3_400_000, completion_tokens: 10 },
          };
        },
      },
    } as unknown as Env;
    const events: Array<{ type: string; text?: string }> = [];
    await runTurn({
      stream: null,
      defaultEngine: "@cf/deepseek-ai/deepseek-v4.1-flash-1017",
      env,
      store,
      draftId: d.id,
      text: "Did the bans lower rents?",
      maxSteps: 20,
      emit: (e) => events.push(e as never),
    });
    // $1.02 after one step, $2.04 after two: the cap ($1.50) stops it there.
    expect(calls).toBe(2);
    expect(WORKERS_MESSAGE_CAP_CENTS).toBe(150);
    expect(
      events.some(
        (e) => e.type === "activity" && /^Stopped at the spending cap/.test(e.text ?? ""),
      ),
    ).toBe(true);
  });
});
