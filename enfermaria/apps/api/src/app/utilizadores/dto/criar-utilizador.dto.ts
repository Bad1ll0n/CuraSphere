import { IsString, IsNotEmpty, MinLength, Matches, IsEnum, IsOptional, IsInt, Min, IsIn } from 'class-validator';
import { ROLES, Servico } from '../../common/enums';

export class CriarUtilizadorDto {
  @IsString()
  @IsNotEmpty()
  numeroFuncionario!: string;

  @IsString()
  @IsNotEmpty()
  nome!: string;

  @IsString()
  @MinLength(10, { message: 'A password deve ter pelo menos 10 caracteres' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'A password deve conter pelo menos uma letra maiúscula, uma minúscula e um número',
  })
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
