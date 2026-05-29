import { IsString, IsOptional, IsBoolean, IsNotEmpty, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegistarFormacaoDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  utilizadorId: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  nome: string;

  @ApiProperty()
  @IsDateString()
  dataRealizacao: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dataExpiracao?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  entidade?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  obrigatoria?: boolean;
}
