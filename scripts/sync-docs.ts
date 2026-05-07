import { S3Client, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";
import { createClient } from "@google/genai";
import "dotenv/config";
import fs from "fs";
import path from "path";
import { Readable } from "stream";

// ==========================================
// 1. Configuration
// ==========================================
const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
});

const geminiClient = createClient({
    apiKey: process.env.GEMINI_API_KEY!,
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME!;
const MANIFEST_PATH = path.join(process.cwd(), "gemini-files-manifest.json");
const TEMP_DIR = path.join(process.cwd(), "temp_sync");

// ==========================================
// 2. Helpers
// ==========================================
async function downloadFromS3(key: string, downloadPath: string) {
    const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key });
    const response = await s3Client.send(command);
    const body = response.Body as Readable;

    return new Promise((resolve, reject) => {
        const fileStream = fs.createWriteStream(downloadPath);
        body.pipe(fileStream);
        body.on("error", reject);
        fileStream.on("finish", resolve);
    });
}

function getMimeType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    switch (ext) {
        case ".pdf": return "application/pdf";
        case ".png": return "image/png";
        case ".jpg":
        case ".jpeg": return "image/jpeg";
        case ".txt": return "text/plain";
        case ".docx": return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        default: return "application/octet-stream";
    }
}

// ==========================================
// 3. Main Sync Logic
// ==========================================
async function sync() {
    console.log("🚀 Starting S3 to Gemini synchronization...");

    if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

    try {
        // List all objects in S3
        const listCommand = new ListObjectsV2Command({ Bucket: BUCKET_NAME });
        const listResponse = await s3Client.send(listCommand);
        const objects = listResponse.Contents || [];

        console.log(`Found ${objects.length} objects in S3 bucket: ${BUCKET_NAME}`);

        const manifest: Record<string, any> = {};

        for (const obj of objects) {
            if (!obj.Key) continue;
            
            // Skip folders
            if (obj.Key.endsWith("/")) continue;

            const filename = path.basename(obj.Key);
            const tempFilePath = path.join(TEMP_DIR, filename);
            const mimeType = getMimeType(filename);

            console.log(`\n📦 Processing: ${obj.Key}`);

            // 1. Download
            console.log(`   - Downloading from S3...`);
            await downloadFromS3(obj.Key, tempFilePath);

            // 2. Upload to Gemini
            console.log(`   - Uploading to Gemini File API...`);
            const uploadResponse = await geminiClient.files.upload({
                path: tempFilePath,
                mimeType: mimeType,
                displayName: filename,
            });

            console.log(`   ✅ Success! Gemini URI: ${uploadResponse.uri}`);

            // 3. Track in manifest
            manifest[obj.Key] = {
                geminiUri: uploadResponse.uri,
                mimeType: mimeType,
                size: obj.Size,
                lastModified: obj.LastModified,
            };

            // 4. Cleanup temp file
            fs.unlinkSync(tempFilePath);
        }

        // Save manifest
        fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
        console.log(`\n✨ Sync complete! Manifest saved to: ${MANIFEST_PATH}`);

    } catch (error: any) {
        console.error("\n❌ Sync failed:", error.message);
        if (error.response) {
            console.error("Error Details:", JSON.stringify(error.response.data, null, 2));
        }
    } finally {
        if (fs.existsSync(TEMP_DIR)) fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    }
}

sync();
