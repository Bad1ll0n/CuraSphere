import { SkeletonTable } from '@/components/skeleton';

export default function DoentesLoading() {
  return (
    <div style={{ padding: '40px 48px', maxWidth: '1280px', margin: '0 auto' }}>
      <div className="animate-pulse flex items-center justify-between" style={{ marginBottom: '28px' }}>
        <div>
          <div className="bg-slate-200 rounded h-8 w-36" style={{ marginBottom: '8px' }} />
          <div className="bg-slate-100 rounded h-4 w-56" />
        </div>
        <div className="bg-slate-200 rounded-xl h-10 w-32" />
      </div>
      <SkeletonTable rows={8} />
    </div>
  );
}
