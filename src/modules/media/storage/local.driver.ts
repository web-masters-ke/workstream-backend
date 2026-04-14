import { Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import { dirname, join } from 'path';
import { StorageDriver, StoragePutInput, StoragePutResult } from './storage.driver';

@Injectable()
export class LocalStorageDriver implements StorageDriver {
  private readonly log = new Logger(LocalStorageDriver.name);
  private readonly baseDir = process.env.MEDIA_LOCAL_DIR || './uploads';
  private readonly publicBase =
    process.env.MEDIA_PUBLIC_BASE_URL || 'http://localhost:3000/media';

  async put(input: StoragePutInput): Promise<StoragePutResult> {
    const abs = join(process.cwd(), this.baseDir, input.key);
    await fs.mkdir(dirname(abs), { recursive: true });
    await fs.writeFile(abs, input.body);
    this.log.debug(`wrote ${abs} (${input.body.length}b)`);
    return {
      key: input.key,
      url: `${this.publicBase.replace(/\/$/, '')}/${input.key}`,
    };
  }

  async delete(key: string): Promise<void> {
    const abs = join(process.cwd(), this.baseDir, key);
    await fs.rm(abs, { force: true });
  }

  async signedUrl(key: string): Promise<string> {
    return `${this.publicBase.replace(/\/$/, '')}/${key}`;
  }
}
