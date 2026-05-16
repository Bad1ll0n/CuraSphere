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

    const passagem = await this.prisma.passagemTurno.findMany({
      where: { turnoId },
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
        notas: {
          include: { autor: { select: { nome: true } } },
          take: 3,
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
            ...(p.notas?.length > 0 ? p.notas.map((n: any) => ({
              text: `• ${n.autor?.nome ?? ''}: ${n.texto}`,
              fontSize: 9, color: '#374151', margin: [8, 0, 0, 2],
            })) : []),
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
}
