import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import api from '../lib/api';
import { Utilizador } from '../lib/auth';

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface ResumoStats {
  totalFaturado: number;
  totalPago: number;
  totalPendente: number;
  totalAnulado: number;
  countPorEstado: Record<string, number>;
}

interface Episodio {
  id: string;
  estado: string;
  totalCobrado: number;
  totalBase: number;
  tipoCobertura?: string;
  criadoEm: string;
  dataEmissao?: string;
  doente?: { nome: string; numeroProcesso: string };
  criadoPor?: { nome: string };
  _count?: { itens: number; pagamentos: number };
}

interface Props { utilizador: Utilizador; onVoltar: () => void }

// ─── Constantes ───────────────────────────────────────────────────────────────

const ESTADO: Record<string, { label: string; cor: string; fundo: string }> = {
  pendente: { label: 'Pendente',  cor: '#b45309', fundo: '#fef3c7' },
  emitida:  { label: 'Emitida',   cor: '#1d4ed8', fundo: '#dbeafe' },
  paga:     { label: 'Paga',      cor: '#059669', fundo: '#d1fae5' },
  anulada:  { label: 'Anulada',   cor: '#6b7280', fundo: '#f1f5f9' },
};

const COBERTURA_LABEL: Record<string, string> = {
  sns: 'SNS', seguro: 'Seguro', particular: 'Particular', outro: 'Outro',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(v: number) {
  return v.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });
}

