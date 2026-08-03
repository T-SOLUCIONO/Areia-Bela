import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import cookieParser from 'cookie-parser'
import { json } from 'express'
import type { Request } from 'express'
import helmet from 'helmet'
import { AppModule } from './app.module'

/** What the raw-body hook writes onto the request for the Stripe webhook. */
type RawBodyRequest = Request & { rawBody?: Buffer }

async function bootstrap() {
  // The Stripe webhook verifies a signature over the exact bytes Stripe sent,
  // so the parsed body is not enough — a re-serialised JSON never matches.
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
    // Nest's own parsers are off so the ones below are the only ones running.
    bodyParser: false,
  })

  // JSON only, deliberately.
  //
  // Nest enables a form parser by default and nothing here consumes a form:
  // every endpoint takes JSON, and the two image uploads are handled by
  // multer. Leaving it on would matter the moment cookies go `SameSite=None`,
  // because a cross-site `<form>` posts without a preflight while JSON cannot
  // — so a parser nobody needs is a door nobody watches.
  //
  // `verify` keeps the exact bytes for the Stripe webhook, which checks a
  // signature over them; a re-serialised body never matches.
  app.use(
    json({
      limit: '1mb',
      verify: (req: RawBodyRequest, _res, buffer) => {
        req.rawBody = Buffer.from(buffer)
      },
    }),
  )

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
