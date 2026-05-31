import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class AssinarConsentimentoDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  testemunhaId?: string;
}
