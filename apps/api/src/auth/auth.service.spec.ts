import { UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { UserRole, type User } from '@prisma/client'
import * as argon2 from 'argon2'
import { MAX_FAILED_LOGIN_ATTEMPTS } from '@areia-bela/shared'
import { AuthService } from './auth.service'
import { TotpService } from './totp.service'
import { TOTP_CHALLENGE_PURPOSE } from './auth.types'
import type { PrismaService } from '../prisma/prisma.service'

const PASSWORD = 'CorrectHorseBattery1'

type PrismaMock = {
  user: { findUnique: jest.Mock; update: jest.Mock }
  refreshToken: {
    findUnique: jest.Mock
    create: jest.Mock
    update: jest.Mock
    updateMany: jest.Mock
  }
  recoveryCode: { updateMany: jest.Mock }
}

const buildUser = (overrides: Partial<User> = {}): User =>
  ({
    id: 'user-1',
    email: 'admin@areiabela.com',
    passwordHash: 'replaced-in-beforeAll',
    firstName: 'Areia',
    lastName: 'Admin',
    role: UserRole.SUPERADMIN,
    active: true,
    failedLoginAttempts: 0,
    lockedUntil: null,
    lastLoginAt: null,
    totpSecret: null,
    totpEnabledAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as User

describe('AuthService', () => {
  let prisma: PrismaMock
  let service: AuthService
  let totp: TotpService
  let jwt: JwtService
  let passwordHash: string

  beforeAll(async () => {
    passwordHash = await AuthService.hashPassword(PASSWORD)
  })

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn(), update: jest.fn().mockResolvedValue(undefined) },
      refreshToken: {
        findUnique: jest.fn(),
        create: jest.fn().mockResolvedValue(undefined),
        update: jest.fn().mockResolvedValue(undefined),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      recoveryCode: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    }

    jwt = new JwtService({ secret: 'x'.repeat(40) })
    totp = new TotpService({ get: () => 'a'.repeat(64) } as unknown as ConfigService)
    service = new AuthService(
      prisma as unknown as PrismaService,
      jwt,
      { get: () => undefined } as unknown as ConfigService,
      totp,
    )
  })

  describe('password hashing', () => {
    it('uses Argon2id and never stores the plaintext', async () => {
      const hash = await AuthService.hashPassword(PASSWORD)
      expect(hash).toMatch(/^\$argon2id\$/)
      expect(hash).not.toContain(PASSWORD)
    })

    it('salts, so the same password hashes differently each time', async () => {
      const [a, b] = await Promise.all([
        AuthService.hashPassword(PASSWORD),
        AuthService.hashPassword(PASSWORD),
      ])
      expect(a).not.toBe(b)
      await expect(argon2.verify(a, PASSWORD)).resolves.toBe(true)
    })
  })

  describe('login', () => {
    it('issues tokens for correct credentials', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser({ passwordHash }))

      const result = await service.login({ email: 'admin@areiabela.com', password: PASSWORD })

      expect(result.requiresTotp).toBe(false)
      if (result.requiresTotp) throw new Error('unreachable')
      expect(result.accessToken).toBeTruthy()
      expect(result.refreshToken).toBeTruthy()
      expect(result.user.email).toBe('admin@areiabela.com')
      // The refresh token is persisted hashed, never in the clear.
      const stored = prisma.refreshToken.create.mock.calls[0][0].data.tokenHash
      expect(stored).not.toBe(result.refreshToken)
      expect(stored).toMatch(/^[0-9a-f]{64}$/)
    })

    it('rejects a wrong password', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser({ passwordHash }))
      await expect(
        service.login({ email: 'admin@areiabela.com', password: 'wrong-password' }),
      ).rejects.toThrow(UnauthorizedException)
    })

    it('gives the same error for an unknown email, so accounts cannot be enumerated', async () => {
      prisma.user.findUnique.mockResolvedValue(null)
      await expect(
        service.login({ email: 'nobody@areiabela.com', password: PASSWORD }),
      ).rejects.toThrow('Invalid credentials')

      prisma.user.findUnique.mockResolvedValue(buildUser({ passwordHash }))
      await expect(
        service.login({ email: 'admin@areiabela.com', password: 'wrong' }),
      ).rejects.toThrow('Invalid credentials')
    })

    it('refuses a deactivated account even with the right password', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser({ passwordHash, active: false }))
      await expect(
        service.login({ email: 'admin@areiabela.com', password: PASSWORD }),
      ).rejects.toThrow('Invalid credentials')
    })
  })

  describe('brute-force lockout', () => {
    it('counts a failed attempt without locking before the threshold', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser({ passwordHash, failedLoginAttempts: 0 }))

      await expect(
        service.login({ email: 'admin@areiabela.com', password: 'wrong' }),
      ).rejects.toThrow()

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ failedLoginAttempts: 1 }) }),
      )
      expect(prisma.user.update.mock.calls[0][0].data.lockedUntil).toBeNull()
    })

    it(`locks the account on failure number ${MAX_FAILED_LOGIN_ATTEMPTS}`, async () => {
      prisma.user.findUnique.mockResolvedValue(
        buildUser({ passwordHash, failedLoginAttempts: MAX_FAILED_LOGIN_ATTEMPTS - 1 }),
      )

      await expect(
        service.login({ email: 'admin@areiabela.com', password: 'wrong' }),
      ).rejects.toThrow()

      const { lockedUntil, failedLoginAttempts } = prisma.user.update.mock.calls[0][0].data
      expect(lockedUntil).toBeInstanceOf(Date)
      expect(lockedUntil.getTime()).toBeGreaterThan(Date.now())
      // Counter resets once locked; the lock itself is what blocks further tries.
      expect(failedLoginAttempts).toBe(0)
    })

    it('refuses a locked account even with the correct password', async () => {
      prisma.user.findUnique.mockResolvedValue(
        buildUser({ passwordHash, lockedUntil: new Date(Date.now() + 60_000) }),
      )
      await expect(
        service.login({ email: 'admin@areiabela.com', password: PASSWORD }),
      ).rejects.toThrow(/temporarily locked/)
    })

    it('lets the account back in once the lock has expired', async () => {
      prisma.user.findUnique.mockResolvedValue(
        buildUser({ passwordHash, lockedUntil: new Date(Date.now() - 1_000) }),
      )
      const result = await service.login({ email: 'admin@areiabela.com', password: PASSWORD })
      expect(result.requiresTotp).toBe(false)
    })

    it('clears the counter after a successful sign-in', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser({ passwordHash, failedLoginAttempts: 3 }))
      await service.login({ email: 'admin@areiabela.com', password: PASSWORD })
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ failedLoginAttempts: 0, lockedUntil: null }),
        }),
      )
    })
  })

  describe('refresh token rotation', () => {
    const activeToken = (token: string, user: User) => ({
      id: 'rt-1',
      userId: user.id,
      tokenHash: token,
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      createdAt: new Date(),
      user,
    })

    it('revokes the presented token and issues a new pair', async () => {
      const user = buildUser({ passwordHash })
      prisma.user.findUnique.mockResolvedValue(user)
      const { refreshToken } = (await service.login({
        email: user.email,
        password: PASSWORD,
      })) as { refreshToken: string }

      prisma.refreshToken.findUnique.mockResolvedValue(activeToken('hash', user))
      const rotated = await service.refresh(refreshToken)

      expect(prisma.refreshToken.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { revokedAt: expect.any(Date) } }),
      )
      expect(rotated.refreshToken).not.toBe(refreshToken)
    })

    it('rejects an unknown token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null)
      await expect(service.refresh('nope')).rejects.toThrow(UnauthorizedException)
    })

    it('rejects an expired token', async () => {
      const user = buildUser({ passwordHash })
      prisma.refreshToken.findUnique.mockResolvedValue({
        ...activeToken('hash', user),
        expiresAt: new Date(Date.now() - 1_000),
      })
      await expect(service.refresh('expired')).rejects.toThrow(UnauthorizedException)
    })

    it('treats reuse of a revoked token as theft and drops every session', async () => {
      const user = buildUser({ passwordHash })
      prisma.refreshToken.findUnique.mockResolvedValue({
        ...activeToken('hash', user),
        revokedAt: new Date(),
      })

      await expect(service.refresh('reused')).rejects.toThrow(UnauthorizedException)

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: user.id, revokedAt: null } }),
      )
    })

    it('rejects a token belonging to a deactivated user', async () => {
      const user = buildUser({ passwordHash, active: false })
      prisma.refreshToken.findUnique.mockResolvedValue(activeToken('hash', user))
      await expect(service.refresh('token')).rejects.toThrow(UnauthorizedException)
    })
  })

  describe('two-factor login', () => {
    const totpUser = () => {
      const secret = totp.generateSecret()
      return {
        secret,
        user: buildUser({
          passwordHash,
          totpSecret: totp.encryptSecret(secret),
          totpEnabledAt: new Date(),
        }),
      }
    }

    it('returns a challenge instead of a session when 2FA is on', async () => {
      const { user } = totpUser()
      prisma.user.findUnique.mockResolvedValue(user)

      const result = await service.login({ email: user.email, password: PASSWORD })

      expect(result.requiresTotp).toBe(true)
      if (!result.requiresTotp) throw new Error('unreachable')
      expect(result.challengeToken).toBeTruthy()
      // Critically, no refresh token was persisted for a half-finished login.
      expect(prisma.refreshToken.create).not.toHaveBeenCalled()
    })

    it('the challenge token is marked so it cannot pass as an access token', async () => {
      const { user } = totpUser()
      prisma.user.findUnique.mockResolvedValue(user)
      const result = await service.login({ email: user.email, password: PASSWORD })
      if (!result.requiresTotp) throw new Error('unreachable')

      expect(jwt.verify(result.challengeToken)).toMatchObject({
        purpose: TOTP_CHALLENGE_PURPOSE,
      })
    })

    it('completes the login with a valid code', async () => {
      const { secret, user } = totpUser()
      prisma.user.findUnique.mockResolvedValue(user)
      const challenge = await service.login({ email: user.email, password: PASSWORD })
      if (!challenge.requiresTotp) throw new Error('unreachable')

      const { generateSync } = await import('otplib')
      const result = await service.verifyTotpChallenge(
        challenge.challengeToken,
        generateSync({ secret }),
      )

      expect(result.accessToken).toBeTruthy()
      expect(prisma.refreshToken.create).toHaveBeenCalled()
    })

    it('rejects a wrong code and counts it toward the lockout', async () => {
      const { user } = totpUser()
      prisma.user.findUnique.mockResolvedValue(user)
      const challenge = await service.login({ email: user.email, password: PASSWORD })
      if (!challenge.requiresTotp) throw new Error('unreachable')

      prisma.user.update.mockClear()
      await expect(service.verifyTotpChallenge(challenge.challengeToken, '000000')).rejects.toThrow(
        /Invalid verification code/,
      )

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ failedLoginAttempts: 1 }) }),
      )
    })

    it('accepts a recovery code and marks it used', async () => {
      const { user } = totpUser()
      prisma.user.findUnique.mockResolvedValue(user)
      const challenge = await service.login({ email: user.email, password: PASSWORD })
      if (!challenge.requiresTotp) throw new Error('unreachable')

      // No TOTP match, but a recovery row is consumed.
      prisma.recoveryCode.updateMany.mockResolvedValue({ count: 1 })
      const result = await service.verifyTotpChallenge(challenge.challengeToken, 'ABCDE-12345')

      expect(result.accessToken).toBeTruthy()
      expect(prisma.recoveryCode.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ usedAt: null }) }),
      )
    })

    it('rejects an access token presented as a challenge', async () => {
      const accessToken = await jwt.signAsync({ sub: 'user-1', email: 'a@b.c', role: 'VIEWER' })
      await expect(service.verifyTotpChallenge(accessToken, '000000')).rejects.toThrow(
        /Invalid or expired challenge/,
      )
    })

    it('rejects a garbage challenge token', async () => {
      await expect(service.verifyTotpChallenge('not-a-jwt', '000000')).rejects.toThrow(
        /Invalid or expired challenge/,
      )
    })
  })

  describe('requireJwtSecret', () => {
    it('rejects a missing secret', () => {
      expect(() =>
        AuthService.requireJwtSecret({ get: () => undefined } as unknown as ConfigService),
      ).toThrow(/JWT_ACCESS_SECRET/)
    })

    it('rejects a secret that is too short to be safe', () => {
      expect(() =>
        AuthService.requireJwtSecret({ get: () => 'short' } as unknown as ConfigService),
      ).toThrow(/32 characters/)
    })
  })
})
