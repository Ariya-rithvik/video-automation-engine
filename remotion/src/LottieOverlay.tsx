// LottieOverlay — wraps @remotion/lottie for use as a layer on top of any scene.
// Designers ship a .lottie or .json file (export from After Effects via Bodymovin, or
// from Figma via the LottieFiles plugin) — drop it into remotion/public/lottie/ and
// reference it by filename. The pipeline plays it synced to the scene's frame timeline.

import React, { useEffect, useState } from 'react';
import { Lottie } from '@remotion/lottie';
import { continueRender, delayRender, staticFile } from 'remotion';

interface LottieOverlayProps {
  src: string;                  // relative path under remotion/public/, e.g. "lottie/sparkle.json"
  width?: number | string;
  height?: number | string;
  loop?: boolean;
  style?: React.CSSProperties;
}

export const LottieOverlay: React.FC<LottieOverlayProps> = ({
  src, width = '100%', height = '100%', loop = false, style,
}) => {
  const [animationData, setAnimationData] = useState<any>(null);
  const [handle] = useState(() => delayRender(`lottie:${src}`));

  useEffect(() => {
    fetch(staticFile(src))
      .then((res) => res.json())
      .then((json) => {
        setAnimationData(json);
        continueRender(handle);
      })
      .catch((err) => {
        console.warn(`[LottieOverlay] Failed to load ${src}:`, err);
        continueRender(handle);
      });
  }, [src, handle]);

  if (!animationData) return null;

  return (
    <div style={{ width, height, pointerEvents: 'none', ...style }}>
      <Lottie animationData={animationData} loop={loop} />
    </div>
  );
};
