import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface AuditParams {
  utilizadorId: string;
  acao: string;
  entidadeId?: string;
  entidadeTipo?: string;
  detalhes?: string;
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  registar(params: AuditParams): void {
    // fire-and-forget — não bloqueia a resposta
    this.prisma.auditLog
      .create({ data: params })
      .catch(() => { /* silencioso — audit não deve quebrar o fluxo */ });
  }
}
