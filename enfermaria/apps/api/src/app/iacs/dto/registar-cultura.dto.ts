import { IsString, IsNotEmpty, IsOptional, IsDateString, IsIn, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegistarCulturaDto {
  @ApiProperty() @IsString() @IsNotEmpty() doenteId: string;
  @ApiProperty() @IsDateString() dataColheita: string;
  @ApiProperty() @IsIn(['sangue','urina','expectoracao','ferida','swab_nasal','swab_rectal','lcr','outro'])
  tipoAmostra: string;
  @ApiPropertyOptional() @IsOptional() @IsString() agente?: string;
  @ApiPropertyOptional() @IsOptional() @IsObject() antibiograma?: Record<string, string>;
  @ApiPropertyOptional() @IsOptional() @IsIn(['pendente','positivo','negativo','contaminado'])
  resultado?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() servico?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() observacoes?: string;
}
