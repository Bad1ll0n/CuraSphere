import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import api from '../lib/api';
import { Utilizador } from '../lib/auth';

interface DadosQualidade {
  iacs: {
    totalIsolados: number;
    porMotivo: { motivo: string; total: number }[];
    tendencia: { data: string; total: number }[];
  };
  alertas: {
    naoLidos: number;
    porTipo: { tipo: string; total: number }[];
    recentes: {
      id: string; tipo: string; mensagem: string; criadoEm: string;
      doente: { id: string; nome: string };
    }[];
  };
  riscos: {
    altoRisco7Dias: number;
    porTipo: { tipo: string; total: number }[];
  };
  doentes: {
    criticos: number;
    instaveis: number;
    ocupacao: { total: number; ocupadas: number; taxa: number };
  };
  alta: {
    altas30Dias: number;
    comSumario: number;
    taxaComplitude: number;
  };
  medicacao: {
    pendentes: number;
    administradasHoje: number;
  };
}

interface EventosIndicadores {
  total30d: number;
  abertos: number;
  totalMes: number;
  totalMesPassado: number;
  porTipo: { tipo: string; total: number }[];
  porGravidade: { gravidade: string; total: number }[];
}

interface Props { utilizador: Utilizador; onVoltar: () => void }

const TIPO_LABEL: Record<string, string> = {
  queda: 'Queda', erro_medicacao: 'Erro Medicação', near_miss: 'Near Miss',
  infecao: 'Infeção', lesao_pressao: 'Lesão Pressão', outro: 'Outro',
};

const GRAVIDADE_COR: Record<string, string> = {
  sem_dano: '#22c55e', dano_leve: '#eab308', dano_moderado: '#f97316',
  dano_grave: '#ef4444', obito: '#1e293b',
};

const GRAVIDADE_LABEL: Record<string, string> = {
  sem_dano: 'Sem Dano', dano_leve: 'Dano Leve', dano_moderado: 'Moderado',
  dano_grave: 'Grave', obito: 'Óbito',
};

