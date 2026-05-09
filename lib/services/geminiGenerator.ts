import { GoogleGenAI } from "@google/genai";
import { trackMetric } from './metrics';

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY!
});

const GEMINI_MODEL =
    process.env.GEMINI_MODEL
    || "gemini-2.0-flash-lite";

const sleep = (ms: number) =>
    new Promise(resolve => setTimeout(resolve, ms));

async function withTimeout<T>(
    promise: Promise<T>,
    timeoutMs = 60000
): Promise<T> {

    let timeoutHandle: NodeJS.Timeout;

    const timeoutPromise =
        new Promise<never>((_, reject) => {

            timeoutHandle =
                setTimeout(() => {

                    reject(
                        new Error(
                            `Gemini timeout after ${timeoutMs}ms`
                        )
                    );

                }, timeoutMs);
        });

    try {

        return await Promise.race([
            promise,
            timeoutPromise
        ]);

    } finally {

        clearTimeout(timeoutHandle!);
    }
}

async function retry<T>(
    fn: () => Promise<T>,
    retries = 3
): Promise<T> {

    for (let i = 0; i < retries; i++) {

        try {

            return await fn();

        } catch (err: any) {

            const message =
                String(err?.message || '');

            const isRetryable =
                message.includes("429") ||
                message.includes("503") ||
                message.includes("500") ||
                message.includes("overloaded") ||
                err?.status === 429 ||
                err?.status === 503;

            if (!isRetryable || i === retries - 1) {
                throw err;
            }

            const baseWait =
                (i + 1) * 5000;

            const jitter =
                Math.floor(Math.random() * 2000);

            const wait =
                baseWait + jitter;

            trackMetric(
                "gemini_retry",
                {
                    retry_attempt: i + 1,
                    wait_ms: wait,
                    error: message
                }
            );

            console.log(
                `⏳ Gemini retry in ${wait}ms`
            );

            await sleep(wait);
        }
    }

    throw new Error("Gemini retry failed");
}

const responseSchema = {

    type: "array",

    items: {

        type: "object",

        properties: {

            message_number: {
                type: "number"
            },

            hook: {
                type: "string"
            },

            angle: {
                type: "string"
            },

            text: {
                type: "string"
            }
        },

        required: [
            "message_number",
            "hook",
            "angle",
            "text"
        ]
    }
} as const;


export async function generateMarketingMessages(
    prompt: string
) {
    try {
        const generationStart =
            Date.now();



        const response = await retry(() =>

            withTimeout(
                ai.models.generateContent({
                    model: GEMINI_MODEL,

                    contents: prompt,

                    config: {
                        temperature: 0.8,
                        topP: 0.95,
                        maxOutputTokens: 2048,
                        responseMimeType:
                            "application/json",
                        responseSchema
                    }
                }),

                60000
            )
        );

        const latency =
            Date.now() - generationStart;

        trackMetric(
            "gemini_generation_success",
            {
                latency_ms: latency,
                model: GEMINI_MODEL
            }
        );

        console.log(
            `⚡ Gemini generation completed in ${latency}ms`
        );

        return response.text || "";
    } catch (error: any) {
        trackMetric(
            "gemini_generation_failure",
            {
                error:
                    String(error?.message || error)
            }
        );

        throw error;
    }
}