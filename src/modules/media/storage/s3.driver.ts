import { Injectable, Logger } from '@nestjs/common';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StorageDriver, StoragePutInput, StoragePutResult } from './storage.driver';

@Injectable()
export class S3StorageDriver implements StorageDriver {
  private readonly log = new Logger(S3StorageDriver.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly region: string;
  private readonly prefix: string;

  constructor() {
    this.region = process.env.AWS_REGION || 'eu-west-2';
    this.bucket = process.env.S3_BUCKET || '';
    this.prefix = process.env.S3_PREFIX || '';
    this.client = new S3Client({
      region: this.region,
      credentials: process.env.AWS_ACCESS_KEY_ID
        ? {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
          }
        : undefined,
    });
    if (!this.bucket) this.log.warn('S3_BUCKET not set');
  }

  private full(key: string) {
    return `${this.prefix}${key}`.replace(/^\/+/, '');
  }

  async put(input: StoragePutInput): Promise<StoragePutResult> {
    const key = this.full(input.key);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: input.body,
        ContentType: input.mimeType,
      }),
    );
    const url = `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
    return { key: input.key, url };
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: this.full(key) }),
    );
  }

  async signedUrl(key: string, expiresInSec = 900): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: this.full(key) }),
      { expiresIn: expiresInSec },
    );
  }
}
