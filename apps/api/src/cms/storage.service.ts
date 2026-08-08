import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Storage } from '@google-cloud/storage'
import { del, put } from '@vercel/blob'
import { randomBytes } from 'node:crypto'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']
const MAX_BYTES = 8 * 1024 * 1024

/** Where a Cloud Storage object is publicly readable from. */
const GCS_HOST = 'https://storage.googleapis.com'

/**
 * Photo storage, in one of three places.
 *
 * The order matters and is deliberate:
 *
 * 1. **Google Cloud Storage**, if `GCS_BUCKET` is set. Everything else in this
 *    deployment already lives in Google Cloud, so this needs no second account,
 *    and on Cloud Run it authenticates with the service the API already runs as
 *    — no key file anywhere.
 * 2. **Vercel Blob**, if `BLOB_READ_WRITE_TOKEN` is set. Kept because it was
 *    here first and works.
 * 3. **The local disk**, for development.
 *
 * ## Why the local fallback was a trap in production
 *
 * It writes to `apps/web/public/uploads` and returns `/uploads/<name>` — a path
 * the **web** serves. In this deployment those are two containers: the API wrote
 * the file into its own filesystem and handed back a URL only the web could
 * answer, and the web had never heard of it. Every upload in the panel reported
 * success and produced a permanent 404 — the gallery, card images, review
 * portraits and the logo. Ephemeral disks made it worse: even one container
 * would have lost them on the next deploy.
 *
 * So the fallback stays for `pnpm dev`, where both apps share a checkout, and
 * anything deployed configures one of the other two.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name)
  /** Built once: the client opens connections and reads credentials. */
  private gcs?: Storage

  constructor(private readonly config: ConfigService) {}

  private get bucketName(): string | undefined {
    return this.config.get<string>('GCS_BUCKET')?.trim() || undefined
  }

  private get token(): string | undefined {
    return this.config.get<string>('BLOB_READ_WRITE_TOKEN')
  }

  /** Which of the three is in use, for the panel to report honestly. */
  get backend(): 'gcs' | 'blob' | 'local' {
    if (this.bucketName) return 'gcs'
    if (this.token) return 'blob'
    return 'local'
  }

  private bucket() {
    // Application Default Credentials: on Cloud Run that is the service account
    // the API already runs as, and locally it is `gcloud auth
    // application-default login`. No key file to leak either way.
    this.gcs ??= new Storage()
    return this.gcs.bucket(this.bucketName!)
  }

  assertValidImage(file: Express.Multer.File | undefined): asserts file is Express.Multer.File {
    if (!file) throw new BadRequestException('No file received')
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Unsupported type ${file.mimetype}. Use JPEG, PNG, WebP or AVIF.`,
      )
    }
    if (file.size > MAX_BYTES) {
      throw new BadRequestException(`Image is larger than ${MAX_BYTES / 1024 / 1024} MB`)
    }
  }

  async upload(file: Express.Multer.File): Promise<string> {
    this.assertValidImage(file)

    // Random prefix: two guests uploading "pool.jpg" must not collide, and the
    // original name shouldn't be guessable in the public URL.
    const extension = file.originalname.split('.').pop()?.toLowerCase() ?? 'jpg'
    const filename = `gallery/${randomBytes(12).toString('hex')}.${extension}`

    if (this.bucketName) return this.uploadToGcs(filename, file)
    if (!this.token) return this.writeLocally(filename, file.buffer)

    const blob = await put(filename, file.buffer, {
      access: 'public',
      token: this.token,
      contentType: file.mimetype,
    })
    return blob.url
  }

  /** Best-effort: a failure here must not block deleting the database row. */
  async remove(url: string): Promise<void> {
    try {
      const bucket = this.bucketName
      if (bucket) {
        const prefix = `${GCS_HOST}/${bucket}/`
        // Only ours. A URL from another backend — or a listing photo seeded from
        // the source site — is not this bucket's to delete.
        if (url.startsWith(prefix)) await this.bucket().file(url.slice(prefix.length)).delete()
        return
      }
      if (!this.token) {
        if (url.startsWith('/uploads/')) {
          await unlink(join(process.cwd(), '..', 'web', 'public', url))
        }
        return
      }
      await del(url, { token: this.token })
    } catch (error) {
      this.logger.warn(`Could not delete stored file ${url}: ${(error as Error).message}`)
    }
  }

  private async uploadToGcs(filename: string, file: Express.Multer.File): Promise<string> {
    await this.bucket()
      .file(filename)
      .save(file.buffer, {
        contentType: file.mimetype,
        // A year, immutable: the name carries twelve random bytes, so a given
        // URL always answers with the same picture. Re-uploading produces a new
        // name rather than a stale cache.
        metadata: { cacheControl: 'public, max-age=31536000, immutable' },
      })

    // No per-object ACL call: the bucket grants public reads at the bucket
    // level, which is what uniform access requires and what keeps this to one
    // round trip.
    return `${GCS_HOST}/${this.bucketName}/${filename}`
  }

  private async writeLocally(filename: string, buffer: Buffer): Promise<string> {
    this.logger.warn(
      'Neither GCS_BUCKET nor BLOB_READ_WRITE_TOKEN is set — storing the image on local disk. ' +
        'Fine for `pnpm dev`, where the API and the web share a checkout. Anywhere they do not, ' +
        'this URL will 404: the file lands in the API container and the web serves the path.',
    )
    const publicDir = join(process.cwd(), '..', 'web', 'public', 'uploads')
    const safeName = filename.replace('gallery/', '')
    await mkdir(publicDir, { recursive: true })
    await writeFile(join(publicDir, safeName), buffer)
    return `/uploads/${safeName}`
  }
}
