import { IsOptional, IsNumber, IsIn, IsDateString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CriarContratoDto {
  @ApiProperty({ enum: ['efetivo', 'contrato_termo', 'prestacao_servicos', 'estagio', 'outro'] })
  @IsIn(['efetivo', 'contrato_termo', 'prestacao_servicos', 'estagio', 'outro'])
  tipoVinculo: string;

  @ApiProperty()
  @IsDateString()
  dataInicio: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dataFimPrevista?: string;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  diasFeriasAnuais?: number;
}
