import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly provider: string;
  private s3Client: any;
  private bucket: string;
  private endpoint: string;
  private localBase: string;

  constructor(private readonly config: ConfigService) {
    this.provider = config.get<string>('STORAGE_PROVIDER', 'local');
    this.bucket = config.get<string>('MINIO_BUCKET', config.get<string>('S3_BUCKET', 'curasphere'));
    this.endpoint = '';
    this.localBase = path.join(process.cwd(), 'uploads');

    if (this.provider === 's3' || this.provider === 'minio') {
      this.initS3();
    } else {
      this.initLocal();
    }
  }

  private initLocal() {
    if (!fs.existsSync(this.localBase)) {
      fs.mkdirSync(this.localBase, { recursive: true });
    }
  }

  private initS3() {
    const { S3Client } = require('@aws-sdk/client-s3');
    const minioEndpoint = this.config.get<string>('MINIO_ENDPOINT');
    const minioPort = this.config.get<number>('MINIO_PORT');

    const cfg: any = {
      region: this.config.get<string>('AWS_REGION', 'us-east-1'),
      credentials: {
        accessKeyId: this.config.get<string>('MINIO_ACCESS_KEY') ?? this.config.get<string>('AWS_ACCESS_KEY_ID', ''),
        secretAccessKey: this.config.get<string>('MINIO_SECRET_KEY') ?? this.config.get<string>('AWS_SECRET_ACCESS_KEY', ''),
      },
    };

    if (minioEndpoint) {
      const port = minioPort ?? 9000;
      this.endpoint = `http://${minioEndpoint}:${port}`;
      cfg.endpoint = this.endpoint;
      cfg.forcePathStyle = true;
    }

    this.s3Client = new S3Client(cfg);
  }

  async upload(buffer: Buffer, key: string, mimeType: string): Promise<{ key: string }> {
    if (this.provider === 'local') {
      return this.uploadLocal(buffer, key);
    }
    return this.uploadS3(buffer, key, mimeType);
  }

  private async uploadLocal(buffer: Buffer, key: string): Promise<{ key: string }> {
    const filePath = path.join(this.localBase, key.replace(/\//g, '_'));
    await fs.promises.writeFile(filePath, buffer);
    return { key };
  }

  private async uploadS3(buffer: Buffer, key: string, mimeType: string): Promise<{ key: string }> {
    const { PutObjectCommand } = require('@aws-sdk/client-s3');
    await this.s3Client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    }));
    return { key };
  }

  async getSignedUrl(key: string, ttlSeconds = 3600): Promise<string> {
    if (this.provider === 'local') {
      return `/v1/storage/local/${encodeURIComponent(key)}`;
    }
    const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
    const { GetObjectCommand } = require('@aws-sdk/client-s3');
    const url = await getSignedUrl(
      this.s3Client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: ttlSeconds },
    );
    return url;
  }

  async delete(key: string): Promise<void> {
    if (this.provider === 'local') {
      const filePath = path.join(this.localBase, key.replace(/\//g, '_'));
      await fs.promises.unlink(filePath).catch(() => {});
      return;
    }
    const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
    await this.s3Client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key })).catch((e: any) => {
      this.logger.warn(`S3 delete failed for key ${key}: ${e.message}`);
    });
  }

  async readLocal(key: string): Promise<Buffer | null> {
    const filePath = path.join(this.localBase, key.replace(/\//g, '_'));
    return fs.promises.readFile(filePath).catch(() => null);
  }
}
