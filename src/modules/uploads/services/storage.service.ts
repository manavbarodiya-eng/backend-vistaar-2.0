import { randomUUID } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { cert, getApp, initializeApp, type App } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';

import { unavailable } from '@common/errors/api-error';
import type { Env } from '@config/env.schema';

const APP_NAME = 'vistaar-uploads';
const SIGNED_URL_TTL_MS = 60 * 60 * 1000;

export const ALLOWED_MIME =
  /^(image\/(jpeg|png|webp|heic|heif)|application\/pdf)$/;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'application/pdf': 'pdf',
};

/**
 * KYC files (Aadhaar, PAN, cheque, selfie…) in the organisation's document
 * folder — `KO-documents/<pii_id>/<purpose>/`, beside ko-sales' own — but as
 * **private** objects (decided 2026-10-09): a reader gets a signed URL that
 * expires in an hour, minted on each read. `piis.documents` records the
 * object's canonical URL, which opens only for someone with bucket access.
 *
 * The `<pii_id>` prefix is how a partner is stopped from attaching someone
 * else's file to their own form.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private app: App | null = null;
  private readonly bucketName?: string;
  private readonly credentials?: {
    projectId: string;
    clientEmail: string;
    privateKey: string;
  };

  constructor(config: ConfigService<Env, true>) {
    const projectId = config.get('FIREBASE_PROJECT_ID', { infer: true });
    const clientEmail = config.get('FIREBASE_CLIENT_EMAIL', { infer: true });
    const privateKey = config.get('FIREBASE_PRIVATE_KEY', { infer: true });
    this.bucketName = config.get('FIREBASE_STORAGE_BUCKET', { infer: true });
    if (projectId && clientEmail && privateKey && this.bucketName) {
      this.credentials = {
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, '\n'),
      };
    }
  }

  get configured(): boolean {
    return !!this.credentials;
  }

  /** `KO-documents/<piiId>/<purpose>/<ts>-<id>.<ext>` — the value stored in `raw_data`. */
  async save(
    piiId: string,
    purpose: string,
    buffer: Buffer,
    mime: string,
  ): Promise<string> {
    const name = `${Date.now()}-${randomUUID().slice(0, 8)}.${EXT[mime] ?? 'bin'}`;
    const path = `KO-documents/${piiId}/${purpose}/${name}`;
    await this.bucket()
      .file(path)
      .save(buffer, {
        contentType: mime,
        resumable: false,
        metadata: { cacheControl: 'private, max-age=0' },
      });
    return path;
  }

  /** The object's canonical URL, in the form ko-sales stores in `piis.documents`. */
  urlOf(path: string): string | null {
    if (!this.bucketName) return null;
    const encoded = path.split('/').map(encodeURIComponent).join('/');
    return `https://storage.googleapis.com/${this.bucketName}/${encoded}`;
  }

  /** Signed read URLs for many paths at once; a path that fails is left out. */
  async sign(paths: string[]): Promise<Map<string, string>> {
    const urls = new Map<string, string>();
    if (!this.configured || paths.length === 0) return urls;
    const expires = Date.now() + SIGNED_URL_TTL_MS;
    await Promise.all(
      [...new Set(paths)].map(async (path) => {
        try {
          const [url] = await this.bucket()
            .file(path)
            .getSignedUrl({ action: 'read', expires });
          urls.set(path, url);
        } catch (error) {
          this.logger.warn(`Could not sign ${path}: ${String(error)}`);
        }
      }),
    );
    return urls;
  }

  private bucket() {
    if (!this.credentials || !this.bucketName) {
      throw unavailable(
        'UPLOADS_NOT_CONFIGURED',
        'File uploads are not configured on this server.',
      );
    }
    if (!this.app) {
      try {
        this.app = getApp(APP_NAME);
      } catch {
        this.app = initializeApp(
          { credential: cert(this.credentials) },
          APP_NAME,
        );
      }
    }
    return getStorage(this.app).bucket(this.bucketName);
  }
}
