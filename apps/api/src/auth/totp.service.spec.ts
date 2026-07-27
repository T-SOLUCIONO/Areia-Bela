import { ConfigService } from '@nestjs/config'
import { generateSync } from 'otplib'
import { TotpService } from './totp.service'

const config = (values: Record<string, string>) =>
  ({ get: (key: string) => values[key] }) as unknown as ConfigService

const KEY = 'a'.repeat(64) // 32 bytes as hex

describe('TotpService', () => {
  let service: TotpService

  beforeEach(() => {
    service = new TotpService(config({ TOTP_ENCRYPTION_KEY: KEY }))
  })

  it('refuses to start without an encryption key', () => {
    expect(() => new TotpService(config({}))).toThrow(/TOTP_ENCRYPTION_KEY/)
  })

  it('refuses a passphrase that is too short to be safe', () => {
    expect(() => new TotpService(config({ TOTP_ENCRYPTION_KEY: 'short' }))).toThrow(
      /64 hex characters or a passphrase/,
    )
  })

  describe('secret encryption', () => {
    it('round-trips a secret', () => {
      const secret = service.generateSecret()
      expect(service.decryptSecret(service.encryptSecret(secret))).toBe(secret)
    })

    it('never stores the secret in plaintext', () => {
      const secret = service.generateSecret()
      expect(service.encryptSecret(secret)).not.toContain(secret)
    })

    it('produces a different ciphertext each time (random IV)', () => {
      const secret = service.generateSecret()
      expect(service.encryptSecret(secret)).not.toBe(service.encryptSecret(secret))
    })

    it('rejects a secret encrypted under a different key', () => {
      const encrypted = service.encryptSecret(service.generateSecret())
      const other = new TotpService(config({ TOTP_ENCRYPTION_KEY: 'b'.repeat(64) }))
      expect(() => other.decryptSecret(encrypted)).toThrow()
    })

    it('rejects tampered ciphertext (GCM auth tag)', () => {
      const encrypted = service.encryptSecret(service.generateSecret())
      const [iv, tag, data] = encrypted.split(':')
      const flipped = data.slice(0, -2) + (data.endsWith('00') ? '11' : '00')
      expect(() => service.decryptSecret([iv, tag, flipped].join(':'))).toThrow()
    })
  })

  describe('verifyCode', () => {
    it('accepts the code the authenticator app would show', () => {
      const secret = service.generateSecret()
      const encrypted = service.encryptSecret(secret)
      expect(service.verifyCode(generateSync({ secret }), encrypted)).toBe(true)
    })

    it('tolerates spaces and dashes from pasted codes', () => {
      const secret = service.generateSecret()
      const encrypted = service.encryptSecret(secret)
      const code = generateSync({ secret })
      expect(service.verifyCode(`${code.slice(0, 3)} ${code.slice(3)}`, encrypted)).toBe(true)
    })

    it('rejects a wrong code', () => {
      const secret = service.generateSecret()
      const code = generateSync({ secret })
      // Guaranteed different from the real one.
      const wrong = code === '000000' ? '111111' : '000000'
      expect(service.verifyCode(wrong, service.encryptSecret(secret))).toBe(false)
    })

    it.each(['12345', '1234567', 'abcdef', ''])('rejects malformed input %p', (code) => {
      const encrypted = service.encryptSecret(service.generateSecret())
      expect(service.verifyCode(code, encrypted)).toBe(false)
    })

    it('returns false instead of throwing on a corrupt stored secret', () => {
      expect(service.verifyCode('123456', 'not-a-valid-payload')).toBe(false)
    })
  })

  describe('recovery codes', () => {
    it('generates the requested number of unique codes', () => {
      const { plaintext, hashes } = service.generateRecoveryCodes(10)
      expect(plaintext).toHaveLength(10)
      expect(new Set(plaintext).size).toBe(10)
      expect(new Set(hashes).size).toBe(10)
    })

    it('stores only hashes, never the code itself', () => {
      const { plaintext, hashes } = service.generateRecoveryCodes(3)
      plaintext.forEach((code, index) => expect(hashes[index]).not.toContain(code))
    })

    it('hashes ignore formatting so users can type codes loosely', () => {
      const canonical = TotpService.hashRecoveryCode('ABCDE-12345')
      expect(TotpService.hashRecoveryCode('abcde12345')).toBe(canonical)
      expect(TotpService.hashRecoveryCode(' ABCDE - 12345 ')).toBe(canonical)
    })

    it('compares hashes without leaking length differences', () => {
      const hash = TotpService.hashRecoveryCode('ABCDE-12345')
      expect(TotpService.recoveryCodeMatches(hash, hash)).toBe(true)
      expect(TotpService.recoveryCodeMatches(TotpService.hashRecoveryCode('X'), hash)).toBe(false)
      expect(TotpService.recoveryCodeMatches('abc', hash)).toBe(false)
    })
  })

  it('builds an otpauth URI an authenticator app can consume', () => {
    const secret = service.generateSecret()
    const uri = service.buildKeyUri('admin@areiabela.com', secret)
    expect(uri).toMatch(/^otpauth:\/\/totp\//)
    expect(uri).toContain(`secret=${secret}`)
    expect(uri).toContain('issuer=Areia%20Bela%20Admin')
  })
})
