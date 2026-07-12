import { SkeletonTable } from '@/components/skeleton';

export default function UtilizadoresLoading() {
  return (
    <div style={{ padding: '40px 48px', maxWidth: '1280px', margin: '0 auto' }}>
      <div className="animate-pulse flex items-center justify-between" style={{ marginBottom: '28px' }}>
        <div className="bg-slate-200 rounded h-8 w-44" />
        <div className="bg-slate-200 rounded-xl h-10 w-36" />
      </div>
      <SkeletonTable rows={7} />
    </div>
  );
}
