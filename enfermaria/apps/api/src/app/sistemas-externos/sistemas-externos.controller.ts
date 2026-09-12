import {
  Controller, Get, Post, Patch, Delete, Param, Body, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { SistemasExternosService } from './sistemas-externos.service';
import { IsString, IsOptional, IsBoolean, IsUrl, MaxLength } from 'class-validator';

class CriarSistemaDto {
  @IsString() @MaxLength(200) nome: string;
  @IsString() @MaxLength(50) tipo: string;
  // SEC-05: o `endpoint` é o destino de um `fetch` feito pelo servidor. Só http/https, e
  // o IP resolvido é validado em `assertUrlDestinoPublico` (criação e cada disparo).
  @IsOptional() @IsUrl({ protocols: ['http', 'https'], require_protocol: true }) @MaxLength(500) endpoint?: string;
  @IsOptional() @IsString() @MaxLength(50) authTipo?: string;
  @IsOptional() @IsString() @MaxLength(2000) authConfig?: string;
  @IsOptional() @IsBoolean() ativo?: boolean;
}

/**
 * SEC-13 — mass assignment. `PATCH /sistemas-externos/:id` recebia
 * `@Body() dto: Partial<CriarSistemaDto>`. `Partial<T>` é um tipo puramente estrutural do
 * TypeScript: não existe em runtime, o metatype emitido é `Object` e a `ValidationPipe`
 * global (com `whitelist` + `forbidNonWhitelisted`) era desligada por completo neste
 * handler. O corpo seguia inteiro para `prisma.sistemaExternoSaude.update({ data })`,
 * pelo que qualquer coluna do modelo — incluindo as que o modelo venha a ganhar — era
 * gravável pelo cliente.
 *
 * A lista explícita abaixo é o allowlist; não voltar a usar `Partial<>` num `@Body()`.
 */
class AtualizarSistemaDto {
  @IsOptional() @IsString() @MaxLength(200) nome?: string;
  @IsOptional() @IsString() @MaxLength(50) tipo?: string;
  @IsOptional() @IsUrl({ protocols: ['http', 'https'], require_protocol: true }) @MaxLength(500) endpoint?: string;
  @IsOptional() @IsString() @MaxLength(50) authTipo?: string;
  @IsOptional() @IsString() @MaxLength(2000) authConfig?: string;
  @IsOptional() @IsBoolean() ativo?: boolean;
}

class IdentificadorDto {
  @IsString() @MaxLength(36) sistemaId: string;
  @IsString() @MaxLength(200) valorId: string;
  @IsString() @MaxLength(50) tipo: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('sistemas-externos')
export class SistemasExternosController {
  constructor(private readonly service: SistemasExternosService) {}

  @Get()
  @Roles('ti', 'direcao', 'medico', 'chefe_enfermeiros')
  listar() {
    return this.service.listar();
  }

  @Get(':id')
  @Roles('ti', 'direcao')
  obter(@Param('id') id: string) {
    return this.service.obter(id);
  }

  @Post()
  @Roles('ti', 'direcao')
  criar(@Body() dto: CriarSistemaDto) {
    return this.service.criar(dto);
  }

  @Patch(':id')
  @Roles('ti', 'direcao')
  atualizar(@Param('id') id: string, @Body() dto: AtualizarSistemaDto) {
    return this.service.atualizar(id, dto);
  }

  @Delete(':id')
  @Roles('ti', 'direcao')
  remover(@Param('id') id: string) {
    return this.service.remover(id);
  }

  @Post(':id/testar')
  @Roles('ti', 'direcao', 'medico')
  testar(@Param('id') id: string) {
    return this.service.testarConectividade(id);
  }

  @Get('doente/:doenteId/identificadores')
  @Roles('medico', 'enfermeiro', 'chefe_enfermeiros', 'ti')
  listarIdentificadores(@Param('doenteId') doenteId: string) {
    return this.service.listarIdentificadoresDoente(doenteId);
  }

  @Post('doente/:doenteId/identificadores')
  @Roles('medico', 'chefe_enfermeiros', 'ti')
  adicionarIdentificador(
    @Param('doenteId') doenteId: string,
    @Body() dto: IdentificadorDto,
  ) {
    return this.service.adicionarIdentificadorDoente(doenteId, dto.sistemaId, dto.valorId, dto.tipo);
  }
}
