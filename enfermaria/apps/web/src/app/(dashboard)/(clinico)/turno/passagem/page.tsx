import { redirect } from 'next/navigation';

/**
 * UX-22 — havia duas passagens de turno ("Passagem de Turno" e "Passagem Turno Pro", com
 * backends diferentes). Ficou uma só, em ISBAR, em /passagem-turno; os atalhos antigos
 * continuam a funcionar.
 */
export default function PassagemTurnoAntiga() {
  redirect('/passagem-turno');
}
