import { NextResponse } from 'next/server';
import { fetchAndNormalizeAolCourse } from '@/lib/services/aolApi';
import { getEventMessageCount, saveGeneratedBatch, } from '@/lib/dynamo';
import { generateMarketingMessages } from '@/lib/services/geminiGenerator';
import { buildMarketingContext } from '@/lib/services/contextBuilder';
import { buildPrompt } from '@/lib/services/promptBuilder';
import { trackMetric } from '@/lib/services/metrics';
import { prettyLog } from '@/lib/services/logger';
import { processGeneratedMessages } from '@/lib/services/messageProcessor';



export const maxDuration = 300; // Tells Vercel to allow 200 seconds of processing time


export async function POST(request: Request) {
    try {
        const startTime = Date.now();
        const body = await request.json();
        const { url, ...options } = body as any;

        const {
            eventId: event_id_val,
            cleanedCourseData,
            courseLabel,
            displayCourseName,
            isOnline,
            safeGet
        } = await fetchAndNormalizeAolCourse(
            url,
            prettyLog
        );

        // ==========================================
        // 6. DynamoDB Gatekeeper (Rate Limiting)
        // ==========================================
        const currentGenerationCount = await getEventMessageCount(event_id_val);
        prettyLog("DYNAMODB MESSAGE COUNT", {
            event_id: event_id_val,
            currentGenerationCount
        });

        if (currentGenerationCount >= 15) {
            return NextResponse.json({
                error: "This event has reached its maximum AI generation limit of 15 batches."
            }, { status: 429 });
        }

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
        // 8. Parallel Context Gathering
        // ==========================================
        prettyLog("STARTING PARALLEL CONTEXT FETCH");

        const {
            s3Context,
            historicalStyleContext
        } = await buildMarketingContext({
            eventId: event_id_val,
            courseLabel,
            prefs,
            prettyLog
        });


        const copywriterPrompt =
            buildPrompt({
                displayCourseName,
                cleanedCourseData,
                safeGet,
                isOnline,
                url,
                prefs,
                s3Context,
                historicalStyleContext
            });

        prettyLog(
            "COPYWRITER PROMPT",
            copywriterPrompt
        );

        const rawOutput =
            await generateMarketingMessages(
                copywriterPrompt
            );

        prettyLog(
            "RAW GEMINI OUTPUT",
            rawOutput
        );

        const finalPassedMessages =
            await processGeneratedMessages({

                rawOutput,

                copywriterPrompt
            });


        // ==========================================
        // BUILD FINAL RESPONSE BATCH
        // ==========================================

        const timestamp = new Date()
            .toISOString()
            .replace(/[-:T.Z]/g, '')
            .slice(0, 14);

        const finalBatch =
            finalPassedMessages.map(
                (msg: any, index: number) => ({
                    message_id:
                        `${event_id_val}-${timestamp}-M00${index + 1}`,

                    message_text:
                        msg.text,

                    hook:
                        msg.hook || '',

                    angle:
                        msg.angle || '',

                    evaluation_score:
                        msg.evaluation.score,

                    evaluation_reasons:
                        msg.evaluation.reasons,

                    like_count: 0,
                    share_count: 0,
                    copy_count: 0
                })
            );

        prettyLog(
            "FINAL GENERATED MESSAGES",
            finalBatch
        );

        await saveGeneratedBatch(
            event_id_val,
            courseLabel,
            finalBatch
        );

        prettyLog("TOTAL EXECUTION TIME", {
            ms: Date.now() - startTime,
            seconds: (
                (Date.now() - startTime) / 1000
            ).toFixed(2)
        });

        trackMetric(
            "pipeline_success",
            {
                event_id: event_id_val,
                total_latency_ms:
                    Date.now() - startTime
            }
        );

        return NextResponse.json({
            success: true,
            event_id_val,
            messages: finalBatch,
            historicalStyleContext,
            s3Context
        });



    } catch (error: any) {
        console.error("Pipeline Error:", error);
        trackMetric(
            "pipeline_failure",
            {
                error:
                    String(error?.message || error)
            }
        );
        return NextResponse.json({
            error: "An error occurred while generating the messages."
        }, { status: 500 });
    }
}