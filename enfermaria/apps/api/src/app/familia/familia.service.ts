import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IsEmail, IsString, MaxLength } from 'class-validator';

export class CriarAcessoFamiliarDto {
  @IsString()
  @MaxLength(150)
  nomeContacto: string;

  @IsEmail()
  email: string;
}

@Injectable()
export class FamiliaService {
  constructor(private readonly prisma: PrismaService) {}

  async criarAcesso(doenteId: string, dto: CriarAcessoFamiliarDto, criadoPorId: string) {
    const doente = await this.prisma.doente.findUnique({ where: { id: doenteId }, select: { id: true, nome: true } });
    if (!doente) throw new NotFoundException(`Doente (ID ${doenteId}) não encontrado`);

    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 7); // válido 7 dias

    return this.prisma.acessoFamiliar.create({
      data: {
        doenteId,
        criadoPorId,
        nomeContacto: dto.nomeContacto,
        email: dto.email,
        accessTokenExpiry: expiry,
      },
      select: {
        id: true, nomeContacto: true, email: true, accessToken: true, accessTokenExpiry: true, ativo: true,
        doente: { select: { nome: true } },
      },
    });
  }

  async portalDoente(token: string) {
    const acesso = await this.prisma.acessoFamiliar.findUnique({
      where: { accessToken: token },
      include: {
        doente: {
          select: {
            id: true, nome: true, dataAdmissao: true,
            cama: { select: { numero: true, quarto: true, servico: true } },
            sinaisVitais: {
              orderBy: { data: 'desc' },
              take: 1,
              select: { data: true, news2: true },
            },
            alertasClinicos: {
              where: { lido: false, urgencia: false },
              select: { mensagem: true },
              take: 3,
            },
          },
        },
      },
    });

    if (!acesso) throw new NotFoundException('Acesso não encontrado ou token inválido');
    if (!acesso.ativo) throw new ForbiddenException('Acesso familiar revogado');
    if (new Date() > acesso.accessTokenExpiry) throw new ForbiddenException('Acesso familiar expirado');

    const doente = (acesso as any).doente;
    const sv = doente?.sinaisVitais?.[0];

    // Estado simplificado sem dados clínicos detalhados
    const news2 = sv?.news2 ?? null;
    const estadoGeral = news2 == null ? 'estável'
      : news2 <= 2 ? 'estável'
      : news2 <= 4 ? 'sob observação'
      : 'a ser acompanhado de perto';

    return {
      nomeContacto: acesso.nomeContacto,
      doente: {
        nome: doente.nome,
        internamentoDesde: doente.dataAdmissao,
        servico: doente.servico,
        estadoGeral,
        ultimaAvaliacao: sv?.data ?? null,
      },
    };
  }

  async listarAcessos(doenteId: string) {
    return this.prisma.acessoFamiliar.findMany({
      where: { doenteId },
      select: { id: true, nomeContacto: true, email: true, ativo: true, criadoEm: true, accessTokenExpiry: true },
      orderBy: { criadoEm: 'desc' },
    });
  }

  async revogarAcesso(id: string) {
    const acesso = await this.prisma.acessoFamiliar.findUnique({ where: { id } });
    if (!acesso) throw new NotFoundException('Acesso não encontrado');
    return this.prisma.acessoFamiliar.update({ where: { id }, data: { ativo: false } });
  }
}
