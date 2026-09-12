import {
  Controller, Get, Post, Delete, Param, Body, UseGuards, Request,
  UseInterceptors, UploadedFile, BadRequestException, Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { DocumentosSaudeService } from './documentos-saude.service';
import { UploadDocumentoDto } from './dto/upload-documento.dto';

const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB
const TIPOS_PERMITIDOS = [
  'application/pdf',
  'image/jpeg', 'image/png',
  'application/dicom',
  'application/octet-stream',
];

async function validarMagicBytes(buffer: Buffer, mimetype: string): Promise<boolean> {
  if (buffer.length < 4) return false;
  switch (mimetype) {
    case 'image/jpeg':      return buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
    case 'image/png':       return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
    case 'application/pdf': return buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;
    case 'application/dicom': return buffer[128] === 0x44 && buffer[129] === 0x49 && buffer[130] === 0x43 && buffer[131] === 0x4D;
    default: return false;
  }
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('documentos-saude')
export class DocumentosSaudeController {
  constructor(private readonly service: DocumentosSaudeService) {}

  // S-01: as rotas por doente usavam `:id` e escapavam à verificação global de acesso (o
  // AcessoDoenteInterceptor procura `doenteId`): os documentos de saúde de qualquer doente
  // podiam ser listados, carregados e sincronizados. O URL é o mesmo.
  @Get('doente/:doenteId')
  @Roles('medico', 'enfermeiro', 'chefe_enfermeiros', 'farmaceutico', 'ti')
  listar(@Param('doenteId') doenteId: string, @Query('tipo') tipo?: string) {
    return this.service.listar(doenteId, tipo);
  }

  @Post('doente/:doenteId/upload')
  @Roles('medico', 'enfermeiro', 'tecnico_saude')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_SIZE_BYTES },
      fileFilter: (_req, file, cb) => {
        if (TIPOS_PERMITIDOS.includes(file.mimetype)) cb(null, true);
        else cb(new BadRequestException(`Tipo não permitido: ${file.mimetype}`), false);
      },
    }),
  )
  async upload(
    @Param('doenteId') doenteId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadDocumentoDto,
    @Request() req: any,
  ) {
    if (!file) throw new BadRequestException('Ficheiro obrigatório');
    const valido = await validarMagicBytes(file.buffer, file.mimetype);
    if (!valido) throw new BadRequestException('Conteúdo do ficheiro inválido');
    return this.service.upload(doenteId, file, dto, req.user.sub);
  }

  @Get(':id/download')
  @Roles('medico', 'enfermeiro', 'chefe_enfermeiros', 'farmaceutico', 'tecnico_saude')
  getDownloadUrl(@Param('id') docId: string, @Request() req: any) {
    return this.service.getDownloadUrl(docId, req.user.sub);
  }

  @Post('doente/:doenteId/sincronizar')
  @Roles('medico', 'enfermeiro', 'chefe_enfermeiros')
  sincronizar(@Param('doenteId') doenteId: string, @Request() req: any) {
    return this.service.sincronizar(doenteId, req.user.sub);
  }

  @Post(':id/assinar')
  @Roles('medico', 'chefe_enfermeiros', 'direcao')
  assinar(@Param('id') docId: string, @Request() req: any) {
    return this.service.assinar(docId, req.user.sub);
  }

  @Delete(':id')
  @Roles('medico', 'chefe_enfermeiros', 'ti')
  remover(@Param('id') docId: string, @Request() req: any) {
    return this.service.remover(docId, req.user.sub, req.user.role);
  }
}
