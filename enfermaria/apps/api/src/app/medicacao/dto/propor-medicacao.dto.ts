import { IsString, IsOptional, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProporMedicacaoDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  doenteId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  nome: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  dose: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  via: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  frequencia: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  observacoes?: string;
}
