# How to verify the pipeline (screenshots → AI → decide → typing)

There are TWO modes. Important: the agent sends the AI a **text list of on-screen controls**
(roles + names) — it does **not** upload screenshot images each step (that's the cheap design).
Screenshots are saved locally and used by the **video director**. Your logged-in ChatGPT/Gemini
account is used only by the **browser-AI brain** (text chat).

---

## A. "Is it taking screenshots?"  (RECORD mode — no AI)
1. UI → pick **📹 Just record**, URL `https://www.zomato.com`, run.
2. Backend log shows: `📸 Captured N section shot(s) for: ...` per page.
3. Check the files:
   - screenshots: `backend/watched/screenshot-*.png` (fresh)
   - video: `backend/output/crawl-recording-*.mp4`
✅ This needs **zero AI** — always works. (Verified: zomato.com → 22 screenshots + 59.7 MB video.)

---

## B. "Is it sending to ChatGPT/Gemini (our account) and getting an answer?"  (the brain)
1. Run **`start-chrome-attach.bat`** → a Chrome opens on debug port 9222 with your real profile.
2. In that Chrome, open **gemini.google.com** (or chatgpt.com) and make sure you're **signed in**.
3. Open **http://localhost:5000/api/v1/brain/test-page** → click **"Test browser-AI"**.
   - You'll SEE the prompt typed into your AI, and the reply shown back (e.g. ask `7×8` → `56`).
   - That proves: send → your logged-in AI → read answer. (Verified working.)
4. To make the agent USE it: start backend with `BROWSER_LLM=1`. Chain becomes
   `Gemini API → OpenRouter → your web AI`.
NOTE: we send TEXT (the element inventory), not image uploads. (Image upload = possible but costs more;
ask if you want vision.)

---

## C. "Is it deciding + typing/clicking/drawing?"  (EXPLORE mode — needs a brain)
1. UI → pick **🤖 Explore & demo**, URL = your app (e.g. CollabCanvas) + login, run.
2. Backend log shows the AI's decisions, one per step:
   - `🧠 demo plan:` … (the features it plans to show)
   - `🧠 demo: click #N "..." — <why>`  ← clicking
   - `🧠 demo: type #N "..." — <why>`   ← **typing** (this is the "writing" check)
   - `🧠 demo: draw ... ✏️ drawing ...`  ← drawing
3. Visual proof of the drawing: `backend/watched/demo-canvas.png`.
✅ Needs a working brain — Gemini API quota OR your logged-in web AI from step B.
   (Free Gemini = 20/day per project; when it's spent, explore stalls unless BROWSER_LLM is on.)

---

## D. "Is the video the right length?"  (3-min vs Full)
- UI → **Video length**: `3-minute` (default, tight ~75s curated cut) or `Full` (longer, up to ~3 min+).
- The director de-dupes near-identical shots and picks a DIVERSE set (spans pages/features), then caps
  total length to the target. Check the rendered mp4 duration + the director log.

---

## The honest data-flow
```
RECORD mode:   browser → scroll+screenshot (local files) → ffmpeg → video        [NO AI]
EXPLORE mode:  browser → TEXT inventory of controls → AI brain (Gemini API OR your logged-in web AI)
               → one action (click/type/draw/scroll) → repeat → recorded          [AI per step]
VIDEO:         screenshots + TEXT description → Gemini → scene plan → Remotion render (16:9 + 9:16)
```
