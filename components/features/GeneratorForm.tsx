// components/features/GeneratorForm.tsx
"use client";

import { useState, useEffect } from 'react';
import { LinkIcon, Sparkles, SlidersHorizontal, Info, X, Loader2, RefreshCw } from 'lucide-react';
import { DROPDOWN_OPTIONS } from '@/lib/constants';
import CustomSelect from '../ui/CustomSelect';

export default function GeneratorForm() {
    const [url, setUrl] = useState('');
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [showModal, setShowModal] = useState(false);

    const [isLoading, setIsLoading] = useState(false);
    const [apiResult, setApiResult] = useState<any>(null);
    const [pendingResult, setPendingResult] = useState<any>(null);

    const [selections, setSelections] = useState({
        audience: 'none',
        tone: 'none',
        length: 'none',
        benefit: 'none',
        emoji: 'none',
    });

    const isAolLink = (urlString: string) => {
        try {
            const urlObj = new URL(urlString);
            const isAolOnline = urlObj.hostname.includes("artofliving.online") && urlObj.pathname.includes("registration");
            const isAoltIn = urlObj.hostname.includes("aolt.in");
            return isAolOnline || isAoltIn;
        } catch (e) {
            return false;
        }
    };

    const looksLikeUrl = (urlString: string) => {
        // Broad regex to catch domains (google.com) even without protocol
        const regex = /^(https?:\/\/)?([\w\-]+\.)+[\w\-]{2,}(\/[\w\-./?%&=]*)?$/;
        return regex.test(urlString.trim());
    };

    const isInvalid = url.trim() === '' || !looksLikeUrl(url) || errorMsg !== '';
    const hasSelectedOptions = Object.values(selections).some(val => val !== 'none');

    const handleToggleOptions = () => {
        if (isLoading) return;

        if (isInvalid) {
            setErrorMsg('Please enter a link/url to access options');
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
    // CORE FETCH LOGIC
    // ==========================================
    const executeFetch = async (targetUrl: string, currentSelections: any, useSelections: boolean) => {
        setIsLoading(true);
        setErrorMsg('');
        setApiResult(null);
        setPendingResult(null);

        const payload = {
            url: targetUrl,
            ...(useSelections ? currentSelections : {})
        };

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 300000);

            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            const data = await response.json();

            if (!response.ok) {
                setErrorMsg(data.error || "An error occurred while validating the course link.");
                setIsLoading(false);
            } else {
                // SUCCESS
                const result = {
                    eventId: data.event_id_val,
                    messages: data.messages, // <-- CRITICAL: Grab the AI messages!
                    ...data.courseContext
                };

                // Logic: If user didn't pick any options, show modal first
                if (!useSelections && !hasSelectedOptions) {
                    setPendingResult(result);
                    setShowModal(true);
                    setIsLoading(false);
                } else {
                    // They either used options OR they just clicked "Continue" from the modal
                    setApiResult(result);
                    setShowAdvanced(false);
                    setIsLoading(false);
                }
            }
        } catch (err: any) {
            console.error("Fetch Error:", err);
            if (err.name === 'AbortError') {
                setErrorMsg("Request timed out. The server took too long to respond.");
            } else {
                setErrorMsg("Network error. Please check your connection and try again.");
            }
            setIsLoading(false);
        }
    };

    const handleReset = () => {
        setUrl('');
        setErrorMsg('');
        setApiResult(null);
        setPendingResult(null);
        setShowAdvanced(false);
        setSelections({
            audience: 'none',
            tone: 'none',
            length: 'none',
            benefit: 'none',
            emoji: 'none',
        });
        window.scrollTo({ top: 0, behavior: 'smooth' }); // Scroll back to the top!
    };

    const handleGenerate = (e: React.FormEvent) => {
        e.preventDefault();
        if (isLoading) return;

        if (isInvalid) {
            setErrorMsg('Please enter a link/url to create message');
            return;
        }

        // We trigger the fetch immediately. 
        // The modal decision is now inside the SUCCESS path of executeFetch.
        executeFetch(url, selections, hasSelectedOptions);
    };

    const handleConfirmModal = () => {
        if (pendingResult) {
            setApiResult(pendingResult);
            setShowModal(false);
            setShowAdvanced(false);
        }
    };

    // Keyboard support for the modal
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (showModal && e.key === 'Enter') {
                e.preventDefault();
                handleConfirmModal();
            }
            if (showModal && e.key === 'Escape') {
                setShowModal(false);
            }
        };

        if (showModal) {
            window.addEventListener('keydown', handleKeyDown);
        }

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [showModal, pendingResult]);

    return (
        <>
            <form 
            onSubmit={handleGenerate} 
            className="w-full max-w-5xl mx-auto flex flex-col items-center mt-2 pb-10 space-y-6"
        >

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
                                    // Automatically close options and clear results on new input
                                    if (showAdvanced) setShowAdvanced(false);
                                    if (apiResult) setApiResult(null);
                                }}
                                placeholder="Paste your Art of Living course link here (e.g., https://...)"
                                className="w-full bg-white border border-neutral-300 text-neutral-900 text-base md:text-lg rounded-2xl py-4 pl-12 pr-6 placeholder:text-neutral-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200 transition-all shadow-sm disabled:bg-neutral-50 disabled:text-neutral-500"
                            />
                        </div>

                        {errorMsg && (
                            <div className="w-full  text-red-700 px-4 py-2 flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                                <Info className="h-6 w-6 text-red-500 shrink-0" />
                                <span className="font-semibold text-base md:text-lg">{errorMsg}</span>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto shrink-0">
                        <button
                            type="button"
                            onClick={handleToggleOptions}
                            disabled={isLoading}
                            className={`flex-1 lg:flex-none flex items-center justify-center gap-2 border font-medium rounded-2xl px-6 py-4 transition-colors ${isInvalid && !isLoading
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
                                disabled={isLoading}
                                className={`flex-1 lg:flex-none flex items-center justify-center gap-2 font-semibold rounded-2xl px-8 py-4 transition-colors shadow-md min-w-[200px] ${isInvalid && !isLoading
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
                                disabled={isLoading}
                                className={`w-full sm:w-auto flex items-center justify-center gap-2 font-semibold rounded-2xl px-12 py-4 transition-colors shadow-md min-w-[250px] ${isInvalid && !isLoading
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

            {apiResult && apiResult.messages && (
                <div className="w-full max-w-[1400px] mx-auto mb-32 animate-in fade-in slide-in-from-bottom-4 overflow-hidden">
                    
                    {/* Header with Start Over Button */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
                        <div className="flex items-center gap-3">
                            <Sparkles className="h-6 w-6 text-amber-500" />
                            <h2 className="text-2xl md:text-3xl font-bold text-neutral-900">Your Generated Messages</h2>
                        </div>
                        <button
                            onClick={handleReset}
                            className="flex items-center cursor-pointer gap-2 px-5 py-2.5 rounded-xl font-semibold text-neutral-600 bg-white border border-neutral-200 hover:bg-neutral-50 hover:text-neutral-900 transition-all shadow-sm"
                        >
                            <RefreshCw className="h-4 w-4" />
                            Start Over
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {apiResult.messages.map((msg: any, idx: number) => (
                            <div key={msg.message_id} className="bg-white border border-neutral-200 rounded-3xl p-6 md:p-8 shadow-sm flex flex-col relative hover:shadow-md transition-shadow">

                                {/* Badge Number */}
                                <div className="absolute -top-4 -left-4 bg-amber-500 text-white w-10 h-10 flex items-center justify-center rounded-full font-bold shadow-md border-4 border-white">
                                    {idx + 1}
                                </div>

                                {/* The Actual Message (ADDED break-words TO FIX OVERFLOW) */}
                                <p className="text-neutral-800 text-lg leading-relaxed whitespace-pre-wrap break-words flex-grow mb-8">
                                    {msg.message_text}
                                </p>

                                {/* Action Buttons */}
                                <div className="flex flex-wrap items-center gap-3 mt-auto pt-5 border-t border-neutral-100">
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(msg.message_text);
                                            alert("Copied to clipboard!"); 
                                        }}
                                        className="flex-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium py-3 px-4 rounded-xl transition-colors cursor-pointer"
                                    >
                                        Copy Text
                                    </button>

                                    <button
                                        onClick={() => {
                                            console.log("Liked:", msg.message_id);
                                        }}
                                        className="flex-1 bg-amber-50 hover:bg-amber-100 text-amber-700 font-medium py-3 px-4 rounded-xl transition-colors cursor-pointer"
                                    >
                                        👍 Like
                                    </button>

                                    <button
                                        onClick={() => {
                                            console.log("Shared:", msg.message_id);
                                        }}
                                        className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium py-3 px-4 rounded-xl transition-colors cursor-pointer"
                                    >
                                        📤 Share
                                    </button>
                                </div>
                            </div>
                        ))}
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

                            <button
                                type="button"
                                onClick={handleConfirmModal}
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