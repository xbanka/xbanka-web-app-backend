import { S3Client, CreateBucketCommand } from '@aws-sdk/client-s3';
import * as dotenv from 'dotenv';

dotenv.config();

const region = process.env.AWS_REGION || process.env.AWS_S3_REGION || 'us-east-1';
const accessKeyId = process.env.AWS_ACCESS_KEY_ID || process.env.AWS_S3_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || process.env.AWS_S3_SECRET_ACCESS_KEY;

// IMPORTANT: Bucket names must be globally unique!
const bucketName = 'xbanka-kyc-storage-' + Math.random().toString(36).substring(2, 8);

async function createBucket() {
    console.log(`Attempting to create bucket: ${bucketName} in region: ${region}`);

    const s3Client = new S3Client({
        region,
        credentials: {
            accessKeyId: accessKeyId!,
            secretAccessKey: secretAccessKey!,
        },
    });

    try {
        const data = await s3Client.send(new CreateBucketCommand({
            Bucket: bucketName,
        }));
        console.log('✅ Success! Bucket created at:', data.Location);
        console.log('\n--- IMPORTANT ---');
        console.log(`Update your .env file with: AWS_S3_BUCKET_NAME=${bucketName}`);
        console.log('Then run ./deploy.sh again.');
    } catch (err: any) {
        console.error('❌ Error creating bucket:', err.message);
        if (err.name === 'BucketAlreadyExists' || err.name === 'BucketAlreadyOwnedByYou') {
            console.log('Tip: Try a different bucket name.');
        }
    }
}

createBucket();
