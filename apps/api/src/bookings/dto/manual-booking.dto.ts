import { Type } from 'class-transformer'
import { SUPPORTED_LOCALES } from '@areia-bela/shared'
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator'
import { GuestCountsDto } from '../../properties/dto/quote-request.dto'
import { GuestDetailsDto } from './create-hold.dto'

/** How the host took the money, when Stripe was not the one taking it. */
export enum ManualPaymentMethod {
  CASH = 'CASH',
  TRANSFER = 'TRANSFER',
  CARD = 'CARD',
  OTHER = 'OTHER',
}

/**
 * A stay taken over the phone.
 *
 * Still no total. The server prices it from these inputs exactly as it does a
 * booking made on the site — a booking typed by the host is not a booking with
 * a price the host types (CLAUDE.md).
 */
export class CreateManualBookingDto {
  @IsDateString() checkIn!: string
  @IsDateString() checkOut!: string

  @ValidateNested() @Type(() => GuestCountsDto) guests!: GuestCountsDto
  @ValidateNested() @Type(() => GuestDetailsDto) guest!: GuestDetailsDto

  @IsArray() @IsString({ each: true }) extraIds!: string[]
  @IsOptional() @IsObject() extraUnits?: Record<string, number>

  @IsOptional() @IsString() @MaxLength(1000) specialRequests?: string

  /**
   * Present when the money is already in hand: the booking is confirmed on the
   * spot. Absent means Stripe is asked for a payment link instead.
   */
  @IsOptional() @IsEnum(ManualPaymentMethod) paymentMethod?: ManualPaymentMethod

  /** Which language the guest's confirmation should arrive in. */
  @IsOptional() @IsIn([...SUPPORTED_LOCALES]) locale?: string
}
