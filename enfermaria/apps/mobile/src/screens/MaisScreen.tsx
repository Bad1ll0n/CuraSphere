import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import api from '../lib/api';
import { logout, Utilizador } from '../lib/auth';
import HorariosScreen from './HorariosScreen';
import AtribuicoesScreen from './AtribuicoesScreen';
import CamasScreen from './CamasScreen';
import TrocasScreen from './TrocasScreen';
import UtilizadoresScreen from './UtilizadoresScreen';
import TurnoScreen from './TurnoScreen';
import PassagemTurnoScreen from './PassagemTurnoScreen';
import AuditoriaScreen from './AuditoriaScreen';
import DashboardTIScreen from './DashboardTIScreen';
import PedidosTIScreen from './PedidosTIScreen';
import FarmaciaScreen from './FarmaciaScreen';
import FisioterapiaScreen from './FisioterapiaScreen';
import ConsultasScreen from './ConsultasScreen';
import UrgenciaScreen from './UrgenciaScreen';
import SalaEsperaScreen from './SalaEsperaScreen';
import IACSScreen from './IACSScreen';
import MARScreen from './MARScreen';
import ComunicacaoScreen from './ComunicacaoScreen';
import FeriasScreen from './FeriasScreen';
import PedidosInternosScreen from './PedidosInternosScreen';
import InterconsultasScreen from './InterconsultasScreen';
import WorklistScreen from './WorklistScreen';
import EspecialidadesScreen from './EspecialidadesScreen';
import BlocoScreen from './BlocoScreen';
import CatalogoScreen from './CatalogoScreen';
import DashboardQualidadeScreen from './DashboardQualidadeScreen';
import NotificacoesScreen from './NotificacoesScreen';
import DietasScreen from './DietasScreen';
import EventosAdversosScreen from './EventosAdversosScreen';
import EquipamentosScreen from './EquipamentosScreen';
import ConsentimentosScreen from './ConsentimentosScreen';
import RHScreen from './RHScreen';
import FaturacaoScreen from './FaturacaoScreen';
import DashboardExecutivoScreen from './DashboardExecutivoScreen';
import RelatoriosScreen from './RelatoriosScreen';
import ConformidadeScreen from './ConformidadeScreen';

type SubTela =
  | null
  | 'horarios' | 'atribuicoes' | 'camas' | 'trocas' | 'utilizadores'
  | 'turno' | 'passagem' | 'auditoria' | 'dashboardti' | 'pedidosti'
  | 'farmacia' | 'fisioterapia' | 'consultas' | 'urgencia'
  | 'salaespera' | 'iacs' | 'mar' | 'comunicacao'
  | 'ferias' | 'pedidosInternos' | 'interconsultas' | 'worklist'
  | 'especialidades' | 'bloco' | 'catalogo' | 'dashboardqualidade'
  | 'notificacoes' | 'dietas' | 'eventosadversos' | 'equipamentos' | 'consentimentos'
  | 'rh' | 'faturacao' | 'dashexecutivo' | 'relatorios' | 'conformidade';

const ROLES_MEDICO     = ['medico'];
const ROLES_ENFERMAGEM = ['enfermeiro', 'auxiliar'];
const ROLES_CLINICO    = ['medico', 'enfermeiro', 'auxiliar', 'tecnico_saude', 'farmaceutico'];
const ROLES_ADMIN      = ['administrativo'];
const ROLES_QUALIDADE  = ['qualidade'];

const roleLabel: Record<string, string> = {
  medico:         'Médico',
  enfermeiro:     'Enfermeiro',
  auxiliar:       'Auxiliar',
  tecnico_saude:  'Técnico de Saúde',
  farmaceutico:   'Farmacêutico',
  administrativo: 'Administrativo',
  operacional:    'Operacional',
  ti:             'Tecnologias de Informação',
  qualidade:      'Qualidade',
  direcao:        'Direção',
};

interface Props { utilizador: Utilizador; onLogout: () => void }

