"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { X, Info } from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  
  // Check if we are currently on the About page
  const isAboutPage = pathname === '/about';

  const handleAboutToggle = () => {
    if (isAboutPage) {
      // Toggle Off: Safely go back to the exact previous state. 
      // Fallback to '/' just in case they loaded the /about URL directly.
      if (window.history.length > 2) {
        router.back();
      } else {
        router.push('/');
      }
    } else {
      // Toggle On: Go to the About page
      router.push('/about');
    }
  };

  return (
    <header className="w-full flex items-center px-6 py-2 relative">
      
      {/* 1. Srijan Text: Clickable to go to Homepage */}
      <Link 
        href="/"
        className="text-3xl md:text-4xl font-bold tracking-tight text-black drop-shadow-sm transition-opacity duration-300 hover:opacity-70 cursor-pointer fixed top-2.5 z-50"
        title="Go to Home"
      >
        Srijan
      </Link>

      {/* 2. About Toggle: Fixed to the right edge */}
      <div className="fixed top-2.5 right-6 md:right-8 z-50">
        <button
          onClick={handleAboutToggle}
          className={`flex items-center gap-2 text-sm font-bold transition-all px-4 py-2.5 rounded-xl backdrop-blur-md shadow-sm border cursor-pointer
            ${isAboutPage 
              ? 'bg-neutral-500/30 text-neutral-300 border-neutral-900/20 hover:bg-neutral-500/60 shadow-inner' // Active "Toggled On" state
              : 'bg-white/30 text-neutral-800 border-transparent hover:bg-white/50 hover:text-black' // Inactive state
            }`}
        >
          {isAboutPage ? (
            <>
              <X size={18} strokeWidth={2.5} /> Close About
            </>
          ) : (
            <>
              <Info size={18} strokeWidth={2.5} /> About
            </>
          )}
        </button>
      </div>

    </header>
  );
}