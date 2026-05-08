import { NextResponse } from 'next/server';
import { Runner, InMemorySessionService } from '@google/adk';
import { v4 as uuidv4 } from 'uuid';

// Import your custom agents and database helpers
import { researchAgent } from '@/lib/agents/researchAgent';
import { copywriterAgent } from '@/lib/agents/copywriterAgent';
import { getEventMessageCount, saveGeneratedBatch } from '@/lib/dynamo';


export const maxDuration = 300; // Tells Vercel to allow 200 seconds of processing time

const sessionService = new InMemorySessionService();

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { url, ...options } = body as any;

        // ==========================================
        // 1. URL Validation & Event ID Extraction
        // ==========================================
        if (!url || typeof url !== 'string') {
            return NextResponse.json({ error: 'A valid URL is required.' }, { status: 400 });
        }

        // ✨ NEW: Auto-prepend https:// if the user forgot it (e.g., "google.com")
        let parsedUrlString = url.trim();
        if (!/^https?:\/\//i.test(parsedUrlString)) {
            parsedUrlString = 'https://' + parsedUrlString;
        }

        let urlObj: URL;
        try {
            urlObj = new URL(url);
        } catch (e) {
            return NextResponse.json({ error: 'Please provide a valid Art of Living course link' }, { status: 400 });
        }

        let event_id_val: string | null = null;
        event_id_val = urlObj.searchParams.get("event_id") || urlObj.searchParams.get("id");

        if (!event_id_val) {
            const pathSegments = urlObj.pathname.split("/").filter(Boolean);
            for (const segment of pathSegments) {
                if (/^\d{5,9}$/.test(segment)) {
                    event_id_val = segment;
                    break;
                }
            }
        }

        if (!event_id_val || !/^\d+$/.test(event_id_val)) {
            return NextResponse.json({ error: 'Please provide a valid Art of Living course link' }, { status: 400 });
        }

        // ==========================================
        // 2. Configuration Check
        // ==========================================
        const apiURL = process.env.AOL_API_URL;
        if (!apiURL) {
            console.error("CRITICAL: AOL_API_URL is missing.");
            return NextResponse.json({ error: 'Please provide a valid Art of Living course link' }, { status: 400 });
        }

        // ==========================================
        // 3. Fetch Data from AOL API
        // ==========================================
        const params = new URLSearchParams();
        params.append("event_id", event_id_val);
        params.append('url_reg_type', '');
        params.append('pkg_id', '');
        params.append('dis_id', '');
        params.append('g_dis', '');

        let apiResponse;
        try {
            apiResponse = await fetch(apiURL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                    'Accept': 'application/json, text/javascript, */*; q=0.01'
                },
                body: params.toString()
            });
        } catch (fetchError) {
            return NextResponse.json({ error: 'This Art of Living course is no longer active or accepting registrations.' }, { status: 400 });
        }

        if (!apiResponse.ok) {
            return NextResponse.json({ error: 'This Art of Living course is no longer active or accepting registrations.' }, { status: 400 });
        }

        const responseText = await apiResponse.text();
        let rawData;
        try {
            rawData = JSON.parse(responseText);
        } catch (e) {
            return NextResponse.json({ error: 'This Art of Living course is no longer active or accepting registrations.' }, { status: 400 });
        }

        const courseData = Array.isArray(rawData) ? rawData[0] : rawData;

        // ==========================================
        // 4. Validation & Data Extraction
        // ==========================================
        const courseName = courseData?.course_event_type_label || courseData?.event_name || courseData?.course_name;
        const explicitError = (courseData?.is_error === 1 || courseData?.is_error === "1") ||
            (courseData?.status === "error") ||
            (courseData?.error && courseData.error !== "0" && courseData.error !== 0 && typeof courseData.error === 'string' && courseData.error.length > 1);

        if (!courseData || !courseName || explicitError) {
            return NextResponse.json({ error: 'This Art of Living course is no longer active or accepting registrations.' }, { status: 403 });
        }

        let parsedTeachers: string[] = [];
        let contactNumbers: string[] = [];

        try {
            if (courseData.teacher_info) {
                const info = typeof courseData.teacher_info === 'string'
                    ? JSON.parse(courseData.teacher_info)
                    : courseData.teacher_info;

                if (Array.isArray(info)) {
                    info.forEach((t: any) => {

                        if (t.teacher_name) {
                            parsedTeachers.push(t.teacher_name.trim());
                        }

                        if (t.teacher_phone) {
                            contactNumbers.push(String(t.teacher_phone).trim());
                        }
                    });
                }
            }

            if (courseData.course_teacher_name) {
                const mainTeachers = typeof courseData.course_teacher_name === 'string' ? JSON.parse(courseData.course_teacher_name) : courseData.course_teacher_name;
                if (Array.isArray(mainTeachers)) {
                    mainTeachers.forEach((t: any) => { if (t.teacher_name) parsedTeachers.push(t.teacher_name.trim()); });
                }
            }
            parsedTeachers = [...new Set(parsedTeachers)];
        } catch (e) {
            console.warn("Could not parse teacher_info strings", e);
        }

        const tryParseJSON = (value: any) => {
            if (typeof value !== "string") return value;
            try { return JSON.parse(value); } catch { return value; }
        };

        // ==========================================
        // 5. Deep Clean Entire API Response
        // ==========================================
        const cleanValue = (value: any): any => {
            if (typeof value === "string") {
                return value
                    .replace(/&[a-z]+;/gi, " ")
                    .replace(/<[^>]*>?/gm, " ")
                    .replace(/\r/g, " ")
                    .replace(/\n/g, " ")
                    .replace(/\s+/g, " ")
                    .trim();
            }
            if (Array.isArray(value)) return value.map(cleanValue);
            if (value && typeof value === "object") {
                const cleanedObj: any = {};
                Object.entries(value).forEach(([key, val]) => {
                    cleanedObj[key] = cleanValue(tryParseJSON(val));
                });
                return cleanedObj;
            }
            return value;
        };

        const cleanedCourseData = cleanValue(courseData);
        cleanedCourseData.teachers = parsedTeachers.length > 0 ? parsedTeachers.join(", ") : "TBA";
        cleanedCourseData.contact_numbers =
            contactNumbers.length > 0
                ? [...new Set(contactNumbers)].join(", ")
                : "Contact details available on registration page";

        // ==========================================
        // 6. DynamoDB Gatekeeper (Rate Limiting)
        // ==========================================
        const currentGenerationCount = await getEventMessageCount(event_id_val);
        if (currentGenerationCount >= 15) {
            return NextResponse.json({
                error: "This event has reached its maximum AI generation limit of 15 batches."
            }, { status: 429 });
        }

        // Note: Change to `sessionService.create({ ... })` if your IDE still complains
        const session = await sessionService.createSession({
            appName: 'AOL_Generator',
            userId: 'anonymous',
            sessionId: uuidv4()
        });

        // ==========================================
        // 7. Process User Preferences
        // ==========================================
        const parsePref = (val: string | undefined) => {
            if (!val || val.toLowerCase() === 'none') return "Use your best judgment / Default AOL style";
            return val;
        };

        const prefs = {
            audience: parsePref(options.audience),
            tone: parsePref(options.tone),
            length: parsePref(options.length),
            benefit: parsePref(options.benefit),
            emoji: parsePref(options.emoji)
        };

        // ==========================================
        // 8. Run Research Agent (S3 Fetching)
        // ==========================================
        const researchRunner = new Runner({
            appName: 'AOL_Generator',
            agent: researchAgent,
            sessionService
        });

        const safeGet = (val: any, fallback = 'Not specified') =>
            val && String(val).trim() !== '' ? String(val).trim() : fallback;

        const isOnline = String(cleanedCourseData.address || '')
            .toLowerCase()
            .includes('online');

        const courseLabel =
            cleanedCourseData.course_event_type_label ||
            cleanedCourseData.event_name ||
            "Art of Living Course";

        const displayCourseName = isOnline ? `Online ${courseLabel}` : courseLabel;

        const researchPrompt = `
You are a marketing research assistant for Art of Living courses.
Your job is to scan S3 assets (images, flyers, PDFs) for the course below and return a structured research summary.

COURSE TO RESEARCH: "${courseLabel}"

USER PREFERENCES (use these to prioritise what to extract):
- Target Audience: ${safeGet(options.audience, 'General public')}
- Benefit to Highlight: ${safeGet(options.benefit, 'General wellness and stress relief')}

═══════════════════════════════════════════
SCANNING INSTRUCTIONS
═══════════════════════════════════════════
Scan all available S3 assets for this course. For EACH asset you find:

1. CONTENT EXTRACTION — Extract:
   - Key benefits and transformation statements
   - Testimonials or social proof quotes
   - Schedule/timing details visible in the asset
   - Any unique selling points or phrases
   - Teacher names or credentials shown

2. STYLE EXTRACTION — Note EXACTLY:
   - Emoji usage: which emojis are used, how many, where (start/middle/end of lines)
   - Line break patterns: how much whitespace between sections
   - Structure flow: e.g. Hook → Benefits → Details → CTA → Contact
   - Text alignment: centered, left-aligned, mixed
   - Any bold/italic formatting patterns
   - Opening hook style (question, statement, emoji-led)

═══════════════════════════════════════════
FALLBACK RULES (CRITICAL — follow these if assets are missing)
═══════════════════════════════════════════
- If NO assets are found for this course: Return the phrase "NO_ASSETS_FOUND" as your entire content section and provide a DEFAULT style guide using standard WhatsApp message formatting (emoji-led lines, short paragraphs, generous spacing).
- If SOME assets fail to load: Work with what you have. Never return an error. Always return a complete summary.
- If an asset has no readable text: Note the visual layout and emoji style only.
- Never say "I could not" or "I was unable to". Always return your best attempt.

═══════════════════════════════════════════
OUTPUT FORMAT (MANDATORY — always return this exact structure)
═══════════════════════════════════════════
Return your response in this EXACT structure with these exact headers.
Do not add extra sections. Do not skip sections even if empty:

## ASSETS_FOUND
[YES / NO / PARTIAL — and list the filenames you scanned]

## KEY_FACTS
[Bullet points of benefits, testimonials, unique selling points extracted. If none found, write "None extracted — use course API data only."]

## STYLE_GUIDE
[Describe the exact formatting pattern to replicate. Include:
- Emoji placement and frequency
- Line break frequency
- Section order (e.g. Hook → Body → CTA → Contact)
- Tone (warm/urgent/inspirational)
- Opening hook style
If no assets found, provide this DEFAULT style guide:
"Use WhatsApp-friendly formatting: emoji at start of each key line, 1 blank line between sections, flow: Hook → Dates/Timings → Venue → Benefits → CTA Link → Contact. Tone: warm and inviting. Keep lines short (max 10 words each)."]

## AUDIENCE_SPECIFIC_INSIGHTS
[Any facts or angles from the assets that specifically appeal to: ${safeGet(options.audience, 'general audience')}. If none, write "None found — use general wellness angle."]
`;

        // Run Research Agent
        const researchEvents = researchRunner.runAsync({
            userId: 'anonymous',
            sessionId: session.id,
            newMessage: {
                role: "user",
                parts: [{ text: researchPrompt }]
            }
        });

        // Collect streamed text
        let assetSummary = '';

        for await (const event of researchEvents) {
            if (event.content?.parts) {
                assetSummary += event.content.parts
                    .map((part: any) => part.text || '')
                    .join('');
            }
        }

        console.log("=====================================");
        console.log("🔍 S3 ASSET SUMMARY EXTRACTED:");
        console.log(assetSummary);
        console.log("=====================================");

        // ==========================================
        // 9. Run Copywriter Agent (Text Generation)
        // ==========================================
        const copywriterRunner = new Runner({
            appName: 'AOL_Generator',
            agent: copywriterAgent,
            sessionService
        });

        const courseFields = {
            name: displayCourseName,
            startDate: safeGet(cleanedCourseData.start_date, 'Check registration link for dates'),
            endDate: safeGet(cleanedCourseData.end_date, 'Check registration link for dates'),
            weekdayTime: safeGet(cleanedCourseData.weekdaytimings, 'Check registration link for timings'),
            weekendTime: safeGet(cleanedCourseData.weekendtimings, 'Check registration link for timings'),
            venue: isOnline
                ? 'ONLINE (Join from anywhere)'
                : safeGet(cleanedCourseData.address, 'Venue TBA — check registration link'),
            city: safeGet(cleanedCourseData.course_city, ''),
            language: safeGet(cleanedCourseData.language_of_instruction, 'English'),
            teachers: cleanedCourseData.teachers || 'TBA',
            contactNumbers: cleanedCourseData.contact_numbers || 'Contact via registration link',
            org: safeGet(cleanedCourseData.org_full_name, 'The Art of Living'),
            registrationUrl: url || 'Check with your teacher for the registration link',
        };

        const hasAssets = assetSummary &&
            !assetSummary.includes('NO_ASSETS_FOUND') &&
            assetSummary.trim().length > 50;

        const assetSection = hasAssets
            ? `S3 ASSET SUMMARY (mimic this style and use these facts):
${assetSummary}`
            : `S3 ASSET SUMMARY: No marketing assets were found for this course.
Use the DEFAULT WhatsApp style: emoji-led lines, short punchy sentences, generous line breaks,
flow: Hook → Dates/Timings → Venue → Benefits → CTA → Contact section.`;

        const copywriterPrompt = `
You are an expert WhatsApp/Email copywriter for Art of Living courses.
Your task is to write EXACTLY 2 distinct promotional messages and return them as a valid JSON array.

═══════════════════════════════════════════
ABSOLUTE RULES — NEVER BREAK THESE
═══════════════════════════════════════════
1. 🚫 NO PRICING: Never mention, hint at, or reference any donation amount, course fee, or price. Not even "affordable" or "nominal fee". Completely exclude.
2. 📍 ONLINE PREFIX: This course is ${isOnline ? 'ONLINE. You MUST prefix the course name with "Online " everywhere it appears.' : 'IN-PERSON. Do NOT add "Online" prefix.'}
3. 🔗 REGISTRATION LINK: Every message must include this exact URL — ${courseFields.registrationUrl}
4. 4. 📞 CONTACT SECTION:
Its always good practice to end with(but not mandatory if no contact info is available):

Happy to Help 📞

followed ONLY by contact phone number(s).

DO NOT mention teacher names in this section unless explicitly provided as volunteer/support contacts.
The teacher names are course instructors, not helpdesk volunteers.
5. ✅ JSON ONLY: Your entire response must be a valid JSON array. No text before or after the JSON. No markdown. No explanation.
6. 🚫 NO HALLUCINATION: Only use facts provided below. Never invent dates, venues, or teacher names.
7. 📱 WHATSAPP FRIENDLY: Short lines. Generous spacing. Never a wall of text. Max 10 words per line where possible.

═══════════════════════════════════════════
COURSE DETAILS (use exactly as provided — do not alter)
═══════════════════════════════════════════
Course Name:        ${courseFields.name}
Start Date:         ${courseFields.startDate}
End Date:           ${courseFields.endDate}
Weekday Timings:    ${courseFields.weekdayTime}
Weekend Timings:    ${courseFields.weekendTime}
Venue:              ${courseFields.venue}${courseFields.city ? `, ${courseFields.city}` : ''}
Language:           ${courseFields.language}
Teachers:           ${courseFields.teachers}
Organisation:       ${courseFields.org}
Registration URL:   ${courseFields.registrationUrl}
Contact Numbers:    ${courseFields.contactNumbers}

═══════════════════════════════════════════
${assetSection}
═══════════════════════════════════════════

═══════════════════════════════════════════
USER PREFERENCES
═══════════════════════════════════════════
Target Audience:  ${safeGet(options.audience, 'General public')}
Tone:             ${safeGet(options.tone, 'Warm and uplifting')}
    SPIRITUAL TONE REFERENCE:
    The message tone should feel deeply peaceful, compassionate, uplifting and heart-opening — similar to the warmth and simplicity of Gurudev Sri Sri Ravi Shankar's intro talks.

    The writing should:
    - radiate calmness, positivity and hope
    - feel emotionally soothing and welcoming
    - inspire trust and inner happiness
    - avoid aggressive sales language
    - avoid corporate marketing tone
    - feel human, soulful and spiritually elevated
    - gently invite people rather than "sell" to them

    Use emotionally uplifting phrases such as:
    - "a few moments can change the quality of your life"
    - "discover a calmer and happier you"
    - "come home to yourself"
    - "experience deep rest and clarity"
    - "a beautiful opportunity to recharge from within"

    The tone should feel:
    warm ✨
    peaceful 🌸
    joyful 😊
    compassionate 💛
    spiritually uplifting 🙏

Length:           ${safeGet(options.length, 'Standard — 150 to 250 words')}
Core Benefit:     ${safeGet(options.benefit, 'General wellness and stress relief')}

═══════════════════════════════════════════
MESSAGE DIFFERENTIATION RULES
═══════════════════════════════════════════
Message 1 and Message 2 MUST be meaningfully different:
- Different opening hook (one can be a question, one a bold statement)
- Different benefit angle (e.g. one focuses on stress relief, one on energy/clarity)
- Different emoji set (do not reuse the same emojis in both)
    Emoji usage should feel elegant and emotionally warm.
    Use emojis naturally like authentic Art of Living WhatsApp promotions.

    Preferred emojis:
    ✨ 🌸 😊 🙏 💛 🌿 🕊️ 🌞 💫 😌 🧘 🎶 🌈

    Avoid:
    ❌ excessive fire emojis
    ❌ loud hype marketing emojis
    ❌ spammy emoji repetition
    ❌ aggressive urgency
- Different structural flow

═══════════════════════════════════════════
MANDATORY SECTIONS IN EVERY MESSAGE
═══════════════════════════════════════════
Every message must contain ALL of these sections in this order:
1. Opening hook (1-2 lines max)
2. Course name + brief description
3. 📅 Dates (start and end)
4. ⏰ Timings (weekday AND weekend separately)
5. 📍 Venue (full address or "Online")
6. Key benefits (3-5 bullet points using emojis)
7. 🔗 Registration link (exact URL — no shortening)
8. Happy to Help 📞 (ONLY phone numbers unless specific volunteer names are provided)

═══════════════════════════════════════════
REQUIRED OUTPUT FORMAT (copy this schema exactly)
═══════════════════════════════════════════
[
  {
    "message_number": 1,
    "hook": "One-line description of the opening hook style used",
    "angle": "One-line description of the benefit angle used",
    "text": "The full message text here with \\n for line breaks"
  },
  {
    "message_number": 2,
    "hook": "One-line description of the opening hook style used",
    "angle": "One-line description of the benefit angle used",
    "text": "The full message text here with \\n for line breaks"
  }
]

REMEMBER: Return ONLY this JSON array. Nothing else. No markdown code blocks. No explanation. Just the raw JSON.
`;

        // Run Copywriter Agent
        const copyEvents = copywriterRunner.runAsync({
            userId: 'anonymous',
            sessionId: session.id,
            newMessage: {
                role: "user",
                parts: [{ text: copywriterPrompt }]
            }
        });

        // Collect streamed response
        let rawOutput = '';

        for await (const event of copyEvents) {
            if (event.content?.parts) {
                rawOutput += event.content.parts
                    .map((part: any) => part.text || '')
                    .join('');
            }
        }

        // ==========================================
        // 10. Parse AI JSON Response
        // ==========================================
        let generatedMessages: any[] = [];

        try {
            // Strip any accidental markdown or leading/trailing text
            const cleanJson = rawOutput
                .replace(/```json\n?/gi, '')
                .replace(/```\n?/g, '')
                .trim();

            // Find the JSON array even if LLM added text around it
            const jsonMatch = cleanJson.match(/\[[\s\S]*\]/);
            if (!jsonMatch) throw new Error('No JSON array found in LLM response');

            const parsed = JSON.parse(jsonMatch[0]);

            if (!Array.isArray(parsed) || parsed.length === 0) {
                throw new Error('Parsed result is not a non-empty array');
            }

            // Validate each message has required fields
            generatedMessages = parsed.map((msg: any, i: number) => {
                if (!msg.text || typeof msg.text !== 'string') {
                    throw new Error(`Message ${i + 1} missing text field`);
                }
                return msg;
            });

        } catch (e: any) {
            console.error('[Copywriter] JSON parse failed:', e.message);
            console.error('[Copywriter] Raw output was:', rawOutput.slice(0, 500));

            return NextResponse.json({
                error: "AI failed to format response correctly. Please try again.",
                debug: process.env.NODE_ENV === 'development'
                    ? rawOutput.slice(0, 300)
                    : undefined,
            }, { status: 500 });
        }

        // ==========================================
        // 11. Save & Return
        // ==========================================
        const timestamp = new Date().toISOString()
            .replace(/[-:T.Z]/g, '')
            .slice(0, 14);

        const finalBatch = generatedMessages.map((msg: any, index: number) => ({
            message_id: `${event_id_val}-${timestamp}-M00${index + 1}`,
            message_text: msg.text,
            hook: msg.hook || '',
            angle: msg.angle || '',
            like_count: 0,
            share_count: 0,
            copy_count: 0,
        }));


        await saveGeneratedBatch(event_id_val, courseLabel, finalBatch);

        return NextResponse.json({
            success: true,
            event_id_val,
            courseContext: cleanedCourseData,
            userOptions: options,
            s3_data_found: assetSummary,
            messages: finalBatch // FIXED: Sent back to frontend!
        });

    } catch (error: any) {
        console.error("Pipeline Error:", error);
        return NextResponse.json({
            error: "An error occurred while generating the messages."
        }, { status: 500 });
    }
}