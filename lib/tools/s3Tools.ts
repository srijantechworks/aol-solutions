import { ListObjectsV2Command, S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { FunctionTool } from "@google/adk";
import { boolean, file, z } from 'zod';


// Initialize the S3 Client
const s3 = new S3Client({
    region: process.env.AWS_REGION || "ap-south-1",
})

const BUCKET_NAME = process.env.S3_BUCKET_NAME || "sri-admin-aol-solutions-s3-bucket";

// ==========================================
// MAPPING DICTIONARY
// Maps the 'clean' API course names to your specific S3 folder prefixes
// ==========================================
const COURSE_FOLDER_MAP: Record<string, string> = {
    // Exact maps based on your screenshots
    "Happiness Program": "hapiness_program", // Handling the one 'p' spelling in S3
    "Youth Happiness Program": "happiness_program_for_youth",
    "Happiness Retreat": "happiness_retreat_blr_ashram",
    "Happiness Sahaj Combo": "happiness_sahaj_combo",
    "Intuition Process": "intuition_program",
    "Online Meditation and Breath Workshop": "online_meditation&breath_workshop",
    "Online Sahaj Samadhi Meditation": "online_sahaj",
    "Online Sri Sri Yoga": "online_srisri_yoga",
    "Sahaj Samadhi Meditation": "sahaj",
    "Sri Sri Yoga Deep Dive": "srisri_yoga_deep_dive",
    "Sanyam": "sanyam_all",
    "DSN": "dsn",
    "AMP": "amp",
    "Online AMP": "online_amp",
    "VTP": "vtp",
    "AOL Camps": "aol_camps",
};

/**
 * Helper to determine the correct S3 folder prefix
 */
function getS3FolderPrefix(courseName: string): string {
    const normalizedInput = courseName.toLowerCase().trim();

    // 1. Sort dictionary keys by length DESCENDING.
    const sortedKeys = Object.keys(COURSE_FOLDER_MAP).sort((a, b) => b.length - a.length);

    // 2. Check for substring inclusion (Input includes Key OR Key includes Input)
    const matchedKey = sortedKeys.find(key => {
        const normalizedKey = key.toLowerCase();
        return normalizedInput.includes(normalizedKey) || normalizedKey.includes(normalizedInput);
    })

    if (matchedKey) {
        return COURSE_FOLDER_MAP[matchedKey];
    }

    // 3. Fallback Heuristic: Format it the way the bucket is generally structured
    return courseName.toLowerCase().trim().replace(/[\s\-]+/g, '_');

}

/**
 * Tool 1: list_s3_folder
 * The agent uses this to find what marketing assets exist for a given course.
 */
export const listS3FolderTool = new FunctionTool({
    name: 'list_s3_folder',
    description: "Searches the S3 bucket for marketing brochures, schedules, images, pdfs, message templates, and other assets for a given course. The agent will use this tool to find out what marketing assets related to a specific Art of Living course.",
    parameters: z.object({
        courseName: z.string().describe("The official name of the Art of Living course, e.g. 'Happiness Program **', 'Sahaj Samadhi Meditation **', 'Sri Sri Yoga **', etc.")
    }),
    execute: async ({ courseName }) => {
        try {
            const folderPrefix = getS3FolderPrefix(courseName);

            // Define both paths based on your new bucket structure
            const messagesPath = `messages/${folderPrefix}/`;
            const moreInfoPath = `more_info/${folderPrefix}/`;

            // Fire both S3 requests at the exact same time
            const [messagesResponse, moreInfoResponse] = await Promise.all([
                s3.send(new ListObjectsV2Command({
                    Bucket: BUCKET_NAME,
                    Prefix: messagesPath
                })),
                s3.send(new ListObjectsV2Command({
                    Bucket: BUCKET_NAME,
                    Prefix: moreInfoPath
                }))
            ])


            const messagesFiles = messagesResponse.Contents?.map(item => item.Key as string).filter(boolean) || [];
            const moreInfoFiles = moreInfoResponse.Contents?.map(item => item.Key as string).filter(boolean) || [];

            // Combine them into a single array
            const allFiles = [...messagesFiles, ...moreInfoFiles];

            // Filter out the directory itself if it returns in the list
            const actualFiles = allFiles.filter(file => file !== `${folderPrefix}/`);

            if (actualFiles.length === 0) {
                return {
                    status: "empty",
                    message: `No files found in either '${messagesPath}' or '${moreInfoPath}'. The agent should proceed generating text using only the API course context.`
                };
            }

            return {
                status: 'success',
                foldersSearched: [messagesPath, moreInfoPath],
                files: actualFiles
            };

        } catch (error: any) {

            console.error("S3 List Error:", error.message);
            return { status: 'error', message: 'Failed to access S3 bucket folders.' };
        }

    }
})


/**
 * Tool 2: read_s3_image
 */
export const readS3ImageTool = new FunctionTool({
    name: 'read_s3_image',
    description: 'Downloads an image from the S3 bucket and returns its base64 encoding so you can analyze its visual and text content.',
    parameters: z.object({
        fileKey: z.string().describe("The exact full S3 file path (key) returned by the list_s3_folder tool")
    }),
    execute: async ({ fileKey }) => {
        try {
            const command = new GetObjectCommand({
                Bucket: BUCKET_NAME,
                Key: fileKey
            });

            const response = await s3.send(command);
            const byteArray = await response.Body?.transformToByteArray();

            if (!byteArray) {
                return { status: "error", message: "File was empty." }
            }

            const base64Data = Buffer.from(byteArray).toString('base64');
            const ext = fileKey.split('.').pop()?.toLowerCase();
            const mimeType = ext === 'png' ? 'image/png' : (ext === 'pdf' ? 'application/pdf' : 'image/jpeg');

            return {
                status: "success",
                mimeType,
                imageBase64: base64Data
            }

        } catch (error: any) {
            console.error(`S3 Read Error for ${fileKey}:`, error.message);
            return { status: 'error', message: `Failed to read file ${fileKey}` };
        }
    }
})

