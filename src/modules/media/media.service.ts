import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MediaKind } from '@prisma/client';
import * as crypto from 'crypto';
import { extname } from 'path';
import { v4 as uuid } from 'uuid';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageDriver } from './storage/storage.driver';
import { LocalStorageDriver } from './storage/local.driver';
import { S3StorageDriver } from './storage/s3.driver';

const MAX_SIZE = 50 * 1024 * 1024; // 50MB

@Injectable()
export class MediaService {
  private readonly driver: StorageDriver;

  constructor(
    private readonly prisma: PrismaService,
    localDriver: LocalStorageDriver,
    s3Driver: S3StorageDriver,
  ) {
    this.driver = process.env.MEDIA_DRIVER === 's3' ? s3Driver : localDriver;
  }

  async upload(opts: {
    userId?: string;
    file: Express.Multer.File;
    kind?: MediaKind;
  }) {
    if (!opts.file) throw new BadRequestException('No file provided');
    if (opts.file.size > MAX_SIZE) {
      throw new BadRequestException(`File exceeds ${MAX_SIZE} bytes`);
    }

    const kind = opts.kind ?? this.inferKind(opts.file.mimetype);
    const ext = extname(opts.file.originalname).toLowerCase() || this.extFromMime(opts.file.mimetype);
    const datePath = new Date().toISOString().slice(0, 10);
    const key = `${datePath}/${kind.toLowerCase()}/${uuid()}${ext}`;

    const { url } = await this.driver.put({
      key,
      body: opts.file.buffer,
      mimeType: opts.file.mimetype,
    });

    const checksum = crypto
      .createHash('sha256')
      .update(opts.file.buffer)
      .digest('hex');

    return this.prisma.mediaAsset.create({
      data: {
        userId: opts.userId,
        kind,
        key,
        originalName: opts.file.originalname,
        mimeType: opts.file.mimetype,
        sizeBytes: opts.file.size,
        url,
        checksum,
      },
    });
  }

  async get(id: string) {
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id } });
    if (!asset) throw new NotFoundException('Media not found');
    return asset;
  }

  async signed(id: string, expiresInSec = 900) {
    const asset = await this.get(id);
    const url = await this.driver.signedUrl(asset.key, expiresInSec);
    return { id: asset.id, url, expiresInSec };
  }

  async list(opts: { userId?: string; kind?: MediaKind; page: number; limit: number }) {
    const where = {
      ...(opts.userId ? { userId: opts.userId } : {}),
      ...(opts.kind ? { kind: opts.kind } : {}),
    };
    const skip = (opts.page - 1) * opts.limit;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.mediaAsset.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: opts.limit,
      }),
      this.prisma.mediaAsset.count({ where }),
    ]);
    return { items, total };
  }

  async delete(id: string) {
    const asset = await this.get(id);
    await this.driver.delete(asset.key);
    await this.prisma.mediaAsset.delete({ where: { id } });
    return { id, deleted: true };
  }

  private inferKind(mime: string): MediaKind {
    if (mime.startsWith('image/')) return MediaKind.IMAGE;
    if (mime.startsWith('video/')) return MediaKind.VIDEO;
    if (mime.startsWith('audio/')) return MediaKind.AUDIO;
    return MediaKind.FILE;
  }

  private extFromMime(mime: string): string {
    const map: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'video/mp4': '.mp4',
      'audio/mpeg': '.mp3',
      'application/pdf': '.pdf',
    };
    return map[mime] ?? '';
  }
}
