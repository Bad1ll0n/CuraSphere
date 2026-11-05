import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length, MaxLength } from 'class-validator';

/** PROD-11: texto da carta de alta revisto pelo médico. */
export class ReverCartaAltaDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(20_000)
  texto!: string;
}

export class AssinarCartaAltaDto {
  @ApiProperty()
  @IsString()
  @Length(6, 6)
  totpCode!: string;
}
