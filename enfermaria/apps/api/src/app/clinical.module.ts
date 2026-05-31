import { Module } from '@nestjs/common';
import { DoenteModule } from './doentes/doentes.module';
import { CamasModule } from './camas/camas.module';
import { TarefasModule } from './tarefas/tarefas.module';
import { SinaisVitaisModule } from './sinais-vitais/sinais-vitais.module';
import { AlergiasModule } from './alergias/alergias.module';
import { ContactosModule } from './contactos/contactos.module';
import { AlertasModule } from './alertas/alertas.module';
import { NotasClinicasModule } from './notas-clinicas/notas-clinicas.module';
import { EscalasClinicasModule } from './escalas-clinicas/escalas-clinicas.module';
import { DispositivosInvasivosModule } from './dispositivos-invasivos/dispositivos-invasivos.module';
import { AtosClinicosModule } from './atos-clinicos/atos-clinicos.module';
import { BreakGlassModule } from './break-glass/break-glass.module';
import { ConsentimentosModule } from './consentimentos/consentimentos.module';
import { EventosAdversosModule } from './eventos-adversos/eventos-adversos.module';
import { MedicacaoModule } from './medicacao/medicacao.module';
import { FarmaciaModule } from './farmacia/farmacia.module';
import { ReconciliacaoModule } from './reconciliacao/reconciliacao.module';
import { ExamesModule } from './exames/exames.module';
import { ProtocolosModule } from './protocolos/protocolos.module';
import { DietasModule } from './dietas/dietas.module';
import { ConsultasModule } from './consultas/consultas.module';
import { InterconsultasModule } from './interconsultas/interconsultas.module';
import { UrgenciaModule } from './urgencia/urgencia.module';
import { BlocoModule } from './bloco/bloco.module';
import { FisioterapiaModule } from './fisioterapia/fisioterapia.module';
import { IacsModule } from './iacs/iacs.module';

const clinicalModules = [
  // Doente & Cama
  DoenteModule, CamasModule, TarefasModule, SinaisVitaisModule,
  AlergiasModule, ContactosModule, AlertasModule, NotasClinicasModule,
  EscalasClinicasModule, DispositivosInvasivosModule, AtosClinicosModule,
  BreakGlassModule, ConsentimentosModule, EventosAdversosModule,
  // Terapêutica & Diagnóstico
  MedicacaoModule, FarmaciaModule, ReconciliacaoModule, ExamesModule,
  ProtocolosModule, DietasModule,
  // Serviços Especializados
  ConsultasModule, InterconsultasModule, UrgenciaModule, BlocoModule,
  FisioterapiaModule,
  // Vigilância
  IacsModule,
];

@Module({
  imports: clinicalModules,
  exports: clinicalModules,
})
export class ClinicalModule {}
