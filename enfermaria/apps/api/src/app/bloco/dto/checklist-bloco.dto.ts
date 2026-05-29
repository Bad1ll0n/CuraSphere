import { IsOptional, IsObject, IsBoolean, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ChecklistBlocoDto {
  @ApiPropertyOptional({ description: 'Identidade confirmada' })
  @IsOptional()
  @IsBoolean()
  identidadeConfirmada?: boolean;

  @ApiPropertyOptional({ description: 'Local cirúrgico confirmado' })
  @IsOptional()
  @IsBoolean()
  localConfirmado?: boolean;

  @ApiPropertyOptional({ description: 'Procedimento confirmado' })
  @IsOptional()
  @IsBoolean()
  procedimentoConfirmado?: boolean;

  @ApiPropertyOptional({ description: 'Consentimento verificado' })
  @IsOptional()
  @IsBoolean()
  consentimentoVerificado?: boolean;

  @ApiPropertyOptional({ description: 'Equipa de bloco apresentada' })
  @IsOptional()
  @IsBoolean()
  equipaApresentada?: boolean;

  @ApiPropertyOptional({ description: 'Preocupações ou notas adicionais' })
  @IsOptional()
  @IsString()
  notas?: string;

  @ApiPropertyOptional({ description: 'Dados adicionais em formato livre' })
  @IsOptional()
  @IsObject()
  dados?: object;
}
