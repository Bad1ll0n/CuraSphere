import {
  Controller, Get, Post, Delete, Body, Param, UseGuards, Request,
  UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { DoenteService } from '../doentes/doentes.service';
import { FeridasService } from './feridas.service';
import { CriarAvaliacaoFerida } from './dto/criar-avaliacao-ferida.dto';

const TIPOS_FOTO = ['image/jpeg', 'image/png'];

async function validarMagicBytesFoto(buffer: Buffer, mimetype: string): Promise<boolean> {
  if (buffer.length < 4) return false;
  if (mimetype === 'image/jpeg') return buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
  if (mimetype === 'image/png')  return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
  return false;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('feridas')
export class FeridasController {
  constructor(
    private readonly service: FeridasService,
    private readonly doenteService: DoenteService,
  ) {}

  @Roles('medico', 'enfermeiro', 'auxiliar', 'tecnico_saude', 'chefe_turno', 'chefe_enfermeiros')
  @Post(':doenteId')
  async criar(
    @Param('doenteId') doenteId: string,
    @Body() dto: CriarAvaliacaoFerida,
    @Request() req: any,
  ) {
    await this.doenteService.assertAcessoDoente(req.user.sub, req.user.role, doenteId);
    return this.service.criar(doenteId, dto, req.user.sub, req.user.role);
  }

  @Get(':doenteId')
  async listar(@Param('doenteId') doenteId: string, @Request() req: any) {
    await this.doenteService.assertAcessoDoente(req.user.sub, req.user.role, doenteId);
    return this.service.listar(doenteId);
  }

  @Get(':doenteId/ultima')
  async buscarUltima(@Param('doenteId') doenteId: string, @Request() req: any) {
    await this.doenteService.assertAcessoDoente(req.user.sub, req.user.role, doenteId);
    return this.service.buscarUltima(doenteId);
  }

  @Roles('medico', 'enfermeiro', 'auxiliar', 'tecnico_saude', 'chefe_turno', 'chefe_enfermeiros')
  @Post(':avaliacaoId/fotos')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (TIPOS_FOTO.includes(file.mimetype)) cb(null, true);
        else cb(new BadRequestException(`Tipo não permitido: ${file.mimetype}`), false);
      },
    }),
  )
  async adicionarFoto(
    @Param('avaliacaoId') avaliacaoId: string,
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any,
  ) {
    if (!file) throw new BadRequestException('Ficheiro obrigatório');
    const valido = await validarMagicBytesFoto(file.buffer, file.mimetype);
    if (!valido) throw new BadRequestException('Conteúdo do ficheiro inválido');
    return this.service.adicionarFoto(avaliacaoId, file.buffer, file.mimetype, req.user.sub);
  }

  @Get(':avaliacaoId/fotos')
  listarFotos(@Param('avaliacaoId') avaliacaoId: string) {
    return this.service.listarFotos(avaliacaoId);
  }

  @Roles('medico', 'enfermeiro', 'chefe_enfermeiros')
  @Post(':avaliacaoId/fotos/:fotoId/analisar')
  analisarFoto(
    @Param('avaliacaoId') avaliacaoId: string,
    @Param('fotoId') fotoId: string,
    @Request() req: any,
  ) {
    return this.service.analisarFoto(fotoId, avaliacaoId, req.user.sub);
  }

  @Roles('medico', 'enfermeiro', 'auxiliar', 'tecnico_saude', 'chefe_turno', 'chefe_enfermeiros')
  @Delete('fotos/:fotoId')
  removerFoto(@Param('fotoId') fotoId: string, @Request() req: any) {
    return this.service.removerFoto(fotoId, req.user.sub, req.user.role);
  }

  @Roles('medico', 'enfermeiro', 'auxiliar', 'tecnico_saude', 'chefe_turno', 'chefe_enfermeiros')
  @Delete(':id')
  apagar(@Param('id') id: string, @Request() req: any) {
    return this.service.apagar(id, req.user.sub, req.user.role);
  }
}
