import { IsString, IsOptional, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CriarManutencaoDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  tipo: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  descricao: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  prioridade?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  observacoes?: string;
}
