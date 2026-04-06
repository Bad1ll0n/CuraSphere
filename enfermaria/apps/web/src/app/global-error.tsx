'use client';

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="pt">
      <body>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
          <h2>Ocorreu um erro</h2>
          <button onClick={reset}>Tentar novamente</button>
        </div>
      </body>
    </html>
  );
}
