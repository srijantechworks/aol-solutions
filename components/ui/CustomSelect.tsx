// components/ui/CustomSelect.tsx
"use client";

import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface Option {
    value: string;
    label: string;
}

interface CustomSelectProps {
    label: string;
    options: Option[];
    value: string;
    onChange: (value: string) => void;
}

export default function CustomSelect({ label, options, value, onChange }: CustomSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedLabel = options.find((opt) => opt.value === value)?.label || 'Select...';

    return (
        <div className="flex flex-col gap-2 relative" ref={dropdownRef}>
            <label className="text-sm font-semibold text-neutral-700">{label}</label>

            <div
                onClick={() => setIsOpen(!isOpen)}
                className="w-full bg-white border border-neutral-300 text-neutral-900 rounded-lg p-3 flex justify-between items-center cursor-pointer hover:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all shadow-sm"
            >
                <span>{selectedLabel}</span>
                <ChevronDown className={`h-4 w-4 text-neutral-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>

            {isOpen && (
                <div className="absolute top-[78px] left-0 w-full bg-white border border-neutral-200 rounded-lg shadow-xl z-50 overflow-y-auto max-h-64 animate-in fade-in slide-in-from-top-2 duration-200">
                    {options.map((opt) => (
                        <div
                            key={opt.value}
                            onClick={() => {
                                onChange(opt.value);
                                setIsOpen(false);
                            }}
                            className={`p-3 cursor-pointer transition-colors ${value === opt.value
                                    ? 'bg-amber-100 text-amber-900 font-medium'
                                    : 'text-neutral-700 hover:bg-amber-50 hover:text-amber-900'
                                }`}
                        >
                            {opt.label}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}