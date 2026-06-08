import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// pdfmake server-side with built-in standard PDF fonts
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PdfPrinter = require('pdfmake/src/printer');

const FONTS = {
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique',
  },
};

function dataPt(d: Date | string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function dtPt(d: Date | string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

@Injectable()
export class PdfService {
  constructor(private readonly prisma: PrismaService) {}

  private build(docDefinition: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const printer = new PdfPrinter(FONTS);
        const chunks: Buffer[] = [];
        const pdfDoc = printer.createPdfKitDocument(docDefinition);
        pdfDoc.on('data', (chunk: Buffer) => chunks.push(chunk));
        pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
        pdfDoc.on('error', reject);
        pdfDoc.end();
      } catch (e) {
        reject(e);
      }
    });
  }

  async gerarSumarioAlta(doenteId: string): Promise<Buffer> {
    const doente = await this.prisma.doente.findUnique({
      where: { id: doenteId },
      include: {
        cama: true,
        alergias: true,
        medicacoes: {
          where: { ativo: true },
          include: { prescritoPor: { select: { nome: true } } },
          take: 20,
        },
        sinaisVitais: { orderBy: { data: 'desc' }, take: 3 },
        atribuicoes: {
          include: { enfermeiro: { select: { nome: true, role: true } } },
          take: 5,
        },
      },
    });

    if (!doente) throw new Error('Doente não encontrado');

    const notas = await this.prisma.notaClinica.findMany({
      where: { doenteId },
      orderBy: { criadaEm: 'desc' },
      take: 5,
      include: { autor: { select: { nome: true, role: true } } },
    }).catch(() => []);

    const now = new Date();
    const docDefinition: any = {
      defaultStyle: { font: 'Helvetica', fontSize: 10 },
      styles: {
        header:    { fontSize: 18, bold: true, color: '#1e40af' },
        subheader: { fontSize: 13, bold: true, color: '#1e3a8a', margin: [0, 10, 0, 4] },
        label:     { bold: true, color: '#374151' },
        small:     { fontSize: 8, color: '#6b7280' },
        tableHeader: { bold: true, fillColor: '#eff6ff', color: '#1e3a8a', fontSize: 9 },
      },
      content: [
        // Header
        {
          columns: [
            { text: 'CuraSphere', style: 'header', width: '*' },
            { text: `Emitido em: ${dtPt(now)}`, style: 'small', alignment: 'right', width: 'auto', margin: [0, 6, 0, 0] },
          ],
          margin: [0, 0, 0, 4],
        },
        { text: 'SUMÁRIO DE ALTA HOSPITALAR', fontSize: 14, bold: true, margin: [0, 0, 0, 12], color: '#111827' },
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: '#bfdbfe' }] },

        // Dados do paciente
        { text: 'IDENTIFICAÇÃO DO DOENTE', style: 'subheader' },
        {
          table: {
            widths: ['auto', '*', 'auto', '*'],
            body: [
              [{ text: 'Nome:', style: 'label' }, doente.nome,
               { text: 'Nº Processo:', style: 'label' }, doente.numeroProcesso ?? '—'],
              [{ text: 'Data Nasc.:', style: 'label' }, dataPt(doente.dataNascimento),
               { text: 'Estado:', style: 'label' }, doente.estado ?? '—'],
              [{ text: 'Data Admissão:', style: 'label' }, dataPt(doente.dataAdmissao),
               { text: 'Data Alta:', style: 'label' }, dataPt(doente.dataAlta ?? now)],
              [{ text: 'Quarto/Cama:', style: 'label' },
               doente.cama ? `Quarto ${doente.cama.quarto} — Cama ${doente.cama.numero}` : '—',
               { text: 'Diagnóstico:', style: 'label' }, doente.diagnosticoPrincipal ?? '—'],
            ],
          },
          layout: 'lightHorizontalLines',
          margin: [0, 0, 0, 12],
        },

        // Alergias
        ...(doente.alergias.length > 0 ? [
          { text: 'ALERGIAS CONHECIDAS', style: 'subheader', color: '#dc2626' },
          {
            table: {
              widths: ['*', 'auto', 'auto'],
              body: [
                [{ text: 'Alergénio', style: 'tableHeader' }, { text: 'Tipo', style: 'tableHeader' }, { text: 'Severidade', style: 'tableHeader' }],
                ...doente.alergias.map((a: any) => [a.alergenio, a.tipo, a.severidade]),
              ],
            },
            layout: 'lightHorizontalLines',
            margin: [0, 0, 0, 12],
          },
        ] : []),

        // Medicações
        ...(doente.medicacoes.length > 0 ? [
          { text: 'MEDICAÇÕES NA ALTA', style: 'subheader' },
          {
            table: {
              widths: ['*', 'auto', 'auto', 'auto'],
              body: [
                [
                  { text: 'Medicamento', style: 'tableHeader' },
                  { text: 'Dose', style: 'tableHeader' },
                  { text: 'Via', style: 'tableHeader' },
                  { text: 'Frequência', style: 'tableHeader' },
                ],
                ...doente.medicacoes.map((m: any) => [m.nome, m.dose, m.via, m.frequencia]),
              ],
            },
            layout: 'lightHorizontalLines',
            margin: [0, 0, 0, 12],
          },
        ] : []),

        // Últimos sinais vitais
        ...(doente.sinaisVitais.length > 0 ? [
          { text: 'ÚLTIMOS SINAIS VITAIS', style: 'subheader' },
          {
            table: {
              widths: ['auto', 'auto', 'auto', 'auto', 'auto', 'auto'],
              body: [
                ['Data', 'TA', 'FC', 'SpO₂', 'Temp.', 'NEWS2'].map(h => ({ text: h, style: 'tableHeader' })),
                ...doente.sinaisVitais.map((s: any) => [
                  dataPt(s.data),
                  s.pressaoSistolica ? `${s.pressaoSistolica}/${s.pressaoDiastolica ?? '?'}` : '—',
                  s.pulso ?? '—',
                  s.saturacaoO2 ? `${s.saturacaoO2}%` : '—',
                  s.temperatura ? `${s.temperatura}ºC` : '—',
                  s.news2 ?? '—',
                ]),
              ],
            },
            layout: 'lightHorizontalLines',
            margin: [0, 0, 0, 12],
          },
        ] : []),

        // Notas clínicas
        ...(notas.length > 0 ? [
          { text: 'NOTAS CLÍNICAS RECENTES', style: 'subheader' },
          ...notas.map((n: any) => ({
            stack: [
              { text: `${dtPt(n.criadaEm)} — ${n.autor?.nome ?? ''}`, bold: true, fontSize: 9, color: '#374151' },
              { text: n.texto, fontSize: 9, margin: [0, 2, 0, 8] },
            ],
          })),
        ] : []),

        // Assinatura
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#d1d5db' }], margin: [0, 12, 0, 0] },
        { text: `Documento gerado automaticamente pelo sistema CuraSphere · ${dtPt(now)}`, style: 'small', alignment: 'center', margin: [0, 8, 0, 0] },
      ],
      pageSize: 'A4',
      pageMargins: [40, 40, 40, 40],
    };

    return this.build(docDefinition);
  }

  async gerarRelatorioTurno(turnoId: string): Promise<Buffer> {
    const turno = await this.prisma.turno.findUnique({
      where: { id: turnoId },
      include: {
        chefeTurno: { select: { nome: true } },
        horariosEntrada: {
          include: {
            utilizador: { select: { nome: true, role: true } },
          },
        },
      },
    });
    if (!turno) throw new Error('Turno não encontrado');

    const passagem = await (this.prisma.passagemTurno as any).findMany({
      where: { turnoAnteriorId: turnoId },
      include: {
        doente: {
          select: {
            nome: true,
            estado: true,
            diagnosticoPrincipal: true,
            cama: { select: { numero: true, quarto: true } },
            tarefas: {
              where: { estado: { not: 'concluida' } },
              select: { descricao: true, prioridade: true, estado: true },
              take: 5,
            },
          },
        },
      },
      take: 50,
    }).catch(() => []);

    const now = new Date();
    const tipoLabel: Record<string, string> = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' };

    const docDefinition: any = {
      defaultStyle: { font: 'Helvetica', fontSize: 10 },
      styles: {
        header:    { fontSize: 18, bold: true, color: '#1e40af' },
        subheader: { fontSize: 12, bold: true, color: '#1e3a8a', margin: [0, 10, 0, 4] },
        label:     { bold: true, color: '#374151' },
        small:     { fontSize: 8, color: '#6b7280' },
        tableHeader: { bold: true, fillColor: '#eff6ff', color: '#1e3a8a', fontSize: 9 },
      },
      content: [
        {
          columns: [
            { text: 'CuraSphere', style: 'header', width: '*' },
            { text: `Emitido: ${dtPt(now)}`, style: 'small', alignment: 'right', width: 'auto', margin: [0, 6, 0, 0] },
          ],
          margin: [0, 0, 0, 4],
        },
        { text: `RELATÓRIO DE TURNO — ${tipoLabel[turno.tipo] ?? turno.tipo}`, fontSize: 14, bold: true, margin: [0, 0, 0, 4] },
        { text: `Período: ${dtPt(turno.dataInicio)} → ${dtPt(turno.dataFim)}`, style: 'small', margin: [0, 0, 0, 4] },
        { text: `Chefe de Turno: ${turno.chefeTurno?.nome ?? '—'}`, style: 'small', margin: [0, 0, 0, 12] },
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: '#bfdbfe' }] },

        ...passagem.flatMap((p: any) => {
          const d = p.doente;
          const cama = d?.cama ? `Q${d.cama.quarto}/C${d.cama.numero}` : '';
          return [
            { text: `${d?.nome ?? '—'} ${cama ? '(' + cama + ')' : ''} — ${d?.estado ?? ''}`, style: 'subheader' },
            { text: `Diagnóstico: ${d?.diagnosticoPrincipal ?? '—'}`, style: 'small', margin: [0, 0, 0, 4] },
            ...(d?.tarefas?.length > 0 ? [{
              text: 'Tarefas pendentes: ' + d.tarefas.map((t: any) => `${t.descricao} [${t.prioridade}]`).join(' · '),
              fontSize: 9, color: '#92400e', margin: [0, 0, 0, 4],
            }] : []),
            { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.3, lineColor: '#e5e7eb' }], margin: [0, 6, 0, 0] },
          ];
        }),

        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#d1d5db' }], margin: [0, 12, 0, 0] },
        { text: `CuraSphere · ${dtPt(now)}`, style: 'small', alignment: 'center', margin: [0, 8, 0, 0] },
      ],
      pageSize: 'A4',
      pageMargins: [40, 40, 40, 40],
    };

    return this.build(docDefinition);
  }

  async gerarMar(doenteId: string, dataStr?: string): Promise<Buffer> {
    const dataRef = dataStr ? new Date(dataStr) : new Date();
    const inicioDia = new Date(dataRef);
    inicioDia.setHours(0, 0, 0, 0);
    const fimDia = new Date(dataRef);
    fimDia.setHours(23, 59, 59, 999);

    const doente = await this.prisma.doente.findUnique({
      where: { id: doenteId },
      select: { nome: true, numeroProcesso: true, dataAdmissao: true, diagnosticoPrincipal: true, cama: { select: { numero: true, quarto: true } } },
    });
    if (!doente) throw new Error('Doente não encontrado');

    const medicacoes = await this.prisma.medicacao.findMany({
      where: { doenteId, ativo: true, deletedAt: null },
      select: {
        id: true, nome: true, dose: true, via: true, frequencia: true,
        registos: {
          where: { administradoEm: { gte: inicioDia, lte: fimDia }, deletedAt: null },
          select: { administradoEm: true, naoAdministrada: true, motivoNaoAdmin: true, observacoes: true },
          orderBy: { administradoEm: 'asc' },
        },
      },
      orderBy: { iniciadoEm: 'asc' },
    });

    const now = new Date();

    const docDefinition: any = {
      defaultStyle: { font: 'Helvetica', fontSize: 9 },
      styles: {
        header:      { fontSize: 18, bold: true, color: '#1e40af' },
        subheader:   { fontSize: 12, bold: true, color: '#1e3a8a', margin: [0, 10, 0, 4] },
        label:       { bold: true, color: '#374151' },
        small:       { fontSize: 8, color: '#6b7280' },
        tableHeader: { bold: true, fillColor: '#eff6ff', color: '#1e3a8a', fontSize: 9 },
      },
      content: [
        {
          columns: [
            { text: 'CuraSphere', style: 'header', width: '*' },
            { text: `Emitido em: ${dtPt(now)}`, style: 'small', alignment: 'right', width: 'auto', margin: [0, 6, 0, 0] },
          ],
          margin: [0, 0, 0, 4],
        },
        { text: 'REGISTO DE ADMINISTRAÇÃO DE MEDICAÇÃO (MAR)', fontSize: 13, bold: true, margin: [0, 0, 0, 4], color: '#111827' },
        { text: `Data: ${dataPt(dataRef)}`, fontSize: 10, color: '#374151', margin: [0, 0, 0, 10] },
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: '#bfdbfe' }] },

        { text: 'IDENTIFICAÇÃO', style: 'subheader' },
        {
          table: {
            widths: ['auto', '*', 'auto', '*'],
            body: [
              [{ text: 'Doente:', style: 'label' }, doente.nome, { text: 'Nº Processo:', style: 'label' }, doente.numeroProcesso ?? '—'],
              [{ text: 'Diagnóstico:', style: 'label' }, doente.diagnosticoPrincipal ?? '—', { text: 'Cama:', style: 'label' }, doente.cama ? `Q${doente.cama.quarto}/C${doente.cama.numero}` : '—'],
            ],
          },
          layout: 'lightHorizontalLines',
          margin: [0, 0, 0, 14],
        },

        { text: 'ADMINISTRAÇÕES DO DIA', style: 'subheader' },
        ...(medicacoes.length === 0 ? [{ text: 'Sem medicações activas.', fontSize: 9, color: '#6b7280' }] : [
          {
            table: {
              widths: ['*', 'auto', 'auto', 'auto', 'auto', '*'],
              body: [
                [
                  { text: 'Medicamento', style: 'tableHeader' },
                  { text: 'Dose', style: 'tableHeader' },
                  { text: 'Via', style: 'tableHeader' },
                  { text: 'Frequência', style: 'tableHeader' },
                  { text: 'Estado', style: 'tableHeader' },
                  { text: 'Hora / Observações', style: 'tableHeader' },
                ],
                ...medicacoes.flatMap((m) => {
                  if (m.registos.length === 0) {
                    return [[m.nome, m.dose, m.via, m.frequencia, { text: 'Não administrada', color: '#dc2626', bold: true }, '—']];
                  }
                  return m.registos.map((r) => [
                    m.nome,
                    m.dose,
                    m.via,
                    m.frequencia,
                    r.naoAdministrada
                      ? { text: 'Omitida', color: '#f59e0b', bold: true }
                      : { text: '✓ Administrada', color: '#16a34a', bold: true },
                    r.naoAdministrada
                      ? (r.motivoNaoAdmin ?? '—')
                      : `${dtPt(r.administradoEm)}${r.observacoes ? ' — ' + r.observacoes : ''}`,
                  ]);
                }),
              ],
            },
            layout: 'lightHorizontalLines',
            margin: [0, 0, 0, 12],
          },
        ]),

        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#d1d5db' }], margin: [0, 12, 0, 0] },
        { text: `CuraSphere · ${dtPt(now)}`, style: 'small', alignment: 'center', margin: [0, 8, 0, 0] },
      ],
      pageSize: 'A4',
      pageMargins: [40, 40, 40, 40],
    };

    return this.build(docDefinition);
  }

  async gerarCartaAltaPdf(doenteId: string): Promise<Buffer> {
    const doente = await this.prisma.doente.findUnique({
      where: { id: doenteId },
      include: {
        medicacoes: { where: { ativo: true }, take: 20 },
        alergias: { take: 10 },
        sumarioAlta: { include: { criadoPor: { select: { nome: true } } } },
        ficheiroPessoal: { select: { nif: true, numeroSNS: true } },
      },
    });

    if (!doente) throw new Error('Doente não encontrado');

    const now = new Date();
    const sumario = (doente as any).sumarioAlta;

    const docDefinition: any = {
      defaultStyle: { font: 'Helvetica', fontSize: 10.5, lineHeight: 1.4 },
      styles: {
        header:    { fontSize: 20, bold: true, color: '#1d4ed8' },
        sub:       { fontSize: 11, color: '#475569', margin: [0, 2, 0, 16] },
        titulo:    { fontSize: 13, bold: true, color: '#0f172a', margin: [0, 14, 0, 6] },
        label:     { bold: true, color: '#374151' },
        small:     { fontSize: 8, color: '#6b7280' },
        tableHdr:  { bold: true, fillColor: '#eff6ff', color: '#1e3a8a', fontSize: 9 },
      },
      content: [
        // Cabeçalho
        { text: 'CuraSphere', style: 'header' },
        { text: 'CARTA DE ALTA HOSPITALAR', style: 'sub' },
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: '#bfdbfe' }] },

        // Identificação
        { text: 'DADOS DO DOENTE', style: 'titulo' },
        {
          table: {
            widths: ['auto', '*', 'auto', '*'],
            body: [
              [{ text: 'Nome:', style: 'label' }, doente.nome,
               { text: 'Nº Processo:', style: 'label' }, doente.numeroProcesso ?? '—'],
              [{ text: 'Data Nasc.:', style: 'label' }, dataPt(doente.dataNascimento),
               { text: 'SNS:', style: 'label' }, (doente as any).ficheiroPessoal?.numeroSNS ?? '—'],
              [{ text: 'Data Admissão:', style: 'label' }, dataPt(doente.dataAdmissao),
               { text: 'Data Alta:', style: 'label' }, dataPt(doente.dataAlta ?? now)],
              [{ text: 'Diagnóstico:', style: 'label' }, { text: doente.diagnosticoPrincipal ?? '—', colSpan: 3 }, '', ''],
            ],
          },
          layout: 'lightHorizontalLines',
          margin: [0, 0, 0, 12],
        },

        // Resumo clínico da IA
        ...(sumario?.cartaAlta ? [
          { text: 'RESUMO CLÍNICO', style: 'titulo' },
          { text: sumario.cartaAlta, fontSize: 10.5, margin: [0, 0, 0, 12] },
        ] : []),

        // Prescrição de saída / instruções
        ...(sumario?.prescricaoSaida ? [
          { text: 'INSTRUCÇÕES AO DOENTE / MÉDICO DE FAMÍLIA', style: 'titulo' },
          { text: sumario.prescricaoSaida, fontSize: 10.5, margin: [0, 0, 0, 12] },
        ] : []),

        // Medicações na alta
        ...(doente.medicacoes.length > 0 ? [
          { text: 'MEDICAÇÃO NA ALTA', style: 'titulo' },
          {
            table: {
              widths: ['*', 'auto', 'auto', 'auto'],
              body: [
                [{ text: 'Medicamento', style: 'tableHdr' }, { text: 'Dose', style: 'tableHdr' }, { text: 'Via', style: 'tableHdr' }, { text: 'Frequência', style: 'tableHdr' }],
                ...doente.medicacoes.map((m: any) => [m.nome, m.dose ?? '—', m.via ?? '—', m.frequencia ?? '—']),
              ],
            },
            layout: 'lightHorizontalLines',
            margin: [0, 0, 0, 12],
          },
        ] : []),

        // Alergias
        ...(doente.alergias.length > 0 ? [
          { text: 'ALERGIAS CONHECIDAS', style: 'titulo', color: '#dc2626' },
          { text: doente.alergias.map((a: any) => `${a.alergenio} (${a.severidade})`).join(' · '), fontSize: 10.5, color: '#dc2626', margin: [0, 0, 0, 12] },
        ] : []),

        // Médico emitente e rodapé
        ...(sumario?.criadoPor?.nome ? [{ text: `Emitido por: ${sumario.criadoPor.nome}`, style: 'label', margin: [0, 8, 0, 0] }] : []),
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#d1d5db' }], margin: [0, 16, 0, 0] },
        { text: 'Documento gerado electronicamente pelo sistema CuraSphere. Assinatura digital do médico responsável requerida para validade legal.', style: 'small', alignment: 'center', margin: [0, 6, 0, 0] },
        { text: `Emitido em: ${dtPt(now)}`, style: 'small', alignment: 'center', margin: [0, 2, 0, 0] },
      ],
      pageSize: 'A4',
      pageMargins: [40, 40, 40, 40],
    };

    return this.build(docDefinition);
  }
}
