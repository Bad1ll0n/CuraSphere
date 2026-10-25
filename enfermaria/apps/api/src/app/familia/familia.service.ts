import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { gerarTokenFamilia, hashTokenFamilia } from './token-familia';
import { IsEmail, IsString, MaxLength } from 'class-validator';

export class CriarAcessoFamiliarDto {
  @IsString()
  @MaxLength(150)
  nomeContacto: string;

  @IsEmail()
  email: string;
}

// Um token nosso tem 43 caracteres (32 bytes em base64url). Ver token-familia.ts (S-15).
const TAMANHO_MAXIMO_TOKEN = 128;

@Injectable()
export class FamiliaService {
  constructor(private readonly prisma: PrismaService) {}

  async criarAcesso(doenteId: string, dto: CriarAcessoFamiliarDto, criadoPorId: string) {
    const doente = await this.prisma.doente.findUnique({ where: { id: doenteId }, select: { id: true, nome: true } });
    if (!doente) throw new NotFoundException(`Doente (ID ${doenteId}) não encontrado`);

    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 7); // válido 7 dias

    const token = gerarTokenFamilia();

    const acesso = await this.prisma.acessoFamiliar.create({
      data: {
        doenteId,
        criadoPorId,
        nomeContacto: dto.nomeContacto,
        email: dto.email,
        accessTokenHash: hashTokenFamilia(token),
        accessTokenExpiry: expiry,
      },
      select: {
        id: true, nomeContacto: true, email: true, accessTokenExpiry: true, ativo: true,
        doente: { select: { nome: true } },
      },
    });

    // É a única vez que o token sai do servidor: não fica guardado, por isso não há como o
    // voltar a mostrar. Se o link se perder, revoga-se este acesso e cria-se outro.
    return { ...acesso, accessToken: token };
  }

  async portalDoente(token: string) {
    // Não vale a pena calcular o hash de lixo nem ir à base de dados por ele.
    if (!token || token.length > TAMANHO_MAXIMO_TOKEN) {
      throw new NotFoundException('Acesso não encontrado ou token inválido');
    }

    const acesso = await this.prisma.acessoFamiliar.findUnique({
      where: { accessTokenHash: hashTokenFamilia(token) },
      include: {
        doente: {
          select: {
            nome: true, dataAdmissao: true,
            cama: { select: { numero: true, quarto: true, servico: true } },
            sinaisVitais: {
              orderBy: { data: 'desc' },
              take: 1,
              select: { data: true, news2: true },
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
        // O serviço é o da cama. Lia-se `doente.servico`, que não existe, e a família via
        // sempre o serviço em branco.
        servico: doente.cama?.servico ?? null,
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

  /**
   * O acesso procura-se dentro do doente do caminho. Antes bastava o id: sem `:doenteId` na
   * rota, a revogação escapava à verificação global de acesso ao doente, e um médico ou
   * enfermeiro que conhecesse o id revogava o acesso da família de um doente que não era seu.
   */
  async revogarAcesso(doenteId: string, id: string) {
    const acesso = await this.prisma.acessoFamiliar.findUnique({
      where: { id },
      select: { id: true, doenteId: true },
    });
    // A mesma resposta para "não existe" e "é de outro doente": não confirmar ids alheios.
    if (!acesso || acesso.doenteId !== doenteId) throw new NotFoundException('Acesso não encontrado');

    return this.prisma.acessoFamiliar.update({
      where: { id },
      data: { ativo: false },
      select: { id: true, nomeContacto: true, email: true, ativo: true, accessTokenExpiry: true },
    });
  }
}
