export interface HorarioTurno {
  id: string;
  tipo: 'manha' | 'tarde' | 'noite';
  data: Date;
  profissionaisIds: string[];
  criadoPorId: string; // chefe de enfermeiros
}

export interface Escala {
  id: string;
  mes: number;
  ano: number;
  turnos: HorarioTurno[];
  criadaPorId: string; // chefe de enfermeiros
}
