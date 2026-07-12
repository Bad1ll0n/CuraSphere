import { SkeletonCard, Skeleton } from '@/components/skeleton';

export default function DoenteLoading() {
  return (
    <div style={{ padding: '40px 48px', maxWidth: '1280px', margin: '0 auto' }}>
      <div className="animate-pulse" style={{ marginBottom: '32px' }}>
        <div className="bg-slate-200 rounded h-6 w-24 mb-3" />
        <div className="flex items-center gap-4">
          <div className="bg-slate-200 rounded-2xl w-14 h-14 shrink-0" />
          <div>
            <div className="bg-slate-200 rounded h-7 w-48 mb-2" />
            <div className="bg-slate-100 rounded h-4 w-64" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4" style={{ marginBottom: '24px' }}>
        {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
      <Skeleton className="h-48 w-full rounded-2xl" />
    </div>
  );
}
