// One-off script: send the user's Gemini Omni reference video to Gemini Vision
// and get back a detailed description so Claude can see what they made.

const fs = require('fs');
const path = require('path');
const { GoogleGenAI } = require('./backend/node_modules/@google/genai');

// Manually parse backend/.env to grab GEMINI_API_KEY (avoids needing dotenv at the root)
const envText = fs.readFileSync(path.resolve(__dirname, 'backend/.env'), 'utf-8');
for (const line of envText.split(/\r?\n/)) {
  const m = /^([A-Z_]+)\s*=\s*(.*)$/.exec(line.trim());
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const VIDEO_PATH = 'C:\\Users\\Ariyap\\Downloads\\i_want_an_animation_like_for_a.mp4';

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('❌ GEMINI_API_KEY not found in backend/.env');
    process.exit(1);
  }

  if (!fs.existsSync(VIDEO_PATH)) {
    console.error(`❌ Video not found: ${VIDEO_PATH}`);
    process.exit(1);
  }

  const sizeBytes = fs.statSync(VIDEO_PATH).size;
  console.log(`📹 Reading ${(sizeBytes / 1024 / 1024).toFixed(2)} MB video...`);

  const buffer = fs.readFileSync(VIDEO_PATH);
  const base64 = buffer.toString('base64');

  const ai = new GoogleGenAI({ apiKey });

  console.log('🧠 Sending to Gemini 2.5 Pro Vision for analysis...\n');

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `Describe EVERY scene of this video for code-driven replication. Be CONCISE but cover the FULL video (no truncation).

For each scene segment:
1. Timecode range (e.g. 0:00-0:03)
2. One-line description of what's shown
3. Cursor: where it enters, where it moves to, where it clicks, ripple style
4. Camera: any zoom-in/zoom-out, focus shifts
5. Text/UI: what appears, what disappears, transitions used
6. Easing: was movement linear, eased, springy, bouncy?
7. Brand colors visible (hex if you can tell)

OUTPUT FORMAT: numbered list, ~3-5 bullet sentences per scene. Cover ALL scenes from 0:00 to the end.

This is a real Gemini Omni-generated Amazon shoe purchase demo. The user wants to replicate the cursor + camera + scene transitions in a programmatic Remotion pipeline.`,
          },
          {
            inlineData: {
              mimeType: 'video/mp4',
              data: base64,
            },
          },
        ],
      },
    ],
    config: {
      maxOutputTokens: 8192,
      temperature: 0.2,
    },
  });

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  GEMINI VISION ANALYSIS OF REFERENCE VIDEO');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(response.text);
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
