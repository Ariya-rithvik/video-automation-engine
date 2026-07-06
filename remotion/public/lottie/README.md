# Lottie animations for the marketing pipeline

Drop `.json` (Bodymovin) or `.lottie` (dotLottie) files in this folder. Scenes can render them as
overlays via the `LottieOverlay` component (see `remotion/src/LottieOverlay.tsx`).

## Where to get Lottie files

1. **LottieFiles** — https://lottiefiles.com — search for free Creative Commons animations.
   Download as "Lottie JSON" (`.json`) or "dotLottie" (`.lottie`).
2. **Figma → LottieFiles plugin** — design vector frames in Figma, install the LottieFiles plugin,
   export as Lottie. Best for matching your brand exactly.
3. **After Effects + Bodymovin** — for designers who want full control. Export as Lottie JSON
   via the Bodymovin extension.

## Recommended starter files

For the marketing pipeline's specific moments, these are good first additions:

| File | When it plays | Suggested style |
|---|---|---|
| `success-check.json` | ProductSelectAndCart finale (`✓ Order placed!`) | Animated checkmark + circle |
| `sparkle-burst.json` | Same finale (alongside check) | Particle burst, gold/brand color |
| `loading-spinner.json` | PromptThenGrid while "generating" | Subtle spinner |
| `cursor-click.json` | CursorClickReveal (replaces our CSS ripple) | Animated tap with rings |
| `arrow-swipe.json` | Transitions between scenes | Light sweep / wipe |

## Usage in scenes

```tsx
import { LottieOverlay } from '../LottieOverlay';

// Inside a scene:
<LottieOverlay
  src="lottie/success-check.json"
  width={200}
  height={200}
  style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
/>
```

The file path is relative to `remotion/public/` (Remotion's static-file mount).

## Notes

- Lottie files render at the scene's fps (30fps for our pipeline). Animations designed at other
  framerates are interpolated by `@remotion/lottie` — should be seamless for most cases.
- Keep files under ~500 KB each — larger ones bloat the bundle and slow startup.
- Test with the Remotion Studio (`npm run preview` in `remotion/`) before relying on a Lottie file
  in the production render — the JSON format has subtle compatibility quirks.
