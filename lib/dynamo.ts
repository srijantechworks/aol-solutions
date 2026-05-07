import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

// Initialize the DynamoDB Client
const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-south-1' });
const docClient = DynamoDBDocumentClient.from(client);

// Define your table names
const STORE_TABLE = process.env.DYNAMO_STORE_TABLE || 'aol_event_message_store';
const MEMORY_TABLE = process.env.DYNAMO_MEMORY_TABLE || 'aol_message_engagement_memory';

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
export async function fetchCourseMemory(courseName: string) {
    try {
        const command = new QueryCommand({
            TableName: MEMORY_TABLE,
            KeyConditionExpression: "PK = :pk",
            ExpressionAttributeValues: {
                ":pk": `EVENTTYPE#${courseName}`
            },
            Limit: 5 
        });
        const response = await docClient.send(command);
        return response.Items || [];
    } catch (error) {
        console.error("DynamoDB Fetch Memory Error:", error);
        return [];
    }
}