// app/layout.tsx
import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/ui/Navbar';
import PageWrapper from '@/components/ui/PageWrapper';

export const metadata: Metadata = {
  title: 'Course Message Generator',
  description: 'Generate beautiful promotional messages for courses using AI.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased text-neutral-900 overflow-x-hidden">
        
        {/* Fixed Global Background */}
        <div 
          className="fixed inset-0 -z-20 w-full h-full"
          style={{ 
            backgroundImage: "url('/vm_update.png')",
            backgroundSize: 'cover',
            backgroundPosition: '50% 35%', 
            backgroundRepeat: 'no-repeat'
          }}
        />

        {/* Global Scrim (keeps the home page readable but subtle) */}
        <div className="fixed inset-0 -z-10 bg-black/20 w-full h-full" />

        <Navbar />
        
        {/* Conditional Wrapper handles the blur logic */}
        <PageWrapper>
          {children}
        </PageWrapper>

      </body>
    </html>
  );
}