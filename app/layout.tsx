import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/ui/Navbar';
import PageWrapper from '@/components/ui/PageWrapper';
import Navigation from '@/components/ui/Navigation'; 

export const metadata: Metadata = {
  title: 'Course Message Generator',
  description: 'Generate beautiful promotional messages for courses using AI.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="h-screen w-screen font-sans antialiased text-neutral-900 overflow-hidden flex bg-neutral-900">
        
        {/* Fixed Global Background */}
        <div 
          className="fixed inset-0 w-full h-full pointer-events-none"
          style={{ 
            backgroundImage: "url('/vm_update.png')",
            backgroundSize: 'cover',
            backgroundPosition: '50% 35%', 
            backgroundRepeat: 'no-repeat'
          }}
        />
        {/* Global Scrim */}
        <div className="fixed inset-0 bg-black/20 w-full h-full pointer-events-none" />

        {/* Navigation wraps the whole screen. 
            Sidebar takes the left, Navbar & PageWrapper take the right! 
        */}
        <Navigation>
            <Navbar />
            <PageWrapper>
                {children}
            </PageWrapper>
        </Navigation>

      </body>
    </html>
  );
}