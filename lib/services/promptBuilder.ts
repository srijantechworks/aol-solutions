import {
    buildDiversityInstructions
} from './diversityEngine';

const buildHistoricalMemoryText = (
    historicalStyleContext: any
) => {

    if (!historicalStyleContext) {
        return 'No historical style memory available.';
    }

    return `
Top Hooks:
${(historicalStyleContext.topHooks || [])
            .map((h: string) => `- ${h}`)
            .join('\n')}

CTA Styles:
${(historicalStyleContext.topCTAStyles || [])
            .map((c: string) => `- ${c}`)
            .join('\n')}

Emoji Patterns:
${(historicalStyleContext.emojiPatterns || [])
            .slice(0, 5)
            .map((e: string) => `- ${e}`)
            .join('\n')}

Brand Tone:
${historicalStyleContext.averageTone || 'Warm spiritual uplifting'}

Formatting Style:
${historicalStyleContext.formattingStyle || 'Short spaced WhatsApp lines'}
`;
};


const buildS3InsightsText = (
    s3Context: any
) => {

    if (
        !s3Context ||
        !s3Context.assetsFound?.length
    ) {

        return `
No S3 assets found.

Use:
- spiritual tone
- emoji-led bullets
- generous spacing
- short WhatsApp lines
`;
    }

    return `
S3 Style Summary:

Hooks Found:
${(s3Context.extractedHooks || [])
            .map((h: string) => `- ${h}`)
            .join('\n')}

Benefits Found:
${(s3Context.extractedBenefits || []).slice(0, 5)
            .map((b: string) => `- ${b}`)
            .join('\n')}

Emoji Style:
${s3Context.emojiStyle || 'Minimal'}

Formatting Style:
${s3Context.formattingStyle || 'Short spaced lines'}
`;
};


export function buildPrompt({
    displayCourseName,
    cleanedCourseData,
    safeGet,
    isOnline,
    url,
    prefs,
    s3Context,
    historicalStyleContext
}: {
    displayCourseName: string;
    cleanedCourseData: any;
    safeGet: Function;
    isOnline: boolean;
    url: string;
    prefs: any;
    s3Context: any;
    historicalStyleContext: any;
}) {

    const s3Insights =
        buildS3InsightsText(
            s3Context
        );

    const historicalMemory =
        buildHistoricalMemoryText(
            historicalStyleContext
        );

    const diversityInstructions =
        buildDiversityInstructions();

    return `
Generate EXACTLY 2 WhatsApp promotional messages
for this Art of Living course.

COURSE DETAILS:
- Course Name: ${displayCourseName}
- Start Date: ${safeGet(cleanedCourseData.start_date)}
- End Date: ${safeGet(cleanedCourseData.end_date)}
- Weekday Timings: ${safeGet(cleanedCourseData.weekdaytimings)}
- Weekend Timings: ${safeGet(cleanedCourseData.weekendtimings)}
- Venue: ${isOnline
            ? 'Online'
            : safeGet(cleanedCourseData.address)
        }
- Teachers: ${cleanedCourseData.teachers}
- Contact Numbers: ${cleanedCourseData.contact_numbers}
- Registration Link: ${url}

USER PREFERENCES:
- Audience: ${prefs.audience}
- Tone: ${prefs.tone}
- Core Benefit: ${prefs.benefit}

${s3Insights}

HISTORICAL BRAND STYLE MEMORY:
${historicalMemory}

${diversityInstructions}

RULES:
- warm spiritual uplifting tone
- peaceful and compassionate style
- short WhatsApp-friendly lines
- elegant emojis
- avoid aggressive sales language
- no pricing mention
- include CTA
- include registration link
- include contact section
- no hallucinated details


`;
}