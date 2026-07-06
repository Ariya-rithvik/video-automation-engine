import React, { useId } from 'react';
import { useCurrentFrame, interpolate, Easing } from 'remotion';

interface CurvedConnectorProps {
  from: { x: number; y: number };
  to: { x: number; y: number };
  startFrame?: number;
  durationFrames?: number;
  color?: string;
  strokeWidth?: number;
  curvature?: number; // 0.2 to 0.8 controls curve intensity
}

export const AnimatedCurvedConnector: React.FC<CurvedConnectorProps> = ({
  from,
  to,
  startFrame = 10,
  durationFrames = 25,
  color = '#8A2BE2', // Accent purple
  strokeWidth = 3,
  curvature = 0.5,
}) => {
  const frame = useCurrentFrame();
  const filterId = useId();

  // Calculate Bezier control points for a smooth organic curve
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  const control1X = from.x + dx * curvature;
  const control1Y = from.y;
  const control2X = to.x - dx * curvature;
  const control2Y = to.y;

  const pathData = `M ${from.x} ${from.y} C ${control1X} ${control1Y}, ${control2X} ${control2Y}, ${to.x} ${to.y}`;

  // Approximate path length for stroke-dasharray calculation
  const distance = Math.hypot(dx, dy);
  const pathLength = distance * 1.3;

  // Animate progress 0 -> 1
  const progress = interpolate(
    frame,
    [startFrame, startFrame + durationFrames],
    [0, 1],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    }
  );

  const dashOffset = pathLength * (1 - progress);

  return (
    <svg
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        overflow: 'visible',
      }}
    >
      <defs>
        <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor={color} floodOpacity="0.4" />
        </filter>
      </defs>

      {/* Background guide track */}
      <path
        d={pathData}
        fill="none"
        stroke={`${color}22`}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />

      {/* Animated drawing line */}
      <path
        d={pathData}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={pathLength}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        filter={`url(#${filterId})`}
      />

      {/* Origin pulsating dot */}
      {progress > 0 && (
        <circle
          cx={from.x}
          cy={from.y}
          r={strokeWidth * 1.5}
          fill={color}
        />
      )}

      {/* Target endpoint dot appearing upon line completion */}
      {progress >= 0.95 && (
        <circle
          cx={to.x}
          cy={to.y}
          r={strokeWidth * 2}
          fill="#ffffff"
          stroke={color}
          strokeWidth={2}
        />
      )}
    </svg>
  );
};
