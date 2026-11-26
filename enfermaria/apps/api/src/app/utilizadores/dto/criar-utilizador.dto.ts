import { IsString, IsNotEmpty, MinLength, MaxLength, IsEnum, IsOptional, IsInt, Min, IsIn } from 'class-validator';
import { ROLES, Servico } from '../../common/infra/enums';

export class CriarUtilizadorDto {
  @IsString()
  @IsNotEmpty()
  numeroFuncionario!: string;

  @IsString()
  @IsNotEmpty()
  nome!: string;

  @IsString()
  // SEC-25: comprimento e não composição (NIST 800-63B); comuns e dados pessoais no serviço.
  @MinLength(12, { message: 'A password deve ter pelo menos 12 caracteres (uma frase curta serve)' })
  @MaxLength(64, { message: 'A password deve ter no máximo 64 caracteres' })
  password!: string;

  // SEC-03: só papéis conhecidos — um papel inventado passava a validação e ficava na BD.
  @IsIn(Object.values(ROLES), { message: 'Role inválida' })
  role!: string;

  @IsOptional()
  @IsString()
  subRole?: string;

  @IsOptional()
  @IsEnum(Servico)
  servico?: Servico;

  @IsOptional()
  @IsInt()
  @Min(1)
  ordemExperiencia?: number;
}
