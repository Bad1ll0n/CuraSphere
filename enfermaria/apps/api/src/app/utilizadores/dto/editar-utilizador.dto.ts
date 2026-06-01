import { IsString, IsOptional, IsInt, IsIn, ValidateIf, IsUUID, Min, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ROLES, Servico } from '../../common/enums';

const ROLES_PERMITIDAS = Object.values(ROLES);
const SERVICOS_PERMITIDOS = Object.values(Servico);

/**
 * DTO de edição de utilizador.
 * Combinado com `whitelist + forbidNonWhitelisted` da ValidationPipe global,
 * impede mass-assignment de campos sensíveis (passwordHash, mfaSecret, ativo, etc).
 * Endpoint protegido por `Roles('ti') + SubRoles('it_admin')`.
 */
export class EditarUtilizadorDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  nome?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  ordemExperiencia?: number;

  @ApiPropertyOptional({ enum: ROLES_PERMITIDAS })
  @IsOptional()
  @IsIn(ROLES_PERMITIDAS, { message: 'Role inválida' })
  role?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(64)
  subRole?: string | null;

  @ApiPropertyOptional({ enum: SERVICOS_PERMITIDOS })
  @IsOptional()
  @IsIn(SERVICOS_PERMITIDOS, { message: 'Serviço inválido' })
  servico?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  equipa?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsUUID()
  chefeId?: string | null;
}
