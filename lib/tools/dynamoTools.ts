import { FunctionTool } from '@google/adk';
import { z } from 'zod';
import { fetchCourseMemory } from '../dynamo';

export const getCourseSpecificMemoryTool = new FunctionTool({
    name: 'fetch_past_successful_messages',
    description: 'Fetches high-performing, user-validated promotional messages for this specific course type to use as style inspiration.',
    parameters: z.object({
        courseEventType: z.string().describe("The type of the course, e.g., 'AMP', 'Happiness Program'")
    }),
    execute: async ({ courseEventType }) => {
        try {
            const pastSuccesses = await fetchCourseMemory(courseEventType);

            if (pastSuccesses.length === 0) {
                return { 
                    status: 'empty', 
                    message: `No past data found for course type '${courseEventType}'. Write the message from scratch based strictly on user preferences.` 
                };
            }
            
            const cleanExamples = pastSuccesses.flatMap(item => 
                item.messages.map((m: any) => ({
                    text: m.message_text,
                    score: m.engagement_score || (m.like_count + m.share_count + m.copy_count)
                }))
            ).sort((a, b) => b.score - a.score).slice(0, 3); 

            return { 
                status: 'success', 
                instruction: 'Analyze the tone, spacing, and formatting of these highly engaged past messages. Mimic their style:',
                examples: cleanExamples 
            };
        } catch (error: any) {
            console.error("Dynamo Tool Error:", error);
            return { status: 'error', message: 'Failed to fetch memory database.' };
        }
    }
});