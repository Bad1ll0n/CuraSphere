import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl, Alert, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import api from '../lib/api';
import { Utilizador } from '../lib/auth';

interface DoenteIsolado {
  id: string;
  nome: string;
  numeroProcesso: string;
  motivoIsolamento: string;
  dataIsolamento: string;
  cama?: { numero: string; quarto: string };
}

interface Props { utilizador: Utilizador; onVoltar: () => void }

const motivoCor: Record<string, string> = {
  MRSA: '#ef4444', VRE: '#f97316', ESBL: '#eab308', 'C.diff': '#8b5cf6',
  KPC: '#dc2626', Pseudomonas: '#3b82f6', Acinetobacter: '#06b6d4',
  COVID: '#ec4899', Influenza: '#64748b', Outros: '#94a3b8',
};

export default function IACSScreen({ utilizador, onVoltar }: Props) {
  const [doentes, setDoentes] = useState<DoenteIsolado[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const podeEditar = ['medico', 'enfermeiro', 'qualidade'].includes(utilizador.role);

  const carregar = async () => {
    try {
      const { data } = await api.get('/doentes/iacs/isolados');
      setDoentes(data?.data ?? data ?? []);
    } catch { /* ignorar */ }
    finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { carregar(); }, []));

  const levantarIsolamento = (id: string, nome: string) => {
    const acao = async () => {
      try {
        await api.patch(`/doentes/${id}/isolamento`, { isolado: false });
        await carregar();
      } catch { /* ignorar */ }
    };
    if (Platform.OS === 'web') {
      if ((window as any).confirm(`Levantar isolamento de ${nome}?`)) acao();
    } else {
      Alert.alert('Isolamento', `Levantar isolamento de ${nome}?`, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Levantar', style: 'destructive', onPress: acao },
      ]);
    }
  };

  const diasIsolamento = (data: string) => {
    const diff = Date.now() - new Date(data).getTime();
    return Math.floor(diff / 86400000);
  };

  if (loading) return <View style={s.centro}><ActivityIndicator size="large" color="#8b5cf6" /></View>;

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={onVoltar} style={s.voltarBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitulo}>IACS — Isolamentos</Text>
          <Text style={s.headerSub}>{doentes.length} doente(s) em isolamento activo</Text>
        </View>
      </View>

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); carregar(); }} />}>
        {doentes.length === 0
          ? (
            <View style={s.vazio}>
              <Ionicons name="shield-checkmark-outline" size={48} color="#22c55e" />
              <Text style={s.vazioTexto}>Sem doentes em isolamento</Text>
            </View>
          )
          : doentes.map(d => {
            const cor = motivoCor[d.motivoIsolamento] ?? '#94a3b8';
            const dias = diasIsolamento(d.dataIsolamento);
            return (
              <View key={d.id} style={[s.cartao, { borderLeftColor: cor }]}>
                <View style={s.cartaoTopo}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.cartaoTitulo}>{d.nome}</Text>
                    <Text style={s.cartaoProc}>Proc. {d.numeroProcesso}</Text>
                  </View>
                  <View style={[s.motivoBadge, { backgroundColor: cor + '22' }]}>
                    <Text style={[s.motivoTexto, { color: cor }]}>{d.motivoIsolamento}</Text>
                  </View>
                </View>

                {d.cama && (
                  <View style={s.infoRow}>
                    <Ionicons name="bed-outline" size={14} color="#64748b" />
                    <Text style={s.infoTexto}>Quarto {d.cama.quarto} · Cama {d.cama.numero}</Text>
                  </View>
                )}

                <View style={s.infoRow}>
                  <Ionicons name="calendar-outline" size={14} color="#64748b" />
                  <Text style={s.infoTexto}>
                    Desde {new Date(d.dataIsolamento).toLocaleDateString('pt-PT')} · {dias} dia(s)
                  </Text>
                </View>

                {podeEditar && (
                  <TouchableOpacity
                    style={s.btnLevantar}
                    onPress={() => levantarIsolamento(d.id, d.nome)}
                  >
                    <Ionicons name="lock-open-outline" size={15} color="#7c3aed" />
                    <Text style={s.btnLevantarTexto}>Levantar Isolamento</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })
        }
        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { backgroundColor: '#7c3aed', paddingTop: 52, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  voltarBtn: { padding: 4 },
  headerTitulo: { fontSize: 20, fontWeight: '700', color: '#fff' },
  headerSub: { fontSize: 12, color: '#ddd6fe', marginTop: 2 },
  vazio: { padding: 60, alignItems: 'center', gap: 12 },
  vazioTexto: { color: '#94a3b8', fontSize: 15 },
  cartao: { backgroundColor: '#fff', marginHorizontal: 16, marginTop: 12, borderRadius: 14, padding: 14, borderLeftWidth: 4, shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 2 },
  cartaoTopo: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  cartaoTitulo: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  cartaoProc: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  motivoBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  motivoTexto: { fontSize: 12, fontWeight: '700' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  infoTexto: { fontSize: 13, color: '#64748b' },
  btnLevantar: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#ede9fe', paddingVertical: 8, borderRadius: 10, justifyContent: 'center', marginTop: 10 },
  btnLevantarTexto: { color: '#7c3aed', fontWeight: '700', fontSize: 14 },
});
