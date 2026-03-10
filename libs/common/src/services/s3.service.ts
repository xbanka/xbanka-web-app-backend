import { Injectable, Logger } from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';

@Injectable()
export class S3Service {
    private readonly s3Client: S3Client;
    private readonly logger = new Logger(S3Service.name);
    private readonly bucketName: string;

    constructor() {
        const region = process.env.AWS_REGION || process.env.AWS_S3_REGION || 'us-east-1';
        const accessKeyId = process.env.AWS_ACCESS_KEY_ID || process.env.AWS_S3_ACCESS_KEY_ID;
        const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || process.env.AWS_S3_SECRET_ACCESS_KEY;
        this.bucketName = process.env.AWS_S3_BUCKET_NAME!;

        const maskedAccessKey = accessKeyId ? `${accessKeyId.substring(0, 4)}...${accessKeyId.substring(accessKeyId.length - 4)}` : 'undefined';
        this.logger.log(`Initializing S3: Region=${region}, Bucket=${this.bucketName}, AccessKey=${maskedAccessKey}`);

        this.s3Client = new S3Client({
            region,
            credentials: {
                accessKeyId: accessKeyId!,
                secretAccessKey: secretAccessKey!,
            },
        });
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
