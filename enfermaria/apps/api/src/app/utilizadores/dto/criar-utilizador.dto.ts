import { IsString, IsNotEmpty, MinLength, Matches, IsEnum, IsOptional, IsInt, Min } from 'class-validator';
import { Role, SubRole, Servico } from '../../common/enums';

export class CriarUtilizadorDto {
  @IsString()
  @IsNotEmpty()
  numeroFuncionario: string;

  @IsString()
  @IsNotEmpty()
  nome: string;

  @IsString()
  @MinLength(10, { message: 'A password deve ter pelo menos 10 caracteres' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'A password deve conter pelo menos uma letra maiúscula, uma minúscula e um número',
  })
  password: string;

  @IsEnum(Role)
  role: Role;

  @IsOptional()
  @IsEnum(SubRole)
  subRole?: SubRole;

  @IsOptional()
  @IsEnum(Servico)
  servico?: Servico;

  @IsOptional()
  @IsInt()
  @Min(1)
  ordemExperiencia?: number;
}
