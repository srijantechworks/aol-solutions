import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/ui/Navbar';
import PageWrapper from '@/components/ui/PageWrapper';
import Navigation from '@/components/ui/Navigation';
import { cookies } from 'next/headers';

export const metadata: Metadata = {
  title: 'Course Message Generator',
  description: 'Generate beautiful promotional messages for courses using AI.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const isCollapsed = cookieStore.get('srijan_sidebar_state')?.value === 'true';

  return (
    <html lang="en">
      <body className="h-dvh w-screen font-sans antialiased text-neutral-900 overflow-hidden flex bg-neutral-900">
        <div className="fixed inset-0 w-full h-full pointer-events-none"
          style={{ backgroundImage: "url('/vm_update.png')", backgroundSize: 'cover', backgroundPosition: '50% 35%', backgroundRepeat: 'no-repeat' }}
        />
        <div className="fixed inset-0 bg-black/20 w-full h-full pointer-events-none" />

        <Navigation initialCollapsed={isCollapsed}>
          <Navbar />
          <PageWrapper>
            {children}
          </PageWrapper>
        </Navigation>
      </body>
    </html>
  );
}