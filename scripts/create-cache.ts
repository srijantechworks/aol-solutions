import { createClient } from "@google/genai";
import "dotenv/config";
import fs from "fs";
import path from "path";

// ==========================================
// 1. Configuration
// ==========================================
const geminiClient = createClient({
    apiKey: process.env.GEMINI_API_KEY!,
});

const MANIFEST_PATH = path.join(process.cwd(), "gemini-files-manifest.json");

// ==========================================
// 2. Cache Logic
// ==========================================
async function createCache() {
    console.log("🚀 Initializing Gemini Context Cache...");

    if (!fs.existsSync(MANIFEST_PATH)) {
        console.error("❌ Error: Manifest file not found. Run sync-docs first.");
        return;
    }

    try {
        const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8"));
        const fileUris = Object.values(manifest).map((val: any) => ({
            fileUri: val.geminiUri,
        }));

        if (fileUris.length === 0) {
            console.error("❌ Error: No files found in manifest.");
            return;
        }

        console.log(`Building cache with ${fileUris.length} reference documents...`);

        // Create the cache
        const cacheResponse = await geminiClient.caches.create({
            model: "models/gemini-1.5-flash-001", // Using Flash for efficiency/speed
            displayName: "srijan-rag-context",
            contents: [
                {
                    role: "user",
                    parts: fileUris
                }
            ],
            ttl: "86400s", // 24 hours
        });

        console.log("\n✅ Cache created successfully!");
        console.log(`Cache Name: ${cacheResponse.name}`);
        console.log(`Expires at: ${cacheResponse.expireTime}`);

        console.log("\n👉 IMPORTANT: Add the following to your .env file:");
        console.log(`GEMINI_CACHE_NAME=${cacheResponse.name}`);

    } catch (error: any) {
        console.error("\n❌ Cache creation failed:", error.message);
        if (error.response) {
            console.error("Error Details:", JSON.stringify(error.response.data, null, 2));
        }
    }
}

createCache();
