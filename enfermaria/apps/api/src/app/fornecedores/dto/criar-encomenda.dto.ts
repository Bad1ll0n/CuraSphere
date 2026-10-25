import { IsString, IsOptional, IsNumber, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CriarEncomendaDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  fornecedorId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  stockItemId: string;

  @ApiProperty()
  @IsNumber()
  quantidadeEncomendada: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  precoUnitario?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  dataEntregaPrevista?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  observacoes?: string;
}
