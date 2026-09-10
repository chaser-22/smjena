import { ImageResponse } from 'next/og';

export const alt = 'SMJENA — Kad fali jedan. Stiže SMJENA.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        background: '#08090b',
        color: '#f5f3ef',
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
        <div style={{ fontSize: 30, fontWeight: 700, color: '#f5f3ef' }}>
          ●&nbsp; SMJENA / CRNA GORA
        </div>
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
          <span>Kad fali</span>
          <span>jedan.</span>
          <span style={{ color: '#ff3d49' }}>Stiže SMJENA.</span>
        </div>
        <div style={{ fontSize: 18, color: '#aeb0b8' }}>
          Vidi smjenu. Vidi cijenu. Potvrdi mjesto.
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: 380,
          padding: 32,
          background: '#d61f2b',
          justifyContent: 'center',
          color: '#ffffff',
          fontSize: 68,
          fontWeight: 700,
          letterSpacing: -5,
        }}
      >
        <span>HITNA</span>
        <span>MREŽA</span>
        <span>RADA.</span>
        <div
          style={{
            display: 'flex',
            marginTop: 30,
            padding: 20,
            background: '#08090b',
            color: '#f5f3ef',
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
