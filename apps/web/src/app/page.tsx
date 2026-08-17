export default function HomePage() {
  return (
    <main
      style={{
        fontFamily: 'system-ui, sans-serif',
        maxWidth: '640px',
        margin: '80px auto',
        padding: '0 24px',
      }}
    >
      <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '8px' }}>NEXUS</h1>
      <p style={{ color: '#555', marginBottom: '32px' }}>Distributed AI Job Processing Platform</p>

      <div
        style={{
          background: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: '8px',
          padding: '16px 20px',
          marginBottom: '24px',
        }}
      >
        <strong style={{ color: '#15803d' }}>✓ Frontend running</strong>
        <p style={{ margin: '4px 0 0', color: '#166534', fontSize: '0.9rem' }}>
          Next.js App Router is working correctly.
        </p>
      </div>

      <div style={{ fontSize: '0.875rem', color: '#777' }}>
        <p>
          <strong>Phase 1</strong> — Monorepo Skeleton & Infrastructure
        </p>
        <p style={{ marginTop: '4px' }}>
          Dashboard, authentication, and job management are implemented in later phases.
        </p>
        <p style={{ marginTop: '16px' }}>
          API:{' '}
          <a href="http://localhost:3001/health" style={{ color: '#2563eb' }}>
            http://localhost:3001/health
          </a>
        </p>
      </div>
    </main>
  );
}
