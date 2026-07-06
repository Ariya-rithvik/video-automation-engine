// Image-side set-of-marks — draws the AI's numbered markers onto a COPY of the screenshot, server-side.
//
// Why: previously we injected red numbered markers into the live DOM, screenshotted, then removed them
// every step — which the human saw as a flicker. Now the live window stays clean and stable; only the
// AI's copy gets the numbered boxes. Pure-JS (jimp 0.22), no native deps.

import Jimp from 'jimp';

export interface MarkRect { id: number; left: number; top: number; w: number; h: number; }

const RED = 0xef4444ff;            // box + label colour
let fontPromise: Promise<any> | null = null;
function getFont() { if (!fontPromise) fontPromise = Jimp.loadFont(Jimp.FONT_SANS_16_WHITE); return fontPromise; }

// Draw numbered boxes on a copy of `srcPath`; return the new path (or srcPath on failure).
export async function markImage(srcPath: string, marks: MarkRect[], dpr = 1): Promise<string> {
  const out = srcPath.replace(/\.png$/i, '-marked.png');
  try {
    const img = await Jimp.read(srcPath);
    const W = img.getWidth(), H = img.getHeight();
    const font = await getFont();
    const sp = (x: number, y: number, c: number) => { if (x >= 0 && y >= 0 && x < W && y < H) img.setPixelColor(c, x, y); };

    for (const m of marks) {
      const x = Math.round(m.left * dpr), y = Math.round(m.top * dpr);
      const w = Math.round(m.w * dpr), h = Math.round(m.h * dpr);
      // 2px rectangle outline
      for (let i = 0; i <= w; i++) { sp(x + i, y, RED); sp(x + i, y + 1, RED); sp(x + i, y + h - 1, RED); sp(x + i, y + h, RED); }
      for (let j = 0; j <= h; j++) { sp(x, y + j, RED); sp(x + 1, y + j, RED); sp(x + w - 1, y + j, RED); sp(x + w, y + j, RED); }
      // filled label chip + white number at the top-left corner
      const lbl = String(m.id);
      const lw = 8 + lbl.length * 9, lh = 19;
      const bx = x, by = Math.max(0, y - lh);
      for (let j = 0; j < lh; j++) for (let i = 0; i < lw; i++) sp(bx + i, by + j, RED);
      img.print(font, bx + 3, by + 1, lbl);
    }
    await img.writeAsync(out);
    return out;
  } catch (e: any) {
    console.warn('[AgentMarks] markImage failed (using clean shot):', e?.message);
    return srcPath;   // graceful: AI still gets the screenshot + the text marks list
  }
}
