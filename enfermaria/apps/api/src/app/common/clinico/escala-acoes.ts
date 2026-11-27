import type { Prisma } from '../../../generated/prisma';

/**
 * PROD-21 — uma avaliação vale pelo que desencadeia.
 *
 * NRS-2002, Barthel, FOIS, Morse e Braden eram registados e ficavam por ali: um NRS-2002 ≥ 3 sem
 * referenciação à nutrição é um registo sem consequência. Agora o resultado (calculado no
 * servidor, PROD-08) gera a tarefa certa, para o grupo certo, com prazo:
 *
 *   NRS-2002 ≥ 3  → referenciar à nutrição/dietética (risco nutricional, ESPEN)
 *   Barthel ≤ 60  → avaliar necessidades de continuidade de cuidados para o planeamento da alta
 *   FOIS ≤ 4      → avaliação da deglutição e dieta adaptada (risco de aspiração)
 *   Morse alto    → medidas de prevenção de quedas (DGS)
 *   Braden alto   → medidas de prevenção de úlceras por pressão (DGS)
 *
 * Os limiares são os das escalas validadas, não opiniões locais; mudá-los pede revisão clínica.
 * Uma tarefa ainda aberta da mesma regra para o mesmo doente não se repete a cada reavaliação.
 */

export interface AcaoEscala {
  /** Etiqueta estável no início da descrição — serve para não repetir a tarefa. */
  regra: string;
  descricao: string;
  prioridade: 'media' | 'alta';
  grupoResponsavel: 'enfermeiro' | 'medico';
  prazoHoras: number;
}

export function acoesDaEscala(tipo: string, pontuacao: number, risco?: string): AcaoEscala[] {
  switch (tipo) {
    case 'NRS2002':
      return pontuacao >= 3 ? [{
        regra: 'Nutrição (NRS-2002)', prioridade: 'alta', grupoResponsavel: 'enfermeiro', prazoHoras: 24,
        descricao: `Nutrição (NRS-2002) — ${pontuacao} pontos: risco nutricional — referenciar à nutrição/dietética e iniciar plano nutricional.`,
      }] : [];
    case 'Barthel':
      return pontuacao <= 60 ? [{
        regra: 'Planeamento da alta (Barthel)', prioridade: 'media', grupoResponsavel: 'enfermeiro', prazoHoras: 48,
        descricao: `Planeamento da alta (Barthel) — ${pontuacao} pontos: dependência ${pontuacao <= 20 ? 'total' : pontuacao <= 40 ? 'grave' : 'moderada'} — avaliar necessidades de continuidade de cuidados (RNCCI, apoio domiciliário, cuidador).`,
      }] : [];
    case 'FOIS':
      return pontuacao <= 4 ? [{
        regra: 'Deglutição (FOIS)', prioridade: 'alta', grupoResponsavel: 'enfermeiro', prazoHoras: 12,
        descricao: `Deglutição (FOIS) — nível ${pontuacao}: alimentação oral limitada — avaliação da deglutição e dieta com textura adaptada antes da próxima refeição.`,
      }] : [];
    case 'morse':
      return risco === 'alto' ? [{
        regra: 'Prevenção de quedas (Morse)', prioridade: 'alta', grupoResponsavel: 'enfermeiro', prazoHoras: 8,
        descricao: `Prevenção de quedas (Morse) — ${pontuacao} pontos, risco alto: cama baixa e travada, campainha ao alcance, levante acompanhado e sinalização do risco.`,
      }] : [];
    case 'braden':
      return risco === 'alto' ? [{
        regra: 'Prevenção de úlceras (Braden)', prioridade: 'alta', grupoResponsavel: 'enfermeiro', prazoHoras: 8,
        descricao: `Prevenção de úlceras (Braden) — ${pontuacao} pontos, risco alto: superfície de apoio, reposicionamento programado e vigilância da pele.`,
      }] : [];
    default:
      return [];
  }
}

type ClienteTarefas = {
  tarefa: {
    findFirst: (a: { where: Record<string, unknown>; select: { id: true } }) => Promise<{ id: string } | null>;
    create: (a: { data: Prisma.TarefaUncheckedCreateInput; select: { id: true; descricao: true } }) => Promise<{ id: string; descricao: string }>;
  };
};

/** Cria as tarefas das ações (sem repetir uma ainda aberta da mesma regra). Devolve as criadas. */
export async function aplicarAcoesEscala(
  prisma: ClienteTarefas, doenteId: string, criadoPorId: string, acoes: AcaoEscala[], agora = new Date(),
): Promise<{ id: string; descricao: string }[]> {
  const criadas: { id: string; descricao: string }[] = [];
  for (const a of acoes) {
    const aberta = await prisma.tarefa.findFirst({
      where: { doenteId, estado: { in: ['pendente', 'em_progresso'] }, descricao: { startsWith: a.regra } },
      select: { id: true },
    });
    if (aberta) continue;
    criadas.push(await prisma.tarefa.create({
      data: {
        doenteId, criadoPorId, tipo: 'clinica', prioridade: a.prioridade, grupoResponsavel: a.grupoResponsavel,
        descricao: a.descricao, prazo: new Date(agora.getTime() + a.prazoHoras * 3_600_000),
      },
      select: { id: true, descricao: true },
    }));
  }
  return criadas;
}
