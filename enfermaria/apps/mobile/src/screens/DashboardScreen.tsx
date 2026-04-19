import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import api from '../lib/api';
import { Utilizador } from '../lib/auth';

const estadoCor: Record<string, string> = {
  estavel: '#22c55e', grave: '#f97316', critico: '#ef4444', alta_prevista: '#3b82f6',
};
const estadoLabel: Record<string, string> = {
  estavel: 'Estável', grave: 'Grave', critico: 'Crítico', alta_prevista: 'Alta Prevista',
};

function saudacao(nome: string) {
  const h = new Date().getHours();
  const pref = h < 12 ? 'Bom dia' : h < 19 ? 'Boa tarde' : 'Boa noite';
  return `${pref}, ${nome.split(' ')[0]}`;
}

function dataHoje() {
  return new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' });
}

function iniciaisDoente(nome: string) {
  const p = nome.trim().split(' ');
  return (p[0][0] + (p[p.length - 1]?.[0] ?? '')).toUpperCase();
}

interface Props { utilizador: Utilizador }

export default function DashboardScreen({ utilizador }: Props) {
  const [ocupacao, setOcupacao] = useState<any>(null);
  const [doentes, setDoentes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const carregar = async () => {
    try {
      const [ocup, doc] = await Promise.all([
        api.get('/camas/ocupacao'),
        api.get('/doentes?todos=true'),
      ]);
      setOcupacao(ocup.data);
      setDoentes(doc.data.data ?? doc.data);
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { carregar(); }, []));

  if (loading) return <View style={s.centro}><ActivityIndicator size="large" color="#2563eb" /></View>;

  const criticos = doentes.filter((d) => d.estado === 'critico');
  const altasHoje = doentes.filter((d) =>
    d.dataAltaPrevista && new Date(d.dataAltaPrevista).toDateString() === new Date().toDateString(),
  );
  const porEstado = (['estavel', 'grave', 'critico', 'alta_prevista'] as const).map((e) => ({
    estado: e, count: doentes.filter((d) => d.estado === e).length,
  }));

  const stats = [
    { label: 'Total', val: ocupacao?.total ?? 0, cor: '#6366f1', bg: '#eef2ff', icon: 'bed-outline' as const },
    { label: 'Ocupadas', val: ocupacao?.ocupadas ?? 0, cor: '#ef4444', bg: '#fef2f2', icon: 'people-outline' as const },
    { label: 'Livres', val: ocupacao?.livres ?? 0, cor: '#22c55e', bg: '#f0fdf4', icon: 'checkmark-circle-outline' as const },
    { label: 'Limpeza', val: ocupacao?.emLimpeza ?? 0, cor: '#f59e0b', bg: '#fffbeb', icon: 'sparkles-outline' as const },
  ];

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={{ paddingBottom: 12 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); carregar(); }} tintColor="#2563eb" />}
    >
      {/* Header */}
      <View style={s.header}>
        <Text style={s.data}>{dataHoje()}</Text>
        <Text style={s.saudacao}>{saudacao(utilizador.nome)}</Text>
      </View>

      {/* Stat cards */}
      <View style={s.statsRow}>
        {stats.map((c) => (
          <View key={c.label} style={[s.statCard, { backgroundColor: c.bg }]}>
            <View style={[s.statIconBox, { backgroundColor: c.cor + '22' }]}>
              <Ionicons name={c.icon} size={18} color={c.cor} />
            </View>
            <Text style={[s.statValor, { color: c.cor }]}>{c.val}</Text>
            <Text style={s.statLabel}>{c.label}</Text>
          </View>
        ))}
      </View>

      {/* Doentes por estado */}
      <View style={s.card}>
        <View style={s.cardHeader}>
          <Ionicons name="pulse-outline" size={18} color="#6366f1" style={{ marginRight: 8 }} />
          <Text style={s.cardTitulo}>Doentes Internados</Text>
          <View style={s.badgePill}>
            <Text style={s.badgeNum}>{doentes.length}</Text>
          </View>
        </View>
        {porEstado.map(({ estado, count }, i) => (
          <View key={estado} style={[s.estadoRow, i === porEstado.length - 1 && { borderBottomWidth: 0 }]}>
            <View style={s.estadoEsq}>
              <View style={[s.dot, { backgroundColor: estadoCor[estado] }]} />
              <Text style={s.estadoLabel}>{estadoLabel[estado]}</Text>
            </View>
            <View style={[s.estadoCountBox, { backgroundColor: estadoCor[estado] + '18' }]}>
              <Text style={[s.estadoCount, { color: estadoCor[estado] }]}>{count}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Críticos */}
      <View style={s.card}>
        <View style={s.cardHeader}>
          <Ionicons name="warning-outline" size={18} color="#ef4444" style={{ marginRight: 8 }} />
          <Text style={s.cardTitulo}>Doentes Críticos</Text>
          <View style={[s.badgePill, criticos.length > 0 && s.badgePillRed]}>
            <Text style={[s.badgeNum, criticos.length > 0 && { color: '#ef4444' }]}>{criticos.length}</Text>
          </View>
        </View>
        {criticos.length === 0
          ? <View style={s.vazioBox}>
              <Ionicons name="checkmark-circle-outline" size={28} color="#d1fae5" />
              <Text style={s.vazioTexto}>Sem doentes críticos</Text>
            </View>
          : criticos.map((d, i) => (
            <View key={d.id} style={[s.doenteRow, i === criticos.length - 1 && { borderBottomWidth: 0 }]}>
              <View style={[s.iniciais, { backgroundColor: estadoCor[d.estado] + '22' }]}>
                <Text style={[s.iniciaisTexto, { color: estadoCor[d.estado] }]}>{iniciaisDoente(d.nome)}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={s.doenteNome}>{d.nome}</Text>
                <Text style={s.doenteSub}>Cama {d.cama.quarto}/{d.cama.numero}</Text>
              </View>
              <View style={[s.estadoBadge, { backgroundColor: estadoCor[d.estado] + '18' }]}>
                <Text style={{ color: estadoCor[d.estado], fontSize: 11, fontWeight: '700' }}>{estadoLabel[d.estado]}</Text>
              </View>
            </View>
          ))
        }
      </View>

      {/* Altas hoje */}
      <View style={s.card}>
        <View style={s.cardHeader}>
          <Ionicons name="exit-outline" size={18} color="#3b82f6" style={{ marginRight: 8 }} />
          <Text style={s.cardTitulo}>Altas Previstas Hoje</Text>
          <View style={[s.badgePill, altasHoje.length > 0 && s.badgePillBlue]}>
            <Text style={[s.badgeNum, altasHoje.length > 0 && { color: '#2563eb' }]}>{altasHoje.length}</Text>
          </View>
        </View>
        {altasHoje.length === 0
          ? <View style={s.vazioBox}>
              <Ionicons name="calendar-outline" size={28} color="#dbeafe" />
              <Text style={s.vazioTexto}>Sem altas previstas hoje</Text>
            </View>
          : altasHoje.map((d, i) => (
            <View key={d.id} style={[s.doenteRow, i === altasHoje.length - 1 && { borderBottomWidth: 0 }]}>
              <View style={[s.iniciais, { backgroundColor: '#eff6ff' }]}>
                <Text style={[s.iniciaisTexto, { color: '#2563eb' }]}>{iniciaisDoente(d.nome)}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 10, marginRight: 8 }}>
                <Text style={s.doenteNome}>{d.nome}</Text>
                <Text style={s.doenteSub} numberOfLines={1}>{d.diagnosticoPrincipal}</Text>
              </View>
              <View style={[s.estadoBadge, { backgroundColor: estadoCor[d.estado] + '18' }]}>
                <Text style={{ color: estadoCor[d.estado], fontSize: 11, fontWeight: '700' }}>{estadoLabel[d.estado]}</Text>
              </View>
            </View>
          ))
        }
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Header
  header: {
    paddingTop: 36,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  saudacao: { fontSize: 22, fontWeight: '800', color: '#0f172a', letterSpacing: -0.5, marginTop: 2 },
  data: { fontSize: 12, color: '#2563eb', fontWeight: '600', textTransform: 'capitalize', letterSpacing: 0.2 },
  // Stats
  statsRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginTop: 4, marginBottom: 2 },
  statCard: {
    flex: 1, borderRadius: 14, padding: 9, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 2,
  },
  statIconBox: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  statValor: { fontSize: 18, fontWeight: '800' },
  statLabel: { fontSize: 9, color: '#94a3b8', marginTop: 1, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },

  // Cards
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 12,
    marginTop: 8,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  cardTitulo: { fontSize: 13, fontWeight: '700', color: '#1e293b', flex: 1 },
  badgePill: { backgroundColor: '#f1f5f9', paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20 },
  badgePillRed: { backgroundColor: '#fef2f2' },
  badgePillBlue: { backgroundColor: '#eff6ff' },
  badgeNum: { fontSize: 12, fontWeight: '700', color: '#94a3b8' },

  // Estado rows
  estadoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
  estadoEsq: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  estadoLabel: { fontSize: 14, color: '#475569', fontWeight: '500' },
  estadoCountBox: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  estadoCount: { fontSize: 13, fontWeight: '700' },

  // Doente rows
  doenteRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
  iniciais: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  iniciaisTexto: { fontSize: 13, fontWeight: '800' },
  doenteNome: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  doenteSub: { fontSize: 12, color: '#94a3b8', marginTop: 1 },
  estadoBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },

  // Vazio
  vazioBox: { alignItems: 'center', paddingVertical: 10, gap: 6 },
  vazioTexto: { color: '#94a3b8', fontSize: 13, fontWeight: '500' },
});
