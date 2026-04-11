import { generateText, generateObject } from 'ai'
import { z } from 'zod'
import { db } from '@/db'
import { investigations, articles, socialPosts } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getAnthropicModel, getOpenAIModel } from './providers'

// ============================================================================
// Multi-Phase AI Investigative Journalist Pipeline
// State Machine: pending -> researching -> cross_checking -> writing -> fact_checking -> completed
// ============================================================================

export type InvestigationPhase =
  | 'pending'
  | 'researching'
  | 'cross_checking'
  | 'writing'
  | 'fact_checking'
  | 'completed'
  | 'failed';

export class InvestigationPipeline {

  /**
   * Main entrypoint: Resume or start an investigation based on its status.
   */
  static async run(investigationId: string) {
    const investigation = await db.query.investigations.findFirst({
      where: eq(investigations.id, investigationId)
    });

    if (!investigation) throw new Error(`Investigation ${investigationId} not found`);

    try {
      if (investigation.status === 'pending') {
        await this.stepResearch(investigationId, investigation.seedPrompt);
      }

      const invAfterResearch = await this.getLatest(investigationId);
      if (invAfterResearch.status === 'researching') {
         await this.stepCrossCheck(investigationId, invAfterResearch);
      }

      const invAfterCrossCheck = await this.getLatest(investigationId);
      if (invAfterCrossCheck.status === 'cross_checking') {
         await this.stepWriting(investigationId, invAfterCrossCheck);
      }

      const invAfterWriting = await this.getLatest(investigationId);
      if (invAfterWriting.status === 'writing') {
         await this.stepFactCheck(investigationId, invAfterWriting);
      }

      // stepFactCheck already transitions to completed or failed internally

    } catch (error) {
      console.error(`Pipeline failed for ${investigationId}:`, error);
      await this.updateStatus(investigationId, 'failed', {
         errorMessage: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private static async getLatest(id: string) {
    return (await db.query.investigations.findFirst({ where: eq(investigations.id, id) }))!;
  }

  private static async updateStatus(id: string, status: InvestigationPhase, data: any = {}) {
     await db.update(investigations).set({ status, ...data, updatedAt: new Date() }).where(eq(investigations.id, id));
  }

  // --------------------------------------------------------------------------
  // Phase 1: Research
  // AI gathers dimensions, context, and generates a structured research dossier.
  // --------------------------------------------------------------------------
  private static async stepResearch(id: string, seedPrompt: string) {
    await this.updateStatus(id, 'researching');

    // In a real implementation with internet access, we would give the model tools (Tavily/Google Search) here.
    // For now, we simulate deep research generation.
    const { object } = await generateObject({
      model: getAnthropicModel('claude-3-5-sonnet-latest'),
      schema: z.object({
        coreNarrative: z.string().describe("The objective timeline of events or core facts."),
        keyEntities: z.array(z.string()).describe("People, organizations, or concepts involved."),
        historicalContext: z.string().describe("Background information needed to understand the topic."),
        divergentPerspectives: z.array(z.string()).describe("How different sides view the issue."),
      }),
      system: "You are Canopticon's Lead Researcher. You are unbiased, meticulous, and objective. Break down the provided topic into a structured research dossier. Do not editorialize.",
      prompt: `Topic / Seed: ${seedPrompt}\nGenerate a comprehensive research dossier.`,
    });

    await this.updateStatus(id, 'cross_checking', { researchData: object });
  }

  // --------------------------------------------------------------------------
  // Phase 2: Cross-Checking / Fallacy Detection
  // AI analyzes the research for common media spin, fallacies, or missing context.
  // --------------------------------------------------------------------------
  private static async stepCrossCheck(id: string, investigation: any) {
    const { object } = await generateObject({
      model: getOpenAIModel('gpt-4o'),
      schema: z.object({
        identifiedSpin: z.array(z.string()).describe("Common ways this topic is misrepresented in mainstream media."),
        logicalFallaciesToAvoid: z.array(z.string()).describe("Fallacies (e.g., ad hominem, strawman) that are often used when discussing this."),
        missingContext: z.string().describe("What the dominant narrative usually leaves out."),
      }),
      system: "You are Canopticon's Fallacy Detector and Cross-Checker. Your job is to analyze research and point out potential bias, spin, and logical fallacies that often surround the topic.",
      prompt: `Research Dossier:\n${JSON.stringify(investigation.researchData, null, 2)}\n\nAnalyze this dossier for potential spin and fallacies to avoid during writing.`,
    });

    await this.updateStatus(id, 'writing', { crossCheckNotes: object });
  }

  // --------------------------------------------------------------------------
  // Phase 3: Writing
  // Drafts the full, unvarnished, punk-rock-yet-neutral investigative piece.
  // --------------------------------------------------------------------------
  private static async stepWriting(id: string, investigation: any) {
    const { text } = await generateText({
      model: getAnthropicModel('claude-3-5-sonnet-latest'),
      system: `You are Canopticon's Lead Writer. Your tone is indie, punk-rock, rigorous, and strictly neutral on facts.
      You do NOT editorialize. You lay out the raw truth with an edge of skeptical investigative rigor.
      Format the output in clean Markdown.`,
      prompt: `
        Write an in-depth investigative article based on the following data.

        Topic: ${investigation.title}

        Research Dossier:
        ${JSON.stringify(investigation.researchData, null, 2)}

        Cross-Check / Spin to avoid:
        ${JSON.stringify(investigation.crossCheckNotes, null, 2)}
      `,
    });

    await this.updateStatus(id, 'fact_checking', { draftContent: text });
  }

  // --------------------------------------------------------------------------
  // Phase 4: Fact-Checking
  // Final pass to ensure the draft adheres to neutrality and accuracy.
  // --------------------------------------------------------------------------
  private static async stepFactCheck(id: string, investigation: any) {
    const { object } = await generateObject({
      model: getAnthropicModel('claude-3-5-haiku-latest'),
      schema: z.object({
        isFactuallyNeutral: z.boolean(),
        containsEditorialization: z.boolean(),
        critique: z.string().describe("Notes on what needs fixing, or 'Approved' if clean."),
        approvedDraft: z.string().describe("The final, corrected Markdown text if changes were needed, or the original if approved."),
        title: z.string().describe("A sharp, objective title for the article."),
        summary: z.string().describe("A 2-sentence summary of the article."),
        xPostDraft: z.string().describe("A sharp, engaging, objective 280-character post for X (Twitter) extracting the best line/hook."),
      }),
      system: "You are Canopticon's Editor-in-Chief. Review the draft for any editorial spin, emotional language, or bias. Ensure the final approved draft is perfectly neutral yet rigorous.",
      prompt: `
        Draft to review:
        ${investigation.draftContent}

        Original Context:
        ${JSON.stringify(investigation.researchData)}
      `,
    });

    if (object.containsEditorialization && !object.isFactuallyNeutral) {
        // If it failed hard, we could theoretically loop back to 'writing'.
        // For now, we trust the Haiku model to fix it in `approvedDraft`.
    }

    await this.updateStatus(id, 'completed', {
        draftContent: object.approvedDraft,
        fallacyReport: { critique: object.critique, wasFlagged: object.containsEditorialization }
    });

    // --------------------------------------------------------------------------
    // Pipeline Success: Create CMS entities (Article + SocialPost)
    // --------------------------------------------------------------------------
    // 1. Generate slug
    const slug = object.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

    // 2. Insert Article
    const [article] = await db.insert(articles).values({
        investigationId: id,
        title: object.title,
        slug: `${slug}-${Math.floor(Math.random() * 1000)}`,
        content: object.approvedDraft,
        summary: object.summary,
        status: 'draft', // Requires final human approval via CMS to publish
    }).returning();

    // 3. Insert Social Post Draft
    await db.insert(socialPosts).values({
        articleId: article.id,
        content: object.xPostDraft,
        status: 'draft'
    });
  }
}
