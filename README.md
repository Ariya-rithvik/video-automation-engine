# Autonomous Demo Engine (ADE) ⚡

The **Autonomous Demo Engine (ADE)** is an automated continuous validation and marketing-to-keynote generation pipeline. It bridges **Antigravity 2.0 JSON Hooks**, multimodal **Gemini 2.5 Flash / Omni**, **ElevenLabs** neural voice synthesis, and a stunning 3D presentation deck UI. 

ADE ensures that marketing demos are **100% verified by functional test passes** before compilation. If tests break, it halts demo creation and compiles a **Bug-Fix Replay** report for developers instead!

---

## Key Strategic Pillars 🛡️

1. **Continuous Validation (Anti-Error)**: No product demos are generated unless the telemetry logs verify a `'SUCCESS'` execution state.
2. **Safety Rule Assertions**: If errors are caught, a `'Bug-Fix Replay'` report is compiled displaying specific line/DB replica timeouts and the chronological walkthrough logs immediately prior to collapse.
3. **Graceful Fallback Mode**: If third-party API tokens (`GEMINI_API_KEY`, `ELEVENLABS_API_KEY`) or system binaries (`ffmpeg`) are missing, the system utilizes robust offline rules, CSS/Canvas VFX animation flows, and native browser SpeechSynthesis APIs to maintain 100% working, beautiful keynote demonstration capabilities out-of-the-box!

---

## Directory Architecture 📂

```
d:\production_project\
├── .antigravity\
│   └── hooks.json               # Native Antigravity 2.0 Webhook subscriber configurations
├── backend\
│   ├── package.json             # Express, Chokidar, and fluent-ffmpeg definitions
│   ├── tsconfig.json            # Node TypeScript compiler configurations
│   ├── src\
│   │   ├── index.ts             # Express entry and server boots
│   │   ├── watcher.ts           # Chokidar workspace watching and Success/Failure log handlers
│   │   ├── slicer.ts            # fluent-ffmpeg 10-second micro-clip loop generator
│   │   ├── services\
│   │   │   ├── gemini.ts        # Gemini 2.5 script writer with rule-based fallback
│   │   │   └── elevenlabs.ts    # ElevenLabs TTS writer with WebSpeech API fallback
│   │   └── routes\
│   │       └── api.ts           # Streaming media routes, ingestion, and trigger endpoints
│   └── watched\
│       ├── run-success.json     # Pre-seeded SUCCESS log file
│       ├── run-success.mp4      # Pre-seeded SUCCESS trigger video file
│       ├── run-failure.json     # Pre-seeded FAILURE log file
│       └── run-failure.mp4      # Pre-seeded FAILURE trigger video file
├── frontend\
│   ├── package.json             # Vite, React 18, and Tailwind CSS definitions
│   ├── index.html               # Keynote template loading Google Fonts (Outfit, Inter)
│   ├── src\
│   │   ├── main.tsx             # React rendering mounting roots
│   │   ├── index.css            # Base Tailwind imports & custom 3D glassmorphic utilities
│   │   ├── App.tsx              # Main Presentation deck interface
│   │   └── components\
│   │       ├── KeynotePanel.tsx # Premium 3D perspective presentation screen
│   │       ├── LiveMap.tsx      # SVG interactive app blueprint connecting node flows
│   │       └── VideoPlayer.tsx  # Video media player + HTML5 Canvas 2D fallback graphics
└── README.md
```

---

## Quick Start Guide 🚀

To boot the entire ADE system on your local workspace:

### 1. Ingestion Backend Setup
Configure your API keys in `backend/.env` (optional):
```env
PORT=5000
WORKSPACE_DIR=d:/production_project
GEMINI_API_KEY=your_gemini_api_key
ELEVENLABS_API_KEY=your_elevenlabs_api_key
```

Install dependencies and run Express:
```bash
cd backend
npm install
npm run dev
```

### 2. Digital Keynote Deck Setup
Launch the client server:
```bash
cd ../frontend
npm install
npm run dev
```

Open `http://localhost:3000` in your web browser.

---

## Operating In Action 🎬

### The Watcher Lifecycle:
- Drop `.mp4` and `.json` telemetry runs into `backend/watched/`.
- If `.json` logs `SUCCESS`, the watcher commands `slicer.ts` to clip 10-second videos, calls Gemini for presentation narration scripts, and maps them to the **Interactive App Blueprint** nodes!
- If `.json` logs `FAILURE`, it triggers safety rules and compiles a developer-ready **Bug-Fix Replay** report containing log traces and timeout alerts!

### Evaluating Immediately:
At the top-right of the presentation deck:
- Click **"Verify SUCCESS Run"** to execute the pipeline for the pre-seeded passing telemetry. You'll hear the voiceover and see the nodes unlock with a celebratory confetti burst!
- Click **"Verify FAILURE Run"** to witness the safety rule capture an error and output the live interactive Bug-Fix Replay trace!
