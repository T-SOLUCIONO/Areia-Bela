import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { del, put } from '@vercel/blob'
import { randomBytes } from 'node:crypto'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']
const MAX_BYTES = 8 * 1024 * 1024

/**
 * Photo storage on Vercel Blob.
 *
 * Without BLOB_READ_WRITE_TOKEN it writes to apps/web/public/uploads instead,
 * so the gallery is usable in local development without an account. That
 * fallback is for development only: on an ephemeral host the folder is wiped
 * on every deploy, which is why the missing token is logged as a warning.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name)

  constructor(private readonly config: ConfigService) {}

  private get token(): string | undefined {
    return this.config.get<string>('BLOB_READ_WRITE_TOKEN')
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

    if (!this.token) {
      return this.writeLocally(filename, file.buffer)
    }

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

  private async writeLocally(filename: string, buffer: Buffer): Promise<string> {
    this.logger.warn(
      'BLOB_READ_WRITE_TOKEN not set — storing the image on local disk. ' +
        'Fine for development; on an ephemeral host these files vanish on deploy.',
    )
    const publicDir = join(process.cwd(), '..', 'web', 'public', 'uploads')
    const safeName = filename.replace('gallery/', '')
    await mkdir(publicDir, { recursive: true })
    await writeFile(join(publicDir, safeName), buffer)
    return `/uploads/${safeName}`
  }
}
