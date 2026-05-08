// components/features/GeneratorForm.tsx
"use client";

import { useState, useEffect } from 'react';
import { LinkIcon, Sparkles, SlidersHorizontal, Info, X, Loader2, RefreshCw, Heart, Share2, Copy, Check } from 'lucide-react';
import { DROPDOWN_OPTIONS } from '@/lib/constants';
import CustomSelect from '../ui/CustomSelect';

export default function GeneratorForm() {
    const [url, setUrl] = useState('');
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [toastMsg, setToastMsg] = useState<string | null>(null);
    const [likedMessageId, setLikedMessageId] = useState<string | null>(null);
    const [shareModalMsg, setShareModalMsg] = useState<any>(null);
    const [isEngaging, setIsEngaging] = useState<{ [key: string]: boolean }>({});

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

    const handleEngagement = async (action: 'copy' | 'like' | 'share', msg: any) => {
        // Prevent spam clicking
        if (isEngaging[`${action}-${msg.message_id}`]) return;

        // Set UI loading state for this specific button
        setIsEngaging(prev => ({ ...prev, [`${action}-${msg.message_id}`]: true }));

        try {
            // Trigger UI Effects Immediately for snappy UX
            if (action === 'copy') {
                navigator.clipboard.writeText(msg.message_text);
                setToastMsg("Message copied to clipboard! ✨");
                setTimeout(() => setToastMsg(null), 3000);
            }
            else if (action === 'like') {
                setLikedMessageId(msg.message_id);
                // Remove the floating heart after 1.5s
                setTimeout(() => setLikedMessageId(null), 1500);
            }

            // Send silently to database
            await fetch('/api/engage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    eventId: apiResult.eventId,
                    courseLabel: apiResult.course_event_type_label || apiResult.event_name || apiResult.course_name || 'AOL Course',
                    messageData: msg,
                    action: action
                })
            });

        } catch (error) {
            console.error("Engagement tracking failed", error);
        } finally {
            setIsEngaging(prev => ({ ...prev, [`${action}-${msg.message_id}`]: false }));
        }
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
                className="w-full max-w-6xl mx-auto flex flex-col items-center pb-10 space-y-6"
            >

                <div className="flex flex-col lg:flex-row gap-4 w-full items-start">
                    <div className="flex flex-col flex-grow w-full gap-2">
                        <div className="relative flex items-center w-full">
                            <div className="absolute left-4 text-neutral-400 pointer-events-none">
                                <LinkIcon className="h-5 w-5" />
                            </div>
                            <input
                                type="text"
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
                            // ✨ RED FROSTED GLASS ERROR PILL ✨
                            <div className="w-full bg-red-700/40 border border-red-500/50 backdrop-blur-md rounded-xl px-4 py-3 flex items-center gap-3 animate-in fade-in slide-in-from-top-2 shadow-lg">
                                <Info className="h-5 w-5 text-red-400 shrink-0" />
                                <span className="font-medium text-red-50 text-base md:text-lg">
                                    {errorMsg}
                                </span>
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
                    // ✨ GLASSMORPHISM APPLIED HERE ✨
                    <div className="w-full mt-8 bg-white/40 border border-white/30 rounded-3xl p-6 md:p-8 animate-in fade-in slide-in-from-top-4 duration-300 shadow-xl backdrop-blur-sm">
                        <div className="text-left mb-6">
                            <h2 className="text-xl font-bold text-neutral-900">Tailor Your Message</h2>
                            <p className="text-sm text-neutral-800 mt-1">Fine-tune the AI's context. Leave as "None" for default generation.</p>

                            {/* Slightly adjusted the info box to match the new glass theme */}
                            <div className="mt-4 bg-white/40 border border-white/50 rounded-xl p-4 flex gap-3 items-start shadow-sm backdrop-blur-sm">
                                <Info className="h-5 w-5 text-neutral-800 shrink-0 mt-0.5" />
                                <p className="text-sm text-neutral-900">
                                    <span className="font-bold">Note: </span>
                                    If you close this options panel, your selections will be reset to "None". Keep the panel open while clicking "Create Message" to apply these settings.
                                </p>
                            </div>
                        </div>
                        {/* ... rest of the selects and button ... */}

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
                <div className="w-full max-w-[1400px] mx-auto mb-32 animate-in fade-in slide-in-from-bottom-4 px-6">

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
                            // ✨ GLASSMORPHISM APPLIED HERE ✨
                            <div key={msg.message_id} className="bg-white/40 backdrop-blur-sm border border-white/30 rounded-3xl p-6 md:p-8 shadow-xl flex flex-col relative hover:shadow-2xl transition-all">

                                {/* Badge Number (Optional: you can change bg-amber-500 to bg-neutral-900 if you want to drop amber entirely) */}
                                <div className="absolute -top-4 -left-4 bg-amber-500 text-white w-10 h-10 flex items-center justify-center rounded-full font-bold shadow-md border-4 border-white/50">
                                    {idx + 1}
                                </div>

                                {/* The Actual Message */}
                                <p className="text-neutral-900 font-medium text-lg leading-relaxed whitespace-pre-wrap break-words flex-grow mb-8">
                                    {msg.message_text}
                                </p>

                                {/* Action Buttons - Made slightly more transparent to match */}
                                <div className="flex flex-wrap items-center gap-3 mt-auto pt-5 border-t border-white/30">
                                    {/* COPY BUTTON */}
                                    <button
                                        onClick={() => handleEngagement('copy', msg)}
                                        className="flex-1 flex justify-center items-center gap-2 bg-white/50 hover:bg-white/70 text-neutral-900 font-bold py-3 px-4 rounded-xl transition-colors cursor-pointer shadow-sm backdrop-blur-sm"
                                    >
                                        <Copy className="h-4 w-4" /> Copy
                                    </button>

                                    {/* LIKE BUTTON (With floating heart animation) */}
                                    <div className="flex-1 relative">
                                        <button
                                            onClick={() => handleEngagement('like', msg)}
                                            className="w-full flex justify-center items-center gap-2 bg-white/50 hover:bg-white/70 text-amber-700 font-bold py-3 px-4 rounded-xl transition-colors cursor-pointer shadow-sm backdrop-blur-sm"
                                        >
                                            <Heart className={`h-4 w-4 ${likedMessageId === msg.message_id ? 'fill-red-500 text-red-500 animate-pulse' : ''}`} />
                                            Like
                                        </button>

                                        {/* Beautiful floating heart animation */}
                                        {likedMessageId === msg.message_id && (
                                            <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 pointer-events-none animate-in fade-in slide-in-from-bottom-8 zoom-in duration-700">
                                                <Heart className="h-12 w-12 text-red-500 fill-red-500 drop-shadow-lg" />
                                            </div>
                                        )}
                                    </div>

                                    {/* SHARE BUTTON */}
                                    <button
                                        onClick={() => setShareModalMsg(msg)}
                                        className="flex-1 flex justify-center items-center gap-2 bg-white/50 hover:bg-white/70 text-blue-700 font-bold py-3 px-4 rounded-xl transition-colors cursor-pointer shadow-sm backdrop-blur-sm"
                                    >
                                        <Share2 className="h-4 w-4" /> Share
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

            {/* ==========================================
                SHARE MODAL
            ========================================== */}
            {shareModalMsg && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-neutral-900/60 backdrop-blur-sm animate-in fade-in duration-200 p-4">
                    <div className="relative bg-white/90 backdrop-blur-xl border border-white/50 rounded-3xl shadow-2xl w-full max-w-sm p-6 animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-300">
                        <button
                            onClick={() => setShareModalMsg(null)}
                            className="absolute top-4 right-4 p-2 text-neutral-500 hover:text-black hover:bg-neutral-200/50 rounded-full transition-colors cursor-pointer"
                        >
                            <X className="h-5 w-5" />
                        </button>

                        <h3 className="text-xl font-bold text-neutral-900 mb-6 text-center">Share Message</h3>

                        <div className="grid grid-cols-3 gap-4">
                            <button onClick={() => { handleEngagement('share', shareModalMsg); setShareModalMsg(null); }} className="flex flex-col items-center gap-2 group cursor-pointer">
                                <div className="h-14 w-14 rounded-full bg-green-100 flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm">
                                    <svg className="w-7 h-7 text-green-600" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" /></svg>
                                </div>
                                <span className="text-xs font-semibold text-neutral-700">WhatsApp</span>
                            </button>
                            <button onClick={() => { handleEngagement('share', shareModalMsg); setShareModalMsg(null); }} className="flex flex-col items-center gap-2 group cursor-pointer">
                                <div className="h-14 w-14 rounded-full bg-blue-100 flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm">
                                    <svg className="w-7 h-7 text-blue-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 24c6.627 0 12-5.373 12-12S18.627 0 12 0 0 5.373 0 12s5.373 12 12 12zM5.882 12.883l3.525 1.254 1.158 3.522c.115.35.602.378.756.044l1.192-2.584 3.73 2.766c.264.195.632.062.688-.26l2.336-13.626c.074-.432-.387-.77-.788-.57L5.617 11.666c-.43.214-.378.847.265 1.217z" /></svg>
                                </div>
                                <span className="text-xs font-semibold text-neutral-700">Telegram</span>
                            </button>
                            <button onClick={() => { handleEngagement('share', shareModalMsg); setShareModalMsg(null); }} className="flex flex-col items-center gap-2 group cursor-pointer">
                                <div className="h-14 w-14 rounded-full bg-neutral-800 flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm">
                                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
                                </div>
                                <span className="text-xs font-semibold text-neutral-700">X (Twitter)</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ==========================================
                SUCCESS TOAST NOTIFICATION
            ========================================== */}
            {toastMsg && (
                <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50">
                    <div className="bg-neutral-200/90 backdrop-blur-md text-black px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-5 duration-300">
                        <Check className="h-5 w-5 text-green-500" />
                        <span className="font-medium text-sm md:text-base">{toastMsg}</span>
                    </div>
                </div>
            )}
        </>
    );
}