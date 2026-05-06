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

        if (urlObj.hostname.includes("artofliving.online") && urlObj.pathname.includes("registration")) {
            eventId = urlObj.searchParams.get("event_id");
        }
        else if (urlObj.hostname.includes("aolt.in")) {
            const pathSegments = urlObj.pathname.split("/").filter(Boolean);

            if (pathSegments.length > 0) {
                eventId = pathSegments[0];
            }
        }

        // Final Security & Format Check
        // We ensure we found an ID AND that it only consists of numbers (Regex: ^\d+$)
        if (!eventId || !/^\d+$/.test(eventId)) {
            return NextResponse.json({
                error: 'Please provide a valid Art of Living course link'
            }, { status: 400 });
        }

        // ==========================================
        // 2. Fetch Data from AOL API
        // ==========================================
        // Load the API Key from the environment variables
        const apiURL = process.env.AOL_API_URL;
        
        if (!apiURL) {
            console.error("CRITICAL: AOL_API_URL is missing from environment variables.");
            return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
        }

        const params = new URLSearchParams();
        params.append("event_id", eventId);
        params.append('url_reg_type', '');
        params.append('pkg_id', '');
        params.append('dis_id', '');
        params.append('g_dis', '');

        console.log(`Fetching details for Event ID: ${eventId} from AOL API...`);

        const apiResponse = await fetch(apiURL, { 
            method: "POST", 
            headers: { 
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8", 
                'Accept': 'application/json, text/javascript, */*; q=0.01' 
            }, 
            body: params.toString() 
        });


        if (!apiResponse.ok) {
            // If the API itself fails (e.g., 404 or 400), it's likely an inactive or invalid event ID
            return NextResponse.json({
                error: 'This is not an active Art of living course link'
            }, { status: apiResponse.status === 404 ? 404 : 400 });
        }

        // The response is a single JSON object
        const courseData = await apiResponse.json();

        // ==========================================
        // 3. Validation & Data Extraction
        // ==========================================
        // Security check & Inactive link check
        // If the API returns null or doesn't have the expected organization name
        if (!courseData || courseData.org_full_name !== "The Art of Living") {
            return NextResponse.json({
                error: 'This is not an active Art of living course link'
            }, { status: 403 });
        }

        // Parse teacher info safely since it comes back as a stringified JSON array
        let parsedTeachers = [];
        try {
            if (courseData.teacher_info) {
                parsedTeachers = JSON.parse(courseData.teacher_info);
            }
        } catch (e) {
            console.warn("Could not parse teacher_info JSON string");
        }

        // Extract only the juicy context we want to feed to the LLM
        const extractedContext = {
            courseName: courseData.course_event_type_label,
            organization: courseData.org_full_name,
            amount: courseData.amount,
            startDate: courseData.start_date,
            endDate: courseData.end_date,
            weekdayTimings: courseData.weekdaytimings,
            weekendTimings: courseData.weekendtimings,
            language: courseData.language_of_instruction,
            address: courseData.address,
            city: courseData.course_city,
            teachers: parsedTeachers // This will be an array of objects like { teacher_name: "..." }
        };

        console.log(NextResponse.json({
            success: true,
            message: "Validation passed and data fetched successfully.",
            eventId: eventId,
            courseContext: extractedContext,
            userOptions: options
        }));

        // ==========================================
        // 4. Return to Client
        // ==========================================
        return NextResponse.json({
            success: true,
            message: "Validation passed and data fetched successfully.",
            eventId: eventId,
            courseContext: extractedContext,
            userOptions: options
        });


    } catch (error: any) {
        console.error("API Route Error:", error);
        return NextResponse.json({ error: "An internal server error occurred while processing the URL." }, { status: 500 });
    }
}