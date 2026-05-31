import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Platform, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import api from '../lib/api';
import { Utilizador } from '../lib/auth';

interface Ausencia {
  id: string;
  tipo: string;
  dataInicio: string;
  dataFim: string;
  estado: string;
  motivo?: string;
  diasTotais: number;
  utilizador?: { id: string; nome: string; role: string };
  aprovadoPor?: { nome: string };
}

interface Formacao {
  id: string;
  nome: string;
  obrigatoria: boolean;
  dataRealizacao: string;
  dataExpiracao?: string;
  certificado?: string;
  utilizador?: { id: string; nome: string; role: string };
}

interface Avaliacao {
  id: string;
  periodo: string;
  notaFinal?: number;
  estado: string;
  comentarios?: string;
  criadoEm: string;
  utilizador?: { id: string; nome: string; role: string };
  avaliador?: { nome: string };
}

interface Pessoal {
  id: string;
  nome: string;
  role: string;
  subRole?: string;
  numeroFuncionario: string;
  email: string;
  contrato?: { tipo: string; dataInicio: string; dataFim?: string; salarioBase?: number };
}

interface Dashboard {
  ausenciasPendentes: number;
  ausenciasAtivas: number;
  formacoesAExpirar: number;
  totalStaff: number;
  contratosAExpirar: number;
  avaliacoesPendentes: number;
}

interface Props { utilizador: Utilizador; onVoltar: () => void }

type Tab = 'dashboard' | 'ausencias' | 'formacoes' | 'avaliacoes';
type AusenciasSub = 'todas' | 'para_aprovar';

const TIPO_AUSENCIA_LABEL: Record<string, string> = {
  ferias: 'Férias',
  doenca: 'Doença',
  formacao: 'Formação',
  licenca: 'Licença',
  outros: 'Outros',
};

const AUSENCIA_ESTADO: Record<string, { bg: string; text: string; label: string }> = {
  pendente:  { bg: '#fef3c7', text: '#b45309', label: 'Pendente' },
  aprovada:  { bg: '#d1fae5', text: '#059669', label: 'Aprovada' },
  rejeitada: { bg: '#fee2e2', text: '#dc2626', label: 'Rejeitada' },
};

const AVALIACAO_ESTADO: Record<string, { bg: string; text: string; label: string }> = {
  pendente:    { bg: '#fef3c7', text: '#b45309', label: 'Pendente' },
  concluida:   { bg: '#d1fae5', text: '#059669', label: 'Concluída' },
  em_revisao:  { bg: '#dbeafe', text: '#1d4ed8', label: 'Em Revisão' },
};

