import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator'
import { SUPPORTED_LOCALES } from '@areia-bela/shared'

export class AssistantTurnDto {
  @IsIn(['user', 'assistant']) role!: 'user' | 'assistant'
  @IsString() @MaxLength(2000) content!: string
}

/**
 * The history comes from the browser, so it is treated as input and not as
 * memory: capped in length and in turns, because it is the part of the request
 * an attacker controls the size of, and size is what a language model costs.
 */
export class AskDto {
  @IsString() @MinLength(2) @MaxLength(500) question!: string

  @IsOptional() @IsIn(SUPPORTED_LOCALES as unknown as string[]) locale?: string

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => AssistantTurnDto)
  history?: AssistantTurnDto[]
}