export default function MaisScreen({ utilizador, onLogout }: Props) {
  const [subTela, setSubTela] = useState<SubTela>(null);
  const [naoLidasNotif, setNaoLidasNotif] = useState(0);

  useFocusEffect(useCallback(() => {
    api.get('/notificacoes/nao-lidas')
      .then(r => setNaoLidasNotif(r.data.count ?? 0))
      .catch(() => {});
  }, []));

  const voltar = () => setSubTela(null);

  if (subTela === 'horarios')     return <HorariosScreen utilizador={utilizador} onVoltar={voltar} />;
  if (subTela === 'atribuicoes')  return <AtribuicoesScreen utilizador={utilizador} onVoltar={voltar} />;
  if (subTela === 'camas')        return <CamasScreen utilizador={utilizador} onVoltar={voltar} />;
  if (subTela === 'trocas')       return <TrocasScreen utilizador={utilizador} onVoltar={voltar} />;
  if (subTela === 'utilizadores') return <UtilizadoresScreen utilizador={utilizador} onVoltar={voltar} />;
  if (subTela === 'turno')        return <TurnoScreen utilizador={utilizador} onVoltar={voltar} />;
  if (subTela === 'passagem')     return <PassagemTurnoScreen utilizador={utilizador} onVoltar={voltar} />;
  if (subTela === 'auditoria')    return <AuditoriaScreen utilizador={utilizador} onVoltar={voltar} />;
  if (subTela === 'dashboardti')  return <DashboardTIScreen utilizador={utilizador} onVoltar={voltar} />;
  if (subTela === 'pedidosti')    return <PedidosTIScreen utilizador={utilizador} />;
  if (subTela === 'farmacia')     return <FarmaciaScreen utilizador={utilizador} onVoltar={voltar} />;
  if (subTela === 'fisioterapia') return <FisioterapiaScreen utilizador={utilizador} onVoltar={voltar} />;
  if (subTela === 'consultas')    return <ConsultasScreen utilizador={utilizador} onVoltar={voltar} />;
  if (subTela === 'urgencia')     return <UrgenciaScreen utilizador={utilizador} onVoltar={voltar} />;
  if (subTela === 'salaespera')   return <SalaEsperaScreen utilizador={utilizador} onVoltar={voltar} />;
  if (subTela === 'iacs')         return <IACSScreen utilizador={utilizador} onVoltar={voltar} />;
  if (subTela === 'mar')          return <MARScreen utilizador={utilizador} onVoltar={voltar} />;
  if (subTela === 'comunicacao')  return <ComunicacaoScreen utilizador={utilizador} onVoltar={voltar} />;
  if (subTela === 'ferias')          return <FeriasScreen utilizador={utilizador} onVoltar={voltar} />;
  if (subTela === 'pedidosInternos') return <PedidosInternosScreen utilizador={utilizador} onVoltar={voltar} />;
  if (subTela === 'interconsultas')  return <InterconsultasScreen utilizador={utilizador} onVoltar={voltar} />;
  if (subTela === 'worklist')        return <WorklistScreen utilizador={utilizador} onVoltar={voltar} />;
  if (subTela === 'especialidades')  return <EspecialidadesScreen utilizador={utilizador} onVoltar={voltar} />;
  if (subTela === 'bloco')               return <BlocoScreen utilizador={utilizador} onVoltar={voltar} />;
  if (subTela === 'catalogo')            return <CatalogoScreen utilizador={utilizador} onVoltar={voltar} />;
  if (subTela === 'dashboardqualidade')  return <DashboardQualidadeScreen utilizador={utilizador} onVoltar={voltar} />;
  if (subTela === 'notificacoes')        return <NotificacoesScreen utilizador={utilizador} onVoltar={() => { setNaoLidasNotif(0); voltar(); }} />;
  if (subTela === 'dietas')              return <DietasScreen utilizador={utilizador} onVoltar={voltar} />;
  if (subTela === 'eventosadversos')     return <EventosAdversosScreen utilizador={utilizador} onVoltar={voltar} />;
  if (subTela === 'equipamentos')        return <EquipamentosScreen utilizador={utilizador} onVoltar={voltar} />;
  if (subTela === 'consentimentos')      return <ConsentimentosScreen utilizador={utilizador} onVoltar={voltar} />;
  if (subTela === 'rh')                  return <RHScreen utilizador={utilizador} onVoltar={voltar} />;
  if (subTela === 'faturacao')           return <FaturacaoScreen utilizador={utilizador} onVoltar={voltar} />;
  if (subTela === 'dashexecutivo')       return <DashboardExecutivoScreen utilizador={utilizador} onVoltar={voltar} />;
  if (subTela === 'relatorios')          return <RelatoriosScreen utilizador={utilizador} onVoltar={voltar} />;
  if (subTela === 'conformidade')        return <ConformidadeScreen utilizador={utilizador} onVoltar={voltar} />;

  const confirmarLogout = async () => {
    if (Platform.OS === 'web') {
      if ((window as any).confirm('Tem a certeza que quer terminar a sessão?')) {
        await logout();
        onLogout();
      }
    } else {
      Alert.alert('Sair', 'Tem a certeza que quer sair?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sair', style: 'destructive', onPress: async () => { await logout(); onLogout(); } },
      ]);
    }
  };

  const role = utilizador.role;
  const subRole = utilizador.subRole;
  const eClinical = ROLES_CLINICO.includes(role);
  const eMedico = ROLES_MEDICO.includes(role);
  const eEnfermagem = ROLES_ENFERMAGEM.includes(role);
  const eTI = role === 'ti';
  const eFarmaceutico = role === 'farmaceutico';
  const eTecnicoSaude = role === 'tecnico_saude';
  const eAdmin = ROLES_ADMIN.includes(role);
  const eOperacional = role === 'operacional';

  const itens: { key: SubTela; icon: keyof typeof Ionicons.glyphMap; cor: string; titulo: string; sub: string; visivel: boolean; badge?: number }[] = [
    // — TI
    { key: 'utilizadores', icon: 'people-outline',           cor: '#ec4899', titulo: 'Utilizadores',      sub: 'Gestão de profissionais',          visivel: eTI && subRole === 'it_admin' },
    { key: 'auditoria',    icon: 'document-text-outline',    cor: '#64748b', titulo: 'Auditoria',          sub: 'Logs de acesso e ações',           visivel: eTI || ROLES_QUALIDADE.includes(role) },
    // — Comunicação e Notificações (universal)
    { key: 'notificacoes', icon: 'notifications-outline',    cor: '#6366f1', titulo: 'Notificações',       sub: 'Alertas e avisos do sistema',      visivel: true, badge: naoLidasNotif || undefined },
    { key: 'comunicacao',  icon: 'chatbubbles-outline',      cor: '#6366f1', titulo: 'Comunicação',        sub: 'Mensagens e anúncios',             visivel: true },
    // — Clínico geral
    { key: 'turno',        icon: 'time-outline',             cor: '#8b5cf6', titulo: 'Turno',              sub: 'Doentes e tarefas do meu turno',   visivel: eClinical },
    { key: 'passagem',     icon: 'git-merge-outline',        cor: '#06b6d4', titulo: 'Passagem de Turno',  sub: 'Informação do turno anterior',     visivel: eEnfermagem || eMedico },
    { key: 'horarios',     icon: 'calendar-outline',         cor: '#6366f1', titulo: 'Horários',           sub: 'Escala mensal de turnos',          visivel: eClinical || eAdmin },
    { key: 'atribuicoes',  icon: 'clipboard-outline',        cor: '#0ea5e9', titulo: 'Atribuições',        sub: 'Doentes por profissional',         visivel: eMedico || eEnfermagem },
    { key: 'camas',        icon: 'bed-outline',              cor: '#22c55e', titulo: 'Camas',              sub: 'Mapa de camas e quartos',          visivel: eMedico || eEnfermagem || eAdmin },
    { key: 'trocas',       icon: 'swap-horizontal-outline',  cor: '#f59e0b', titulo: 'Trocas de Turno',    sub: 'Pedidos de cobertura',             visivel: eClinical },
    // — Clínico especializado
    { key: 'iacs',         icon: 'shield-outline',           cor: '#7c3aed', titulo: 'IACS',               sub: 'Doentes em isolamento',            visivel: eMedico || eEnfermagem || ROLES_QUALIDADE.includes(role) },
    { key: 'mar',          icon: 'medical-outline',          cor: '#3b82f6', titulo: 'MAR',                sub: 'Mapa de administração de medicação', visivel: eEnfermagem },
    { key: 'urgencia',     icon: 'heart-outline',            cor: '#ef4444', titulo: 'Urgência',           sub: 'Episódios de urgência activos',    visivel: eMedico || eEnfermagem || eAdmin },
    { key: 'salaespera',   icon: 'people-circle-outline',    cor: '#f97316', titulo: 'Sala de Espera',     sub: 'Fila de espera da urgência',       visivel: eEnfermagem || eAdmin },
    { key: 'consultas',    icon: 'calendar-number-outline',  cor: '#10b981', titulo: 'Consultas',          sub: 'Consultas externas agendadas',     visivel: eMedico || eAdmin },
    { key: 'farmacia',     icon: 'flask-outline',            cor: '#ec4899', titulo: 'Farmácia',           sub: 'Stock e pedidos de medicação',     visivel: eFarmaceutico || eMedico },
    { key: 'fisioterapia', icon: 'fitness-outline',          cor: '#14b8a6', titulo: 'Fisioterapia',       sub: 'Planos de reabilitação',           visivel: eTecnicoSaude || eMedico },
    // — Novos ecrãs
    { key: 'ferias',          icon: 'umbrella-outline',              cor: '#0ea5e9', titulo: 'As Minhas Férias',    sub: 'Pedidos e saldo de férias',              visivel: true },
    { key: 'pedidosInternos', icon: 'list-outline',                  cor: '#f97316', titulo: 'Pedidos Internos',    sub: 'Transporte, limpeza, equipamentos',       visivel: eClinical || eAdmin || eOperacional },
    { key: 'interconsultas',  icon: 'chatbubble-ellipses-outline',   cor: '#8b5cf6', titulo: 'Interconsultas',      sub: 'Pedidos entre especialistas',            visivel: eMedico },
    { key: 'worklist',        icon: 'clipboard-outline',             cor: '#06b6d4', titulo: 'Worklist',            sub: 'Lista de trabalho',                      visivel: eTecnicoSaude || eMedico },
    { key: 'especialidades',  icon: 'ribbon-outline',                cor: '#14b8a6', titulo: 'Especialidades',      sub: 'Sessões de especialidade',               visivel: eTecnicoSaude },
    { key: 'bloco',           icon: 'cut-outline',                   cor: '#7c3aed', titulo: 'Bloco Operatório',    sub: 'Cirurgias agendadas',                    visivel: eMedico || eEnfermagem },
    { key: 'catalogo',            icon: 'book-outline',            cor: '#ec4899', titulo: 'Catálogo',               sub: 'Medicamentos e fármacos',            visivel: eFarmaceutico || eAdmin || eMedico || eEnfermagem },
    { key: 'dashboardqualidade',  icon: 'analytics-outline',       cor: '#0d9488', titulo: 'Dashboard Qualidade',    sub: 'Indicadores clínicos e de segurança', visivel: ROLES_QUALIDADE.includes(role) || role === 'direcao' || eMedico || eEnfermagem },
    { key: 'dietas',             icon: 'restaurant-outline',      cor: '#16a34a', titulo: 'Dietas',                  sub: 'Prescrições dietéticas do dia',       visivel: eClinical || eAdmin },
    { key: 'eventosadversos',    icon: 'warning-outline',         cor: '#dc2626', titulo: 'Eventos Adversos',        sub: 'Registo de incidentes e near misses',  visivel: eClinical || ROLES_QUALIDADE.includes(role) || role === 'direcao' },
    { key: 'equipamentos',       icon: 'construct-outline',       cor: '#0891b2', titulo: 'Equipamentos',             sub: 'Inventário e gestão de manutenções',   visivel: eOperacional || eTI || eClinical || eAdmin || role === 'direcao' },
    { key: 'consentimentos',     icon: 'document-text-outline',   cor: '#6366f1', titulo: 'Consentimentos',           sub: 'Consentimentos informados dos doentes', visivel: eMedico || eEnfermagem || eAdmin },
    // — Administrativo / Direção
    { key: 'rh',                 icon: 'people-circle-outline',   cor: '#7c3aed', titulo: 'Recursos Humanos',          sub: 'Ausências, formações e avaliações',     visivel: eAdmin || role === 'direcao' },
    { key: 'faturacao',          icon: 'card-outline',            cor: '#0d9488', titulo: 'Faturação',                 sub: 'Episódios de faturação e pagamentos',   visivel: eAdmin || role === 'direcao' },
    { key: 'dashexecutivo',      icon: 'bar-chart-outline',       cor: '#6366f1', titulo: 'Dashboard Executivo',       sub: 'KPIs operacionais e financeiros',        visivel: eAdmin || role === 'direcao' },
    { key: 'relatorios',         icon: 'document-text-outline',   cor: '#b45309', titulo: 'Relatórios DGS/SNS',        sub: 'Internamento, ocupação, diagnósticos',   visivel: eAdmin || role === 'direcao' || eTI },
    { key: 'conformidade',       icon: 'shield-checkmark-outline',cor: '#0d9488', titulo: 'Conformidade',              sub: 'Checklist RGPD, DGS, ACSS, SNS',         visivel: ROLES_QUALIDADE.includes(role) || role === 'direcao' || eTI },
  ];

  const itensVisiveis = itens.filter((i) => i.visivel);

  return (
    <ScrollView style={s.container}>
      {/* Perfil */}
      <View style={s.perfilCard}>
        <View style={s.avatar}>
          <Text style={s.avatarTexto}>{utilizador.nome.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={s.perfilInfo}>
          <Text style={s.perfilNome}>{utilizador.nome}</Text>
          <Text style={s.perfilRole}>{roleLabel[utilizador.role] ?? utilizador.role}</Text>
          {utilizador.subRole && (
            <Text style={s.perfilSubRole}>{utilizador.subRole.replace(/_/g, ' ')}</Text>
          )}
          <Text style={s.perfilNum}>Nº {utilizador.numeroFuncionario}</Text>
        </View>
      </View>

      {/* Menu */}
      <View style={s.secao}>
        <Text style={s.secaoTitulo}>Funcionalidades</Text>
        <View style={s.menuCard}>
          {itensVisiveis.map((item, i) => (
            <TouchableOpacity
              key={item.key}
              style={[s.menuItem, i < itensVisiveis.length - 1 && s.menuItemBorder]}
              onPress={() => setSubTela(item.key)}
              activeOpacity={0.7}
            >
              <View style={[s.menuIconBox, { backgroundColor: item.cor + '18' }]}>
                <Ionicons name={item.icon} size={20} color={item.cor} />
              </View>
              <View style={s.menuTextos}>
                <Text style={s.menuTitulo}>{item.titulo}</Text>
                <Text style={s.menuSub}>{item.sub}</Text>
              </View>
              {item.badge ? (
                <View style={s.badge}>
                  <Text style={s.badgeText}>{item.badge > 99 ? '99+' : item.badge}</Text>
                </View>
              ) : (
                <Text style={s.menuArrow}>›</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Logout */}
      <View style={s.secao}>
        <TouchableOpacity style={s.sairBotao} onPress={confirmarLogout}>
          <Text style={s.sairTexto}>Terminar Sessão</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  perfilCard: { backgroundColor: '#1e293b', padding: 24, paddingTop: 32, flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center' },
  avatarTexto: { fontSize: 24, fontWeight: '700', color: '#fff' },
  perfilInfo: { flex: 1 },
  perfilNome: { fontSize: 18, fontWeight: '700', color: '#fff' },
  perfilRole: { fontSize: 13, color: '#94a3b8', marginTop: 2 },
  perfilSubRole: { fontSize: 12, color: '#64748b', marginTop: 1, textTransform: 'capitalize' },
  perfilNum: { fontSize: 12, color: '#64748b', marginTop: 2 },
  secao: { padding: 16, paddingBottom: 0 },
  secaoTitulo: { fontSize: 12, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  menuCard: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 2 },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  menuItemBorder: { borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  menuIconBox: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  menuTextos: { flex: 1 },
  menuTitulo: { fontSize: 15, fontWeight: '600', color: '#1e293b' },
  menuSub: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  menuArrow: { fontSize: 20, color: '#cbd5e1', fontWeight: '300' },
  badge: {
    backgroundColor: '#ef4444', borderRadius: 12,
    minWidth: 22, height: 22, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6,
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  sairBotao: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', paddingVertical: 14, borderRadius: 14, alignItems: 'center', marginTop: 6 },
  sairTexto: { color: '#dc2626', fontWeight: '700', fontSize: 16 },
});
