// KineticCaption — fast word-by-word "pop" captions in the Varun Mayya / Aevy TV style.
// Big, bold, centered. Each word springs in with a short stagger; the longest word in the
// phrase is highlighted in the brand accent color. Designed to live in the vertical dead-space
// of a 9:16 Shorts frame (above/below the scaled 16:9 content stage).

import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';

interface KineticCaptionProps {
  text: string;
  startFrame: number;     // absolute composition frame when this caption became active
  brandColor: string;
  textColor: string;
  fontSize?: number;
  maxWidth?: number;
}

export const KineticCaption: React.FC<KineticCaptionProps> = ({
  text, startFrame, brandColor, textColor, fontSize = 84, maxWidth = 960,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - startFrame;

  const words = (text || '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;

  // Highlight the longest word (kinetic-caption convention — emphasizes the key term)
  let keywordIdx = 0;
  for (let i = 1; i < words.length; i++) {
    if (words[i].replace(/[^a-zA-Z0-9]/g, '').length > words[keywordIdx].replace(/[^a-zA-Z0-9]/g, '').length) {
      keywordIdx = i;
    }
  }

  const STAGGER = 3; // frames between words

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '0.18em 0.28em',
        maxWidth,
        margin: '0 auto',
        fontFamily: 'Inter, system-ui, sans-serif',
        fontWeight: 900,
        fontSize,
        lineHeight: 1.05,
        letterSpacing: -1.5,
        textAlign: 'center',
        padding: '0 40px',
      }}
    >
      {words.map((word, i) => {
        const wordStart = i * STAGGER;
        const pop = spring({
          frame: Math.max(0, local - wordStart),
          fps,
          config: { damping: 11, stiffness: 170, mass: 0.7 },
          from: 0,
          to: 1,
        });
        const opacity = interpolate(local - wordStart, [0, 6], [0, 1], {
          extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
        });
        const yShift = (1 - pop) * 26;
        const isKeyword = i === keywordIdx && words.length > 1;
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              transform: `translateY(${yShift}px) scale(${0.85 + pop * 0.15})`,
              opacity,
              color: isKeyword ? brandColor : textColor,
              textShadow: isKeyword ? `0 4px 24px ${brandColor}55` : 'none',
              whiteSpace: 'nowrap',
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
};
