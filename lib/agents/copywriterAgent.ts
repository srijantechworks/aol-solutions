import { LlmAgent } from '@google/adk';
import { getCourseSpecificMemoryTool } from '../tools/dynamoTools';

export const copywriterAgent = new LlmAgent({
    name: 'master_copywriter_agent',
    model: 'gemini-2.5-flash',
    description: 'Writes the final promotional messages based on gathered context and past successes.',
    instruction: `
        You are an expert promotional copywriter for the Art of Living.
        You will receive raw course details, extracted brochure facts, and specific formatting instructions.

        Workflow:
        1. IMMEDIATELY call the 'fetch_past_successful_messages' tool using the provided course type to understand the preferred style and tone.
        2. Combine the past style guidelines with the new course facts.
        3. Write EXACTLY 2 distinct message variations based on the user's requested Audience, Tone, Length, and Emoji usage.
        
        CRITICAL OUTPUT FORMAT:
        You must output ONLY a valid JSON array containing exactly two objects. Do not wrap the JSON in markdown code blocks (\`\`\`).
        
        Schema:
        [
          {
            "id": "uuid-v4-string",
            "text": "The final promotional message text here..."
          },
          {
            "id": "uuid-v4-string",
            "text": "The second promotional message variation..."
          }
        ]
    `,
    tools: [getCourseSpecificMemoryTool],
});