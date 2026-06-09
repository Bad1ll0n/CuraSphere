import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../common/storage.service';
import { FhirService } from '../fhir/fhir.service';
import { UploadDocumentoDto } from './dto/upload-documento.dto';
import { createHash, randomUUID } from 'crypto';

@Injectable()
export class DocumentosSaudeService {
  private readonly logger = new Logger(DocumentosSaudeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly fhir: FhirService,
  ) {}

  async listar(doenteId: string, tipo?: string) {
    return this.prisma.documentoSaude.findMany({
      where: { doenteId, ...(tipo ? { tipo } : {}) },
      orderBy: { dataDocumento: 'desc' },
      include: {
        registadoPor: { select: { id: true, nome: true } },
        sistemaOrigem: { select: { id: true, nome: true, tipo: true } },
      },
    });
  }

  async upload(
    doenteId: string,
    file: Express.Multer.File,
    dto: UploadDocumentoDto,
    userId: string,
  ) {
    const doente = await this.prisma.doente.findUnique({ where: { id: doenteId } });
    if (!doente) throw new NotFoundException('Doente não encontrado');

    const ext = file.originalname.includes('.') ? '.' + file.originalname.split('.').pop()!.toLowerCase() : '';
    const key = `documentos/${doenteId}/${randomUUID()}${ext}`;

    await this.storage.upload(file.buffer, key, file.mimetype);

    const formato = this.mimeToFormato(file.mimetype, ext);

    return this.prisma.documentoSaude.create({
      data: {
        doenteId,
        tipo: dto.tipo,
        titulo: dto.titulo,
        descricao: dto.descricao,
        dataDocumento: new Date(dto.dataDocumento),
        origem: dto.origem ?? 'Upload manual',
        formato,
        storageKey: key,
        mimeType: file.mimetype,
        tamanhoBytes: file.size,
        modalidadeDicom: dto.modalidadeDicom,
        verificado: false,
        registadoPorId: userId,
      },
    });
  }

  async getDownloadUrl(docId: string, _userId: string) {
    const doc = await this.prisma.documentoSaude.findUnique({ where: { id: docId } });
    if (!doc) throw new NotFoundException('Documento não encontrado');

    if (doc.storageKey) {
      const url = await this.storage.getSignedUrl(doc.storageKey, 3600);
      return { url, tipo: doc.tipo, mimeType: doc.mimeType, titulo: doc.titulo };
    }

    if (doc.urlExterna) {
      return { url: doc.urlExterna, tipo: doc.tipo, mimeType: doc.mimeType, titulo: doc.titulo };
    }

    throw new NotFoundException('Documento sem ficheiro associado');
  }

  async sincronizar(doenteId: string, _userId: string) {
    const doente = await this.prisma.doente.findUnique({
      where: { id: doenteId },
      include: { identificadoresExternos: true },
    });
    if (!doente) throw new NotFoundException('Doente não encontrado');

    const sistemas = await this.prisma.sistemaExternoSaude.findMany({
      where: { ativo: true, tipo: 'fhir_r4' },
    });

    let novos = 0;

    for (const sistema of sistemas) {
      if (!sistema.endpoint) continue;

      const idExterno = doente.identificadoresExternos.find(
        (i) => i.sistema === sistema.id || i.sistema === sistema.nome,
      );
      if (!idExterno) continue;

      try {
        const docs = await this.fhir.pullDocumentosDoente(sistema as any, idExterno.valorId);
        for (const doc of docs) {
          const existe = doc.fhirResourceId
            ? await this.prisma.documentoSaude.findFirst({ where: { fhirResourceId: doc.fhirResourceId } })
            : null;

          if (!existe) {
            await this.prisma.documentoSaude.create({
              data: {
                doenteId,
                tipo: doc.tipo,
                titulo: doc.titulo,
                dataDocumento: doc.dataDocumento,
                origem: doc.origem ?? sistema.nome,
                sistemaOrigemId: sistema.id,
                formato: doc.formato,
                urlExterna: doc.urlExterna,
                mimeType: doc.mimeType,
                fhirResourceId: doc.fhirResourceId,
              },
            });
            novos++;
          }
        }

        await this.prisma.sistemaExternoSaude.update({
          where: { id: sistema.id },
          data: { ultimaSincronizacao: new Date() },
        });
      } catch (e: any) {
        this.logger.warn(`Sync FHIR failed for sistema ${sistema.nome}: ${e.message}`);
      }
    }

    return { novos, mensagem: `Sincronização concluída. ${novos} novo(s) documento(s).` };
  }

  async assinar(docId: string, userId: string) {
    const doc = await this.prisma.documentoSaude.findUnique({ where: { id: docId } });
    if (!doc) throw new NotFoundException('Documento não encontrado');
    if (doc.assinadoEm) throw new ForbiddenException('Documento já foi assinado');

    let hashSHA256: string | null = null;
    if (doc.storageKey) {
      const buffer = await this.storage.getBuffer(doc.storageKey);
      if (buffer) {
        hashSHA256 = createHash('sha256').update(buffer).digest('hex');
      }
    }

    const updated = await this.prisma.documentoSaude.update({
      where: { id: docId },
      data: { assinadoEm: new Date(), assinadoPorId: userId, hashSHA256, verificado: true },
      include: { assinadoPor: { select: { id: true, nome: true } } },
    });

    await (this.prisma as any).auditLog.create({
      data: {
        utilizadorId: userId,
        acao: 'assinar_documento',
        entidade: 'DocumentoSaude',
        entidadeId: docId,
        detalhes: { hashSHA256 },
      },
    });

    return updated;
  }

  async remover(docId: string, userId: string, role: string) {
    const doc = await this.prisma.documentoSaude.findUnique({ where: { id: docId } });
    if (!doc) throw new NotFoundException('Documento não encontrado');

    const podeApagar = ['medico', 'chefe_enfermeiros', 'it_admin'].includes(role);
    if (!podeApagar) throw new ForbiddenException('Sem permissão para apagar documentos');

    if (doc.storageKey) {
      await this.storage.delete(doc.storageKey);
    }

    await this.prisma.documentoSaude.delete({ where: { id: docId } });
    return { sucesso: true };
  }

  private mimeToFormato(mime: string, ext: string): string {
    if (mime === 'application/pdf') return 'pdf';
    if (mime === 'application/dicom' || ext === '.dcm') return 'dicom';
    if (mime === 'image/jpeg') return 'jpg';
    if (mime === 'image/png') return 'png';
    if (mime === 'application/fhir+json') return 'fhir_json';
    if (mime?.includes('hl7')) return 'hl7';
    return 'outro';
  }
}
