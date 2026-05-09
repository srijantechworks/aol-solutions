import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { trackMetric } from './services/metrics';

// Initialize the DynamoDB Client
const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-south-1' });
const docClient = DynamoDBDocumentClient.from(client);

// Define your table names
const STORE_TABLE = process.env.DYNAMODB_EVENTS_TABLE || 'aol_event_message_store';
const MEMORY_TABLE = process.env.DYNAMODB_RAG_TABLE || 'aol_message_engagement_memory';

const CONTEXT_CACHE_TABLE =
    process.env.DYNAMODB_CONTEXT_CACHE_TABLE
    || "aol_context_cache";

export const buildCourseMemoryPK = (courseLabel: string) => {

    return `EVENTTYPE#${courseLabel
        .toUpperCase()
        .replace(/\s+/g, '_')
        .replace(/[^\w()]/g, '')}`;
};

/**
 * 1. Gatekeeper: Check how many times this event has generated messages
 */
export async function getEventMessageCount(eventId: string): Promise<number> {
    try {
        const command = new GetCommand({
            TableName: STORE_TABLE,
            Key: { PK: `EVENT#${eventId}` }
        });
        const response = await docClient.send(command);
        return response.Item?.message_count || 0;
    } catch (error) {
        console.error("DynamoDB Get Count Error:", error);
        return 0; // Fallback to 0 so the app doesn't crash if DB is unreachable temporarily
    }
}

/**
 * 2. Save Generation: Save the newly generated batch to the event store
 */
export async function saveGeneratedBatch(eventId: string, courseName: string, newMessages: any[]) {
    try {
        const command = new UpdateCommand({
            TableName: STORE_TABLE,
            Key: { PK: `EVENT#${eventId}` },
            UpdateExpression: `
                SET event_id = :eventId, 
                    course_event_type_label = :courseName,
                    engaged_messages = list_append(if_not_exists(engaged_messages, :emptyList), :newMessages),
                    message_count = if_not_exists(message_count, :zero) + :inc
            `,
            ExpressionAttributeValues: {
                ":eventId": eventId,
                ":courseName": courseName,
                ":emptyList": [],
                ":newMessages": newMessages,
                ":zero": 0,
                ":inc": newMessages.length // <--- CHANGE THIS FROM 1 TO newMessages.length
            }
        });
        await docClient.send(command);
    } catch (error) {
        console.error("DynamoDB Save Batch Error:", error);
    }
}

/**
 * 3. AI Memory: Fetch Hall of Fame messages for a specific course type
 */
export async function getTopMessagesByCourseType(
    courseLabel: string
) {

    try {

        const memoryPK =
            buildCourseMemoryPK(courseLabel);

        console.log(
            "📚 FETCHING COURSE MEMORY:",
            memoryPK
        );

        const command = new GetCommand({
            TableName: MEMORY_TABLE,
            Key: {
                PK: memoryPK
            }
        });

        const response =
            await docClient.send(command);

        if (!response.Item) {

            console.log(
                "⚠️ No course memory found"
            );

            return [];
        }

        const messages =
            response.Item.messages || [];

        // ==========================================
        // SORT BY ENGAGEMENT
        // ==========================================

        const ranked =
            messages
                .sort((a: any, b: any) => {

                    const scoreA =
                        (a.engagement_score || 0);

                    const scoreB =
                        (b.engagement_score || 0);

                    return scoreB - scoreA;
                })
                .slice(0, 5);

        console.log(
            `✅ Found ${ranked.length} high-performing messages`
        );

        return ranked;

    } catch (error) {

        console.error(
            "❌ DynamoDB Memory Fetch Error:",
            error
        );

        return [];
    }
}

export function buildHistoricalStyleContext(
    messages: any[]
) {

    if (!messages?.length) {

        return {
            hooks: [],
            benefits: [],
            emojiPatterns: [],
            ctaPatterns: [],
            tones: []
        };
    }

    const hooks = [];
    const ctaPatterns = [];
    const emojiPatterns = [];

    for (const msg of messages) {

        const text =
            msg.message_text || '';

        const lines =
            text.split('\n')
                .map((l: string) => l.trim())
                .filter(Boolean);

        // ==========================================
        // HOOK
        // ==========================================

        if (lines.length > 0) {
            hooks.push(lines[0]);
        }

        // ==========================================
        // CTA
        // ==========================================

        const ctaLine =
            lines.find((line: string) =>
                line.includes('🔗') ||
                line.toLowerCase().includes('register')
            );

        if (ctaLine) {
            ctaPatterns.push(ctaLine);
        }

        // ==========================================
        // EMOJI STYLE
        // ==========================================

        const emojiLines =
            lines.filter((line: string) =>
                /^[^\w\s]/.test(line)
            );

        emojiPatterns.push(
            emojiLines.slice(0, 5)
        );
    }

    return {

        topHooks:
            [...new Set(hooks)].slice(0, 5),

        topCTAStyles:
            [...new Set(ctaPatterns)].slice(0, 5),

        emojiPatterns:
            emojiPatterns.flat().slice(0, 10),

        averageTone:
            "warm spiritual uplifting",

        formattingStyle:
            "short whatsapp lines with generous spacing"
    };
}

