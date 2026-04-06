export const dynamic = 'force-dynamic';

import ClientLayout from './client-layout';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <ClientLayout>{children}</ClientLayout>;
}
