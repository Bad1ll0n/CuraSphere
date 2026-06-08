import {
  Controller, Get, Post, Delete, Param, Body, Query, UseGuards,
  UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { GuidelinesService } from './guidelines.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('guidelines')
export class GuidelinesController {
  constructor(private readonly service: GuidelinesService) {}

  @Get()
  @Roles('it_admin', 'direcao', 'medico', 'chefe_enfermeiros')
  listar(@Query('categoria') categoria?: string) {
    return this.service.listar(categoria);
  }

  @Post()
  @Roles('it_admin', 'direcao')
  criar(@Body() dto: { titulo: string; categoria: string; conteudo: string; fonte: string; versao?: string }) {
    return this.service.criar(dto);
  }

  @Post('upload-pdf')
  @Roles('it_admin', 'direcao')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 50 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (file.mimetype === 'application/pdf') cb(null, true);
        else cb(new BadRequestException('Apenas PDF permitido'), false);
      },
    }),
  )
  async uploadPdf(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { titulo: string; categoria: string; fonte: string },
  ) {
    if (!file) throw new BadRequestException('Ficheiro PDF obrigatório');
    // Validar magic bytes PDF: %PDF
    if (file.buffer[0] !== 0x25 || file.buffer[1] !== 0x50 || file.buffer[2] !== 0x44 || file.buffer[3] !== 0x46) {
      throw new BadRequestException('Conteúdo inválido — não é um PDF');
    }
    return this.service.uploadPdf(file.buffer, body.titulo, body.categoria, body.fonte);
  }

  @Post('reindexar')
  @Roles('it_admin', 'direcao')
  reindexar() {
    return this.service.reindexarTodos();
  }

  @Delete(':id')
  @Roles('it_admin', 'direcao')
  remover(@Param('id') id: string) {
    return this.service.remover(id);
  }
}
