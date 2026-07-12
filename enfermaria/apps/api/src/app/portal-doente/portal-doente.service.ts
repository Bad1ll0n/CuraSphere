import { Injectable, NotFoundException, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../common/storage.service';
import { PdfService } from '../common/pdf.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class PortalDoenteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly storage: StorageService,
    private readonly pdf: PdfService,
  ) {}

  async criarAcesso(doenteId: string, email: string, senha: string, criadoPorId: string) {
    const doente = await this.prisma.doente.findUnique({ where: { id: doenteId } });
    if (!doente || !doente.ativo) throw new NotFoundException('Doente não encontrado');

    const emailExiste = await this.prisma.portalDoente.findUnique({ where: { email } });
    if (emailExiste && emailExiste.doenteId !== doenteId) {
      throw new ConflictException('Email já utilizado por outro doente');
    }

    const passwordHash = await bcrypt.hash(senha, 12);
    return this.prisma.portalDoente.upsert({
      where: { doenteId },
      create: { doenteId, email, passwordHash, criadoPorId },
      update: { email, passwordHash },
      select: { id: true, doenteId: true, email: true, ativo: true, criadoEm: true },
    });
  }

  async login(email: string, senha: string) {
    const portal = await this.prisma.portalDoente.findUnique({
      where: { email },
      include: { doente: { select: { id: true, nome: true, ativo: true } } },
    });
    if (!portal || !portal.ativo) throw new UnauthorizedException('Credenciais inválidas');
    if (!portal.doente.ativo) throw new UnauthorizedException('Conta desactivada');

    const valido = await bcrypt.compare(senha, portal.passwordHash);
    if (!valido) throw new UnauthorizedException('Credenciais inválidas');

    const accessToken = this.jwt.sign(
      { sub: portal.id, doenteId: portal.doenteId, tipo: 'portal' },
      { expiresIn: '8h' },
    );
    return { accessToken, doente: portal.doente };
  }

  async me(doenteId: string) {
    const doente = await this.prisma.doente.findUnique({
      where: { id: doenteId },
      select: {
        id: true, nome: true, dataNascimento: true, diagnosticoPrincipal: true,
        dataAdmissao: true, dataAltaPrevista: true, estado: true,
      },
    });
    if (!doente) throw new NotFoundException('Doente não encontrado');
    return doente;
  }

  async meusDocumentos(doenteId: string) {
    const docs = await this.prisma.documentoSaude.findMany({
      where: { doenteId },
      orderBy: { dataDocumento: 'desc' },
      select: { id: true, titulo: true, tipo: true, formato: true, origem: true, dataDocumento: true, tamanhoBytes: true, storageKey: true, urlExterna: true },
    });
    return Promise.all(docs.map(async d => ({
      ...d,
      url: d.storageKey ? await this.storage.getSignedUrl(d.storageKey) : d.urlExterna ?? null,
      storageKey: undefined,
    })));
  }

  async minhaMedicacao(doenteId: string) {
    return this.prisma.medicacao.findMany({
      where: { doenteId, ativo: true },
      orderBy: { iniciadoEm: 'desc' },
      select: {
        id: true, nome: true, dose: true, via: true, frequencia: true,
        iniciadoEm: true,
      },
    });
  }

  async meuPlanoAlta(doenteId: string) {
    return this.prisma.planoAlta.findFirst({
      where: { doenteId },
      orderBy: { criadoEm: 'desc' },
      select: {
        id: true, dataAlvoDia: true, notas: true, criadoEm: true,
        afebrилApenas24h: true, mobilidadeAdequada: true, alimentacaoOral: true,
        doresControladas: true, familiaInformada: true,
      },
    });
  }

  async exportarDados(doenteId: string): Promise<Buffer> {
    const doente = await this.prisma.doente.findUnique({ where: { id: doenteId } });
    if (!doente) throw new NotFoundException('Doente não encontrado');
    return this.pdf.gerarSumarioAlta(doenteId);
  }

  async exportarJson(doenteId: string) {
    const doente = await this.prisma.doente.findUnique({
      where: { id: doenteId },
      select: {
        id: true, nome: true, dataNascimento: true, numeroProcesso: true,
        diagnosticoPrincipal: true, dataAdmissao: true, dataAltaPrevista: true, estado: true,
      },
    });
    if (!doente) throw new NotFoundException('Doente não encontrado');

    const [medicacao, sinaisVitais, documentos, planoAlta] = await Promise.all([
      this.prisma.medicacao.findMany({
        where: { doenteId, ativo: true },
        select: { nome: true, dose: true, via: true, frequencia: true, iniciadoEm: true },
      }),
      this.prisma.sinalVital.findMany({
        where: { doenteId, data: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
        orderBy: { data: 'desc' },
        select: { data: true, pressaoSistolica: true, pressaoDiastolica: true, pulso: true, temperatura: true, saturacaoO2: true, frequenciaRespiratoria: true, news2: true },
        take: 100,
      }),
      this.prisma.documentoSaude.findMany({
        where: { doenteId },
        select: { titulo: true, tipo: true, formato: true, origem: true, dataDocumento: true },
        orderBy: { dataDocumento: 'desc' },
      }),
      this.prisma.planoAlta.findFirst({
        where: { doenteId },
        orderBy: { criadoEm: 'desc' },
        select: { dataAlvoDia: true, notas: true, criadoEm: true },
      }),
    ]);

    return {
      exportadoEm: new Date().toISOString(),
      regulamento: 'RGPD Art. 20 — Direito à portabilidade dos dados',
      doente,
      medicacaoActiva: medicacao,
      sinaisVitaisUltimos30Dias: sinaisVitais,
      documentosClinicosListagem: documentos,
      planoAlta,
    };
  }

  async teleconsultas(portalId: string) {
    const portal = await this.prisma.portalDoente.findUnique({ where: { id: portalId } });
    if (!portal) throw new UnauthorizedException();
    return this.prisma.consulta.findMany({
      where: { doenteId: portal.doenteId, tipo: 'teleconsulta' as any, estado: 'agendada' },
      orderBy: { dataHora: 'asc' },
      include: { medico: { select: { id: true, nome: true, subRole: true } } },
    });
  }

  async entrarVideoPortal(consultaId: string, portalId: string) {
    const portal = await this.prisma.portalDoente.findUnique({ where: { id: portalId } });
    if (!portal) throw new UnauthorizedException();
    const consulta = await this.prisma.consulta.findFirst({
      where: { id: consultaId, doenteId: portal.doenteId },
    });
    if (!consulta) throw new NotFoundException('Consulta não encontrada');
    const roomId: string | null = (consulta as any).videoRoomId ?? null;
    if (!roomId) throw new NotFoundException('Chamada ainda não iniciada');
    const server = process.env['JITSI_SERVER'] ?? 'https://meet.jit.si';
    return { roomUrl: `${server}/${roomId}`, videoRoomId: roomId };
  }

  async enviarMensagem(doenteId: string, conteudo: string) {
    const doente = await this.prisma.doente.findUnique({
      where: { id: doenteId },
      select: { nome: true },
    });
    // Criar mensagem interna com remetente virtual "Portal do Doente"
    // Destinatários: utilizadores do serviço internamento com role enfermeiro/chefe_enfermeiros
    const equipa = await this.prisma.utilizador.findMany({
      where: { role: { in: ['enfermeiro', 'chefe_enfermeiros', 'medico'] }, servico: 'internamento', ativo: true },
      select: { id: true },
      take: 10,
    });

    const mensagens = equipa.map(u =>
      this.prisma.mensagemInterna.create({
        data: {
          assunto: `Mensagem do Portal — ${doente?.nome ?? 'Doente'}`,
          texto: conteudo,
          remetenteId: equipa[0]?.id ?? u.id, // remetente interno fictício (primeiro da equipa)
          destinatarioId: u.id,
          lida: false,
        },
      }),
    );
    await Promise.all(mensagens);
    return { mensagem: 'Mensagem enviada à equipa' };
  }

  // ── PRO — Patient-Reported Outcomes ──────────────────────────────────────────

  async listarTemplatesPRO() {
    return this.prisma.templatePRO.findMany({ where: { ativo: true }, orderBy: { nome: 'asc' } });
  }

  async criarTemplatePRO(nome: string, campos: object[]) {
    return this.prisma.templatePRO.create({ data: { nome, campos } });
  }

  async submeterPRO(doenteId: string, templateId: string, respostas: Record<string, unknown>) {
    return this.prisma.registoPRO.create({
      data: { doenteId, templateId, respostas },
      include: { template: { select: { nome: true } } },
    });
  }

  async historicoPRO(doenteId: string, templateId?: string) {
    return this.prisma.registoPRO.findMany({
      where: { doenteId, ...(templateId ? { templateId } : {}) },
      include: { template: { select: { nome: true, campos: true } } },
      orderBy: { criadoEm: 'desc' },
      take: 50,
    });
  }

  async historicoPRODoente(doenteId: string) {
    return this.historicoPRO(doenteId);
  }
}
