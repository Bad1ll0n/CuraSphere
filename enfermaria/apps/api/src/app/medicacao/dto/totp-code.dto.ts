import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TotpCodeDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  totpCode: string;
}