function fmtData(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function diasParaExpirar(iso?: string): number | null {
  if (!iso) return null;
  return Math.round((new Date(iso).getTime() - Date.now()) / 86400000);
}

export default function RHScreen({ utilizador, onVoltar }: Props) {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [ausenciasSub, setAusenciasSub] = useState<AusenciasSub>('todas');

  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [ausencias, setAusencias] = useState<Ausencia[]>([]);
  const [ausenciasAprovar, setAusenciasAprovar] = useState<Ausencia[]>([]);
  const [formacoes, setFormacoes] = useState<Formacao[]>([]);
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([]);

  const [loading, setLoading] = useState(false);
  const [aprovando, setAprovando] = useState<string | null>(null);
  const [rejeitando, setRejeitando] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'dashboard') {
        const r = await api.get('/rh/dashboard');
        setDashboard(r.data);
      } else if (tab === 'ausencias') {
        const [todas, aprovar] = await Promise.all([
          api.get('/rh/ausencias'),
          api.get('/rh/ausencias/para-aprovar'),
        ]);
        setAusencias(todas.data ?? []);
        setAusenciasAprovar(aprovar.data ?? []);
      } else if (tab === 'formacoes') {
        const r = await api.get('/rh/formacoes');
        setFormacoes(r.data ?? []);
      } else if (tab === 'avaliacoes') {
        const r = await api.get('/rh/avaliacoes');
        setAvaliacoes(r.data ?? []);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  const aprovar = async (id: string) => {
    setAprovando(id);
    try {
      await api.patch(`/rh/ausencias/${id}/aprovar`);
      await carregar();
    } catch {
      Alert.alert('Erro', 'Não foi possível aprovar a ausência.');
    } finally {
      setAprovando(null);
    }
  };

  const rejeitar = async (id: string) => {
    setRejeitando(id);
    try {
      await api.patch(`/rh/ausencias/${id}/rejeitar`);
      await carregar();
    } catch {
      Alert.alert('Erro', 'Não foi possível rejeitar a ausência.');
    } finally {
      setRejeitando(null);
    }
  };

  const TABS: { key: Tab; label: string }[] = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'ausencias', label: 'Ausências' },
    { key: 'formacoes', label: 'Formações' },
    { key: 'avaliacoes', label: 'Avaliações' },
  ];

  const listaAusencias = ausenciasSub === 'todas' ? ausencias : ausenciasAprovar;

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={onVoltar} style={s.btnVoltar} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color="#0f172a" />
        </TouchableOpacity>
        <Text style={s.headerTitulo}>Recursos Humanos</Text>
        <View style={{ width: 38 }} />
      </View>

      <View style={s.tabRow}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[s.tab, tab === t.key && s.tabAtiva]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[s.tabLabel, tab === t.key && s.tabLabelAtiva]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={s.centro}>
          <ActivityIndicator size="large" color="#0f172a" />
        </View>
      ) : tab === 'dashboard' ? (
        <ScrollView contentContainerStyle={s.scrollContent}>
          {!dashboard ? (
            <View style={s.vazioWrap}>
              <Ionicons name="bar-chart-outline" size={48} color="#94a3b8" />
              <Text style={s.vazioTexto}>Sem dados.</Text>
            </View>
          ) : (
            <View style={s.kpiGrid}>
              <View style={[s.kpiCard, { borderTopColor: '#475569' }]}>
                <Text style={[s.kpiValor, { color: '#0f172a' }]}>{dashboard.totalStaff}</Text>
                <Text style={s.kpiLabel}>Total Staff</Text>
              </View>
              <View style={[s.kpiCard, { borderTopColor: '#b45309' }]}>
                <Text style={[s.kpiValor, { color: '#b45309' }]}>{dashboard.ausenciasPendentes}</Text>
                <Text style={s.kpiLabel}>Aus. Pendentes</Text>
              </View>
              <View style={[s.kpiCard, { borderTopColor: '#2563eb' }]}>
                <Text style={[s.kpiValor, { color: '#2563eb' }]}>{dashboard.ausenciasAtivas}</Text>
                <Text style={s.kpiLabel}>Aus. Ativas</Text>
              </View>
              <View style={[s.kpiCard, { borderTopColor: '#dc2626' }]}>
                <Text style={[s.kpiValor, { color: '#dc2626' }]}>{dashboard.formacoesAExpirar}</Text>
                <Text style={s.kpiLabel}>Form. a Expirar</Text>
              </View>
              <View style={[s.kpiCard, { borderTopColor: '#dc2626' }]}>
                <Text style={[s.kpiValor, { color: '#dc2626' }]}>{dashboard.contratosAExpirar}</Text>
                <Text style={s.kpiLabel}>Contratos a Expirar</Text>
              </View>
              <View style={[s.kpiCard, { borderTopColor: '#b45309' }]}>
                <Text style={[s.kpiValor, { color: '#b45309' }]}>{dashboard.avaliacoesPendentes}</Text>
                <Text style={s.kpiLabel}>Aval. Pendentes</Text>
              </View>
            </View>
          )}
        </ScrollView>
      ) : tab === 'ausencias' ? (
        <>
          <View style={s.segmentRow}>
            <TouchableOpacity
              style={[s.segmentBtn, ausenciasSub === 'todas' && s.segmentBtnAtivo]}
              onPress={() => setAusenciasSub('todas')}
            >
              <Text style={[s.segmentLabel, ausenciasSub === 'todas' && s.segmentLabelAtivo]}>Todas</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.segmentBtn, ausenciasSub === 'para_aprovar' && s.segmentBtnAtivo]}
              onPress={() => setAusenciasSub('para_aprovar')}
            >
              <Text style={[s.segmentLabel, ausenciasSub === 'para_aprovar' && s.segmentLabelAtivo]}>
                Para Aprovar{ausenciasAprovar.length > 0 ? ` (${ausenciasAprovar.length})` : ''}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={s.scrollContent}>
            {listaAusencias.length === 0 ? (
              <View style={s.vazioWrap}>
                <Ionicons name="calendar-outline" size={48} color="#94a3b8" />
                <Text style={s.vazioTexto}>Sem dados.</Text>
              </View>
            ) : listaAusencias.map((a) => {
              const est = AUSENCIA_ESTADO[a.estado] ?? { bg: '#f1f5f9', text: '#64748b', label: a.estado };
              return (
                <View key={a.id} style={s.card}>
                  <View style={s.cardTopoRow}>
                    {a.utilizador && (
                      <Text style={s.cardNome}>{a.utilizador.nome}</Text>
                    )}
                    <View style={[s.badge, { backgroundColor: est.bg }]}>
                      <Text style={[s.badgeTexto, { color: est.text }]}>{est.label}</Text>
                    </View>
                  </View>

                  <View style={s.cardInfoRow}>
                    <View style={[s.badge, { backgroundColor: '#f1f5f9' }]}>
                      <Text style={[s.badgeTexto, { color: '#475569' }]}>
                        {TIPO_AUSENCIA_LABEL[a.tipo] ?? a.tipo}
                      </Text>
                    </View>
                    <Text style={s.cardMeta}>{a.diasTotais} dias</Text>
                  </View>

                  <View style={s.cardMetaRow}>
                    <Ionicons name="calendar-outline" size={13} color="#94a3b8" />
                    <Text style={s.cardMeta}>{fmtData(a.dataInicio)} → {fmtData(a.dataFim)}</Text>
                  </View>

                  {a.aprovadoPor && (
                    <View style={s.cardMetaRow}>
                      <Ionicons name="checkmark-circle-outline" size={13} color="#94a3b8" />
                      <Text style={s.cardMeta}>Aprovado por {a.aprovadoPor.nome}</Text>
                    </View>
                  )}

                  {ausenciasSub === 'para_aprovar' && (
                    <View style={s.acoesRow}>
                      <TouchableOpacity
                        style={[s.btnAprovar, aprovando === a.id && s.btnDesativado]}
                        onPress={() => aprovar(a.id)}
                        disabled={aprovando === a.id || rejeitando === a.id}
                        activeOpacity={0.8}
                      >
                        {aprovando === a.id ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text style={s.btnAcoesTexto}>Aprovar</Text>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[s.btnRejeitar, rejeitando === a.id && s.btnDesativado]}
                        onPress={() => rejeitar(a.id)}
                        disabled={aprovando === a.id || rejeitando === a.id}
                        activeOpacity={0.8}
                      >
                        {rejeitando === a.id ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text style={s.btnAcoesTexto}>Rejeitar</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>
        </>
      ) : tab === 'formacoes' ? (
        <ScrollView contentContainerStyle={s.scrollContent}>
          {formacoes.length === 0 ? (
            <View style={s.vazioWrap}>
              <Ionicons name="school-outline" size={48} color="#94a3b8" />
              <Text style={s.vazioTexto}>Sem dados.</Text>
            </View>
          ) : formacoes.map((f) => {
            const dias = diasParaExpirar(f.dataExpiracao);
            const expiracaoCor = dias === null ? null : dias < 0 ? '#dc2626' : dias <= 30 ? '#b45309' : null;
            return (
              <View key={f.id} style={s.card}>
                <View style={s.cardTopoRow}>
                  <Text style={s.cardNome} numberOfLines={2}>{f.nome}</Text>
                  {f.obrigatoria && (
                    <View style={[s.badge, { backgroundColor: '#fee2e2' }]}>
                      <Text style={[s.badgeTexto, { color: '#dc2626' }]}>Obrigatória</Text>
                    </View>
                  )}
                </View>

                {f.utilizador && (
                  <View style={s.cardMetaRow}>
                    <Ionicons name="person-outline" size={13} color="#94a3b8" />
                    <Text style={s.cardMeta}>{f.utilizador.nome}</Text>
                  </View>
                )}

                <View style={s.cardMetaRow}>
                  <Ionicons name="calendar-outline" size={13} color="#94a3b8" />
                  <Text style={s.cardMeta}>Realizada: {fmtData(f.dataRealizacao)}</Text>
                </View>

                {f.dataExpiracao && (
                  <View style={s.cardMetaRow}>
                    <Ionicons name="time-outline" size={13} color={expiracaoCor ?? '#94a3b8'} />
                    <Text style={[s.cardMeta, expiracaoCor ? { color: expiracaoCor, fontWeight: '600' } : {}]}>
                      Expira: {fmtData(f.dataExpiracao)}
                      {dias !== null && dias < 0 ? ' (Expirada)' : dias !== null && dias <= 30 ? ` (${dias}d)` : ''}
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={s.scrollContent}>
          {avaliacoes.length === 0 ? (
            <View style={s.vazioWrap}>
              <Ionicons name="star-outline" size={48} color="#94a3b8" />
              <Text style={s.vazioTexto}>Sem dados.</Text>
            </View>
          ) : avaliacoes.map((a) => {
            const est = AVALIACAO_ESTADO[a.estado] ?? { bg: '#f1f5f9', text: '#64748b', label: a.estado };
            return (
              <View key={a.id} style={s.card}>
                <View style={s.cardTopoRow}>
                  {a.utilizador && (
                    <Text style={s.cardNome}>{a.utilizador.nome}</Text>
                  )}
                  <View style={[s.badge, { backgroundColor: est.bg }]}>
                    <Text style={[s.badgeTexto, { color: est.text }]}>{est.label}</Text>
                  </View>
                </View>

                <View style={s.cardMetaRow}>
                  <Ionicons name="calendar-outline" size={13} color="#94a3b8" />
                  <Text style={s.cardMeta}>Período: {a.periodo}</Text>
                </View>

                {a.notaFinal !== undefined && a.notaFinal !== null && (
                  <View style={s.cardMetaRow}>
                    <Ionicons name="star-outline" size={13} color="#94a3b8" />
                    <Text style={s.cardMeta}>Nota: {a.notaFinal}/10</Text>
                  </View>
                )}

                {a.avaliador && (
                  <View style={s.cardMetaRow}>
                    <Ionicons name="person-outline" size={13} color="#94a3b8" />
                    <Text style={s.cardMeta}>Avaliador: {a.avaliador.nome}</Text>
                  </View>
                )}

                {a.comentarios ? (
                  <Text style={s.comentarios} numberOfLines={2}>{a.comentarios}</Text>
                ) : null}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 56 : 16,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  btnVoltar: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitulo: { fontSize: 17, fontWeight: '700', color: '#0f172a' },

  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabAtiva: { borderBottomWidth: 2, borderBottomColor: '#0f172a' },
  tabLabel: { fontSize: 12, color: '#94a3b8', fontWeight: '500' },
  tabLabelAtiva: { color: '#0f172a', fontWeight: '700' },

  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  scrollContent: { padding: 16, gap: 10, paddingBottom: 40 },

  vazioWrap: { alignItems: 'center', paddingTop: 60, gap: 12 },
  vazioTexto: { color: '#94a3b8', fontSize: 15 },

  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  kpiCard: {
    width: '47%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderTopWidth: 3,
    gap: 4,
  },
  kpiValor: { fontSize: 28, fontWeight: '800' },
  kpiLabel: { fontSize: 12, color: '#64748b', fontWeight: '500' },

  segmentRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    gap: 8,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  segmentBtnAtivo: { backgroundColor: '#0f172a', borderColor: '#0f172a' },
  segmentLabel: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  segmentLabelAtivo: { color: '#fff' },

  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 6,
  },
  cardTopoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardNome: { flex: 1, fontSize: 15, fontWeight: '700', color: '#0f172a' },
  cardInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  cardMeta: { fontSize: 12, color: '#94a3b8' },

  badge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20 },
  badgeTexto: { fontSize: 11, fontWeight: '700' },

  acoesRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  btnAprovar: {
    flex: 1,
    backgroundColor: '#059669',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  btnRejeitar: {
    flex: 1,
    backgroundColor: '#dc2626',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  btnAcoesTexto: { color: '#fff', fontSize: 13, fontWeight: '700' },
  btnDesativado: { opacity: 0.5 },

  comentarios: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
    marginTop: 2,
  },
});
