import React from 'react';
import { AbsoluteFill } from 'remotion';

interface ProductionBackgroundProps {
  bgColor?: string;
  gridColor?: string;
  gridSize?: number;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

export const ProductionBackgroundGrid: React.FC<ProductionBackgroundProps> = ({
  bgColor = '#f8f9fa',
  gridColor = 'rgba(138, 43, 226, 0.04)', // 4% purple opacity
  gridSize = 80,
  children,
  style,
}) => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: bgColor,
        backgroundImage: `
          linear-gradient(${gridColor} 1px, transparent 1px),
          linear-gradient(90deg, ${gridColor} 1px, transparent 1px)
        `,
        backgroundSize: `${gridSize}px ${gridSize}px`,
        position: 'absolute',
        inset: 0,
        ...style,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};
