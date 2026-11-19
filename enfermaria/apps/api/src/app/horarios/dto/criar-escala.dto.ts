import { IsNumber, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CriarEscalaDto {
  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  mes: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  ano: number;

  /** PROD-17: o serviço (nome do serviço das camas). Vazio = escala geral. */
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(60)
  servico?: string;
}
