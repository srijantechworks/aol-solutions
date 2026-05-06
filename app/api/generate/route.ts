import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { url, ...options } = body;

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
            return NextResponse.json({ error: 'Malformed URL provided. Ensure it includes https://' }, { status: 400 });
        }

        let eventId: string | null = null;

        // Try standard param
        eventId = urlObj.searchParams.get("event_id") || urlObj.searchParams.get("id");

        // Try all params
        if (!eventId) {
            for (const value of urlObj.searchParams.values()) {
                if (/^\d{5,8}$/.test(value)) { eventId = value; break; }
            }
        }

        // Try path segments
        if (!eventId) {
            const pathSegments = urlObj.pathname.split("/").filter(Boolean);
            for (const segment of pathSegments) {
                if (/^\d{5,8}$/.test(segment)) { eventId = segment; break; }
            }
        }

        if (!eventId || !/^\d+$/.test(eventId)) {
            return NextResponse.json({
                error: 'Please provide a valid Art of Living course link.'
            }, { status: 400 });
        }

        // ==========================================
        // 2. Configuration Check
        // ==========================================
        const apiURL = process.env.AOL_API_URL;
        if (!apiURL) {
            console.error("CRITICAL: AOL_API_URL is missing.");
            return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
        }

        // ==========================================
        // 3. Fetch Data from AOL API
        // ==========================================
        const params = new URLSearchParams();
        params.append("event_id", eventId);
        params.append('url_reg_type', '');
        params.append('pkg_id', '');
        params.append('dis_id', '');
        params.append('g_dis', '');

        console.log(`[AOL] Fetching Event ID: ${eventId}`);

        let apiResponse;
        try {
            apiResponse = await fetch(apiURL, {
                method: "POST",
                headers: {
                    // ✅ KEY FIX: Mimic a real browser request so the AOL API doesn't block us
                    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                    "Accept": "application/json, text/javascript, */*; q=0.01",
                    "X-Requested-With": "XMLHttpRequest",
                    "Origin": "https://www.artofliving.online",
                    "Referer": "https://www.artofliving.online/",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                },
                body: params.toString(),
            });
        } catch (fetchError) {
            console.error("[AOL] Network error:", fetchError);
            return NextResponse.json({ error: 'Could not reach the Art of Living server.' }, { status: 502 });
        }

        const responseText = await apiResponse.text();
        console.log(`[AOL] HTTP ${apiResponse.status} | Body: ${responseText.slice(0, 300)}`);

        if (!apiResponse.ok) {
            console.error(`[AOL] Non-OK HTTP status: ${apiResponse.status}`);
            return NextResponse.json({ error: 'This is not an active Art of Living course link.' }, { status: 400 });
        }

        // ==========================================
        // 4. Parse Response
        // ==========================================
        let courseData: any;
        try {
            const rawData = JSON.parse(responseText);
            // API returns a flat object for active courses, 
            // but guard against array wrapping just in case
            courseData = Array.isArray(rawData) ? rawData[0] : rawData;
        } catch (e) {
            console.error("[AOL] JSON parse failed:", responseText.slice(0, 200));
            return NextResponse.json({ error: 'This is not an active Art of Living course link.' }, { status: 400 });
        }

        // ==========================================
        // 5. Validate Using Known Response Schema
        //    Active:   { status: 1, is_error: 0, course_event_type_label: "..." }
        //    Expired:  { status: 0 } or { is_error: 1 } or missing course name
        // ==========================================
        if (!courseData || typeof courseData !== 'object') {
            return NextResponse.json({ error: 'This is not an active Art of Living course link.' }, { status: 400 });
        }

        // Explicit status/error check using the real API fields
        const apiStatus = Number(courseData.status ?? -1);
        const apiIsError = Number(courseData.is_error ?? 1);
        const courseName = courseData.course_event_type_label
            || courseData.event_name
            || courseData.course_name;

        console.log(`[AOL] status=${apiStatus} | is_error=${apiIsError} | courseName=${courseName}`);

        if (apiStatus !== 1 || apiIsError !== 0 || !courseName) {
            console.warn(`[AOL] Course ${eventId} is inactive or invalid.`);
            return NextResponse.json({
                error: 'This Art of Living course is no longer active or accepting registrations.'
            }, { status: 400 });
        }

        // ==========================================
        // 6. Extract Context
        // ==========================================
        let parsedTeachers: any[] = [];
        try {
            if (courseData.teacher_info) {
                parsedTeachers = typeof courseData.teacher_info === 'string'
                    ? JSON.parse(courseData.teacher_info)
                    : Array.isArray(courseData.teacher_info)
                        ? courseData.teacher_info
                        : [];
            }
        } catch {
            console.warn("[AOL] Could not parse teacher_info");
        }

        const extractedContext = {
            courseName,
            organization: courseData.org_full_name || "The Art of Living",
            amount: courseData.amount || "See registration link",
            startDate: courseData.start_date,
            endDate: courseData.end_date,
            weekdayTimings: courseData.weekdaytimings,
            weekendTimings: courseData.weekendtimings,
            language: courseData.language_of_instruction,
            address: courseData.address,
            city: courseData.course_city,
            teachers: parsedTeachers,
        };

        return NextResponse.json({
            success: true,
            eventId,
            courseContext: extractedContext,
            userOptions: options,
        });

    } catch (error: any) {
        console.error("[AOL] Unhandled error:", error);
        return NextResponse.json({
            error: "An unexpected error occurred. Please try again."
        }, { status: 500 });
    }
}