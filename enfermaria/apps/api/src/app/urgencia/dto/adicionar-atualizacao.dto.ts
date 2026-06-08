import { IsString, IsOptional, IsInt, Min, Max, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AdicionarAtualizacaoDto {
  @ApiProperty()
  @IsString()
  @MaxLength(1000)
  texto!: string;

  @ApiPropertyOptional({ description: 'Nova ETA em minutos (substitui a anterior)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(120)
  novaETA?: number;
}
