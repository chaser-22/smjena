import { ImageResponse } from 'next/og';

export const alt = 'SMJENA — Tvoj grad. Tvoja sljedeća smjena.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        background: '#f4f1e9',
        color: '#101d34',
        display: 'flex',
        padding: 64,
        justifyContent: 'space-between',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ fontSize: 30, fontWeight: 700 }}>SMJENA.</div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            fontSize: 72,
            fontWeight: 700,
            letterSpacing: -4,
            lineHeight: 1.07,
          }}
        >
          <span>Tvoj grad.</span>
          <span>Tvoja sljedeća</span>
          <span style={{ color: '#bd391d' }}>SMJENA.</span>
        </div>
        <div style={{ fontSize: 18 }}>Ugostiteljstvo. Crna Gora.</div>
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: 380,
          padding: 32,
          background: '#101d34',
          justifyContent: 'center',
          color: '#ff7953',
          fontSize: 80,
          fontWeight: 700,
          letterSpacing: -5,
        }}
      >
        <span>IMA</span>
        <span>POSLA.</span>
        <div
          style={{
            display: 'flex',
            marginTop: 30,
            padding: 20,
            background: '#f4f1e9',
            color: '#101d34',
            fontSize: 20,
            letterSpacing: 0,
          }}
        >
          Ljudi za smjenu.
          <br />
          Smjena za ljude.
        </div>
      </div>
    </div>,
    size,
  );
}
