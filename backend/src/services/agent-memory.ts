// Agent Skill Memory — a self-improving / lifelong-learning web agent.
//
// Most web agents are amnesiacs: every run starts from zero. This gives the agent a MEMORY of what
// worked. After a task succeeds, we save the action sequence ("skill") keyed by the site's domain.
// Before planning a NEW task, we recall the most similar past skills for that site and feed them to
// the planner as a learned "playbook" — so the agent reuses what worked and gets faster + more
// reliable the more you use it. (Research direction: skill libraries / lifelong agents, e.g. Voyager.)
//
// Deliberately simple + dependency-free: JSON on disk, keyword-overlap similarity (no embeddings).

import * as fs from 'fs';
import * as path from 'path';

const SKILLS_PATH = path.resolve(__dirname, '../../data/agent-skills.json');

export interface Skill {
  id: string;
  domain: string;          // e.g. "amazon.in"
  goal: string;            // the natural-language goal that succeeded
  steps: string[];         // the human-readable action sequence that worked
  createdAt: string;
  uses: number;            // how many times this skill has been recalled
}

// ─── Persistence ─────────────────────────────────────────────────────────────

function load(): Skill[] {
  try { return JSON.parse(fs.readFileSync(SKILLS_PATH, 'utf-8')); }
  catch { return []; }
}
function save(skills: Skill[]): void {
  try {
    fs.mkdirSync(path.dirname(SKILLS_PATH), { recursive: true });
    fs.writeFileSync(SKILLS_PATH, JSON.stringify(skills, null, 2), 'utf-8');
  } catch (e) { console.error('[AgentMemory] save failed:', e); }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function domainOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return (url || '').toLowerCase(); }
}

/** Save a successful task as a reusable skill (deduping near-identical goals on the same domain). */
export function saveSkill(input: { domain: string; goal: string; steps: string[] }): Skill | null {
  const steps = (input.steps || []).map(s => s.trim()).filter(Boolean);
  if (!input.domain || !input.goal || steps.length === 0) return null;

  const skills = load();
  // If we already have a very similar goal on this domain, replace it (keep the freshest "how-to").
  const dupIdx = skills.findIndex(s => s.domain === input.domain && similarity(s.goal, input.goal) >= 0.6);
  const skill: Skill = {
    id: dupIdx >= 0 ? skills[dupIdx].id : `skill-${Date.now()}`,
    domain: input.domain,
    goal: input.goal.trim(),
    steps,
    createdAt: new Date().toISOString(),
    uses: dupIdx >= 0 ? skills[dupIdx].uses : 0,
  };
  if (dupIdx >= 0) skills[dupIdx] = skill; else skills.push(skill);
  save(skills);
  console.log(`[AgentMemory] 💾 Saved skill for ${skill.domain}: "${skill.goal}" (${steps.length} steps)`);
  return skill;
}

/** Recall the most relevant past skills for a new task on the same site. */
export function recallSkills(domain: string, goal: string, k = 3): Skill[] {
  const skills = load();
  const ranked = skills
    .filter(s => s.domain === domain)
    .map(s => ({ s, score: similarity(s.goal, goal) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .filter(x => x.score > 0)        // only return actually-relevant skills
    .map(x => x.s);

  if (ranked.length) {
    // bump usage counters
    const all = load();
    for (const r of ranked) { const m = all.find(s => s.id === r.id); if (m) m.uses++; }
    save(all);
    console.log(`[AgentMemory] 🧠 Recalled ${ranked.length} prior skill(s) for ${domain}: "${goal}"`);
  }
  return ranked;
}

/** Render recalled skills as planner context. */
export function skillsAsContext(skills: Skill[]): string[] {
  return skills.map(s => `Previously on ${s.domain} you achieved "${s.goal}" with: ${s.steps.join(' → ')}`);
}

export function listSkills(): Skill[] {
  return load().sort((a, b) => b.uses - a.uses);
}

// ─── Similarity (keyword overlap / Jaccard, lowercased) ──────────────────────

function tokenize(s: string): Set<string> {
  return new Set((s || '').toLowerCase().match(/[a-z0-9]+/g)?.filter(w => w.length > 2) || []);
}
function similarity(a: string, b: string): number {
  const A = tokenize(a), B = tokenize(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);   // Jaccard
}
