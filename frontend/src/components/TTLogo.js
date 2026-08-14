import React from 'react';

export default function TTLogo({ size = 40, withText = true, variant = 'default' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <img
        src="/logo-tt.jpg"
        alt="Tunisie Telecom"
        style={{
          width: size,
          height: size * 0.7,
          objectFit: 'contain',
          borderRadius: 4,
        }}
      />
      {withText && (
        <div>
          <p style={{
            fontFamily: 'Syne, sans-serif',
            fontWeight: 800,
            fontSize: size < 36 ? 11 : 13,
            color: variant === 'light' ? '#fff' : '#E30613',
            lineHeight: 1,
            letterSpacing: '.03em',
          }}>
            TUNISIE TELECOM
          </p>
          <p style={{
            fontSize: size < 36 ? 9 : 10,
            color: variant === 'light' ? 'rgba(255,255,255,0.6)' : '#64748b',
            marginTop: 2,
            letterSpacing: '.05em',
          }}>
            Workflow Automation
          </p>
        </div>
      )}
    </div>
  );
}
