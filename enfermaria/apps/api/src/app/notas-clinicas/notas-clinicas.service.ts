import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const { authenticator } = require('otplib') as any;
import { PrismaService } from '../prisma/prisma.service';

// `direcao` foi deliberadamente removido destas listas: é um papel de gestão, não clínico,
// e não deve poder editar nem apagar a nota clínica de um médico. Continua a ter leitura
// (oversight) pelo `assertAcessoDoente`, que é onde essa permissão pertence.
const ROLES_SUPERVISAO_EDICAO = ['chefe_medicos', 'chefe_enfermeiros'];
const ROLES_SUPERVISAO_APAGAR = ['chefe_medicos'];
const ROLES_PODEM_ADENDAR = ['medico', 'enfermeiro', 'chefe_medicos', 'chefe_enfermeiros'];

@Injectable()
export class NotasClinicasService {
  constructor(private readonly prisma: PrismaService) {}

  async criar(doenteId: string, dto: {
    subjetivo: string; objetivo: string; avaliacao: string; plano: string;
  }, autorId: string) {
    await this.buscarDoente(doenteId);
    return this.prisma.notaClinica.create({
      data: { doenteId, autorId, ...dto },
      include: { autor: { select: { id: true, nome: true, role: true, subRole: true } } },
    });
  }

  async listar(doenteId: string) {
    await this.buscarDoente(doenteId);
    return this.prisma.notaClinica.findMany({
      where: { doenteId, deletedAt: null },
      orderBy: { criadaEm: 'desc' },
      include: {
        autor: { select: { id: true, nome: true, role: true, subRole: true } },
        // Uma nota assinada só pode ser corrigida por adenda — lê-se sempre com elas.
        adendas: {
          orderBy: { criadaEm: 'asc' },
          include: { autor: { select: { id: true, nome: true, role: true, subRole: true } } },
        },
      },
    });
  }

  async atualizar(id: string, utilizadorId: string, role: string, dto: {
    subjetivo?: string; objetivo?: string; avaliacao?: string; plano?: string;
  }) {
    const nota = await this.buscarNota(id);
    // Uma nota assinada é um registo legal fechado: não se reescreve, acrescenta-se adenda.
    if (nota.assinadaEm) {
      throw new ForbiddenException(
        'Nota já assinada — o conteúdo é imutável. Registe uma adenda para corrigir ou acrescentar.',
      );
    }
    const podeEditar = nota.autorId === utilizadorId || ROLES_SUPERVISAO_EDICAO.includes(role);
    if (!podeEditar) throw new ForbiddenException('Só o autor pode editar esta nota');
    return this.prisma.notaClinica.update({
      where: { id },
      data: { ...dto, editadaEm: new Date() },
      include: { autor: { select: { id: true, nome: true, role: true, subRole: true } } },
    });
  }

  async apagar(id: string, utilizadorId: string, role: string) {
    const nota = await this.buscarNota(id);
    if (nota.assinadaEm) {
      throw new ForbiddenException(
        'Nota já assinada — não pode ser apagada. Registe uma adenda a anular o conteúdo.',
      );
    }
    const podeApagar = nota.autorId === utilizadorId || ROLES_SUPERVISAO_APAGAR.includes(role);
    if (!podeApagar) throw new ForbiddenException('Só o autor pode apagar esta nota');
    return this.prisma.notaClinica.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  /**
   * Adenda a uma nota **assinada** — append-only, com autor, momento e motivo.
   * É o único caminho para corrigir ou acrescentar depois da assinatura.
   */
  async criarAdenda(
    notaId: string,
    autorId: string,
    role: string,
    dto: { texto: string; motivo: string },
  ) {
    if (!ROLES_PODEM_ADENDAR.includes(role)) {
      throw new ForbiddenException('Sem permissão para registar adendas a notas clínicas');
    }
    const nota = await this.buscarNota(notaId);
    if (nota.deletedAt) throw new NotFoundException(`Nota clínica (ID ${notaId}) não encontrada`);
    if (!nota.assinadaEm) {
      throw new BadRequestException('Nota ainda não assinada — editar a nota directamente');
    }

    const texto = dto.texto?.trim() ?? '';
    const motivo = dto.motivo?.trim() ?? '';
    if (texto.length < 10) throw new BadRequestException('Texto da adenda demasiado curto (mínimo 10 caracteres)');
    if (motivo.length < 5) throw new BadRequestException('Motivo da adenda obrigatório (mínimo 5 caracteres)');

    return this.prisma.notaClinicaAdenda.create({
      data: { notaClinicaId: notaId, autorId, texto, motivo },
      include: { autor: { select: { id: true, nome: true, role: true, subRole: true } } },
    });
  }

  async listarAdendas(notaId: string) {
    await this.buscarNota(notaId);
    return this.prisma.notaClinicaAdenda.findMany({
      where: { notaClinicaId: notaId },
      orderBy: { criadaEm: 'asc' },
      include: { autor: { select: { id: true, nome: true, role: true, subRole: true } } },
    });
  }

  /** Resolve o doente de uma nota — para o guard de acesso no controlador. */
  async doenteIdDaNota(notaId: string): Promise<string> {
    const nota = await this.buscarNota(notaId);
    return nota.doenteId;
  }

  private async buscarDoente(id: string) {
    const d = await this.prisma.doente.findUnique({ where: { id } });
    if (!d) throw new NotFoundException(`Doente (ID ${id}) não encontrado`);
    return d;
  }

  async assinar(notaId: string, utilizadorId: string, totpCode: string) {
    const utilizador = await this.prisma.utilizador.findUnique({ where: { id: utilizadorId } });
    if (!utilizador) throw new NotFoundException('Utilizador não encontrado');
    if (!utilizador.mfaAtivo || !utilizador.mfaSecret) {
      throw new ForbiddenException('MFA não configurado. Configure o autenticador antes de assinar.');
    }

    const valido = authenticator.verify({ token: totpCode, secret: utilizador.mfaSecret });
    if (!valido) throw new ForbiddenException('Código TOTP inválido');

    const nota = await this.buscarNota(notaId);
    if (nota.deletedAt) throw new NotFoundException(`Nota clínica (ID ${notaId}) não encontrada`);
    if (nota.assinadaEm) throw new BadRequestException('Nota já assinada');

    return this.prisma.notaClinica.update({
      where: { id: notaId },
      data: { assinadaEm: new Date(), assinadaPorId: utilizadorId },
      select: { id: true, assinadaEm: true, assinadaPor: { select: { id: true, nome: true } } },
    });
  }

  private async buscarNota(id: string) {
    const n = await this.prisma.notaClinica.findUnique({ where: { id } });
    if (!n) throw new NotFoundException(`Nota clínica (ID ${id}) não encontrada`);
    return n;
  }
}