function formatarData(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function FaturacaoScreen({ utilizador, onVoltar }: Props) {
  const [stats, setStats] = useState<ResumoStats | null>(null);
  const [episodios, setEpisodios] = useState<Episodio[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState('');

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const r = await api.get('/faturacao/resumo');
      setStats(r.data.stats);
      setEpisodios(r.data.episodios ?? []);
    } catch {
      // silencioso
    } finally {
      setCarregando(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  const episodiosFiltrados = filtroEstado
    ? episodios.filter((e) => e.estado === filtroEstado)
    : episodios;

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onVoltar} style={s.btnVoltar} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color="#0f172a" />
        </TouchableOpacity>
        <Text style={s.headerTitulo}>Faturação</Text>
        <View style={{ width: 38 }} />
      </View>

      {carregando ? (
        <View style={s.centro}>
          <ActivityIndicator size="large" color="#0f172a" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.lista}>
          {/* KPIs */}
          {stats && (
            <View style={s.kpiGrid}>
              <View style={[s.kpiCard, { backgroundColor: '#f8fafc' }]}>
                <Text style={[s.kpiVal, { color: '#0f172a' }]}>{fmt(stats.totalFaturado)}</Text>
                <Text style={s.kpiLabel}>Total Faturado</Text>
              </View>
              <View style={[s.kpiCard, { backgroundColor: '#d1fae5' }]}>
                <Text style={[s.kpiVal, { color: '#059669' }]}>{fmt(stats.totalPago)}</Text>
                <Text style={s.kpiLabel}>Pago</Text>
              </View>
              <View style={[s.kpiCard, { backgroundColor: '#fef3c7' }]}>
                <Text style={[s.kpiVal, { color: '#b45309' }]}>{fmt(stats.totalPendente)}</Text>
                <Text style={s.kpiLabel}>Pendente</Text>
              </View>
              <View style={[s.kpiCard, { backgroundColor: '#f1f5f9' }]}>
                <Text style={[s.kpiVal, { color: '#6b7280' }]}>{fmt(stats.totalAnulado)}</Text>
                <Text style={s.kpiLabel}>Anulado</Text>
              </View>
            </View>
          )}

          {/* Filtro estado */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filtroScroll} contentContainerStyle={{ gap: 6 }}>
            {['', 'pendente', 'emitida', 'paga', 'anulada'].map((e) => {
              const est = ESTADO[e];
              const ativo = filtroEstado === e;
              return (
                <TouchableOpacity
                  key={e || 'todos'}
                  style={[s.filtroPill, ativo && { backgroundColor: (est?.fundo ?? '#0f172a18'), borderColor: est?.cor ?? '#0f172a' }]}
                  onPress={() => setFiltroEstado(e)}
                  activeOpacity={0.7}
                >
                  <Text style={[s.filtroPillLabel, ativo && { color: est?.cor ?? '#0f172a', fontWeight: '600' }]}>
                    {e ? (est?.label ?? e) : 'Todos'}
                    {stats && e && stats.countPorEstado[e] ? ` (${stats.countPorEstado[e]})` : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Lista de episódios */}
          {episodiosFiltrados.length === 0 ? (
            <Text style={s.vazio}>Nenhum episódio encontrado.</Text>
          ) : (
            episodiosFiltrados.map((ep) => {
              const est = ESTADO[ep.estado] ?? { label: ep.estado, cor: '#6b7280', fundo: '#f1f5f9' };
              return (
                <View key={ep.id} style={s.card}>
                  <View style={s.cardTopo}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.cardNome} numberOfLines={1}>
                        {ep.doente?.nome ?? 'Doente desconhecido'}
                      </Text>
                      <Text style={s.cardSub}>Proc. {ep.doente?.numeroProcesso ?? '—'}</Text>
                    </View>
                    <View style={[s.estadoBadge, { backgroundColor: est.fundo }]}>
                      <Text style={[s.estadoLabel, { color: est.cor }]}>{est.label}</Text>
                    </View>
                  </View>

                  <View style={s.cardValorRow}>
                    <Text style={s.cardValor}>{fmt(ep.totalCobrado)}</Text>
                    {ep.tipoCobertura && (
                      <View style={s.coberturaBadge}>
                        <Text style={s.coberturaLabel}>{COBERTURA_LABEL[ep.tipoCobertura] ?? ep.tipoCobertura}</Text>
                      </View>
                    )}
                  </View>

                  <View style={s.cardRodape}>
                    <Text style={s.cardMeta}>Criado: {formatarData(ep.criadoEm)}</Text>
                    {ep.dataEmissao && <Text style={s.cardMeta}>Emitido: {formatarData(ep.dataEmissao)}</Text>}
                    {ep._count && (
                      <Text style={s.cardMeta}>
                        {ep._count.itens} item{ep._count.itens !== 1 ? 's' : ''} · {ep._count.pagamentos} pagamento{ep._count.pagamentos !== 1 ? 's' : ''}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })
          )}

          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#f8fafc' },

  header:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 56 : 16, paddingBottom: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  btnVoltar:       { width: 38, height: 38, borderRadius: 10, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  headerTitulo:    { fontSize: 17, fontWeight: '700', color: '#0f172a' },

  lista:           { padding: 16, gap: 10 },
  centro:          { flex: 1, alignItems: 'center', justifyContent: 'center' },
  vazio:           { textAlign: 'center', color: '#94a3b8', fontSize: 14, marginTop: 24 },

  kpiGrid:         { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 4 },
  kpiCard:         { flex: 1, minWidth: '45%', borderRadius: 12, padding: 14 },
  kpiVal:          { fontSize: 18, fontWeight: '800', marginBottom: 2 },
  kpiLabel:        { fontSize: 11, color: '#64748b', fontWeight: '500' },

  filtroScroll:    { flexGrow: 0, marginBottom: 4 },
  filtroPill:      { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff' },
  filtroPillLabel: { fontSize: 12, color: '#64748b', fontWeight: '500' },

  card:            { backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#e2e8f0' },
  cardTopo:        { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  cardNome:        { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  cardSub:         { fontSize: 11, color: '#64748b', marginTop: 2 },
  estadoBadge:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  estadoLabel:     { fontSize: 11, fontWeight: '700' },
  cardValorRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  cardValor:       { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  coberturaBadge:  { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: '#f1f5f9' },
  coberturaLabel:  { fontSize: 11, color: '#475569', fontWeight: '600' },
  cardRodape:      { marginTop: 6, gap: 2 },
  cardMeta:        { fontSize: 11, color: '#94a3b8' },
});
