# Âmbito do produto (PROD-20, PROD-23)

**O CuraSphere é o registo clínico de enfermagem e a gestão do internamento.** O foco é o fluxo dos enfermeiros na enfermaria. O resto existe para servir esse fluxo ou liga-se a sistemas que o hospital já tem.

## Núcleo: manter e aprofundar

| Área | Inclui |
|---|---|
| Admissão e camas | Admissão (também de utentes não identificados), mapa de camas, pedidos de cama, transferências |
| Medicação | Prescrição, validação farmacêutica, MAR, reconciliação |
| Avaliação | Sinais vitais e NEWS2, escalas (com a ação que desencadeiam), avaliação inicial |
| Plano de cuidados | Diagnósticos e intervenções de enfermagem, tarefas |
| Vigilância | Alertas, sépsis, deterioração, dispositivos invasivos, IACS |
| Turno | O meu turno, atribuições, passagem de turno (ISBAR) |
| Alta | Planeamento da alta, nota de alta de enfermagem, carta de alta (rascunho revisto por um médico) |
| Qualidade e dotações | Eventos adversos, indicadores, dotação segura por turno |

## Satélites: só na interface com o internamento

- **Urgência e bloco:** entram como origem e destino do doente internado, não como módulos completos.
- **Consultas, receção e senhas:** chegada do doente e balcões.
- **RH, no que afeta a escala:** ausências, férias e trocas de folga.

## Opcionais: desligáveis por instalação

Estão em `libs/shared/src/lib/modulos.ts`. Cada um tem a flag `modulo.<id>`:
- **Sem flag:** o módulo está ligado, por isso nenhuma instalação existente perde funcionalidades.
- **Flag a `false`:**
  - a API responde 404 em todas as rotas do módulo (`ModuloGuard`, global);
  - a web tira-o do menu e mostra "Módulo desligado" a quem abrir o endereço.

Liga-se e desliga-se em **Configurações → Módulos opcionais** (TI) ou com `PUT /v1/feature-flags/modulo.<id>`. Desligar um módulo **não apaga dados**.

| Módulo | Porque é opcional |
|---|---|
| Faturação e tabela de atos | No SNS, o internamento é financiado por GDH a partir da codificação ICD-10-CM/PCS, no HIS. Pagamentos ao balcão são do ERP do privado. |
| Fornecedores e encomendas | Compras são do ERP. |
| Equipamentos | Gestão de ativos é do sistema de manutenção. |
| Pedidos e incidentes de TI | O hospital tem *helpdesk*. |
| RH: formações, avaliações, contratos, bem-estar | Gestão de pessoas é do sistema de RH. |
| Maternidade, oncologia, diálise | Especialidades em protótipo, com poucos endpoints. Não se vendem como profundidade clínica. |
| Triagem por IA no portal | Decisão clínica por IA, desligada por omissão (PROD-19). |
| Saúde populacional, outcomes, regras clínicas, lista de espera | Sem ecrã na web (ARQ-16). |

**Para uma instalação SNS**, recomenda-se desligar `faturacao`, `compras`, `equipamentos`, `ti` e `rh`, e as especialidades que o serviço não tenha.

## Codificação clínica (PROD-23)

A codificação para financiamento (GDH) é feita no HIS, por médicos codificadores. O CuraSphere:
- **regista diagnósticos** com código ICD-10-CM. A lista incluída (`codificacao/icd10-data.ts`) é um **subconjunto de apoio** de cerca de 120 códigos comuns, não o catálogo completo. Não inclui ICD-10-PCS;
- **envia-os ao HIS** pelas interfaces (HL7 ADT, FHIR `Condition`; ver `INTEROPERABILIDADE.md`);
- **não agrupa em GDH** e não fatura o internamento.

Para codificar a sério, a instalação deve consumir o catálogo completo e licenciado do HIS, em vez de o manter aqui.

## Duplicados a fundir

| Duplicado | Achado |
|---|---|
| Escalas: um só motor no servidor | ARQ-19 |
| Passagem de turno | UX-22, feito |
| As duas vias de alta | PROD-12 |
