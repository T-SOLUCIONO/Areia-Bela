import { BadRequestException, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { generateSecret, generateURI, verifySync } from 'otplib'
import { toDataURL } from 'qrcode'
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12

/**
 * TOTP (RFC 6238) with an authenticator app — deliberately not SMS, which is
 * vulnerable to SIM swapping and would need a paid provider.
 *
 * The secret is encrypted at rest rather than hashed: verifying a code requires
 * the original secret, so a hash wouldn't work, and plaintext would make a
 * database leak sufficient to mint valid codes.
 */
@Injectable()
export class TotpService {
  private readonly key: Buffer

  constructor(private readonly config: ConfigService) {
    this.key = TotpService.resolveKey(config)
  }

  private static resolveKey(config: ConfigService): Buffer {
    const raw = config.get<string>('TOTP_ENCRYPTION_KEY')
    if (!raw) {
      throw new Error('TOTP_ENCRYPTION_KEY is not set. See docs/env.md.')
    }

    // Accept either 32 raw bytes as hex (64 chars) or any sufficiently long
    // passphrase, derived to 32 bytes.
    if (/^[0-9a-f]{64}$/i.test(raw)) return Buffer.from(raw, 'hex')
    if (raw.length < 32) {
      throw new Error(
        'TOTP_ENCRYPTION_KEY must be 64 hex characters or a passphrase of at least 32 characters.',
      )
    }
    return createHash('sha256').update(raw).digest()
  }

  generateSecret(): string {
    return generateSecret()
  }

  /** `otpauth://` URI, the standard format every authenticator app accepts. */
  buildKeyUri(email: string, secret: string): string {
    return generateURI({ strategy: 'totp', issuer: 'Areia Bela Admin', label: email, secret })
  }

  /**
   * Rendered server-side as a data URL so the admin bundle doesn't need a QR
   * library, and the secret never has to be drawn client-side.
   */
  buildQrCodeDataUrl(keyUri: string): Promise<string> {
    return toDataURL(keyUri, { width: 240, margin: 1 })
  }

  encryptSecret(secret: string): string {
    const iv = randomBytes(IV_LENGTH)
    const cipher = createCipheriv(ALGORITHM, this.key, iv)
    const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()])
    // iv:authTag:ciphertext — self-contained, so rotating the key later is a
    // visible migration rather than silent corruption.
    return [
      iv.toString('hex'),
      cipher.getAuthTag().toString('hex'),
      encrypted.toString('hex'),
    ].join(':')
  }

  decryptSecret(stored: string): string {
    const [ivHex, tagHex, dataHex] = stored.split(':')
    if (!ivHex || !tagHex || !dataHex) {
      throw new BadRequestException('Stored TOTP secret is malformed')
    }

    const decipher = createDecipheriv(ALGORITHM, this.key, Buffer.from(ivHex, 'hex'))
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
    return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString(
      'utf8',
    )
  }

  verifyCode(code: string, encryptedSecret: string): boolean {
    const normalized = code.replace(/[\s-]/g, '')
    if (!/^\d{6}$/.test(normalized)) return false

    try {
      // ±30s tolerance: real devices drift. Wider would weaken brute-force
      // resistance, which is why the verify endpoints are also rate limited.
      const result = verifySync({
        secret: this.decryptSecret(encryptedSecret),
        token: normalized,
        epochTolerance: 30,
      })
      return result.valid
    } catch {
      return false
    }
  }

  /** Plaintext is returned once, at setup; only hashes are stored. */
  generateRecoveryCodes(count = 10): { plaintext: string[]; hashes: string[] } {
    const plaintext = Array.from({ length: count }, () =>
      randomBytes(5)
        .toString('hex')
        .toUpperCase()
        .match(/.{1,5}/g)!
        .join('-'),
    )
    return { plaintext, hashes: plaintext.map((code) => TotpService.hashRecoveryCode(code)) }
  }

  static hashRecoveryCode(code: string): string {
    return createHash('sha256').update(code.replace(/[\s-]/g, '').toUpperCase()).digest('hex')
  }

  static recoveryCodeMatches(candidateHash: string, storedHash: string): boolean {
    const a = Buffer.from(candidateHash, 'hex')
    const b = Buffer.from(storedHash, 'hex')
    return a.length === b.length && timingSafeEqual(a, b)
  }
}
