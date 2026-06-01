import { IsString, IsNotEmpty, IsOptional, IsIn, MaxLength, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const TIPOS_SENHA = ['consulta', 'urgencia', 'admissao', 'farmacia', 'administrativo', 'exames'];
const PRIORIDADES = ['normal', 'prioritario', 'urgente'];

export class TirarSenhaDto {
  @ApiProperty()
  @IsString()
  @IsIn(TIPOS_SENHA)
  tipo: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsIn(PRIORIDADES)
  prioridade?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nomeUtente?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9\s\-]{9,15}$/, { message: 'Telefone inválido' })
  telefone?: string;
}
