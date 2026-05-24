import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ComunicacaoService } from './comunicacao.service';

@UseGuards(JwtAuthGuard)
@Controller('comunicacao')
export class ComunicacaoController {
  constructor(private readonly service: ComunicacaoService) {}

  @Get('anuncios')
  listarAnuncios(@Request() req: any) {
    return this.service.listarAnuncios(req.user.servico);
  }

  @UseGuards(RolesGuard)
  @Roles('enfermeiro', 'medico', 'administrativo', 'direcao')
  @Post('anuncios')
  publicarAnuncio(@Body() dto: any, @Request() req: any) {
    return this.service.publicarAnuncio(dto, req.user.sub);
  }

  @Get('mensagens')
  inbox(@Request() req: any, @Query('page') page = '1') {
    return this.service.inbox(req.user.sub, parseInt(page));
  }

  @Get('mensagens/nao-lidas')
  contarNaoLidas(@Request() req: any) {
    return this.service.contarNaoLidas(req.user.sub);
  }

  @Get('mensagens/enviadas')
  enviadas(@Request() req: any, @Query('page') page = '1') {
    return this.service.enviadas(req.user.sub, parseInt(page));
  }

  @Post('mensagens')
  enviarMensagem(@Body() dto: any, @Request() req: any) {
    return this.service.enviarMensagem(dto, req.user.sub);
  }

  @Patch('mensagens/:id/lida')
  marcarLida(@Param('id') id: string, @Request() req: any) {
    return this.service.marcarLida(id, req.user.sub);
  }
}
