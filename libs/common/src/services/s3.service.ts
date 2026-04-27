import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
    S3Client,
    PutBucketPolicyCommand,
    PutPublicAccessBlockCommand,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';

@Injectable()
export class S3Service implements OnModuleInit {
    private readonly s3Client: S3Client;
    private readonly logger = new Logger(S3Service.name);
    private readonly bucketName: string;

    constructor() {
        const region = process.env.AWS_REGION || process.env.AWS_S3_REGION || 'us-east-1';
        const accessKeyId = process.env.AWS_ACCESS_KEY_ID || process.env.AWS_S3_ACCESS_KEY_ID;
        const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || process.env.AWS_S3_SECRET_ACCESS_KEY;
        this.bucketName = process.env.AWS_S3_BUCKET_NAME!;

        const maskedAccessKey = accessKeyId
            ? `${accessKeyId.substring(0, 4)}...${accessKeyId.substring(accessKeyId.length - 4)}`
            : 'undefined';
        this.logger.log(`Initializing S3: Region=${region}, Bucket=${this.bucketName}, AccessKey=${maskedAccessKey}`);

        this.s3Client = new S3Client({
            region,
            credentials: {
                accessKeyId: accessKeyId!,
                secretAccessKey: secretAccessKey!,
            },
        });
    }

    /**
     * On startup, ensure the bucket is configured for public reads:
     * 1. Disable Block Public Access
     * 2. Apply a bucket policy that allows s3:GetObject for everyone
     */
    async onModuleInit() {
        try {
            // Step 1: Disable all Block Public Access settings
            await this.s3Client.send(
                new PutPublicAccessBlockCommand({
                    Bucket: this.bucketName,
                    PublicAccessBlockConfiguration: {
                        BlockPublicAcls: false,
                        IgnorePublicAcls: false,
                        BlockPublicPolicy: false,
                        RestrictPublicBuckets: false,
                    },
                }),
            );
            this.logger.log(`[S3] Block Public Access disabled for bucket: ${this.bucketName}`);

            // Step 2: Apply public-read bucket policy
            const bucketPolicy = JSON.stringify({
                Version: '2012-10-17',
                Statement: [
                    {
                        Sid: 'PublicReadGetObject',
                        Effect: 'Allow',
                        Principal: '*',
                        Action: 's3:GetObject',
                        Resource: `arn:aws:s3:::${this.bucketName}/*`,
                    },
                ],
            });

            await this.s3Client.send(
                new PutBucketPolicyCommand({
                    Bucket: this.bucketName,
                    Policy: bucketPolicy,
                }),
            );
            this.logger.log(`[S3] Public-read bucket policy applied to: ${this.bucketName}`);
        } catch (error) {
            this.logger.error(`[S3] Failed to configure public access: ${error.message}`);
            // Non-fatal — service still works; uploads will just remain private
        }
    }

    async uploadFile(file: Express.Multer.File, folder: string = 'kyc'): Promise<string> {
        const fileExtension = path.extname(file.originalname);
        const fileName = `${folder}/${uuidv4()}${fileExtension}`;

        try {
            const upload = new Upload({
                client: this.s3Client,
                params: {
                    Bucket: this.bucketName,
                    Key: fileName,
                    Body: file.buffer,
                    ContentType: file.mimetype,
                    ACL: 'public-read',
                },
            });

            await upload.done();

            const region = process.env.AWS_REGION || process.env.AWS_S3_REGION || 'us-east-1';
            const url = `https://${this.bucketName}.s3.${region}.amazonaws.com/${fileName}`;
            this.logger.log(`File uploaded successfully to S3: ${url}`);
            return url;
        } catch (error) {
            this.logger.error(`Error uploading file to S3: ${error.message}`);
            this.logger.error(`Error Details: ${JSON.stringify(error, null, 2)}`);
            if (error.$metadata) {
                this.logger.error(`S3 Metadata: ${JSON.stringify(error.$metadata, null, 2)}`);
            }
            throw new Error(`Failed to upload file to S3: ${error.message}`);
        }
    }
}
