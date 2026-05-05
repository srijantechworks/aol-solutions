// app/layout.tsx
import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/ui/Navbar';

export const metadata: Metadata = {
  title: 'Course Message Generator',
  description: 'Generate beautiful promotional messages for courses using AI.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      {/* Updated: Warm cream background, dark gray text, warm selection highlight */}
      <body className="min-h-screen bg-amber-50 text-neutral-900 antialiased selection:bg-amber-200 selection:text-amber-900">
        <Navbar />
        <main className="mx-auto max-w-6xl p-6">
          {children}
        </main>
      </body>
    </html>
  );
}