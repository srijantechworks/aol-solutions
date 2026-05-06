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
            // Standardized error for malformed URLs
            return NextResponse.json({ error: 'Please provide a valid Art of Living course link' }, { status: 400 });
        }

        let eventId: string | null = null;
        eventId = urlObj.searchParams.get("event_id") || urlObj.searchParams.get("id");

        if (!eventId) {
            const pathSegments = urlObj.pathname.split("/").filter(Boolean);
            for (const segment of pathSegments) {
                if (/^\d{5,9}$/.test(segment)) {
                    eventId = segment;
                    break;
                }
            }
        }

        if (!eventId || !/^\d+$/.test(eventId)) {
            return NextResponse.json({
                error: 'Please provide a valid Art of Living course link'
            }, { status: 400 });
        }

        // ==========================================
        // 2. Configuration Check
        // ==========================================
        const apiURL = process.env.AOL_API_URL;
        if (!apiURL) {
            console.error("CRITICAL: AOL_API_URL is missing.");
            // Consistent error message as requested
            return NextResponse.json({ error: 'Please provide a valid Art of Living course link' }, { status: 400 });
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
        
        // Identify course name
        const courseName = courseData?.course_event_type_label || courseData?.event_name || courseData?.course_name;
        
        // Success Heuristic:
        // A link is ACTIVE if we have a course name AND no explicit error flag.
        const explicitError = (courseData?.is_error === 1 || courseData?.is_error === "1") || 
                              (courseData?.status === "error") ||
                              (courseData?.error && courseData.error !== "0" && courseData.error !== 0 && typeof courseData.error === 'string' && courseData.error.length > 1);

        if (!courseData || !courseName || explicitError) {
            return NextResponse.json({
                error: 'This Art of Living course is no longer active or accepting registrations.'
            }, { status: 403 });
        }

        // Parse teacher info safely
        let parsedTeachers = [];
        try {
            if (courseData.teacher_info) {
                if (typeof courseData.teacher_info === 'string') {
                    parsedTeachers = JSON.parse(courseData.teacher_info);
                } else if (Array.isArray(courseData.teacher_info)) {
                    parsedTeachers = courseData.teacher_info;
                }
            }
        } catch (e) {
            console.warn("Could not parse teacher_info");
        }

        const extractedContext = {
            courseName: courseName,
            organization: courseData.org_full_name || "The Art of Living",
            amount: courseData.amount || "See registration link",
            startDate: courseData.start_date,
            endDate: courseData.end_date,
            weekdayTimings: courseData.weekdaytimings,
            weekendTimings: courseData.weekendtimings,
            language: courseData.language_of_instruction,
            address: courseData.address,
            city: courseData.course_city,
            teachers: parsedTeachers
        };

        return NextResponse.json({
            success: true,
            eventId: eventId,
            courseContext: extractedContext,
            userOptions: options
        });

    } catch (error: any) {
        return NextResponse.json({ 
            error: "This Art of Living course is no longer active or accepting registrations." 
        }, { status: 400 });
    }
}