export default function DashboardQualidadeScreen({ utilizador, onVoltar }: Props) {
  const [dados, setDados] = useState<DadosQualidade | null>(null);
  const [eventos, setEventos] = useState<EventosIndicadores | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const carregar = async () => {
    try {
      const [r1, r2] = await Promise.all([
        api.get('/dashboard/qualidade'),
        api.get('/eventos-adversos/indicadores').catch(() => ({ data: null })),
      ]);
      setDados(r1.data);
      setEventos(r2.data);
    } catch { /* ignorar */ }
    finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { carregar(); }, []));

  const fmtHora = (d: string) =>
    new Date(d).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });

  if (loading) return <View style={s.centro}><ActivityIndicator size="large" color="#0d9488" /></View>;

  const maxTendencia = dados ? Math.max(...dados.iacs.tendencia.map(t => t.total), 1) : 1;

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onVoltar} style={s.voltarBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitulo}>Dashboard de Qualidade</Text>
          <Text style={s.headerSub}>Indicadores clínicos e de segurança</Text>
        </View>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); carregar(); }} tintColor="#0d9488" />}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, gap: 16 }}
      >
        {!dados ? (
          <View style={s.vazio}>
            <Ionicons name="analytics-outline" size={48} color="#94a3b8" />
            <Text style={s.vazioTexto}>Sem dados disponíveis</Text>
          </View>
        ) : (
          <>
            {/* KPI Cards */}
            <View style={s.kpiGrid}>
              <View style={[s.kpiCard, { borderTopColor: '#ef4444' }]}>
                <Text style={s.kpiValor}>{dados.iacs.totalIsolados}</Text>
                <Text style={s.kpiTitulo}>Isolamentos IACS</Text>
              </View>
              <View style={[s.kpiCard, { borderTopColor: dados.alertas.naoLidos > 0 ? '#f59e0b' : '#22c55e' }]}>
                <Text style={[s.kpiValor, { color: dados.alertas.naoLidos > 0 ? '#f59e0b' : '#22c55e' }]}>{dados.alertas.naoLidos}</Text>
                <Text style={s.kpiTitulo}>Alertas não lidos</Text>
              </View>
              <View style={[s.kpiCard, { borderTopColor: '#f97316' }]}>
                <Text style={s.kpiValor}>{dados.riscos.altoRisco7Dias}</Text>
                <Text style={s.kpiTitulo}>Alto risco 7d</Text>
              </View>
              <View style={[s.kpiCard, { borderTopColor: dados.alta.taxaComplitude >= 80 ? '#10b981' : '#f43f5e' }]}>
                <Text style={[s.kpiValor, { color: dados.alta.taxaComplitude >= 80 ? '#10b981' : '#f43f5e' }]}>{dados.alta.taxaComplitude}%</Text>
                <Text style={s.kpiTitulo}>Taxa sumário</Text>
              </View>
            </View>

            {/* Ocupação & Estado */}
            <View style={s.secao}>
              <Text style={s.secaoTitulo}>Ocupação & Estado Clínico</Text>

              {/* Barra ocupação */}
              <View style={{ marginBottom: 14 }}>
                <View style={s.ocupacaoRow}>
                  <Text style={s.ocupacaoLabel}>Ocupação</Text>
                  <Text style={s.ocupacaoValor}>{dados.doentes.ocupacao.taxa}%</Text>
                </View>
                <View style={s.barraFundo}>
                  <View style={[
                    s.barraPreenchimento,
                    { width: `${dados.doentes.ocupacao.taxa}%` as any,
                      backgroundColor: dados.doentes.ocupacao.taxa >= 90 ? '#ef4444'
                        : dados.doentes.ocupacao.taxa >= 75 ? '#f59e0b' : '#22c55e' }
                  ]} />
                </View>
                <Text style={s.ocupacaoSub}>{dados.doentes.ocupacao.ocupadas} de {dados.doentes.ocupacao.total} camas</Text>
              </View>

              {/* Estado cards */}
              {[
                { label: 'Críticos', valor: dados.doentes.criticos, cor: '#ef4444', bg: '#fef2f2' },
                { label: 'Graves', valor: dados.doentes.instaveis, cor: '#f97316', bg: '#fff7ed' },
                { label: 'Medicação pendente', valor: dados.medicacao.pendentes, cor: '#64748b', bg: '#f8fafc' },
              ].map(({ label, valor, cor, bg }) => (
                <View key={label} style={[s.estadoRow, { backgroundColor: bg }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={[s.estadoPonto, { backgroundColor: cor }]} />
                    <Text style={s.estadoLabel}>{label}</Text>
                  </View>
                  <Text style={[s.estadoValor, { color: cor }]}>{valor}</Text>
                </View>
              ))}
            </View>

            {/* Tendência IACS */}
            {dados.iacs.tendencia.length > 0 && (
              <View style={s.secao}>
                <Text style={s.secaoTitulo}>Tendência IACS — 7 dias</Text>
                <Text style={s.secaoSub}>Isolamentos activos por dia</Text>
                <View style={s.tendenciaGrafico}>
                  {dados.iacs.tendencia.map(({ data, total }) => (
                    <View key={data} style={s.tendenciaColuna}>
                      <Text style={s.tendenciaNum}>{total}</Text>
                      <View style={[s.tendenciaBarra, { height: Math.max(4, (total / maxTendencia) * 64) }]} />
                      <Text style={s.tendenciaDia}>{new Date(data).getDate()}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* IACS por Motivo */}
            {dados.iacs.porMotivo.length > 0 && (
              <View style={s.secao}>
                <Text style={s.secaoTitulo}>IACS por Agente</Text>
                {dados.iacs.porMotivo.map(({ motivo, total }) => (
                  <View key={motivo} style={s.listaRow}>
                    <Text style={s.listaLabel}>{motivo}</Text>
                    <Text style={[s.listaValor, { color: '#ef4444' }]}>{total}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Alertas recentes */}
            <View style={s.secao}>
              <View style={s.secaoHeader}>
                <Text style={s.secaoTitulo}>Alertas Clínicos Não Lidos</Text>
                {dados.alertas.naoLidos > 0 && (
                  <View style={s.badge}>
                    <Text style={s.badgeTexto}>{dados.alertas.naoLidos}</Text>
                  </View>
                )}
              </View>
              {dados.alertas.recentes.length === 0 ? (
                <Text style={s.semDados}>Sem alertas activos</Text>
              ) : dados.alertas.recentes.slice(0, 8).map(alerta => (
                <View key={alerta.id} style={s.alertaRow}>
                  <View style={s.alertaPonto} />
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', gap: 6, marginBottom: 2 }}>
                      <Text style={s.alertaTipo}>{alerta.tipo}</Text>
                      <Text style={s.alertaSep}>·</Text>
                      <Text style={s.alertaDoente} numberOfLines={1}>{alerta.doente.nome}</Text>
                    </View>
                    <Text style={s.alertaMensagem} numberOfLines={1}>{alerta.mensagem}</Text>
                  </View>
                  <Text style={s.alertaHora}>{fmtHora(alerta.criadoEm)}</Text>
                </View>
              ))}
            </View>

            {/* Avaliações de risco */}
            {dados.riscos.porTipo.length > 0 && (
              <View style={s.secao}>
                <Text style={s.secaoTitulo}>Avaliações de Risco</Text>
                <Text style={s.secaoSub}>Últimos 7 dias · {dados.riscos.altoRisco7Dias} de alto/crítico</Text>
                {dados.riscos.porTipo.map(({ tipo, total }) => {
                  const maxRisco = Math.max(...dados.riscos.porTipo.map(r => r.total), 1);
                  return (
                    <View key={tipo} style={s.listaRow}>
                      <Text style={[s.listaLabel, { flex: 1 }]}>{tipo.replace(/_/g, ' ')}</Text>
                      <View style={s.miniBarraFundo}>
                        <View style={[s.miniBarraPreenchimento, { width: `${Math.min(100, (total / maxRisco) * 100)}%` as any }]} />
                      </View>
                      <Text style={s.listaValor}>{total}</Text>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Completitude de Alta */}
            <View style={s.secao}>
              <Text style={s.secaoTitulo}>Completitude de Alta</Text>
              <Text style={s.secaoSub}>Sumários nos últimos 30 dias</Text>
              <View style={s.altaRow}>
                <View style={s.altaCirculo}>
                  <Text style={[s.altaPct, { color: dados.alta.taxaComplitude >= 80 ? '#10b981' : '#f43f5e' }]}>
                    {dados.alta.taxaComplitude}%
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.altaNumero}>
                    {dados.alta.comSumario}
                    <Text style={s.altaTotal}> / {dados.alta.altas30Dias}</Text>
                  </Text>
                  <Text style={s.altaSub}>altas com sumário completo</Text>
                  {dados.alta.taxaComplitude < 80 && (
                    <Text style={s.altaAlerta}>Abaixo do objectivo (80%)</Text>
                  )}
                </View>
              </View>
            </View>

            {/* Eventos Adversos */}
            {eventos && (
              <View style={s.secao}>
                <Text style={s.secaoTitulo}>Eventos Adversos</Text>
                <Text style={s.secaoSub}>Últimos 30 dias</Text>

                <View style={s.kpiGrid}>
                  {[
                    { label: 'Registados (30d)', valor: eventos.total30d, cor: '#1e293b' },
                    { label: 'Em Aberto', valor: eventos.abertos, cor: eventos.abertos > 0 ? '#f59e0b' : '#1e293b' },
                    { label: 'Este mês', valor: eventos.totalMes, cor: '#1e293b' },
                    { label: 'Mês anterior', valor: eventos.totalMesPassado, cor: '#94a3b8' },
                  ].map(({ label, valor, cor }) => (
                    <View key={label} style={[s.kpiCard, { borderTopColor: cor }]}>
                      <Text style={[s.kpiValor, { color: cor }]}>{valor}</Text>
                      <Text style={s.kpiTitulo}>{label}</Text>
                    </View>
                  ))}
                </View>

                {eventos.porTipo.length > 0 && (
                  <>
                    <Text style={[s.secaoSubSecao, { marginTop: 14 }]}>Por Tipo</Text>
                    {eventos.porTipo.slice(0, 5).map(({ tipo, total }) => {
                      const maxEv = Math.max(...eventos.porTipo.map(t => t.total), 1);
                      return (
                        <View key={tipo} style={s.listaRow}>
                          <Text style={[s.listaLabel, { flex: 1 }]}>{TIPO_LABEL[tipo] ?? tipo}</Text>
                          <View style={s.miniBarraFundo}>
                            <View style={[s.miniBarraPreenchimento, { width: `${Math.round((total / maxEv) * 100)}%` as any, backgroundColor: '#f87171' }]} />
                          </View>
                          <Text style={s.listaValor}>{total}</Text>
                        </View>
                      );
                    })}
                  </>
                )}

                {eventos.porGravidade.length > 0 && (
                  <>
                    <Text style={[s.secaoSubSecao, { marginTop: 12 }]}>Por Gravidade</Text>
                    {(['obito', 'dano_grave', 'dano_moderado', 'dano_leve', 'sem_dano'] as const).map(g => {
                      const item = eventos.porGravidade.find(x => x.gravidade === g);
                      if (!item) return null;
                      const maxEv = Math.max(...eventos.porGravidade.map(x => x.total), 1);
                      const cor = GRAVIDADE_COR[g] ?? '#94a3b8';
                      return (
                        <View key={g} style={s.listaRow}>
                          <Text style={[s.listaLabel, { flex: 1 }]}>{GRAVIDADE_LABEL[g]}</Text>
                          <View style={s.miniBarraFundo}>
                            <View style={[s.miniBarraPreenchimento, { width: `${Math.round((item.total / maxEv) * 100)}%` as any, backgroundColor: cor }]} />
                          </View>
                          <Text style={s.listaValor}>{item.total}</Text>
                        </View>
                      );
                    })}
                  </>
                )}
              </View>
            )}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { backgroundColor: '#0d9488', paddingTop: 52, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  voltarBtn: { padding: 4 },
  headerTitulo: { fontSize: 20, fontWeight: '700', color: '#fff' },
  headerSub: { fontSize: 11, color: '#99f6e4', marginTop: 2 },
  vazio: { padding: 60, alignItems: 'center', gap: 12 },
  vazioTexto: { color: '#94a3b8', fontSize: 15 },

  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpiCard: { flex: 1, minWidth: '45%', backgroundColor: '#fff', borderRadius: 14, padding: 14, borderTopWidth: 3, shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4, elevation: 2 },
  kpiValor: { fontSize: 24, fontWeight: '800', color: '#1e293b' },
  kpiTitulo: { fontSize: 11, color: '#94a3b8', marginTop: 4 },

  secao: { backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4, elevation: 2 },
  secaoHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  secaoTitulo: { fontSize: 15, fontWeight: '700', color: '#1e293b', marginBottom: 4 },
  secaoSub: { fontSize: 11, color: '#94a3b8', marginBottom: 12 },
  secaoSubSecao: { fontSize: 12, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },

  ocupacaoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  ocupacaoLabel: { fontSize: 13, color: '#475569' },
  ocupacaoValor: { fontSize: 13, fontWeight: '700', color: '#1e293b' },
  barraFundo: { height: 8, backgroundColor: '#e2e8f0', borderRadius: 4, overflow: 'hidden' },
  barraPreenchimento: { height: '100%', borderRadius: 4 },
  ocupacaoSub: { fontSize: 11, color: '#94a3b8', marginTop: 4 },

  estadoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 10, padding: 10, marginBottom: 8 },
  estadoPonto: { width: 8, height: 8, borderRadius: 4 },
  estadoLabel: { fontSize: 13, color: '#334155' },
  estadoValor: { fontSize: 14, fontWeight: '700' },

  tendenciaGrafico: { flexDirection: 'row', alignItems: 'flex-end', height: 88, gap: 6 },
  tendenciaColuna: { flex: 1, alignItems: 'center', gap: 4 },
  tendenciaNum: { fontSize: 10, color: '#94a3b8', fontWeight: '600' },
  tendenciaBarra: { width: '100%', backgroundColor: '#fca5a5', borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  tendenciaDia: { fontSize: 10, color: '#cbd5e1' },

  listaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
  listaLabel: { fontSize: 13, color: '#475569', textTransform: 'capitalize' },
  listaValor: { fontSize: 13, fontWeight: '700', color: '#1e293b', width: 20, textAlign: 'right' },
  miniBarraFundo: { width: 60, height: 6, backgroundColor: '#e2e8f0', borderRadius: 3, overflow: 'hidden' },
  miniBarraPreenchimento: { height: '100%', backgroundColor: '#818cf8', borderRadius: 3 },

  badge: { backgroundColor: '#ef4444', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  badgeTexto: { fontSize: 11, fontWeight: '700', color: '#fff' },

  alertaRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
  alertaPonto: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#f59e0b', marginTop: 5 },
  alertaTipo: { fontSize: 11, fontWeight: '700', color: '#64748b', textTransform: 'capitalize' },
  alertaSep: { fontSize: 11, color: '#cbd5e1' },
  alertaDoente: { fontSize: 11, color: '#94a3b8', flex: 1 },
  alertaMensagem: { fontSize: 12, color: '#475569' },
  alertaHora: { fontSize: 11, color: '#cbd5e1', marginTop: 2 },

  altaRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  altaCirculo: { width: 72, height: 72, borderRadius: 36, borderWidth: 4, borderColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' },
  altaPct: { fontSize: 16, fontWeight: '800' },
  altaNumero: { fontSize: 24, fontWeight: '800', color: '#1e293b' },
  altaTotal: { fontSize: 16, fontWeight: '400', color: '#94a3b8' },
  altaSub: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  altaAlerta: { fontSize: 11, color: '#f43f5e', fontWeight: '600', marginTop: 4 },
});
