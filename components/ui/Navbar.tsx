import Link from 'next/link';
import Image from 'next/image';

export default function Navbar() {
  const navLinks = [
    { name: 'About', href: '/about' },
  ];

  return (
    // ✨ NEUTRAL FROSTED GLASS ✨
    <nav className="sticky top-0 z-50 w-full border-b border-white/30 bg-white/20 backdrop-blur-md px-6 py-4 shadow-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between">

        <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-80">
          <Image
            src="/srijan-logo.png"
            alt="Srijan TechWorks Logo"
            width={50}
            height={50}
            className="rounded-full shadow-sm"
          />
          {/* Changed to neutral-900 to ensure readability on the glass */}
          <span className="text-3xl font-bold tracking-tight text-neutral-900">
            Srijan
          </span>
        </Link>

        <div className="flex items-center gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.name}
              href={link.href}
              className="text-md font-bold text-neutral-800 transition-colors hover:text-black"
            >
              {link.name}
            </Link>
          ))}
        </div>

      </div>
    </nav>
  );
}