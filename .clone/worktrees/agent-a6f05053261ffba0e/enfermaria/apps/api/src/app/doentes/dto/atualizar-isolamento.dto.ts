import { IsBoolean, IsString, IsOptional, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AtualizarIsolamentoDto {
  @ApiProperty()
  @IsBoolean()
  @IsNotEmpty()
  emIsolamento: boolean;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  motivoIsolamento?: string;
}
