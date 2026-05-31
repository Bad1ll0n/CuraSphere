import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import api from '../lib/api';
import { Utilizador } from '../lib/auth';

interface DashExec {
  doentes: { internados: number; ambulatorio: number; pendenteCama: number; mediaInternamento: number };
  camas: { total: number; ocupadas: number; livres: number; limpeza: number; reservadas: number; taxaOcupacao: number };
  faturacao: { totalMes: number; pagoMes: number; pendenteMes: number; porCobertura: { sns: number; seguro: number; particular: number } };
  consultasHoje: { total: number; faltaram: number; taxaNoShow: number };
  trocasPendentes: number;
  pessoal: { utilizadoresPorRole: Record<string, number> };
  urgenciaHoje: { total: number; emAtendimento: number; aguardaAlta: number; alta: number };
  cirurgiasMes: { total: number; concluidas: number; emCurso: number; canceladas: number };
  ausenciasAtivas: number;
}

interface Props { utilizador: Utilizador; onVoltar: () => void }

function fmtEur(val: number) {
  return val.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

export default function DashboardExecutivoScreen({ utilizador, onVoltar }: Props) {
  const [dados, setDados] = useState<DashExec | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const carregar = async () => {
    try {
      const r = await api.get('/dashboard/executivo');
      setDados(r.data);
    } catch { /* ignorar */ }
    finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { carregar(); }, []));

  if (loading) return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={onVoltar} style={s.btnVoltar}>
          <Ionicons name="arrow-back" size={22} color="#0f172a" />
        </TouchableOpacity>
        <Text style={s.headerTitulo}>Dashboard Executivo</Text>
        <View style={{ width: 38 }} />
      </View>
      <View style={s.centro}><ActivityIndicator size="large" color="#6366f1" /></View>
    </View>
  );

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={onVoltar} style={s.btnVoltar}>
          <Ionicons name="arrow-back" size={22} color="#0f172a" />
        </TouchableOpacity>
        <Text style={s.headerTitulo}>Dashboard Executivo</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); carregar(); }} />
        }
        contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}
      >
        {!dados ? (
          <View style={s.vazio}>
            <Ionicons name="analytics-outline" size={48} color="#94a3b8" />
            <Text style={s.vazioTexto}>Sem dados disponíveis</Text>
          </View>
        ) : (
          <>
            {/* Secção Doentes */}
            <View style={s.secao}>
              <Text style={s.secaoTitulo}>Doentes</Text>
              <View style={s.kpiGrid}>
                <View style={[s.kpiCard, { borderTopColor: '#6366f1' }]}>
                  <Text style={[s.kpiNum, { color: '#6366f1' }]}>{dados.doentes.internados}</Text>
                  <Text style={s.kpiLabel}>Internados</Text>
                </View>
                <View style={[s.kpiCard, { borderTopColor: '#0d9488' }]}>
                  <Text style={[s.kpiNum, { color: '#0d9488' }]}>{dados.doentes.ambulatorio}</Text>
                  <Text style={s.kpiLabel}>Ambulatório</Text>
                </View>
                <View style={[s.kpiCard, { borderTopColor: '#f59e0b' }]}>
                  <Text style={[s.kpiNum, { color: '#f59e0b' }]}>{dados.doentes.pendenteCama}</Text>
                  <Text style={s.kpiLabel}>A aguardar cama</Text>
                </View>
                <View style={[s.kpiCard, { borderTopColor: '#64748b' }]}>
                  <Text style={[s.kpiNum, { color: '#64748b' }]}>{dados.doentes.mediaInternamento}</Text>
                  <Text style={s.kpiLabel}>Demora média (dias)</Text>
                </View>
              </View>
            </View>

            {/* Secção Camas */}
            <View style={s.secao}>
              <Text style={s.secaoTitulo}>Camas</Text>
              <View style={s.barraFundo}>
                {dados.camas.total > 0 && (
                  <>
                    <View style={[s.barraSegmento, { flex: dados.camas.ocupadas / dados.camas.total, backgroundColor: '#6366f1' }]} />
                    <View style={[s.barraSegmento, { flex: dados.camas.limpeza / dados.camas.total, backgroundColor: '#f59e0b' }]} />
                    <View style={[s.barraSegmento, { flex: dados.camas.reservadas / dados.camas.total, backgroundColor: '#93c5fd' }]} />
                    <View style={[s.barraSegmento, { flex: dados.camas.livres / dados.camas.total, backgroundColor: '#e2e8f0' }]} />
                  </>
                )}
              </View>
              <View style={s.legendaRow}>
                <View style={s.legendaItem}>
                  <View style={[s.legendaPonto, { backgroundColor: '#6366f1' }]} />
                  <Text style={s.legendaTexto}>Ocupadas {dados.camas.ocupadas}</Text>
                </View>
                <View style={s.legendaItem}>
                  <View style={[s.legendaPonto, { backgroundColor: '#f59e0b' }]} />
                  <Text style={s.legendaTexto}>Limpeza {dados.camas.limpeza}</Text>
                </View>
                <View style={s.legendaItem}>
                  <View style={[s.legendaPonto, { backgroundColor: '#93c5fd' }]} />
                  <Text style={s.legendaTexto}>Reservadas {dados.camas.reservadas}</Text>
                </View>
                <View style={s.legendaItem}>
                  <View style={[s.legendaPonto, { backgroundColor: '#cbd5e1' }]} />
                  <Text style={s.legendaTexto}>Livres {dados.camas.livres}</Text>
                </View>
              </View>
              <Text style={s.taxaOcupacao}>Taxa Ocupação: {dados.camas.taxaOcupacao.toFixed(1)}%</Text>
            </View>

            {/* Secção Faturação */}
            <View style={s.secao}>
              <Text style={s.secaoTitulo}>Faturação do Mês</Text>
              <View style={s.kpiGrid}>
                <View style={[s.kpiCard, { borderTopColor: '#64748b' }]}>
                  <Text style={[s.kpiNumPeq, { color: '#64748b' }]}>{fmtEur(dados.faturacao.totalMes)}</Text>
                  <Text style={s.kpiLabel}>Total faturado</Text>
                </View>
                <View style={[s.kpiCard, { borderTopColor: '#22c55e' }]}>
                  <Text style={[s.kpiNumPeq, { color: '#22c55e' }]}>{fmtEur(dados.faturacao.pagoMes)}</Text>
                  <Text style={s.kpiLabel}>Pago</Text>
                </View>
                <View style={[s.kpiCard, { borderTopColor: '#f59e0b' }]}>
                  <Text style={[s.kpiNumPeq, { color: '#f59e0b' }]}>{fmtEur(dados.faturacao.pendenteMes)}</Text>
                  <Text style={s.kpiLabel}>Pendente</Text>
                </View>
              </View>
              {dados.faturacao.totalMes > 0 && (
                <View style={[s.coberturaRow, { marginTop: 12 }]}>
                  <View style={s.coberturaItem}>
                    <Text style={s.coberturaNome}>SNS</Text>
                    <Text style={s.coberturaPct}>{((dados.faturacao.porCobertura.sns / dados.faturacao.totalMes) * 100).toFixed(1)}%</Text>
                  </View>
                  <View style={s.coberturaItem}>
                    <Text style={s.coberturaNome}>Seguro</Text>
                    <Text style={s.coberturaPct}>{((dados.faturacao.porCobertura.seguro / dados.faturacao.totalMes) * 100).toFixed(1)}%</Text>
                  </View>
                  <View style={s.coberturaItem}>
                    <Text style={s.coberturaNome}>Particular</Text>
                    <Text style={s.coberturaPct}>{((dados.faturacao.porCobertura.particular / dados.faturacao.totalMes) * 100).toFixed(1)}%</Text>
                  </View>
                </View>
              )}
            </View>

            {/* Secção Urgência */}
            <View style={s.secao}>
              <Text style={s.secaoTitulo}>Urgência Hoje</Text>
              <View style={s.kpiGrid}>
                <View style={[s.kpiCard, { borderTopColor: '#0f172a' }]}>
                  <Text style={s.kpiNum}>{dados.urgenciaHoje.total}</Text>
                  <Text style={s.kpiLabel}>Total</Text>
                </View>
                <View style={[s.kpiCard, { borderTopColor: '#ef4444' }]}>
                  <Text style={[s.kpiNum, { color: '#ef4444' }]}>{dados.urgenciaHoje.emAtendimento}</Text>
                  <Text style={s.kpiLabel}>Em Atendimento</Text>
                </View>
                <View style={[s.kpiCard, { borderTopColor: '#f59e0b' }]}>
                  <Text style={[s.kpiNum, { color: '#f59e0b' }]}>{dados.urgenciaHoje.aguardaAlta}</Text>
                  <Text style={s.kpiLabel}>Aguarda Alta</Text>
                </View>
                <View style={[s.kpiCard, { borderTopColor: '#22c55e' }]}>
                  <Text style={[s.kpiNum, { color: '#22c55e' }]}>{dados.urgenciaHoje.alta}</Text>
                  <Text style={s.kpiLabel}>Alta</Text>
                </View>
              </View>
            </View>

            {/* Secção Bloco Cirúrgico */}
            <View style={s.secao}>
              <Text style={s.secaoTitulo}>Bloco Cirúrgico (mês)</Text>
              <View style={s.kpiGrid}>
                <View style={[s.kpiCard, { borderTopColor: '#0f172a' }]}>
                  <Text style={s.kpiNum}>{dados.cirurgiasMes.total}</Text>
                  <Text style={s.kpiLabel}>Total</Text>
                </View>
                <View style={[s.kpiCard, { borderTopColor: '#22c55e' }]}>
                  <Text style={[s.kpiNum, { color: '#22c55e' }]}>{dados.cirurgiasMes.concluidas}</Text>
                  <Text style={s.kpiLabel}>Concluídas</Text>
                </View>
                <View style={[s.kpiCard, { borderTopColor: '#6366f1' }]}>
                  <Text style={[s.kpiNum, { color: '#6366f1' }]}>{dados.cirurgiasMes.emCurso}</Text>
                  <Text style={s.kpiLabel}>Em curso</Text>
                </View>
                <View style={[s.kpiCard, { borderTopColor: '#94a3b8' }]}>
                  <Text style={[s.kpiNum, { color: '#94a3b8' }]}>{dados.cirurgiasMes.canceladas}</Text>
                  <Text style={s.kpiLabel}>Canceladas</Text>
                </View>
              </View>
            </View>

            {/* Secção Pessoal */}
            <View style={s.secao}>
              <Text style={s.secaoTitulo}>Pessoal</Text>
              {Object.entries(dados.pessoal.utilizadoresPorRole).map(([role, count]) => (
                <View key={role} style={s.pessoalRow}>
                  <Text style={s.pessoalRole}>{role.charAt(0).toUpperCase() + role.slice(1)}</Text>
                  <Text style={s.pessoalCount}>{count}</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 56 : 16,
    paddingBottom: 12, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
  },
  btnVoltar: {
    width: 38, height: 38, borderRadius: 10, backgroundColor: '#f1f5f9',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitulo: { fontSize: 17, fontWeight: '700', color: '#0f172a' },

  vazio: { padding: 60, alignItems: 'center', gap: 12 },
  vazioTexto: { color: '#94a3b8', fontSize: 15 },

  secao: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6, elevation: 2,
  },
  secaoTitulo: { fontSize: 15, fontWeight: '700', color: '#0f172a', marginBottom: 12 },

  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpiCard: {
    flex: 1, minWidth: '45%', backgroundColor: '#fff', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#e2e8f0', borderTopWidth: 3,
  },
  kpiNum: { fontSize: 28, fontWeight: '800', color: '#0f172a' },
  kpiNumPeq: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  kpiLabel: { fontSize: 12, color: '#64748b', marginTop: 4 },

  barraFundo: {
    height: 16, flexDirection: 'row', borderRadius: 8, overflow: 'hidden',
    backgroundColor: '#e2e8f0', marginBottom: 10,
  },
  barraSegmento: { height: '100%' },

  legendaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  legendaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendaPonto: { width: 10, height: 10, borderRadius: 5 },
  legendaTexto: { fontSize: 12, color: '#64748b' },

  taxaOcupacao: { fontSize: 22, fontWeight: '800', color: '#0f172a', textAlign: 'center', marginTop: 4 },

  coberturaRow: { flexDirection: 'row', gap: 8 },
  coberturaItem: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 10, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  coberturaNome: { fontSize: 11, color: '#64748b', fontWeight: '600' },
  coberturaPct: { fontSize: 16, fontWeight: '800', color: '#0f172a', marginTop: 2 },

  pessoalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  pessoalRole: { fontSize: 14, color: '#334155' },
  pessoalCount: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
});
