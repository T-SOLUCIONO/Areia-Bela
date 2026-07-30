import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import { AppModule } from './app.module'

async function bootstrap() {
  // The Stripe webhook verifies a signature over the exact bytes Stripe sent,
  // so the parsed body is not enough — a re-serialised JSON never matches.
  const app = await NestFactory.create(AppModule, { rawBody: true })

  app.use(helmet())
  // Auth cookies are HttpOnly, so they're only readable here after parsing.
  app.use(cookieParser())

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      // Reject unknown properties instead of silently dropping them, so a
      // typo'd field in a request is a visible 400 rather than a no-op.
      forbidNonWhitelisted: true,
    }),
  )

  // Credentials must be enabled for cookie auth to work at all, and once they
  // are, a wildcard origin is no longer allowed by browsers — hence the
  // explicit allowlist. See docs/env.md for the cross-site deployment caveat.
  const allowedOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

  app.enableCors({ origin: allowedOrigins, credentials: true })

  const port = process.env.PORT ? Number(process.env.PORT) : 3001
  await app.listen(port)
}

bootstrap()
