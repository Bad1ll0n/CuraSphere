import { IsString, IsOptional, IsNotEmpty, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CriarPedidoInternoDto {
  @ApiProperty({ enum: ['transporte', 'limpeza', 'manutencao', 'esterilizacao', 'roupa', 'outro'] })
  @IsIn(['transporte', 'limpeza', 'manutencao', 'esterilizacao', 'roupa', 'outro'])
  tipo: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  doenteId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  localOrigem?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  localDestino?: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  descricao: string;

  @ApiProperty({ enum: ['urgente', 'alta', 'media', 'baixa'] })
  @IsIn(['urgente', 'alta', 'media', 'baixa'])
  prioridade: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  servicoOrigem: string;
}
