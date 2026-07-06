// Planner — the strategic tier of the agent (separate from the per-step vision executor).
//
// Two-tier agentic pattern (MiroFish-style):
//   • PLANNER (this file): goal + site → an ordered, checkable plan (steps + success criteria).
//                          Runs once up front, and RE-PLANS when the executor stalls.
//   • EXECUTOR (agent-task.ts): per step, looks at the screenshot and picks the next concrete
//                          action. The plan is its guide-rail, not a rigid script.
//
// The planner is text-only and runs through the same swappable brain (Gemini primary → Qwen/GLM
// fallback) via brainText(), so it inherits the free-chain + auto-fallback for free.

import { brainText } from './vision-brain';

export type StepStatus = 'pending' | 'active' | 'done';

export interface PlanStep {
  id: number;
  text: string;        // short imperative instruction
  status: StepStatus;
}

export interface AgentPlan {
  goal: string;
  successCriteria: string;   // how the agent knows it's finished
  steps: PlanStep[];
  revision: number;          // 0 = first plan, increments on each replan
}

// ─── Create the initial plan ─────────────────────────────────────────────────

export async function createPlan(goal: string, targetUrl: string, priorSkills: string[] = []): Promise<AgentPlan> {
  const learned = priorSkills.length
    ? `\nLEARNED FROM PAST SUCCESSFUL RUNS ON THIS SITE (reuse what worked — it's proven):\n${priorSkills.map(s => `- ${s}`).join('\n')}\n`
    : '';
  const prompt = `You are the PLANNER for a browser-automation agent. Break the user's goal into a short,
ordered plan of concrete UI steps the agent will perform on the site.

GOAL: "${goal}"
SITE: ${targetUrl}
${learned}

Return ONLY this JSON (no markdown):
{
  "successCriteria": "<one sentence: what the screen shows when the goal is achieved>",
  "steps": ["<imperative step>", "<imperative step>", ...]
}

Rules:
- 3 to 6 steps. Each step is ONE concrete UI action (e.g. "Click the search box", "Type 'coffee maker'",
  "Press Enter", "Wait for results", "Click the first product").
- Assume the agent must handle login/CAPTCHA itself by pausing for the human — do NOT add a login step
  unless the goal explicitly needs an account action.
- Keep steps generic enough to survive small layout differences. No site-specific CSS selectors.`;

  const raw = await brainText({ prompt, json: true });
  return normalizePlan(goal, raw, 0);
}

// ─── Re-plan after a stall / failure ─────────────────────────────────────────

export interface ReplanContext {
  goal: string;
  targetUrl: string;
  currentUrl: string;
  completedSteps: string[];   // human-readable actions already taken
  reason: string;             // why we're replanning (e.g. "stuck waiting 3x")
  previousRevision: number;
}

export async function replan(ctx: ReplanContext): Promise<AgentPlan> {
  const prompt = `You are the PLANNER for a browser-automation agent. The current plan STALLED and you must
produce a fresh, corrected plan to still achieve the goal.

GOAL: "${ctx.goal}"
SITE: ${ctx.targetUrl}
CURRENT URL: ${ctx.currentUrl}
WHY WE STALLED: ${ctx.reason}

ACTIONS ALREADY TRIED (don't blindly repeat the ones that didn't help):
${ctx.completedSteps.map((s, i) => `${i + 1}. ${s}`).join('\n') || '(none)'}

Return ONLY this JSON (no markdown):
{
  "successCriteria": "<one sentence success check>",
  "steps": ["<imperative step>", ...]
}

Rules:
- 3 to 6 steps. Start from the CURRENT state, not the beginning. Try a DIFFERENT approach for whatever
  was stuck (e.g. scroll first, dismiss a popup, use a different control).
- One concrete UI action per step. No site-specific CSS selectors.`;

  const raw = await brainText({ prompt, json: true });
  return normalizePlan(ctx.goal, raw, ctx.previousRevision + 1);
}

// ─── Stall heuristic (cheap, no model call) ──────────────────────────────────
// The executor calls this each step. We replan if the agent is clearly spinning:
//   • 3+ consecutive "wait" actions, OR
//   • the same (action+target) repeated 3 times in a row.

export function detectStall(recent: Array<{ action: string; detail: string }>): boolean {
  if (recent.length < 3) return false;
  const last3 = recent.slice(-3);
  if (last3.every(s => s.action === 'wait')) return true;
  const sig = (s: { action: string; detail: string }) => `${s.action}::${s.detail}`;
  if (last3.every(s => sig(s) === sig(last3[0]))) return true;
  return false;
}

// ─── Internals ───────────────────────────────────────────────────────────────

function normalizePlan(goal: string, raw: string, revision: number): AgentPlan {
  const parsed = safeParse(raw);
  let stepTexts: string[] = [];
  let successCriteria = '';

  if (parsed && Array.isArray(parsed.steps)) {
    stepTexts = parsed.steps.map((s: unknown) => String(s).trim()).filter(Boolean);
    successCriteria = String(parsed.successCriteria || '').trim();
  } else {
    // Fallback: treat the raw text as newline-separated steps.
    stepTexts = raw.split(/\r?\n/).map(s => s.replace(/^[-*\d.\s]+/, '').trim()).filter(Boolean);
  }

  stepTexts = stepTexts.slice(0, 6);
  if (stepTexts.length === 0) {
    stepTexts = ['Look at the page', 'Take the most useful action toward the goal', 'Report the result'];
  }
  if (!successCriteria) successCriteria = `The page clearly shows the result of: ${goal}`;

  const steps: PlanStep[] = stepTexts.map((text, i) => ({
    id: i,
    text,
    status: i === 0 ? 'active' : 'pending',
  }));

  return { goal, successCriteria, steps, revision };
}

function safeParse(raw: string): any | null {
  const cleaned = (raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(cleaned); }
  catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]); } catch { /* ignore */ } }
    return null;
  }
}

/** Advance the plan's active pointer by one (called when the executor completes a real action). */
export function advancePlan(plan: AgentPlan): AgentPlan {
  const steps = plan.steps.map(s => ({ ...s }));
  const activeIdx = steps.findIndex(s => s.status === 'active');
  if (activeIdx >= 0) {
    steps[activeIdx].status = 'done';
    if (activeIdx + 1 < steps.length) steps[activeIdx + 1].status = 'active';
  }
  return { ...plan, steps };
}
