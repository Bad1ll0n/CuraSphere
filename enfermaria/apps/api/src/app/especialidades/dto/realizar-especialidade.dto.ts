import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class RealizarEspecialidadeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  evolucao: string;
}
