type FetchCourseResult = {

    eventId: string;

    cleanedCourseData: any;

    courseLabel: string;

    displayCourseName: string;

    isOnline: boolean;

    safeGet: Function;
};

const safeGet = (
    val: any,
    fallback = 'Not specified'
) => {

    return val &&
        String(val).trim() !== ''
        ? String(val).trim()
        : fallback;
};

const tryParseJSON = (
    value: any
) => {

    if (typeof value !== "string") {
        return value;
    }

    try {

        return JSON.parse(value);

    } catch {

        return value;
    }
};

const cleanValue = (
    value: any
): any => {

    if (typeof value === "string") {

        return value
            .replace(/&[a-z]+;/gi, " ")
            .replace(/<[^>]*>?/gm, " ")
            .replace(/\t/g, " ")
            .replace(/\r/g, " ")
            .replace(/[ ]{2,}/g, " ")
            .trim();
    }

    if (Array.isArray(value)) {
        return value.map(cleanValue);
    }

    if (
        value &&
        typeof value === "object"
    ) {

        const cleanedObj: any = {};

        Object.entries(value)
            .forEach(([key, val]) => {

                cleanedObj[key] =
                    cleanValue(
                        tryParseJSON(val)
                    );
            });

        return cleanedObj;
    }

    return value;
};

export async function fetchAndNormalizeAolCourse(
    rawUrl: string,
    prettyLog?: Function
): Promise<FetchCourseResult> {

    if (
        !rawUrl ||
        typeof rawUrl !== 'string'
    ) {

        throw new Error(
            'A valid URL is required.'
        );
    }

    // ==========================================
    // URL NORMALIZATION
    // ==========================================

    let parsedUrlString =
        rawUrl.trim();

    if (
        !/^https?:\/\//i.test(
            parsedUrlString
        )
    ) {

        parsedUrlString =
            'https://' + parsedUrlString;
    }

    let urlObj: URL;

    try {

        urlObj =
            new URL(parsedUrlString);

    } catch {

        throw new Error(
            'Invalid Art of Living course URL'
        );
    }

    // ==========================================
    // EVENT ID EXTRACTION
    // ==========================================

    let eventId =
        urlObj.searchParams.get("event_id")
        ||
        urlObj.searchParams.get("id");

    if (!eventId) {

        const pathSegments =
            urlObj.pathname
                .split("/")
                .filter(Boolean);

        for (const segment of pathSegments) {

            if (/^\d{5,9}$/.test(segment)) {

                eventId = segment;

                break;
            }
        }
    }

    if (
        !eventId ||
        !/^\d+$/.test(eventId)
    ) {

        throw new Error(
            'Invalid event ID'
        );
    }

    prettyLog?.(
        "EVENT ID EXTRACTED",
        {
            originalUrl: rawUrl,
            parsedUrl: parsedUrlString,
            eventId
        }
    );

    // ==========================================
    // AOL API FETCH
    // ==========================================

    const apiURL =
        process.env.AOL_API_URL;

    if (!apiURL) {

        throw new Error(
            "AOL_API_URL missing"
        );
    }

    const params =
        new URLSearchParams();

    params.append(
        "event_id",
        eventId
    );

    params.append('url_reg_type', '');
    params.append('pkg_id', '');
    params.append('dis_id', '');
    params.append('g_dis', '');

    const apiResponse =
        await fetch(apiURL, {
            method: "POST",

            headers: {
                "Content-Type":
                    "application/x-www-form-urlencoded; charset=UTF-8",

                'Accept':
                    'application/json, text/javascript, */*; q=0.01'
            },

            body:
                params.toString()
        });

    if (!apiResponse.ok) {

        throw new Error(
            "AOL API fetch failed"
        );
    }

    const responseText =
        await apiResponse.text();

    let rawData;

    try {

        rawData =
            JSON.parse(responseText);

    } catch {

        throw new Error(
            "Invalid AOL API response"
        );
    }

    const courseData =
        Array.isArray(rawData)
            ? rawData[0]
            : rawData;

    prettyLog?.(
        "AOL API RAW RESPONSE",
        courseData
    );

    // ==========================================
    // VALIDATION
    // ==========================================

    const courseName =
        courseData?.course_event_type_label
        ||
        courseData?.event_name
        ||
        courseData?.course_name;

    const explicitError =
        (courseData?.is_error === 1 ||
            courseData?.is_error === "1")
        ||
        (courseData?.status === "error");

    if (
        !courseData ||
        !courseName ||
        explicitError
    ) {

        throw new Error(
            "Course inactive"
        );
    }

    // ==========================================
    // TEACHER PARSING
    // ==========================================

    let parsedTeachers: string[] = [];

    let contactNumbers: string[] = [];

    try {

        if (courseData.teacher_info) {

            const info =
                typeof courseData.teacher_info
                    === 'string'

                    ? JSON.parse(
                        courseData.teacher_info
                    )

                    : courseData.teacher_info;

            if (Array.isArray(info)) {

                info.forEach((t: any) => {

                    if (t.teacher_name) {

                        parsedTeachers.push(
                            t.teacher_name.trim()
                        );
                    }

                    if (t.teacher_phone) {

                        contactNumbers.push(
                            String(
                                t.teacher_phone
                            ).trim()
                        );
                    }
                });
            }
        }

    } catch (e) {

        console.warn(
            "Teacher parse failed",
            e
        );
    }

    parsedTeachers =
        [...new Set(parsedTeachers)];

    // ==========================================
    // CLEANING
    // ==========================================

    const cleanedCourseData =
        cleanValue(courseData);

    cleanedCourseData.teachers =
        parsedTeachers.length > 0

            ? parsedTeachers.join(", ")

            : "TBA";

    cleanedCourseData.contact_numbers =
        contactNumbers.length > 0

            ? [...new Set(contactNumbers)]
                .join(", ")

            : "Contact details available on registration page";

    // ==========================================
    // DISPLAY FORMATTING
    // ==========================================

    const isOnline =
        String(
            cleanedCourseData.address || ''
        )
            .toLowerCase()
            .includes('online');

    const courseLabel =
        cleanedCourseData.course_event_type_label
        ||
        cleanedCourseData.event_name
        ||
        "Art of Living Course";

    const displayCourseName =
        isOnline
            ? `Online ${courseLabel}`
            : courseLabel;

    return {
        eventId,
        cleanedCourseData,
        courseLabel,
        displayCourseName,
        isOnline,
        safeGet
    };
}