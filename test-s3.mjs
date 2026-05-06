import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import "dotenv/config";

const client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

try {
    const response = await client.send(
        new ListObjectsV2Command({ Bucket: process.env.S3_BUCKET_NAME })
    );
    console.log("✅ S3 connection successful!");
    console.log("Objects in bucket:", response.KeyCount);
} catch (err) {
    console.error("❌ Connection failed:", err.message);
}