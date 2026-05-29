import { IsString, IsOptional, IsIn, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CriarAusenciaDto {
  @ApiProperty({ enum: ['ferias', 'baixa_medica', 'formacao', 'licenca_parental', 'outro'] })
  @IsIn(['ferias', 'baixa_medica', 'formacao', 'licenca_parental', 'outro'])
  tipo: string;

  @ApiProperty()
  @IsDateString()
  dataInicio: string;

  @ApiProperty()
  @IsDateString()
  dataFim: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  observacoes?: string;
}
