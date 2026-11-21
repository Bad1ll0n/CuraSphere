import { ConflictException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * QA-14 — "Descontinuar" só fazia `ativo=false` e guardava a hora: não ficava quem decidiu nem
 * porquê, e um enfermeiro descontinuava uma prescrição médica sem rasto. Agora o motivo é
 * obrigatório, fica o autor, e se quem descontinua não é o prescritor (nem médico), o prescritor
 * recebe uma tarefa para confirmar a decisão terapêutica.
 */
export async function descontinuarMedicacao(
  prisma: PrismaService,
  id: string,
  autor: { id: string; role: string },
  motivo: string,
) {
  const med = await prisma.medicacao.findUnique({
    where: { id },
    select: { id: true, nome: true, ativo: true, doenteId: true, prescritoPorId: true },
  });
  if (!med) throw new NotFoundException(`Medicação (ID ${id}) não encontrada`);
  if (!med.ativo) throw new ConflictException('Esta medicação já foi descontinuada');

  const texto = motivo.trim().slice(0, 500);
  return prisma.$transaction(async (tx) => {
    const atualizada = await tx.medicacao.update({
      where: { id },
      data: { ativo: false, terminadoEm: new Date(), descontinuadoPorId: autor.id, motivoDescontinuacao: texto },
      select: {
        id: true, nome: true, ativo: true, terminadoEm: true, motivoDescontinuacao: true,
        descontinuadoPor: { select: { id: true, nome: true } },
      },
    });
    if (autor.role !== 'medico' && autor.id !== med.prescritoPorId) {
      await tx.tarefa.create({
        data: {
          doenteId: med.doenteId,
          tipo: 'clinica',
          prioridade: 'alta',
          responsavelId: med.prescritoPorId,
          criadoPorId: autor.id,
          descricao: `Confirmar a descontinuação de "${med.nome}" (feita por enfermagem). Motivo: ${texto}`.slice(0, 1000),
        },
      });
    }
    return atualizada;
  });
}
