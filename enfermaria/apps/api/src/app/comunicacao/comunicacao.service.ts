import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const PAGE_SIZE = 20;

@Injectable()
export class ComunicacaoService {
  constructor(private readonly prisma: PrismaService) {}

  async listarAnuncios(servico: string) {
    const agora = new Date();
    return this.prisma.anuncio.findMany({
      where: { ativo: true, OR: [{ servico: null }, { servico }], AND: [{ OR: [{ expiraEm: null }, { expiraEm: { gt: agora } }] }] },
      orderBy: { criadoEm: 'desc' },
      include: { autor: { select: { id: true, nome: true, role: true } } },
    });
  }

  async publicarAnuncio(dto: { titulo: string; texto: string; servico?: string; expiraEm?: string }, autorId: string) {
    return this.prisma.anuncio.create({
      data: { titulo: dto.titulo, texto: dto.texto, servico: dto.servico ?? null, expiraEm: dto.expiraEm ? new Date(dto.expiraEm) : null, autorId },
      include: { autor: { select: { id: true, nome: true } } },
    });
  }

  async inbox(utilizadorId: string, page = 1) {
    const skip = (page - 1) * PAGE_SIZE;
    const where = { destinatarioId: utilizadorId };
    const [total, mensagens] = await Promise.all([
      this.prisma.mensagemInterna.count({ where }),
      this.prisma.mensagemInterna.findMany({
        where,
        orderBy: { criadaEm: 'desc' },
        take: PAGE_SIZE,
        skip,
        include: {
          remetente: { select: { id: true, nome: true, role: true, servico: true } },
          anexos: { select: { id: true, nome: true, url: true, mimeType: true, tamanho: true } },
        },
      }),
    ]);
    return { total, pagina: page, totalPaginas: Math.ceil(total / PAGE_SIZE), mensagens };
  }

  async enviadas(utilizadorId: string, page = 1) {
    const skip = (page - 1) * PAGE_SIZE;
    const where = { remetenteId: utilizadorId };
    const [total, mensagens] = await Promise.all([
      this.prisma.mensagemInterna.count({ where }),
      this.prisma.mensagemInterna.findMany({
        where,
        orderBy: { criadaEm: 'desc' },
        take: PAGE_SIZE,
        skip,
        include: {
          destinatario: { select: { id: true, nome: true, role: true, servico: true } },
          anexos: { select: { id: true, nome: true, url: true, mimeType: true, tamanho: true } },
        },
      }),
    ]);
    return { total, pagina: page, totalPaginas: Math.ceil(total / PAGE_SIZE), mensagens };
  }

  async enviarMensagem(dto: { destinatarioId: string; assunto?: string; texto: string }, remetenteId: string) {
    const dest = await this.prisma.utilizador.findUnique({ where: { id: dto.destinatarioId } });
    if (!dest) throw new NotFoundException(`Destinatário (ID ${dto.destinatarioId}) não encontrado`);
    return this.prisma.mensagemInterna.create({
      data: { remetenteId, destinatarioId: dto.destinatarioId, assunto: dto.assunto ?? null, texto: dto.texto },
      include: { remetente: { select: { id: true, nome: true } }, destinatario: { select: { id: true, nome: true } } },
    });
  }

  async marcarLida(id: string, utilizadorId: string) {
    return this.prisma.mensagemInterna.updateMany({ where: { id, destinatarioId: utilizadorId }, data: { lida: true } });
  }

  async contarNaoLidas(utilizadorId: string) {
    const count = await this.prisma.mensagemInterna.count({ where: { destinatarioId: utilizadorId, lida: false } });
    return { naoLidas: count };
  }

  async enviarBroadcast(dto: {
    servicoAlvo?: string;
    roleAlvo?: string;
    assunto?: string;
    texto: string;
  }, remetenteId: string) {
    const where: any = { ativo: true, id: { not: remetenteId } };
    if (dto.servicoAlvo) where.servico = dto.servicoAlvo;
    if (dto.roleAlvo)    where.role = dto.roleAlvo;

    const destinatarios = await this.prisma.utilizador.findMany({ where, select: { id: true } });
    if (destinatarios.length === 0) throw new NotFoundException('Nenhum utilizador encontrado para os critérios seleccionados');

    await this.prisma.mensagemInterna.createMany({
      data: destinatarios.map(d => ({
        remetenteId,
        destinatarioId: d.id,
        assunto: dto.assunto ?? null,
        texto: dto.texto,
      })),
    });
    return { enviadas: destinatarios.length };
  }

  async adicionarAnexo(
    mensagemId: string,
    utilizadorId: string,
    file: { nome: string; url: string; mimeType: string; tamanho: number },
  ) {
    const mensagem = await this.prisma.mensagemInterna.findUnique({ where: { id: mensagemId } });
    if (!mensagem) throw new NotFoundException(`Mensagem (ID ${mensagemId}) não encontrada`);
    if (mensagem.remetenteId !== utilizadorId) throw new ForbiddenException('Sem permissão para adicionar anexo a esta mensagem');

    return this.prisma.anexoMensagem.create({
      data: { mensagemId, ...file },
    });
  }
}
