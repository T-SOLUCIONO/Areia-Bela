import { createParamDecorator, type ExecutionContext } from '@nestjs/common'
import type { Request } from 'express'

export interface CurrentGuestPayload {
  customerId: string
  email: string
}

/** Set by GuestGuard; only meaningful on a route that uses it. */
export const CurrentGuest = createParamDecorator(
  (_data: unknown, context: ExecutionContext): CurrentGuestPayload => {
    const request = context.switchToHttp().getRequest<Request & { guest: CurrentGuestPayload }>()
    return request.guest
  },
)
