import type { ConfigService } from '@nestjs/config'
import { BadRequestException } from '@nestjs/common'
import { StorageService } from './storage.service'

const save = jest.fn()
const del = jest.fn()
const file = jest.fn(() => ({ save, delete: del }))
const bucket = jest.fn(() => ({ file }))

jest.mock('@google-cloud/storage', () => ({
  Storage: jest.fn(() => ({ bucket })),
}))

const blobPut = jest.fn()
const blobDel = jest.fn()
jest.mock('@vercel/blob', () => ({
  put: (...args: unknown[]) => blobPut(...args),
  del: (...args: unknown[]) => blobDel(...args),
}))

const configOf = (values: Record<string, string | undefined>) =>
  ({ get: (key: string) => values[key] }) as unknown as ConfigService

const anImage = {
  originalname: 'Piscina Climatizada.JPG',
  mimetype: 'image/jpeg',
  size: 1024,
  buffer: Buffer.from('bytes'),
} as Express.Multer.File

describe('StorageService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    save.mockResolvedValue(undefined)
    del.mockResolvedValue(undefined)
    blobPut.mockResolvedValue({ url: 'https://blob.example/gallery/x.jpg' })
  })

  describe('which backend it picks', () => {
    /**
     * The order is the point. Both can be configured at once during a move
     * between them, and the answer has to be one of them, not "whichever the
     * code happens to check first".
     */
    it('prefers Cloud Storage', () => {
      const service = new StorageService(
        configOf({ GCS_BUCKET: 'areia-bela-media', BLOB_READ_WRITE_TOKEN: 'vercel_blob_x' }),
      )
      expect(service.backend).toBe('gcs')
    })

    it('falls back to Vercel Blob', () => {
      expect(new StorageService(configOf({ BLOB_READ_WRITE_TOKEN: 'vercel_blob_x' })).backend).toBe(
        'blob',
      )
    })

    it('reports local when nothing is configured', () => {
      // The panel needs to know this, because a local URL is a 404 anywhere the
      // API and the web are separate containers.
      expect(new StorageService(configOf({})).backend).toBe('local')
    })

    it('treats a blank bucket name as unset', () => {
      // An empty environment variable is how a deployment "removes" one, and it
      // must not put the service into a mode that cannot work.
      expect(new StorageService(configOf({ GCS_BUCKET: '   ' })).backend).toBe('local')
    })
  })

  describe('uploading to Cloud Storage', () => {
    const service = () => new StorageService(configOf({ GCS_BUCKET: 'areia-bela-media' }))

    it('returns the public URL of the object it wrote', async () => {
      const url = await service().upload(anImage)

      expect(url).toMatch(
        /^https:\/\/storage\.googleapis\.com\/areia-bela-media\/gallery\/[0-9a-f]{24}\.jpg$/,
      )
    })

    it('does not carry the original filename into the URL', async () => {
      // Two guests uploading "pool.jpg" must not collide, and the name a host
      // typed should not end up in a public address.
      const url = await service().upload(anImage)

      expect(url.toLowerCase()).not.toContain('piscina')
      expect(url).not.toContain(' ')
    })

    it('stores it as immutable for a year', async () => {
      await service().upload(anImage)

      // Safe because the name is random: one URL always answers with the same
      // picture, and a replacement gets a new name rather than a stale cache.
      expect(save).toHaveBeenCalledWith(
        anImage.buffer,
        expect.objectContaining({
          contentType: 'image/jpeg',
          metadata: { cacheControl: 'public, max-age=31536000, immutable' },
        }),
      )
    })
  })

  describe('deleting', () => {
    const service = () => new StorageService(configOf({ GCS_BUCKET: 'areia-bela-media' }))

    it('deletes the object behind its own URL', async () => {
      await service().remove('https://storage.googleapis.com/areia-bela-media/gallery/abc123.jpg')

      expect(file).toHaveBeenCalledWith('gallery/abc123.jpg')
      expect(del).toHaveBeenCalled()
    })

    it('leaves alone a URL that is not in this bucket', async () => {
      // The seeded gallery points at the source listing, and a photo the host
      // deletes from the panel must not send a delete to somebody else's host.
      await service().remove('https://a0.muscache.com/im/pictures/abc.jpeg')

      expect(del).not.toHaveBeenCalled()
    })

    it('never throws, because the row still has to go', async () => {
      del.mockRejectedValue(new Error('403'))

      await expect(
        service().remove('https://storage.googleapis.com/areia-bela-media/gallery/abc123.jpg'),
      ).resolves.toBeUndefined()
    })
  })

  describe('what it refuses', () => {
    const service = () => new StorageService(configOf({ GCS_BUCKET: 'areia-bela-media' }))

    it('refuses a type that is not an image we serve', async () => {
      await expect(
        service().upload({ ...anImage, mimetype: 'application/pdf' } as Express.Multer.File),
      ).rejects.toThrow(BadRequestException)
      expect(save).not.toHaveBeenCalled()
    })

    it('refuses anything over 8 MB', async () => {
      await expect(
        service().upload({ ...anImage, size: 9 * 1024 * 1024 } as Express.Multer.File),
      ).rejects.toThrow(BadRequestException)
      expect(save).not.toHaveBeenCalled()
    })

    it('refuses an empty request rather than writing nothing', async () => {
      await expect(service().upload(undefined as never)).rejects.toThrow(BadRequestException)
    })
  })
})
