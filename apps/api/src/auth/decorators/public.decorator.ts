import { SetMetadata } from '@nestjs/common'
import { IS_PUBLIC_KEY } from '../auth.constants'

/**
 * Opts a route out of JwtAuthGuard, which is registered globally so that
 * forgetting to protect a new endpoint fails closed rather than open.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true)
