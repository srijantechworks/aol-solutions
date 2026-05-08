"use client";

import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';

export default function PageWrapper({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isAboutPage = pathname === '/about';

  return (
    <main 
      /* FIX 1: Changed 'transition-all' to specific properties. 
         This stops the border/layout from 'sliding' and causing that line.
      */
      className={`mx-auto w-full px-4 sm:px-6 lg:px-8 transition-[background-color,backdrop-filter,padding,margin] duration-500 ease-in-out
        ${isAboutPage 
          ? "bg-black/40 backdrop-blur-md min-h-[calc(100vh-120px)] border border-white/10 py-10 shadow-2xl" 
          /* FIX 2: Added 'border-transparent'. 
             By keeping a border present but invisible on the home page, 
             the browser doesn't 'create' a line during the transition.
          */
          : "bg-transparent mt-0 py-0 border-transparent"
        }`}
    >
      <div className={isAboutPage ? "animate-in fade-in zoom-in-95 duration-500" : ""}>
        {children}
      </div>
    </main>
  );
}