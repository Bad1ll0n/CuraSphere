import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import api from '../lib/api';
import { Utilizador } from '../lib/auth';

interface Props { utilizador: Utilizador; onVoltar: () => void }

const COMPONENTE_LABEL: Record<string, string> = {
  concentrado_eritrocitos: 'Concentrado Eritrocitário',
  plasma_fresco_congelado: 'Plasma Fresco Congelado',
  concentrado_plaquetas: 'Concentrado de Plaquetas',
  crioprecipitado: 'Crioprecipitado',
  sangue_total: 'Sangue Total',
};
const ESTADO_COR: Record<string, string> = {
  disponivel: '#22c55e', reservada: '#f59e0b', transfundida: '#94a3b8', expirada: '#ef4444', descartada: '#94a3b8',
};

function grupoLabel(abo: string, rh: string) {
  return `${abo}${rh === 'negativo' ? '−' : '+'}`;
}

export default function BancoSangueScreen({ utilizador, onVoltar }: Props) {
  const [bolsas, setBolsas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const carregar = async () => {
    try {
      const { data } = await api.get('/transfusao/banco');
      setBolsas(Array.isArray(data) ? data : data.bolsas ?? []);
    } catch {
      setBolsas([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { setLoading(true); carregar(); }, []));

  // Resumo: contagem de unidades disponíveis por grupo sanguíneo.
  const disponiveis = bolsas.filter((b) => b.estado === 'disponivel');
  const porGrupo: Record<string, number> = {};
  for (const b of disponiveis) {
    const g = grupoLabel(b.grupoABO, b.rhD);
    porGrupo[g] = (porGrupo[g] ?? 0) + 1;
  }
  const gruposOrdenados = ['O−', 'O+', 'A−', 'A+', 'B−', 'B+', 'AB−', 'AB+'];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onVoltar} style={styles.voltar}>
          <Ionicons name="chevron-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.titulo}>Banco de Sangue</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#dc2626" />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); carregar(); }} />}>

          {/* Resumo de stock por grupo */}
          <Text style={styles.seccao}>Unidades disponíveis por grupo</Text>
          <View style={styles.grelha}>
            {gruposOrdenados.map((g) => (
              <View key={g} style={styles.grupoCard}>
                <Text style={styles.grupoLabel}>{g}</Text>
                <Text style={[styles.grupoNum, (porGrupo[g] ?? 0) === 0 && styles.grupoZero]}>{porGrupo[g] ?? 0}</Text>
              </View>
            ))}
          </View>

          {/* Lista de bolsas */}
          <Text style={[styles.seccao, { marginTop: 20 }]}>Bolsas ({bolsas.length})</Text>
          {bolsas.length === 0 && <Text style={styles.vazio}>Sem bolsas registadas no banco.</Text>}
          {bolsas.map((b) => (
            <View key={b.id} style={styles.bolsaCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.bolsaNum}>{b.numeroUnidade}</Text>
                <Text style={styles.bolsaSub}>{COMPONENTE_LABEL[b.componente] ?? b.componente}</Text>
              </View>
              <View style={styles.grupoTag}><Text style={styles.grupoTagText}>{grupoLabel(b.grupoABO, b.rhD)}</Text></View>
              <View style={[styles.estadoPonto, { backgroundColor: ESTADO_COR[b.estado] ?? '#94a3b8' }]} />
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 56, paddingBottom: 12, paddingHorizontal: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  voltar: { padding: 4, marginRight: 8 },
  titulo: { fontSize: 20, fontWeight: '700', color: '#0f172a' },
  seccao: { fontSize: 13, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  grelha: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  grupoCard: { width: '22%', backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', paddingVertical: 12, alignItems: 'center' },
  grupoLabel: { fontSize: 15, fontWeight: '700', color: '#dc2626' },
  grupoNum: { fontSize: 22, fontWeight: '800', color: '#0f172a', marginTop: 2 },
  grupoZero: { color: '#cbd5e1' },
  bolsaCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', padding: 14, marginBottom: 8 },
  bolsaNum: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  bolsaSub: { fontSize: 12, color: '#64748b', marginTop: 2 },
  grupoTag: { backgroundColor: '#fee2e2', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginRight: 10 },
  grupoTagText: { color: '#b91c1c', fontWeight: '700', fontSize: 13 },
  estadoPonto: { width: 10, height: 10, borderRadius: 5 },
  vazio: { color: '#94a3b8', fontSize: 14, paddingVertical: 12 },
});
