import { IsString, IsOptional, IsNumber, IsEnum, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum MetodoPagamentoEnum {
  numerario = 'numerario',
  cartao = 'cartao',
  transferencia = 'transferencia',
  cheque = 'cheque',
  mbway = 'mbway',
  seguro = 'seguro',
}

export class RegistarPagamentoDto {
  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  valor: number;

  @ApiProperty({ enum: MetodoPagamentoEnum })
  @IsEnum(MetodoPagamentoEnum)
  metodo: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  referencia?: string;
}
