# ADE — Autonomous Demo Engine: Architecture

> Core principle: **the LLM (brain) can only SEE and UNDERSTAND. It cannot click, type, or draw.**
> So everything around it exists to give the brain **eyes, hands, memory, and a loop**.

---

## 1. The one-line mental model

```
        SEE  ──────────►  THINK  ──────────►  ACT  ──────────►  (page changes) ──┐
   (perception)          (the brain/LLM)     (the hands)                         │
        ▲                                                                        │
        └────────────────────────── repeat the loop ◄───────────────────────────┘
```

The brain never touches the browser. It only **looks at a description of the screen** and **replies
with one decision** (JSON). Deterministic code does the rest.

---

## 2. Who is the "brain"?

The brain is an **LLM, accessed through a swappable chain** (`backend/src/services/vision-brain.ts`).
It is the ONLY part that reasons. It has two entry points:

- `visionDecide({prompt, imagePath})` → looks at a screenshot, returns an action
- `brainText({prompt, json})` → looks at a TEXT description, returns an action / plan (JSON)

**Brain chain (tries each in order, falls over on quota/error):**

```
Gemini 2.5 Flash (key1 → key2 → key3)   ──►   OpenRouter (free gemma vision)   ──►   [next] Browser-AI
       (API, primary)                              (API, free fallback)            (drive free ChatGPT/Gemini
                                                                                     web app in YOUR logged-in
                                                                                     Chrome — $0, via attach)
```

Swap with env vars only — no code change. `brainChainSummary()` prints the live chain.

---

## 3. The four things we give the brain

| The brain lacks… | We provide it with… | Where |
|---|---|---|
| **Eyes** | Screenshot + a **text inventory of interactive elements** ("set-of-marks": `1:[canvas]`, `3:[button] "Text"`) | `autonomousDemo()` inventory; `agent-marks.ts` (numbered boxes for vision) |
| **Hands** | A **Puppeteer executor** that turns a decision into a real mouse click / keystroke / draw stroke / scroll | `browser-recorder.ts`, `agent-task.ts` |
| **Memory** | Short-term action history (this run) + long-term **skill memory** (winning sequences per site) | `agent-memory.ts` |
| **A loop + guardrails** | The agent loop, plus safety (block pay/delete) and human-in-the-loop gates | the loops below |

> **This is the answer to "LLM only can see and understand":** the LLM is just the *think* box.
> The *see* box (perception) and the *act* box (Puppeteer) are plain code wrapped around it.

---

## 4. The agents (multi-agent system)

```
                ┌─────────────────────────────────────────────────────────────┐
                │                      ORCHESTRATION                            │
                │   routes/api.ts  +  supervisor.ts   (REST + state + events)   │
                └───────────────┬───────────────────────────┬─────────────────┘
                                │                            │
          ┌─────────────────────▼──────────┐     ┌───────────▼───────────────────┐
          │  EXPLORER / DEMO agent          │     │  SUPERVISED TASK agent          │
          │  browser-recorder.autonomousDemo│     │  agent-task.ts                  │
          │  "show every feature of any app"│     │  "do anything" (order food,     │
          │  see → brain → act → record     │     │   book ticket) + human gates    │
          └───────┬─────────────────┬───────┘     └───────────┬────────────────────┘
                  │ calls           │ records                  │ calls
                  ▼                 ▼                          ▼
        ┌──────────────────┐  ┌─────────────────┐    ┌──────────────────┐
        │  BRAIN           │  │  RECORDER       │    │  PLANNER          │
        │  vision-brain.ts │  │  CDP screencast │    │  planner.ts       │
        │  (LLM chain)     │  │  → frames → mp4 │    │  plan + replan    │
        └──────────────────┘  └────────┬────────┘    └──────────────────┘
                                        │ screenshots + video
                                        ▼
                            ┌────────────────────────────┐
                            │  DIRECTOR / VIDEO agent     │
                            │  marketing-director.ts      │
                            │  → scene plan (LLM)         │
                            │  → Remotion render (16:9 +  │
                            │     9:16) → FFmpeg polish   │
                            │  decides WHAT & WHEN to show│
                            └────────────────────────────┘
```

- **Explorer/Demo agent** — the brain-driven loop that demonstrates ANY app with no per-feature code.
- **Recorder** — records *everything* to video (smooth ~600px/s scroll, frame recovery).
- **Director/Video agent** — turns the recording into a polished promo (picks the standout moments + timing).
- **Supervised Task agent** — for real actions (booking/ordering) with **payment-stays-human** gates.
- **Brain / Planner / Memory** — shared services the agents call.

---

## 5. The control loop (Explorer agent, step by step)

```
repeat up to N steps:
  1. SEE     inventory on-screen elements →  "1:[canvas] ←draw  3:[button] \"Text\"  7:[button] \"Library\""
  2. THINK   brainText(goal + inventory + history)  →  {"action":"draw","id":1,"why":"show the canvas"}
  3. ACT     executor maps the decision to a REAL action:
                click → page.mouse.click(x,y)      draw → mouse down/move/up strokes
                type  → page.keyboard.type(...)     scroll → smooth 600px/s
             SAFETY: if label ~ pay/checkout/delete/logout → BLOCK (payment stays human)
  4. RECORD  the CDP screencast is already capturing the whole thing → frames
  5. OBSERVE the page changed; loop re-inventories the new state
until the brain says {"action":"done"} or step budget runs out
                                  │
                                  ▼
                    frames → FFmpeg → crawl-recording.mp4 → Director agent → promo video
```

---

## 6. The browser substrate (where it all runs)

Two modes, same agents on top:

```
A) LAUNCH mode   — puppeteer-extra + stealth launches a fresh Chromium (headless or visible-for-login).
B) ATTACH mode   — connect (CDP) to YOUR real, already-logged-in Chrome  ← best bot-bypass + no re-login
                   (start-chrome-attach.bat → debug port 9222 → "Attach to my Chrome" toggle)
```

Bot detection is fingerprint-based; **attaching to your real browser** + human-like timing (the slow
scroll, real keystrokes, stepped mouse) is the strongest *legitimate* way to "get more passed".
**Money/payment is always handed back to the human.**

---

## 7. File map (so you know where each role lives)

| Role | File |
|---|---|
| Brain (LLM chain) | `backend/src/services/vision-brain.ts` |
| Planner | `backend/src/services/planner.ts` |
| Memory (skills) | `backend/src/services/agent-memory.ts` |
| Perception (set-of-marks) | `backend/src/services/agent-marks.ts` + `autonomousDemo()` inventory |
| Explorer/Demo agent + Recorder | `backend/src/services/browser-recorder.ts` |
| Supervised task agent | `backend/src/services/agent-task.ts` |
| Director/Video agent | `backend/src/services/marketing-director.ts`, `marketing-renderer.ts`, `remotion/` |
| Research / Story | `backend/src/services/web-search.ts`, `story-research.ts` |
| Omni (CDP attach to real Chrome for Gemini) | `backend/src/services/omni-clip-agent.ts` |
| Orchestration / API / state | `backend/src/supervisor.ts`, `backend/src/routes/api.ts` |
| Control panel (UI) | `frontend/src/App.tsx` + panels |
```
