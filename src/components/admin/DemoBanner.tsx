'use client';

export default function DemoBanner() {
  return (
    <div style={{
      position: 'sticky',
      top: 0,
      zIndex: 999,
      background: '#fffbe6',
      borderBottom: '2px solid #f0c000',
      padding: '10px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      fontSize: 13,
      fontWeight: 700,
      color: '#7a5c00',
    }}>
      <span style={{ fontSize: 16 }}>👀</span>
      デモモード — 変更は保存されません
    </div>
  );
}
