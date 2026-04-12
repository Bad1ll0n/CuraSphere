import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../lib/api';
import { Utilizador } from '../lib/auth';

const estadoCor: Record<string, string> = {
  estavel: '#22c55e', grave: '#f97316', critico: '#ef4444', alta_prevista: '#3b82f6',
};
const estadoLabel: Record<string, string> = {
  estavel: 'Estável', grave: 'Grave', critico: 'Crítico', alta_prevista: 'Alta Prevista',
};

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
      setDoentes(doc.data);
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

  return (
    <ScrollView
      style={s.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); carregar(); }} />}
    >
      <View style={s.header}>
        <Text style={s.boaDia}>Olá, {utilizador.nome.split(' ')[0]}</Text>
        <Text style={s.subtitulo}>Resumo da enfermaria</Text>
      </View>

      {/* Stats */}
      <View style={s.statsRow}>
        {[
          { label: 'Total', val: ocupacao?.total ?? 0, cor: '#1e293b' },
          { label: 'Ocupadas', val: ocupacao?.ocupadas ?? 0, cor: '#ef4444' },
          { label: 'Livres', val: ocupacao?.livres ?? 0, cor: '#22c55e' },
          { label: 'Limpeza', val: ocupacao?.emLimpeza ?? 0, cor: '#f59e0b' },
        ].map((c) => (
          <View key={c.label} style={s.statCard}>
            <Text style={[s.statValor, { color: c.cor }]}>{c.val}</Text>
            <Text style={s.statLabel}>{c.label}</Text>
          </View>
        ))}
      </View>

      {/* Por estado */}
      <View style={s.card}>
        <Text style={s.cardTitulo}>Doentes Internados · {doentes.length}</Text>
        {porEstado.map(({ estado, count }) => (
          <View key={estado} style={s.estadoRow}>
            <View style={s.estadoEsq}>
              <View style={[s.dot, { backgroundColor: estadoCor[estado] }]} />
              <Text style={s.estadoLabel}>{estadoLabel[estado]}</Text>
            </View>
            <Text style={[s.estadoCount, { color: estadoCor[estado] }]}>{count}</Text>
          </View>
        ))}
      </View>

      {/* Críticos */}
      <View style={s.card}>
        <View style={s.cardCabecalho}>
          <Text style={s.cardTitulo}>Doentes Críticos</Text>
          <View style={[s.badgePill, { backgroundColor: criticos.length > 0 ? '#fef2f2' : '#f1f5f9' }]}>
            <Text style={{ color: criticos.length > 0 ? '#dc2626' : '#64748b', fontSize: 12, fontWeight: '700' }}>{criticos.length}</Text>
          </View>
        </View>
        {criticos.length === 0
          ? <Text style={s.vazioTexto}>Sem doentes críticos</Text>
          : criticos.map((d) => (
            <View key={d.id} style={s.doenteRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.doenteNome}>{d.nome}</Text>
                <Text style={s.doenteSub}>Cama {d.cama.quarto}/{d.cama.numero}</Text>
              </View>
              <View style={[s.estadoBadge, { backgroundColor: estadoCor[d.estado] + '20' }]}>
                <Text style={{ color: estadoCor[d.estado], fontSize: 11, fontWeight: '600' }}>{estadoLabel[d.estado]}</Text>
              </View>
            </View>
          ))
        }
      </View>

      {/* Altas hoje */}
      <View style={[s.card, { marginBottom: 32 }]}>
        <View style={s.cardCabecalho}>
          <Text style={s.cardTitulo}>Altas Previstas Hoje</Text>
          <View style={[s.badgePill, { backgroundColor: altasHoje.length > 0 ? '#eff6ff' : '#f1f5f9' }]}>
            <Text style={{ color: altasHoje.length > 0 ? '#2563eb' : '#64748b', fontSize: 12, fontWeight: '700' }}>{altasHoje.length}</Text>
          </View>
        </View>
        {altasHoje.length === 0
          ? <Text style={s.vazioTexto}>Sem altas previstas hoje</Text>
          : altasHoje.map((d) => (
            <View key={d.id} style={s.doenteRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={s.doenteNome}>{d.nome}</Text>
                <Text style={s.doenteSub} numberOfLines={1}>{d.diagnosticoPrincipal}</Text>
              </View>
              <View style={[s.estadoBadge, { backgroundColor: estadoCor[d.estado] + '20' }]}>
                <Text style={{ color: estadoCor[d.estado], fontSize: 11, fontWeight: '600' }}>{estadoLabel[d.estado]}</Text>
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
  header: { padding: 20, paddingBottom: 8 },
  boaDia: { fontSize: 22, fontWeight: '700', color: '#1e293b' },
  subtitulo: { fontSize: 14, color: '#64748b', marginTop: 2 },
  statsRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginVertical: 12 },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 12, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 1 }, shadowRadius: 4, elevation: 1 },
  statValor: { fontSize: 22, fontWeight: '700' },
  statLabel: { fontSize: 11, color: '#94a3b8', marginTop: 2, textAlign: 'center' },
  card: { backgroundColor: '#fff', marginHorizontal: 16, borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 1 }, shadowRadius: 4, elevation: 1 },
  cardCabecalho: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  cardTitulo: { fontSize: 14, fontWeight: '700', color: '#1e293b', marginBottom: 12 },
  badgePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  estadoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
  estadoEsq: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  estadoLabel: { fontSize: 14, color: '#475569' },
  estadoCount: { fontSize: 16, fontWeight: '700' },
  doenteRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
  doenteNome: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  doenteSub: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  estadoBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  vazioTexto: { color: '#94a3b8', fontSize: 14, textAlign: 'center', paddingVertical: 16 },
});
