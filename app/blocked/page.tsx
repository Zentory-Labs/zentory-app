import Link from 'next/link';

export default function BlockedPage() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#050507',
      color: '#eaeaea',
      fontFamily: "'Montserrat', sans-serif",
    }}>
      <div style={{ textAlign: 'center', maxWidth: 480, padding: 32 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#8b1e2d" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
          </svg>
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Access Restricted</h1>
        <p style={{ color: 'rgba(234,234,234,0.6)', fontSize: 14, lineHeight: 1.7, marginBottom: 24 }}>
          Certain research content offered through ZENTORY Labs is not available in your jurisdiction due to regulatory restrictions.
        </p>
        <p style={{ color: 'rgba(234,234,234,0.4)', fontSize: 12, marginBottom: 32 }}>
          If you believe this is an error, please contact support.
        </p>
        <Link href="/" style={{
          display: 'inline-block',
          padding: '12px 32px',
          background: '#8b1e2d',
          color: '#eaeaea',
          borderRadius: 8,
          fontSize: 12,
          fontWeight: 700,
          textDecoration: 'none',
          letterSpacing: '0.1em',
        }}>
          Return Home
        </Link>
      </div>
    </div>
  );
}
