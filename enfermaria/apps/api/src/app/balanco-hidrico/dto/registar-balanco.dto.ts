import { IsEnum, IsInt, IsOptional, IsString, IsDateString, MaxLength, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegistarBalancoDto {
  @ApiProperty({ enum: ['entrada', 'saida'] })
  @IsEnum(['entrada', 'saida'])
  tipo: string;

  @ApiProperty({
    enum: ['soro_iv', 'oral', 'enteral', 'outro', 'urina', 'dreno', 'vomito', 'fezes', 'aspiracao'],
  })
  @IsEnum(['soro_iv', 'oral', 'enteral', 'outro', 'urina', 'dreno', 'vomito', 'fezes', 'aspiracao'])
  categoria: string;

  @ApiProperty({ description: 'Quantidade em mL' })
  @IsInt()
  @Min(1)
  @Max(10000)
  quantidade: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  descricao?: string;

  @ApiPropertyOptional({ description: 'Data/hora do registo (retroactivo). Omitir para usar agora.' })
  @IsOptional()
  @IsDateString()
  data?: string;
}
