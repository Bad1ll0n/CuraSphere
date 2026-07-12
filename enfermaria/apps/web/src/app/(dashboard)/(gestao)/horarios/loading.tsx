import { Skeleton } from '@/components/skeleton';

export default function HorariosLoading() {
  return (
    <div style={{ padding: '40px 48px', maxWidth: '1280px', margin: '0 auto' }}>
      <div className="animate-pulse flex items-center justify-between" style={{ marginBottom: '32px' }}>
        <div>
          <div className="bg-slate-200 rounded h-8 w-32" style={{ marginBottom: '6px' }} />
          <div className="bg-slate-100 rounded h-4 w-48" />
        </div>
        <div className="flex gap-3">
          <div className="bg-slate-200 rounded-xl h-10 w-28" />
          <div className="bg-slate-200 rounded-xl h-10 w-20" />
        </div>
      </div>
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 35 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
