import { IsString, IsOptional, IsNotEmpty, IsDateString, IsBoolean, IsIn } from 'class-validator';
import { CLASSES_ICPS } from '../icps';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CriarEventoAdversoDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  tipo: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  gravidade: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  descricao: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  servicoId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  doenteId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  acaoCorretiva?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  ocorridoEm?: string;

  /** PROD-18: classe de incidente da OMS (ICPS). Sem ela, deduz-se do tipo. */
  @ApiPropertyOptional({ enum: Object.keys(CLASSES_ICPS) })
  @IsOptional()
  @IsIn(Object.keys(CLASSES_ICPS))
  classeIcps?: string;

  /** PROD-18: notificação anónima — o autor não fica guardado. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  anonimo?: boolean;
}
