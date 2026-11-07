import { IsString, IsOptional, IsDateString, IsIn, IsNumber, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class EditarDoenteDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  diagnosticoPrincipal?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  dataAltaPrevista?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  numeroProcesso?: string;
  // PROD-22: sexo (RNU) e antropometria de referência.
  @ApiPropertyOptional({ enum: ['masculino', 'feminino', 'indeterminado'] })
  @IsIn(['masculino', 'feminino', 'indeterminado'])
  @IsOptional()
  sexo?: string;

  @ApiPropertyOptional({ description: 'Peso de referência (kg)' })
  @IsNumber()
  @Min(0.3)
  @Max(400)
  @IsOptional()
  pesoReferenciaKg?: number;

  @ApiPropertyOptional({ enum: ['medido', 'referido', 'estimado'] })
  @IsIn(['medido', 'referido', 'estimado'])
  @IsOptional()
  pesoReferenciaFonte?: string;

  @ApiPropertyOptional({ description: 'Altura (cm)' })
  @IsNumber()
  @Min(20)
  @Max(260)
  @IsOptional()
  alturaCm?: number;
}
