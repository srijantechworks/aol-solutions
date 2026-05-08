"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { MessageSquare, Image as ImageIcon, BookOpen, Infinity as InfinityIcon, Users, PanelLeftClose, PanelLeftOpen, Plus } from 'lucide-react';

export default function Navigation({ children }: { children: React.ReactNode }) {
    const [isCollapsed, setIsCollapsed] = useState(false); 
    const [isHoveringLogo, setIsHoveringLogo] = useState(false);
    const [isMounted, setIsMounted] = useState(false); 
    const pathname = usePathname();

    // ✨ FIX 3: Load saved sidebar state from localStorage on mount
    useEffect(() => {
        setIsMounted(true);
        const savedState = localStorage.getItem('srijan_sidebar_state');
        if (savedState !== null) {
            setIsCollapsed(JSON.parse(savedState));
        }
    }, []);

    // ✨ FIX 3: Function to toggle and save state simultaneously
    const toggleSidebar = (state: boolean) => {
        setIsCollapsed(state);
        localStorage.setItem('srijan_sidebar_state', JSON.stringify(state));
    };

    const navItems = [
        { name: 'Generate Posters', href: '#', icon: ImageIcon, comingSoon: true },
        { name: 'Knowledge Sheet', href: '/knowledge', icon: BookOpen, comingSoon: false },
        { name: 'Whispering Infinity', href: '/whispers', icon: InfinityIcon, comingSoon: false },
        { name: 'Open CRM', href: '/crm', icon: Users, comingSoon: false },
    ];

    // Don't render complex dynamic sizing until mounted to prevent UI flashes
    if (!isMounted) return null; 

    return (
        <div className="flex w-full h-full relative z-10">
            
            {/* ==========================================
                DESKTOP SIDEBAR 
            ========================================== */}
            <aside 
                className={`hidden md:flex flex-col h-full bg-white/30 backdrop-blur-sm border-r border-white/5 transition-all duration-300 ease-in-out shrink-0
                ${isCollapsed ? 'w-[64px]' : 'w-[250px]'}`}
            >
                {/* Top Section: Logo & Toggle Area */}
                {/* ✨ FIX 1: Removed border-b border-white/20 */}
                <div 
                    className="h-[76px] flex items-center justify-center shrink-0 transition-colors"
                    onMouseEnter={() => setIsHoveringLogo(true)}
                    onMouseLeave={() => setIsHoveringLogo(false)}
                >
                    {isCollapsed ? (
                        <button 
                            onClick={() => toggleSidebar(false)} 
                            className="w-full h-full flex justify-center items-center hover:bg-white/20 transition-all cursor-pointer"
                            title="Expand sidebar"
                        >
                            {isHoveringLogo ? (
                                // ✨ FIX 2: Increased icon stroke width and darkened color for contrast
                                <PanelLeftOpen size={26} strokeWidth={2.5} className="text-neutral-900 drop-shadow-md" />
                            ) : (
                                <Image src="/srijan-logo.png" width={40} height={40} className="rounded-full shadow-md" alt="Srijan Logo" />
                            )}
                        </button>
                    ) : (
                        <div className="flex items-center justify-between w-full px-4 h-full">
                            <Image src="/srijan-logo.png" width={40} height={40} className="rounded-full shadow-md" alt="Srijan Logo" />
                            <button 
                                onClick={() => toggleSidebar(true)} 
                                className="p-2 hover:bg-white/40 rounded-lg transition-colors text-neutral-900 cursor-pointer"
                                title="Collapse sidebar"
                            >
                                <PanelLeftClose size={24} strokeWidth={2.5} />
                            </button>
                        </div>
                    )}
                </div>

                {/* Primary Action Button */}
                <div className="px-3 pt-4 pb-2 shrink-0">
                    <Link
                        href="/"
                        // ✨ FIX 2: Made text 'font-bold' and bumped up background contrast 
                        className={`flex items-center gap-3 rounded-xl transition-all cursor-pointer font-bold text-sm shadow-sm
                            ${isCollapsed ? 'justify-center p-3' : 'px-3 py-3'}
                            ${pathname === '/' ? 'bg-amber-600 text-white shadow-md' : 'bg-white/50 hover:bg-white/70 text-neutral-900'}
                        `}
                        title={isCollapsed ? "Create Message" : ""}
                    >
                        <Plus size={isCollapsed ? 24 : 20} strokeWidth={3} className="shrink-0" />
                        {!isCollapsed && <span className="flex-1 whitespace-nowrap overflow-hidden text-ellipsis">Create Message</span>}
                    </Link>
                </div>

                {/* Scrollable Links List */}
                <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href;
                        const Icon = item.icon;

                        return (
                            <Link
                                key={item.name}
                                href={item.comingSoon ? '#' : item.href}
                                onClick={(e) => item.comingSoon && e.preventDefault()}
                                // ✨ FIX 2: Darkened inactive text to neutral-900 and increased font weights globally
                                className={`flex items-center gap-3 rounded-xl transition-all text-sm font-bold
                                    ${isCollapsed ? 'justify-center p-3' : 'px-3 py-3'}
                                    ${isActive && !item.comingSoon 
                                        ? 'bg-amber-600 text-white shadow-md' 
                                        : item.comingSoon 
                                            ? 'opacity-60 text-neutral-700 cursor-default font-semibold' 
                                            : 'text-neutral-900 hover:bg-white/50 cursor-pointer'
                                    }
                                `}
                                title={isCollapsed ? item.name : ''} 
                            >
                                {/* Icons adjust size and stroke depending on collapsed/active state */}
                                <Icon size={isCollapsed ? 24 : 20} strokeWidth={isActive ? 2.5 : 2} className="shrink-0" />
                                
                                {!isCollapsed && (
                                    <span className="flex-1 whitespace-nowrap overflow-hidden text-ellipsis">
                                        {item.name}
                                    </span>
                                )}
                                {!isCollapsed && item.comingSoon && (
                                    <span className="text-[9px] font-extrabold bg-neutral-900/15 text-neutral-800 px-1.5 py-0.5 rounded shrink-0 uppercase tracking-widest">
                                        Soon
                                    </span>
                                )}
                            </Link>
                        );
                    })}
                </div>
            </aside>

            {/* ==========================================
                MOBILE BOTTOM NAV 
            ========================================== */}
            <nav className="md:hidden fixed bottom-0 left-0 w-full bg-white/40 backdrop-blur-xl border-t border-white/40 shadow-2xl z-50 pb-safe">
                <div className="flex items-center justify-around px-2 py-2">
                    {[{ name: 'Create Message', href: '/', icon: MessageSquare, comingSoon: false }, ...navItems].map((item) => {
                        const isActive = pathname === item.href;
                        const Icon = item.icon;

                        return (
                            <Link
                                key={item.name}
                                href={item.comingSoon ? '#' : item.href}
                                onClick={(e) => item.comingSoon && e.preventDefault()}
                                className={`flex flex-col items-center gap-1 p-2 rounded-xl min-w-[4rem] transition-all relative ${
                                    item.comingSoon ? 'opacity-50 cursor-default' : 'hover:bg-white/20'
                                }`}
                            >
                                {isActive && !item.comingSoon && (
                                    <div className="absolute inset-0 bg-amber-500/20 rounded-xl -z-10" />
                                )}
                                <Icon className={`h-6 w-6 ${isActive && !item.comingSoon ? 'text-amber-600' : 'text-neutral-700'}`} />
                                <span className={`text-[10px] font-bold text-center leading-tight ${isActive && !item.comingSoon ? 'text-amber-800' : 'text-neutral-700'}`}>
                                    {item.name.replace(' ', '\n')}
                                </span>
                            </Link>
                        );
                    })}
                </div>
            </nav>

            {/* ==========================================
                MAIN CONTENT (Slides with Sidebar)
            ========================================== */}
            <main className="flex-1 h-full overflow-y-auto scroll-smooth">
                {children}
            </main>
        </div>
    );
}