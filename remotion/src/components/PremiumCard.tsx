import React from 'react';

interface PremiumCardProps {
  children?: React.ReactNode;
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: React.CSSProperties;
  className?: string;
}

export const PremiumCard: React.FC<PremiumCardProps> = ({
  children,
  width,
  height,
  borderRadius = 16,
  style,
  className,
}) => {
  return (
    <div
      className={className}
      style={{
        width,
        height,
        fontFamily: "'Poppins', 'Inter', -apple-system, sans-serif",
        fontWeight: 700,
        background: '#ffffff',
        borderRadius: `${borderRadius}px`,
        padding: '24px 32px',
        // Deep, highly diffused soft shadow simulating AE composited render
        boxShadow: `
          0px 30px 60px rgba(0, 0, 0, 0.06), 
          0px 4px 10px rgba(0, 0, 0, 0.02)
        `,
        border: '1px solid rgba(0, 0, 0, 0.04)',
        position: 'relative',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {children}
    </div>
  );
};
