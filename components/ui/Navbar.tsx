import Link from 'next/link';
import Image from 'next/image';

export default function Navbar() {
  const navLinks = [
    { name: 'About', href: '/about' },
  ];

  return (
    // ✨ GLASSMORPHISM MAGIC APPLIED HERE ✨
    // Changed bg to transparent amber, added backdrop-blur, and softened the border
    <nav className="sticky top-0 z-50 w-full border-b border-amber-500/30 bg-amber-50/60 backdrop-blur-sm px-6 py-4 shadow-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between">

        {/* Brand / Logo Area */}
        <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-80">
          <Image 
            src="/srijan-logo.png" 
            alt="Srijan TechWorks Logo"
            width={50} 
            height={50} 
            className="rounded-full shadow-sm" 
          />
          <span className="text-3xl font-bold tracking-tight text-neutral-800">
            Srijan
          </span>
        </Link>

        {/* Navigation Links */}
        <div className="flex items-center gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.name}
              href={link.href}
              className="text-md font-bold text-neutral-600 transition-colors hover:text-neutral-900"
            >
              {link.name}
            </Link>
          ))}
        </div>

      </div>
    </nav>
  );
}