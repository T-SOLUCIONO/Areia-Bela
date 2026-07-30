import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator'

/**
 * A guest writing to the host from the public site.
 *
 * Lengths are capped: this endpoint is public and unauthenticated, so the only
 * thing standing between it and an inbox full of novels is the validator.
 */
export class ContactMessageDto {
  @IsString() @MinLength(2) @MaxLength(80) name!: string
  @IsEmail() @MaxLength(160) email!: string
  @IsString() @MinLength(10) @MaxLength(2000) message!: string
}
