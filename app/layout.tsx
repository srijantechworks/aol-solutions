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
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased text-neutral-900">
        
        {/* Fixed Background Layer */}
        <div 
          className="fixed inset-0 -z-10 w-full h-full"
          style={{ 
            backgroundImage: "url('/vm_update.png')",
            backgroundSize: 'cover',
            backgroundPosition: 'center', // Ensures the temple stays in view
            backgroundRepeat: 'no-repeat'
          }}
        />

        {/* Optional: Dark Overlay to make text pop */}
        <div className="fixed inset-0 -z-10 bg-black/20 w-full h-full" />

        <Navbar />
        
        {/* Added padding and max-width to prevent "hitting the edges" */}
        <main className="mx-auto w-full px-4 sm:px-6 lg:px-8">
          {children}
        </main>
      </body>
    </html>
  )
}