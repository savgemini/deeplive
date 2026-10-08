import { ImageResponse } from 'next/server';

export const runtime = 'edge';
export const alt = 'DeepLive turns your webcam into a real-time AI avatar';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const heroImage =
  'https://images.pexels.com/photos/8107821/pexels-photo-8107821.jpeg?auto=compress&cs=tinysrgb&h=650&w=940';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          padding: '56px',
          alignItems: 'center',
          gap: '48px',
          color: '#f4f9fc',
          background: 'linear-gradient(120deg, #071018 0%, #102331 58%, #123b4c 100%)',
          fontFamily: 'Arial, sans-serif',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                display: 'flex',
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#06131a',
                background: '#35c7f2',
                fontSize: '26px',
                fontWeight: 700,
              }}
            >
              D
            </div>
            <span style={{ fontSize: '30px', fontWeight: 700 }}>DeepLive</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', fontSize: '58px', fontWeight: 700, lineHeight: 1.08 }}>
            <span>Become anyone</span>
            <span style={{ color: '#35c7f2' }}>on every video call</span>
          </div>
          <p style={{ margin: 0, color: '#bfd0d9', fontSize: '23px', lineHeight: 1.4 }}>
            Real-time AI avatar streaming for the apps you already use.
          </p>
          <div
            style={{
              display: 'flex',
              alignSelf: 'flex-start',
              padding: '10px 16px',
              border: '1px solid #287994',
              borderRadius: '999px',
              color: '#8de5ff',
              fontSize: '16px',
              fontWeight: 700,
              letterSpacing: '1px',
            }}
          >
            REAL-TIME AI AVATARS
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            width: '410px',
            height: '500px',
            overflow: 'hidden',
            border: '2px solid #4c91a8',
            borderRadius: '28px',
            background: '#102331',
          }}
        >
          <img
            src={heroImage}
            alt="AI avatar video preview"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
      </div>
    ),
    { ...size }
  );
}