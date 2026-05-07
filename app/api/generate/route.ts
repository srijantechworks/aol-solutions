import { NextResponse } from 'next/server';
import { Runner, InMemorySessionService } from '@google/adk';
import { v4 as uuidv4 } from 'uuid';

// Import your custom agents and database helpers
import { researchAgent } from '@/lib/agents/researchAgent';
import { copywriterAgent } from '@/lib/agents/copywriterAgent';
import { getEventMessageCount, saveGeneratedBatch } from '@/lib/dynamo';

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
        try {
            if (courseData.teacher_info) {
                const info = typeof courseData.teacher_info === 'string' ? JSON.parse(courseData.teacher_info) : courseData.teacher_info;
                if (Array.isArray(info)) {
                    info.forEach((t: any) => { if (t.teacher_name) parsedTeachers.push(t.teacher_name.trim()); });
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
        // 7. Run Research Agent (S3 Fetching)
        // ==========================================
        const researchRunner = new Runner({
            appName: 'AOL_Generator',
            agent: researchAgent,
            sessionService
        });

        const courseLabel =
            cleanedCourseData.course_event_type_label ||
            cleanedCourseData.event_name ||
            "Art of Living Course";

        const researchPrompt = `
Task: Analyze marketing assets for the course named: "${courseLabel}".

USER PREFERENCES TO KEEP IN MIND:
- Target Audience: ${prefs.audience}
- Highlighted Benefit: ${prefs.benefit}
(If a specific audience or benefit is mentioned above, prioritize extracting facts from the flyers that appeal to them).

CRITICAL SCANNING INSTRUCTIONS:
While scanning the S3 bucket images, flyers, and PDFs, do not just extract raw text. You must pay close attention to the visual design! 
- Note exactly HOW the messages are aligned and structured.
- Note the exact emojis/emoticons used and where they are placed.
- Extract the overall structural flow (e.g., Hook -> Bullets -> Call to Action).

Summarize the factual details (schedules, benefits) AND provide a strict "Style & Formatting Guide" based on what you saw in the images so the copywriter can replicate it perfectly. Do not overuse "\n" in your summary. Use whereever and how much ever it is necessary.
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
        // 8. Run Copywriter Agent (Text Generation)
        // ==========================================
        const copywriterRunner = new Runner({
            appName: 'AOL_Generator',
            agent: copywriterAgent,
            sessionService
        });

        const copywriterPrompt = `
Task: Write EXACTLY 2 distinct, beautiful promotional messages.

CRITICAL RULES & CONSTRAINTS (YOU MUST FOLLOW THESE):
1. 🚫 NO PRICING: NEVER mention, show, or hint at the donation amount or course fee. Exclude all pricing completely.
2. ✨ BEAUTIFUL DESIGN: DO NOT write a wall of text. You must use the exact alignment, generous line breaks, and emoticons described in the S3 Asset Summary. Make it highly scannable (WhatsApp/Email friendly).
3. 📍 VENUE RULE: If the venue/address indicates it is online, you MUST prefix the course name with "Online " (e.g., "Online Happiness Program").

MANDATORY INCLUSIONS (Every message must have these):
- The Beautiful Course Message / Hook.
- Course Dates: Start and End dates.
- Timings: Explicitly list Weekday and Weekend timings.
- Venue: The exact physical address (or Online).
- Registration Link: ${url}
- Support: A section at the very bottom titled "Happy to Help 📞" (or similar) containing the teacher/volunteer contact details.

Course Context (Raw API Data):
${JSON.stringify(cleanedCourseData)}

S3 Asset Summary & Style Guide (Mimic this layout and tone!):
${assetSummary}

User Preferences:
Audience: ${options.audience || 'General'}
Tone: ${options.tone || 'Uplifting'}
Length: ${options.length || 'Standard'}
Core Benefit: ${options.benefit || 'General Wellness'}

Course Type for Memory Tool: "${courseLabel}"
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
        // 9. Parse AI JSON Response
        // ==========================================
        let generatedMessages;

        try {
            const cleanJson = rawOutput
                .replace(/```json\n?/g, '')
                .replace(/```/g, '')
                .trim();

            generatedMessages = JSON.parse(cleanJson);
        } catch (e) {
            console.error("Failed to parse LLM JSON:");
            console.error(rawOutput);

            return NextResponse.json({
                error: "AI failed to format response correctly. Try again."
            }, { status: 500 });
        }

        const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
        const finalBatch = generatedMessages.map((msg: any, index: number) => ({
            message_id: `${event_id_val}-${timestamp}-M00${index + 1}`,
            message_text: msg.text,
            like_count: 0,
            share_count: 0,
            copy_count: 0
        }));

        // ==========================================
        // 9. Save & Return
        // ==========================================
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