import {
    getCachedContext,
    saveContextCache,
    getTopMessagesByCourseType,
    buildHistoricalStyleContext
} from '@/lib/dynamo';
import { trackMetric } from './metrics';
import { scanS3Assets } from './s3Scanner';
import {
    rankHistoricalMessages
} from './contextRanker';

export async function buildMarketingContext({
    eventId,
    courseLabel,
    prefs,
    prettyLog
}: {
    eventId: string;
    courseLabel: string;
    prefs: {
        audience?: string;
        tone?: string;
        benefit?: string;
    };
    prettyLog?: Function;
}) {

    let s3Context: any;
    let historicalStyleContext: any;

    // ==========================================
    // CACHE CHECK
    // ==========================================

    const cachedContext =
        await getCachedContext(eventId);

    if (cachedContext) {

        trackMetric(
            "context_cache_hit",
            {
                eventId
            }
        );


        prettyLog?.(
            "CONTEXT CACHE HIT",
            cachedContext
        );


        return cachedContext;
    }

    trackMetric(
        "context_cache_miss",
        {
            eventId
        }
    );

    prettyLog?.(
        "CONTEXT CACHE MISS"
    );

    // ==========================================
    // PARALLEL FETCH
    // ==========================================

    const [
        fetchedS3Context,
        previousMessages
    ] = await Promise.all([

        scanS3Assets({
            courseLabel,
            eventId
        }),

        getTopMessagesByCourseType(
            courseLabel
        )
    ]);

    s3Context =
        fetchedS3Context;

    const rankedMessages =
        rankHistoricalMessages({
            messages:
                previousMessages,

            prefs
        });

    historicalStyleContext =
        buildHistoricalStyleContext(
            rankedMessages
        );

    const finalContext = {
        s3Context,
        historicalStyleContext
    };

    // ==========================================
    // SAVE CACHE
    // ==========================================

    await saveContextCache({
        eventId,
        context: finalContext
    });

    prettyLog?.(
        "CONTEXT CACHE SAVED"
    );

    return finalContext;
}