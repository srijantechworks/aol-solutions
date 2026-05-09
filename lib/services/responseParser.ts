import { trackMetric } from './metrics';

export function parseMarketingResponse(
    rawOutput: string
) {

    if (!rawOutput?.trim()) {

        throw new Error(
            "Empty AI response"
        );
    }

    let parsed;

    try {

        parsed =
            JSON.parse(rawOutput);

    } catch (err: any) {
        trackMetric(
            "response_parse_failure",
            {
                error: err.message
            }
        );

        throw new Error(
            `JSON parse failed: ${err.message}`
        );
    }

    if (!Array.isArray(parsed)) {

        throw new Error(
            "Response is not array"
        );
    }

    return parsed.map((msg: any) => ({

        message_number:
            Number(msg.message_number || 0),

        hook:
            String(msg.hook || '')
                .trim(),

        angle:
            String(msg.angle || '')
                .trim(),

        text:
            String(msg.text || '')
                .replace(/\r/g, '')
                .trim()
    }));
}