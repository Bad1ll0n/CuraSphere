import { SkeletonCard } from '@/components/skeleton';

export default function TurnoPassagemLoading() {
  return (
    <div style={{ padding: '40px 48px', maxWidth: '1280px', margin: '0 auto' }}>
      <div className="animate-pulse" style={{ marginBottom: '28px' }}>
        <div className="bg-slate-200 rounded h-8 w-44" style={{ marginBottom: '8px' }} />
        <div className="bg-slate-100 rounded h-4 w-64" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}
