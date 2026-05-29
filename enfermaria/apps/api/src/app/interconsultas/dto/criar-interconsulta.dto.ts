import { IsString, IsOptional, IsBoolean, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CriarInterconsultaDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  especialidadeAlvo: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  motivo: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  urgente?: boolean;
}
