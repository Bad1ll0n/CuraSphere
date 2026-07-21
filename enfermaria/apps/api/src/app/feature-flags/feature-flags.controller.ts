import { Controller, Get, Put, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { FeatureFlagsService } from './feature-flags.service';
import { UpsertFlagDto } from './dto/upsert-flag.dto';

@UseGuards(JwtAuthGuard)
@Controller('feature-flags')
export class FeatureFlagsController {
  constructor(private readonly flags: FeatureFlagsService) {}

  /** Flags resolvidas para o utilizador atual (consumido pelo hook do frontend). */
  @Get('me')
  me(@Request() req: any) {
    return this.flags.paraContexto({ userId: req.user.sub, role: req.user.role, servico: req.user.servico });
  }

  // ── Administração (ti/direção) ───────────────────────────────────────────────
  @UseGuards(RolesGuard)
  @Roles('ti', 'direcao')
  @Get()
  listar() {
    return this.flags.listar();
  }

  @UseGuards(RolesGuard)
  @Roles('ti', 'direcao')
  @Put(':key')
  upsert(@Param('key') key: string, @Body() dto: UpsertFlagDto, @Request() req: any) {
    return this.flags.upsert(key, dto, req.user.sub);
  }

  @UseGuards(RolesGuard)
  @Roles('ti', 'direcao')
  @Delete(':key')
  remover(@Param('key') key: string) {
    return this.flags.remover(key);
  }
}
