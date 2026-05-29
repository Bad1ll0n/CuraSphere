import { IsString, IsOptional, IsNumber, IsNotEmpty, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CriarPedidoFarmaciaDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  stockItemId: string;

  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  quantidade: number;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  servico: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  observacoes?: string;
}
