// src/components/ui/Navbar.tsx
import Link from 'next/link';
import Image from 'next/image';

export default function Navbar() {
  // This array makes scaling easy. Just add new objects here later!
  const navLinks = [
    { name: 'About', href: '/about' },
  ];

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-amber-500 bg-amber-200 px-6 py-4 shadow-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between">

        {/* Brand / Logo Area */}
        <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-80">
          <Image 
            src="/srijan-logo.png" 
            alt="Srijan TechWorks Logo"
            width={50} 
            height={50} 
            // rounded-full perfectly clips the black square background into a circle
            className="rounded-full shadow-sm" 
          />
          <span className="text-3xl font-bold tracking-tight text-neutral-600">
            Srijan
          </span>
        </Link>

        {/* Navigation Links */}
        <div className="flex items-center gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.name}
              href={link.href}
              className="text-md font-bold text-neutral-500 transition-colors hover:text-neutral-700"
            >
              {link.name}
            </Link>
          ))}
        </div>

      </div>
    </nav>
  );
}