export async function getCachedContext(
    eventId: string
) {

    try {

        const response =
            await docClient.send(
                new GetCommand({
                    TableName:
                        CONTEXT_CACHE_TABLE,

                    Key: {
                        PK: `EVENT#${eventId}`
                    }
                })
            );

        if (!response.Item) {

            console.log(
                "⚠️ No context cache found"
            );

            return null;
        }

        console.log(
            "✅ Context cache HIT"
        );

        return response.Item.context;

    } catch (error) {

        console.error(
            "❌ Context cache fetch failed:",
            error
        );

        return null;
    }
}

export async function saveContextCache({
    eventId,
    context
}: {
    eventId: string;
    context: any;
}) {

    try {

        const now =
            Math.floor(Date.now() / 1000);

        const ttl =
            now + (60 * 60 * 24);

        await docClient.send(
            new PutCommand({
                TableName:
                    CONTEXT_CACHE_TABLE,

                Item: {
                    PK: `EVENT#${eventId}`,

                    context,

                    created_at:
                        new Date().toISOString(),

                    ttl
                }
            })
        );

        console.log(
            "✅ Context cache saved"
        );

    } catch (error) {
        trackMetric(
            "context_cache_save_failure",
            {
                error:
                    String(error)
            }
        );

        console.error(
            "❌ Failed saving context cache:",
            error
        );
    }
}


export async function recordEngagement(
    eventId: string,
    courseLabel: string,
    messageData: any,
    action: 'copy' | 'like' | 'share'
) {
    // ==========================================
    // 1. HALL OF FAME MEMORY (Table 2 - EVENTTYPE Array Schema)
    // ==========================================
    try {
        // Format the PK based on your schema (e.g., "EVENTTYPE#AMP")
        const memoryPK = buildCourseMemoryPK(
            courseLabel || 'DEFAULT'
        );

        // Step A: Fetch the current document
        const getMem = await docClient.send(new GetCommand({
            TableName: process.env.DYNAMODB_MEMORY_TABLE || 'aol_message_engagement_memory',
            Key: { PK: memoryPK }
        }));

        // Step B: Create a default structure if it's the very first time this course type is engaged
        let memItem = getMem.Item || {
            PK: memoryPK,
            course_event_type_label: courseLabel,
            messages: []
        };

        let memMessages = memItem.messages || [];

        // Find if this specific message already exists in the Hall of Fame
        const msgIdx = memMessages.findIndex((m: any) => m.message_id === messageData.message_id);

        if (msgIdx !== -1) {
            // Update existing message counters safely
            if (action === 'copy') memMessages[msgIdx].copy_count = (memMessages[msgIdx].copy_count || 0) + 1;
            if (action === 'like') memMessages[msgIdx].like_count = (memMessages[msgIdx].like_count || 0) + 1;
            if (action === 'share') memMessages[msgIdx].share_count = (memMessages[msgIdx].share_count || 0) + 1;

            // Recalculate engagement score (Sum of all actions)
            memMessages[msgIdx].engagement_score =
                (memMessages[msgIdx].like_count || 0) +
                (memMessages[msgIdx].share_count || 0) +
                (memMessages[msgIdx].copy_count || 0);
        } else {
            // Add a brand new message to the array
            memMessages.push({
                message_id: messageData.message_id,
                message_text: messageData.message_text,
                copy_count: action === 'copy' ? 1 : 0,
                like_count: action === 'like' ? 1 : 0,
                share_count: action === 'share' ? 1 : 0,
                engagement_score: 1, // First action
                source_event_id: eventId,
                created_at: new Date().toISOString()
            });
        }

        // Step C: Push the entire updated document back
        // PutCommand safely overwrites the old document or creates a new one if missing
        await docClient.send(new PutCommand({
            TableName: process.env.DYNAMODB_MEMORY_TABLE || 'aol_message_engagement_memory',
            Item: {
                ...memItem,
                messages: memMessages
            }
        }));

        console.log(`✅ Table 2 Memory Updated successfully!`);

    } catch (memoryError) {
        console.error(`💥 Memory Table 2 Error:`, memoryError);
    }

    // ==========================================
    // 2. COUNTERS IN EVENT STORE (Table 1 - EVENT Array Schema)
    // ==========================================
    try {
        const getResponse = await docClient.send(new GetCommand({
            TableName: process.env.DYNAMODB_STORE_TABLE || 'aol_event_message_store',
            Key: { PK: `EVENT#${eventId}` }
        }));

        const item = getResponse.Item;

        if (item && item.engaged_messages) {
            const messagesArray = item.engaged_messages;
            const storeMsgIdx = messagesArray.findIndex(
                (m: any) => m.message_id === messageData.message_id
            );

            if (storeMsgIdx !== -1) {
                // Safe JavaScript Math
                if (action === 'copy') messagesArray[storeMsgIdx].copy_count = (messagesArray[storeMsgIdx].copy_count || 0) + 1;
                if (action === 'like') messagesArray[storeMsgIdx].like_count = (messagesArray[storeMsgIdx].like_count || 0) + 1;
                if (action === 'share') messagesArray[storeMsgIdx].share_count = (messagesArray[storeMsgIdx].share_count || 0) + 1;

                await docClient.send(new UpdateCommand({
                    TableName: process.env.DYNAMODB_STORE_TABLE || 'aol_event_message_store',
                    Key: { PK: `EVENT#${eventId}` },
                    UpdateExpression: `SET engaged_messages = :updatedMessages`,
                    ExpressionAttributeValues: {
                        ":updatedMessages": messagesArray
                    }
                }));

                console.log(`✅ Table 1 Store Updated successfully!`);
            }
        }

        return true;

    } catch (storeError) {
        console.error(`💥 Store Table 1 Error:`, storeError);
        return false;
    }
}