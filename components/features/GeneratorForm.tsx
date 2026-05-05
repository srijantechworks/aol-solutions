// components/features/GeneratorForm.tsx
"use client";

import { useState } from 'react';
import { LinkIcon, Sparkles, SlidersHorizontal, Info, X, Loader2 } from 'lucide-react';
import { DROPDOWN_OPTIONS } from '@/lib/constants';
import CustomSelect from '../ui/CustomSelect';

export default function GeneratorForm() {
    const [url, setUrl] = useState('');
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [showModal, setShowModal] = useState(false);

    const [isLoading, setIsLoading] = useState(false);
    const [apiResult, setApiResult] = useState<any>(null);

    const [selections, setSelections] = useState({
        audience: 'none',
        tone: 'none',
        length: 'none',
        benefit: 'none',
        emoji: 'none',
    });

    const isValidUrl = (urlString: string) => {
        try {
            new URL(urlString);
            return true;
        } catch (e) {
            return false;
        }
    };

    const isButtonDisabled = url.trim() === '' || !isValidUrl(url) || isLoading;
    const hasSelectedOptions = Object.values(selections).some(val => val !== 'none');

    const handleToggleOptions = () => {
        if (isButtonDisabled && !isLoading) {
            setErrorMsg('Please enter a valid course URL to access options.');
            return;
        }

        if (showAdvanced === true) {
            setSelections({
                audience: 'none',
                tone: 'none',
                length: 'none',
                benefit: 'none',
                emoji: 'none',
            });
        }
        setShowAdvanced(!showAdvanced);
    };

    const handleSelectChange = (key: string, value: string) => {
        setSelections((prev) => ({ ...prev, [key]: value }));
    };

    // ==========================================
    // REFACTORED: Bulletproof Fetch Logic
    // ==========================================
    const executeFetch = async (targetUrl: string, currentSelections: any, useSelections: boolean) => {
        setShowModal(false);
        setIsLoading(true); 
        setErrorMsg(''); 
        setApiResult(null); 

        const payload = {
            url: targetUrl,
            ...(useSelections ? currentSelections : {})
        };

        console.log(">> [DEBUG] Starting Fetch. Payload:", payload);

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);

            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: controller.signal
            });

            clearTimeout(timeoutId); 

            console.log(">> [DEBUG] Response Status:", response.status);

            const data = await response.json();
            console.log(">> [DEBUG] Response Data:", data);

            if (!response.ok) {
                setErrorMsg(data.error || "An error occurred while validating the course link.");
            } else {
                // SUCCESS STATE
                setApiResult({
                    eventId: data.eventId,
                    ...data.courseContext
                });
                
                // NEW: Auto-collapse the advanced options so the result is immediately visible!
                setShowAdvanced(false);
            }
        } catch (err: any) {
            console.error(">> [DEBUG] Fetch Error:", err);
            
            if (err.name === 'AbortError') {
                setErrorMsg("Request timed out. The server took too long to respond.");
            } else {
                setErrorMsg("Network error. Please check your connection and try again.");
            }
        } finally {
            console.log(">> [DEBUG] Shutting off loading spinner.");
            setIsLoading(false); 
        }
    };
    const handleGenerate = (e: React.FormEvent) => {
        e.preventDefault();

        if (isButtonDisabled) {
            if (!isLoading) setErrorMsg('Please enter a valid course URL to create a message.');
            return;
        }

        if (!hasSelectedOptions) {
            setShowModal(true);
        } else {
            // Explicitly pass the current state to prevent stale closures
            executeFetch(url, selections, true);
        }
    };

    return (
        <>
            <form onSubmit={handleGenerate} noValidate className="w-full max-w-full mx-auto flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-700 mt-5 pb-10">

                <div className="flex flex-col lg:flex-row gap-4 w-full items-start">
                    <div className="flex flex-col flex-grow w-full gap-2">
                        <div className="relative flex items-center w-full">
                            <div className="absolute left-4 text-neutral-400 pointer-events-none">
                                <LinkIcon className="h-5 w-5" />
                            </div>
                            <input
                                type="url"
                                value={url}
                                disabled={isLoading} 
                                onChange={(e) => {
                                    setUrl(e.target.value);
                                    if (errorMsg) setErrorMsg('');
                                }}
                                placeholder="Paste your Art of Living course link here (e.g., https://...)"
                                className="w-full bg-white border border-neutral-300 text-neutral-900 text-base md:text-lg rounded-2xl py-4 pl-12 pr-6 placeholder:text-neutral-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200 transition-all shadow-sm disabled:bg-neutral-50 disabled:text-neutral-500"
                            />
                        </div>

                        {errorMsg && (
                            <div className="text-red-500 text-sm flex items-center gap-1.5 ml-4 animate-in fade-in slide-in-from-top-1">
                                <Info className="h-4 w-4" />
                                {errorMsg}
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto shrink-0">
                        <button
                            type="button"
                            onClick={handleToggleOptions}
                            disabled={isLoading}
                            className={`flex-1 lg:flex-none flex items-center justify-center gap-2 border font-medium rounded-2xl px-6 py-4 transition-colors ${
                                isButtonDisabled && !isLoading
                                    ? 'opacity-50 cursor-not-allowed bg-white border-neutral-300 text-neutral-700'
                                    : isLoading
                                        ? 'opacity-50 cursor-not-allowed bg-white border-neutral-300 text-neutral-400'
                                        : showAdvanced
                                            ? 'bg-amber-100 border-amber-300 text-amber-900 cursor-pointer hover:bg-amber-200'
                                            : 'bg-white border-neutral-300 text-neutral-700 hover:bg-amber-200 cursor-pointer'
                            }`}
                        >
                            {showAdvanced ? (
                                <>
                                    <X className="h-5 w-5" />
                                    Close Options
                                </>
                            ) : (
                                <>
                                    <SlidersHorizontal className="h-5 w-5" />
                                    Options
                                </>
                            )}
                        </button>

                        {!showAdvanced && (
                            <button
                                type="submit"
                                disabled={isButtonDisabled}
                                className={`flex-1 lg:flex-none flex items-center justify-center gap-2 font-semibold rounded-2xl px-8 py-4 transition-colors shadow-md min-w-[200px] ${
                                    isButtonDisabled
                                        ? 'opacity-50 cursor-not-allowed bg-amber-500 text-white'
                                        : 'bg-amber-500 text-white hover:bg-amber-600 cursor-pointer'
                                }`}
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="h-5 w-5 animate-spin text-amber-50" />
                                        Fetching...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="h-5 w-5 shrink-0 text-amber-50" />
                                        Create Message
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>

                {showAdvanced && (
                    <div className="w-full mt-8 bg-white/80 border border-neutral-200 rounded-2xl p-6 md:p-8 animate-in fade-in slide-in-from-top-4 duration-300 shadow-sm backdrop-blur-sm">
                        <div className="text-left mb-6">
                            <h2 className="text-xl font-bold text-neutral-900">Tailor Your Message</h2>
                            <p className="text-sm text-neutral-600 mt-1">Fine-tune the AI's context. Leave as "None" for default generation.</p>

                            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3 items-start shadow-sm">
                                <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                                <p className="text-sm text-amber-900">
                                    <span className="font-bold text-amber-950">Note: </span>
                                    If you close this options panel, your selections will be reset to "None". Keep the panel open while clicking "Create Message" to apply these settings.
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 text-left">
                            <CustomSelect label="Target Audience" options={DROPDOWN_OPTIONS.audiences} value={selections.audience} onChange={(val) => handleSelectChange('audience', val)} />
                            <CustomSelect label="Message Tone" options={DROPDOWN_OPTIONS.tones} value={selections.tone} onChange={(val) => handleSelectChange('tone', val)} />
                            <CustomSelect label="Message Length" options={DROPDOWN_OPTIONS.lengths} value={selections.length} onChange={(val) => handleSelectChange('length', val)} />
                            <CustomSelect label="Core Benefit Focus" options={DROPDOWN_OPTIONS.benefits} value={selections.benefit} onChange={(val) => handleSelectChange('benefit', val)} />
                            <CustomSelect label="Emoji Level" options={DROPDOWN_OPTIONS.emojis} value={selections.emoji} onChange={(val) => handleSelectChange('emoji', val)} />
                        </div>

                        <div className="mt-10 flex justify-center">
                            <button
                                type="submit"
                                disabled={isButtonDisabled}
                                className={`w-full sm:w-auto flex items-center justify-center gap-2 font-semibold rounded-2xl px-12 py-4 transition-colors shadow-md min-w-[250px] ${
                                    isButtonDisabled
                                        ? 'opacity-50 cursor-not-allowed bg-amber-500 text-white'
                                        : 'bg-amber-500 text-white hover:bg-amber-600 cursor-pointer'
                                }`}
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="h-5 w-5 animate-spin text-amber-50" />
                                        Fetching Details...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="h-5 w-5 shrink-0 text-amber-50" />
                                        Create Message
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </form>

            {apiResult && (
                <div className="w-full max-w-full mx-auto mb-32 animate-in fade-in slide-in-from-bottom-4">
                    <div className="bg-white border border-green-200 rounded-2xl p-6 md:p-8 shadow-sm">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="h-3 w-3 bg-green-500 rounded-full animate-pulse"></div>
                            <h3 className="text-lg font-bold text-neutral-900">Successfully Extracted Course Data</h3>
                        </div>
                        <p className="text-sm text-neutral-600 mb-4">This is the structured data that will be fed to the AI to generate your message.</p>

                        <pre className="bg-neutral-50 p-4 rounded-xl text-sm text-neutral-800 overflow-x-auto border border-neutral-200 shadow-inner">
                            <code>{JSON.stringify(apiResult, null, 2)}</code>
                        </pre>
                    </div>
                </div>
            )}

            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 backdrop-blur-sm animate-in fade-in duration-200 p-4">
                    <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 md:p-8 animate-in zoom-in-95 duration-200">
                        <button
                            type="button"
                            onClick={() => setShowModal(false)}
                            className="absolute top-4 right-4 p-2 text-neutral-500 hover:text-black hover:bg-neutral-300 rounded-full transition-colors cursor-pointer"
                            aria-label="Close modal"
                        >
                            <X className="h-5 w-5" />
                        </button>

                        <h3 className="text-xl font-bold text-neutral-900 mb-2 pr-8">
                            Use Default Settings?
                        </h3>
                        <p className="text-neutral-600 mb-8 leading-relaxed">
                            You haven't selected any additional personalization options tailored to your preferences. Do you still wish to continue generating the message using the standard AI defaults?
                        </p>

                        <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowModal(false);
                                    if (!showAdvanced) setShowAdvanced(true);
                                }}
                                className="px-6 py-3 rounded-xl font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-300 transition-colors w-full sm:w-auto cursor-pointer"
                            >
                                Review Options
                            </button>

                            {/* UPDATED: Pass false explicitly to ignore the empty options */}
                            <button
                                type="button"
                                onClick={() => executeFetch(url, selections, false)}
                                className="px-6 py-3 rounded-xl font-medium text-white bg-amber-500 hover:bg-amber-600 transition-colors flex items-center justify-center gap-2 shadow-sm w-full sm:w-auto cursor-pointer"
                            >
                                <Sparkles className="h-4 w-4" />
                                Continue with Defaults
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}