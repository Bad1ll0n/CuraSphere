import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, Request, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ComunicacaoService } from './comunicacao.service';
import { CriarAnuncioDto } from './dto/criar-anuncio.dto';
import { EnviarMensagemDto } from './dto/enviar-mensagem.dto';
import { EnviarBroadcastDto } from './dto/enviar-broadcast.dto';

const UPLOAD_DIR = join(process.cwd(), 'uploads', 'mensagens');
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const TIPOS_PERMITIDOS = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
];

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
  publicarAnuncio(@Body() dto: CriarAnuncioDto, @Request() req: any) {
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
  enviarMensagem(@Body() dto: EnviarMensagemDto, @Request() req: any) {
    return this.service.enviarMensagem(dto, req.user.sub);
  }

  @Patch('mensagens/:id/lida')
  marcarLida(@Param('id') id: string, @Request() req: any) {
    return this.service.marcarLida(id, req.user.sub);
  }

  @UseGuards(RolesGuard)
  @Roles('medico', 'enfermeiro', 'administrativo', 'direcao')
  @Post('broadcast')
  enviarBroadcast(@Body() dto: EnviarBroadcastDto, @Request() req: any) {
    return this.service.enviarBroadcast(dto, req.user.sub);
  }

  @Post('mensagens/:id/anexo')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: UPLOAD_DIR,
      filename: (_req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, unique + extname(file.originalname));
      },
    }),
    limits: { fileSize: MAX_SIZE_BYTES },
    fileFilter: (_req, file, cb) => {
      if (TIPOS_PERMITIDOS.includes(file.mimetype)) cb(null, true);
      else cb(new BadRequestException(`Tipo de ficheiro não permitido: ${file.mimetype}`), false);
    },
  }))
  async adicionarAnexo(
    @Param('id') mensagemId: string,
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any,
  ) {
    if (!file) throw new BadRequestException('Ficheiro obrigatório');
    return this.service.adicionarAnexo(mensagemId, req.user.sub, {
      nome: file.originalname,
      url: `/uploads/mensagens/${file.filename}`,
      mimeType: file.mimetype,
      tamanho: file.size,
    });
  }
}
