export interface StoragePutInput {
  key: string;
  body: Buffer;
  mimeType: string;
}

export interface StoragePutResult {
  key: string;
  url: string;
}

export interface StorageDriver {
  put(input: StoragePutInput): Promise<StoragePutResult>;
  delete(key: string): Promise<void>;
  signedUrl(key: string, expiresInSec: number): Promise<string>;
}
