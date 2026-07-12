import { SkeletonTable } from '@/components/skeleton';

export default function DashboardLoading() {
  return (
    <div style={{ padding: '40px 48px', maxWidth: '1280px', margin: '0 auto' }}>
      <div className="animate-pulse">
        <div className="bg-slate-200 rounded h-8 w-48" style={{ marginBottom: '8px' }} />
        <div className="bg-slate-100 rounded h-4 w-64" style={{ marginBottom: '32px' }} />
      </div>
      <SkeletonTable />
    </div>
  );
}
