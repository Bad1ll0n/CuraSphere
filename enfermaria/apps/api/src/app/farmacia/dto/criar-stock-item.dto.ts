import { IsString, IsOptional, IsNumber, IsNotEmpty, IsIn, IsDateString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CriarStockItemDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  nome: string;

  @ApiProperty({ enum: ['medicamento', 'dispositivo_medico', 'consumivel', 'reagente', 'outro'] })
  @IsIn(['medicamento', 'dispositivo_medico', 'consumivel', 'reagente', 'outro'])
  tipo: string;

  @ApiProperty({ minimum: 0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  quantidade: number;

  @ApiProperty({ minimum: 0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  quantidadeMinima: number;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  unidade: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  validade?: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  servico: string;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  precoUnitario?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  catalogoId?: string;
}
