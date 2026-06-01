import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, Request, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { open, unlink } from 'fs/promises';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ComunicacaoService } from './comunicacao.service';
import { CriarAnuncioDto } from './dto/criar-anuncio.dto';
import { EnviarMensagemDto } from './dto/enviar-mensagem.dto';
import { EnviarBroadcastDto } from './dto/enviar-broadcast.dto';

const UPLOAD_DIR = join(process.cwd(), 'uploads', 'mensagens');

async function validarMagicBytes(filePath: string, mimetype: string): Promise<boolean> {
  if (mimetype === 'text/plain') return true;
  const fd = await open(filePath, 'r');
  try {
    const buf = Buffer.alloc(8);
    await fd.read(buf, 0, 8, 0);
    switch (mimetype) {
      case 'image/jpeg':    return buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF;
      case 'image/png':     return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47;
      case 'image/gif':     return buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38;
      case 'image/webp':    return buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46;
      case 'application/pdf': return buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46;
      case 'application/msword': return buf[0] === 0xD0 && buf[1] === 0xCF && buf[2] === 0x11 && buf[3] === 0xE0;
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      case 'application/vnd.ms-excel': return buf[0] === 0x50 && buf[1] === 0x4B;
      default: return false;
    }
  } finally {
    await fd.close();
  }
}
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
        // Permitir só extensões alfanuméricas curtas (defesa contra `.php.jpg`, `.html`, etc.)
        const ext = extname(file.originalname).toLowerCase().match(/^\.[a-z0-9]{1,8}$/)?.[0] ?? '';
        cb(null, unique + ext);
      },
    }),
    limits: { fileSize: MAX_SIZE_BYTES, files: 1 },
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
    const valido = await validarMagicBytes(file.path, file.mimetype);
    if (!valido) {
      await unlink(file.path).catch(() => undefined);
      throw new BadRequestException('Conteúdo do ficheiro não corresponde ao tipo declarado');
    }
    // Sanitiza o nome original para nunca conter CRLF / control chars / path-separators
    const nomeOriginalSanitizado = file.originalname
      .replace(/[\r\n\t\u0000-\u001f\u007f]/g, '')
      .replace(/[\\/]/g, '_')
      .slice(0, 200);
    return this.service.adicionarAnexo(mensagemId, req.user.sub, {
      nome: nomeOriginalSanitizado,
      url: `/uploads/mensagens/${file.filename}`,
      mimeType: file.mimetype,
      tamanho: file.size,
    });
  }
}
