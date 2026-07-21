import { IsString, IsOptional, IsIn, MaxLength } from 'class-validator';

export class AdicionarListaEsperaDto {
  @IsString() @MaxLength(120) especialidade: string;
  @IsOptional() @IsString() doenteId?: string;
  @IsOptional() @IsString() @MaxLength(200) nomeDoente?: string;
  @IsOptional() @IsString() medicoId?: string;
  @IsOptional() @IsIn(['urgente', 'alta', 'normal']) prioridade?: string;
  @IsOptional() @IsString() @MaxLength(40) contactoTelefone?: string;
  @IsOptional() @IsString() @MaxLength(500) notas?: string;
}

export class AtualizarListaEsperaDto {
  @IsIn(['em_espera', 'contactado', 'agendado', 'cancelado']) estado: string;
}
