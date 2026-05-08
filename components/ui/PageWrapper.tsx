"use client";

import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';

export default function PageWrapper({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isAboutPage = pathname === '/about';

  return (
    <>
      {/* ✨ THE SEAMLESS BACKGROUND ✨
        By using 'absolute inset-0', this div stretches to the exact edges of the main container.
        '-z-10' and 'pointer-events-none' ensure it sits behind your content and Navbar without blocking clicks.
      */}
      <div 
        className={`absolute inset-0 pointer-events-none transition-[background-color,backdrop-filter] duration-500 ease-in-out -z-10
          ${isAboutPage 
            ? "bg-black/40 backdrop-blur-md" 
            : "bg-transparent backdrop-blur-none"
          }`} 
      />

      {/* ✨ THE CONTENT CONTAINER ✨
        This handles the spacing for your text without dictating the background shape.
      */}
      <div className={`mx-auto w-full max-w-7xl px-6 lg:px-12 ${isAboutPage ? 'py-10' : 'py-0'}`}>
        <div className={isAboutPage ? "animate-in fade-in zoom-in-95 duration-500" : ""}>
          {children}
        </div>
      </div>
    </>
  );
}