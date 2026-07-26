import { Module } from '@nestjs/common';
import { DoenteModule } from './doentes/doentes.module';
import { CamasModule } from './camas/camas.module';
import { TarefasModule } from './tarefas/tarefas.module';
import { SinaisVitaisModule } from './sinais-vitais/sinais-vitais.module';
import { PediatriaModule } from './pediatria/pediatria.module';
import { MaternidadeModule } from './maternidade/maternidade.module';
import { OncologiaModule } from './oncologia/oncologia.module';
import { DialiseModule } from './dialise/dialise.module';
import { RadiologiaModule } from './radiologia/radiologia.module';
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
import { BalancoHidricoModule } from './balanco-hidrico/balanco-hidrico.module';
import { FeridasModule } from './feridas/feridas.module';
import { TransfusaoModule } from './transfusao/transfusao.module';
import { MonitorizacaoModule } from './monitorizacao/monitorizacao.module';
import { SnsPemModule } from './sns-pem/sns-pem.module';
// Session 49
import { SinalizacoesModule } from './sinalizacoes/sinalizacoes.module';
import { SepsisModule } from './sepsis/sepsis.module';
import { BaselinesModule } from './baselines/baselines.module';
import { ReconciliacaoMedicacaoModule } from './reconciliacao-medicacao/reconciliacao-medicacao.module';
import { RelatorioPassagemTurnoModule } from './relatorio-passagem-turno/relatorio-passagem-turno.module';
import { PlanoAltaModule } from './plano-alta/plano-alta.module';
import { FamiliaModule } from './familia/familia.module';
import { FhirModule } from './fhir/fhir.module';
// Session 50
import { AiClinicoModule } from './ai-clinico/ai-clinico.module';
// Session 52
import { ExamesLabModule } from './exames-lab/exames-lab.module';
// Session 53
import { DocumentosSaudeModule } from './documentos-saude/documentos-saude.module';
// Session 58
import { StewardshipModule } from './stewardship/stewardship.module';

const clinicalModules = [
  // Doente & Cama
  DoenteModule, CamasModule, TarefasModule, SinaisVitaisModule, PediatriaModule,
  AlergiasModule, ContactosModule, AlertasModule, NotasClinicasModule,
  EscalasClinicasModule, DispositivosInvasivosModule, AtosClinicosModule,
  BreakGlassModule, ConsentimentosModule, EventosAdversosModule,
  // Terapêutica & Diagnóstico
  MedicacaoModule, FarmaciaModule, ReconciliacaoModule, ExamesModule,
  ProtocolosModule, DietasModule,
  // Serviços Especializados
  ConsultasModule, InterconsultasModule, UrgenciaModule, BlocoModule,
  FisioterapiaModule, MaternidadeModule, OncologiaModule, DialiseModule,
  RadiologiaModule,
  // Vigilância
  IacsModule,
  // Session 48
  BalancoHidricoModule, FeridasModule, TransfusaoModule, MonitorizacaoModule, SnsPemModule,
  // Session 49 — Inteligência Clínica
  SinalizacoesModule, SepsisModule, BaselinesModule, ReconciliacaoMedicacaoModule,
  RelatorioPassagemTurnoModule, PlanoAltaModule, FamiliaModule, FhirModule,
  // Session 50
  AiClinicoModule,
  // Session 52
  ExamesLabModule,
  // Session 53
  DocumentosSaudeModule,
  // Session 58
  StewardshipModule,
];

@Module({
  imports: clinicalModules,
  exports: clinicalModules,
})
export class ClinicalModule {}
