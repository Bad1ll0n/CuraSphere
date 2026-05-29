export interface HorarioTurno {
  id: string;
  tipo: 'manha' | 'tarde' | 'noite';
  data: string;
  profissionaisIds: string[];
  criadoPorId: string;
}

export interface Escala {
  id: string;
  mes: number;
  ano: number;
  turnos: HorarioTurno[];
  criadaPorId: string;
}
