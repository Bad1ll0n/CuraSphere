import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl, Alert, Platform, Linking,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import api from '../lib/api';
import { Utilizador } from '../lib/auth';

interface Consulta {
  id: string;
  dataHora: string;
  tipo: string;
  estado: string;
  motivo: string;
  videoRoomId?: string | null;
  doente: { nome: string; numeroProcesso: string };
  medico: { nome: string };
  sala?: string;
}

interface Props { utilizador: Utilizador; onVoltar: () => void }

const estadoCor: Record<string, string> = {
  agendada: '#3b82f6', realizada: '#22c55e', cancelada: '#ef4444', nao_compareceu: '#f59e0b',
};
const estadoLabel: Record<string, string> = {
  agendada: 'Agendada', realizada: 'Realizada', cancelada: 'Cancelada', nao_compareceu: 'Não Compareceu',
};

export default function ConsultasScreen({ utilizador, onVoltar }: Props) {
  const [consultas, setConsultas] = useState<Consulta[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filtro, setFiltro] = useState<'agendada' | 'realizada' | 'todas'>('agendada');

  const carregar = async () => {
    try {
      const { data } = await api.get('/consultas');
      setConsultas(data?.data ?? data ?? []);
    } catch { /* ignorar */ }
    finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { carregar(); }, []));

  const confirmarRealizacao = (id: string) => {
    const acao = async () => {
      try {
        await api.patch(`/consultas/${id}/realizar`);
        await carregar();
      } catch { /* ignorar */ }
    };
    if (Platform.OS === 'web') {
      if ((window as any).confirm('Marcar consulta como realizada?')) acao();
    } else {
      Alert.alert('Consulta', 'Marcar como realizada?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Confirmar', onPress: acao },
      ]);
    }
  };

  if (loading) return <View style={s.centro}><ActivityIndicator size="large" color="#2563eb" /></View>;

  const filtradas = filtro === 'todas' ? consultas : consultas.filter(c => c.estado === filtro);
  const hoje = new Date().toDateString();

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={onVoltar} style={s.voltarBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitulo}>Consultas Externas</Text>
          <Text style={s.headerSub}>{filtradas.length} consulta(s)</Text>
        </View>
      </View>

      <View style={s.filtros}>
        {([
          { key: 'agendada', label: 'Agendadas' },
          { key: 'realizada', label: 'Realizadas' },
          { key: 'todas', label: 'Todas' },
        ] as const).map(f => (
          <TouchableOpacity key={f.key} style={[s.filtro, filtro === f.key && s.filtroAtivo]} onPress={() => setFiltro(f.key)}>
            <Text style={[s.filtroTexto, filtro === f.key && s.filtroTextoAtivo]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); carregar(); }} />}>
        {filtradas.length === 0
          ? <View style={s.vazio}><Text style={s.vazioTexto}>Sem consultas</Text></View>
          : filtradas.map(c => {
            const dt = new Date(c.dataHora);
            const eHoje = dt.toDateString() === hoje;
            return (
              <View key={c.id} style={[s.cartao, eHoje && s.cartaoHoje]}>
                {eHoje && (
                  <View style={s.hojeTag}>
                    <Text style={s.hojeTagTexto}>HOJE</Text>
                  </View>
                )}
                <View style={s.cartaoTopo}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.cartaoTitulo}>{c.doente.nome}</Text>
                    <Text style={s.cartaoProcesso}>Proc. {c.doente.numeroProcesso}</Text>
                  </View>
                  <View style={[s.badge, { backgroundColor: estadoCor[c.estado] + '22' }]}>
                    <Text style={[s.badgeTexto, { color: estadoCor[c.estado] }]}>{estadoLabel[c.estado] ?? c.estado}</Text>
                  </View>
                </View>

                <View style={s.infoRow}>
                  <Ionicons name="time-outline" size={14} color="#64748b" />
                  <Text style={s.infoTexto}>
                    {dt.toLocaleDateString('pt-PT')} às {dt.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                <View style={s.infoRow}>
                  <Ionicons name="person-outline" size={14} color="#64748b" />
                  <Text style={s.infoTexto}>Dr(a). {c.medico.nome}</Text>
                </View>
                {c.sala && (
                  <View style={s.infoRow}>
                    <Ionicons name="location-outline" size={14} color="#64748b" />
                    <Text style={s.infoTexto}>Sala {c.sala}</Text>
                  </View>
                )}
                <Text style={s.motivo}>{c.motivo}</Text>

                {c.estado === 'agendada' && utilizador.role === 'medico' && (
                  <TouchableOpacity style={s.btnRealizar} onPress={() => confirmarRealizacao(c.id)}>
                    <Text style={s.btnRealizarTexto}>Marcar como Realizada</Text>
                  </TouchableOpacity>
                )}
                {c.tipo === 'teleconsulta' && c.videoRoomId && (
                  <TouchableOpacity
                    style={s.btnVideo}
                    onPress={async () => {
                      try {
                        const { data } = await api.get(`/consultas/${c.id}/video/entrar`);
                        await Linking.openURL(data.roomUrl);
                      } catch {
                        Alert.alert('Erro', 'Não foi possível entrar na videochamada.');
                      }
                    }}
                  >
                    <Text style={s.btnVideoTexto}>📹 Entrar na Videochamada</Text>
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
  header: { backgroundColor: '#2563eb', paddingTop: 52, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  voltarBtn: { padding: 4 },
  headerTitulo: { fontSize: 20, fontWeight: '700', color: '#fff' },
  headerSub: { fontSize: 12, color: '#bfdbfe', marginTop: 2 },
  filtros: { flexDirection: 'row', padding: 12, gap: 8, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  filtro: { flex: 1, paddingVertical: 7, borderRadius: 20, backgroundColor: '#f1f5f9', alignItems: 'center' },
  filtroAtivo: { backgroundColor: '#2563eb' },
  filtroTexto: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  filtroTextoAtivo: { color: '#fff' },
  vazio: { padding: 40, alignItems: 'center' },
  vazioTexto: { color: '#94a3b8', fontSize: 15 },
  cartao: { backgroundColor: '#fff', marginHorizontal: 16, marginTop: 12, borderRadius: 14, padding: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 2 },
  cartaoHoje: { borderLeftWidth: 4, borderLeftColor: '#2563eb' },
  hojeTag: { backgroundColor: '#dbeafe', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginBottom: 8 },
  hojeTagTexto: { fontSize: 11, fontWeight: '700', color: '#1d4ed8' },
  cartaoTopo: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  cartaoTitulo: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  cartaoProcesso: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  infoTexto: { fontSize: 13, color: '#64748b' },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  badgeTexto: { fontSize: 12, fontWeight: '600' },
  motivo: { fontSize: 13, color: '#475569', marginTop: 8, fontStyle: 'italic' },
  btnRealizar: { marginTop: 10, backgroundColor: '#dcfce7', paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  btnRealizarTexto: { color: '#16a34a', fontWeight: '700', fontSize: 14 },
  btnVideo: { marginTop: 8, backgroundColor: '#22c55e', paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  btnVideoTexto: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
