import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl, Alert, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import api from '../lib/api';
import { Utilizador } from '../lib/auth';

interface CheckinSalaEspera {
  id: string;
  horaCheckin: string;
  estado: string;
  prioridade: string;
  doente: { nome: string; dataNascimento?: string };
  motivoEspera?: string;
  numeroChamada?: number;
}

interface Props { utilizador: Utilizador; onVoltar: () => void }

const prioridadeCor: Record<string, string> = {
  urgente: '#dc2626', alta: '#f97316', normal: '#3b82f6', baixa: '#22c55e',
};
const estadoCor: Record<string, string> = {
  aguarda: '#f59e0b', chamado: '#3b82f6', atendido: '#22c55e', desistiu: '#ef4444',
};
const estadoLabel: Record<string, string> = {
  aguarda: 'A Aguardar', chamado: 'Chamado', atendido: 'Atendido', desistiu: 'Desistiu',
};

export default function SalaEsperaScreen({ utilizador, onVoltar }: Props) {
  const [checkins, setCheckins] = useState<CheckinSalaEspera[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const carregar = async () => {
    try {
      const { data } = await api.get('/sala-espera');
      setCheckins(data?.data ?? data ?? []);
    } catch { /* ignorar */ }
    finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { carregar(); }, []));

  const chamar = async (id: string, nome: string) => {
    const acao = async () => {
      try {
        await api.patch(`/sala-espera/${id}/chamar`);
        await carregar();
      } catch { /* ignorar */ }
    };
    if (Platform.OS === 'web') {
      if ((window as any).confirm(`Chamar ${nome}?`)) acao();
    } else {
      Alert.alert('Chamar', `Chamar ${nome}?`, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Chamar', onPress: acao },
      ]);
    }
  };

  const marcarAtendido = async (id: string) => {
    try {
      await api.patch(`/sala-espera/${id}/atendido`);
      await carregar();
    } catch { /* ignorar */ }
  };

  const tempoEspera = (horaCheckin: string) => {
    const diff = Date.now() - new Date(horaCheckin).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 60) return `${min}min`;
    return `${Math.floor(min / 60)}h ${min % 60}min`;
  };

  if (loading) return <View style={s.centro}><ActivityIndicator size="large" color="#2563eb" /></View>;

  const aguardam = checkins.filter(c => c.estado === 'aguarda');
  const chamados = checkins.filter(c => c.estado === 'chamado');

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={onVoltar} style={s.voltarBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitulo}>Sala de Espera</Text>
          <Text style={s.headerSub}>{aguardam.length} a aguardar · {chamados.length} chamados</Text>
        </View>
      </View>

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); carregar(); }} />}>
        {aguardam.length > 0 && (
          <>
            <Text style={s.secaoTitulo}>A Aguardar ({aguardam.length})</Text>
            {aguardam
              .sort((a, b) => {
                const po: Record<string, number> = { urgente: 0, alta: 1, normal: 2, baixa: 3 };
                return (po[a.prioridade] ?? 9) - (po[b.prioridade] ?? 9);
              })
              .map(c => (
                <View key={c.id} style={[s.cartao, { borderLeftColor: prioridadeCor[c.prioridade] ?? '#94a3b8' }]}>
                  <View style={s.cartaoTopo}>
                    <Text style={s.cartaoTitulo}>{c.doente.nome}</Text>
                    <View style={s.tempoBox}>
                      <Ionicons name="time-outline" size={12} color="#64748b" />
                      <Text style={s.tempoTexto}>{tempoEspera(c.horaCheckin)}</Text>
                    </View>
                  </View>
                  {c.motivoEspera && <Text style={s.motivo}>{c.motivoEspera}</Text>}
                  <TouchableOpacity style={s.btnChamar} onPress={() => chamar(c.id, c.doente.nome)}>
                    <Ionicons name="megaphone-outline" size={15} color="#1d4ed8" />
                    <Text style={s.btnChamarTexto}>Chamar</Text>
                  </TouchableOpacity>
                </View>
              ))
            }
          </>
        )}

        {chamados.length > 0 && (
          <>
            <Text style={s.secaoTitulo}>Chamados ({chamados.length})</Text>
            {chamados.map(c => (
              <View key={c.id} style={[s.cartao, { borderLeftColor: '#3b82f6' }]}>
                <View style={s.cartaoTopo}>
                  <Text style={s.cartaoTitulo}>{c.doente.nome}</Text>
                  <View style={[s.badge, { backgroundColor: '#dbeafe' }]}>
                    <Text style={[s.badgeTexto, { color: '#1d4ed8' }]}>Chamado</Text>
                  </View>
                </View>
                <TouchableOpacity style={s.btnAtendido} onPress={() => marcarAtendido(c.id)}>
                  <Ionicons name="checkmark-circle-outline" size={15} color="#16a34a" />
                  <Text style={s.btnAtendidoTexto}>Marcar Atendido</Text>
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}

        {aguardam.length === 0 && chamados.length === 0 && (
          <View style={s.vazio}>
            <Ionicons name="people-outline" size={48} color="#cbd5e1" />
            <Text style={s.vazioTexto}>Sala de espera vazia</Text>
          </View>
        )}
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
  secaoTitulo: { fontSize: 12, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginHorizontal: 16, marginTop: 20, marginBottom: 6 },
  vazio: { padding: 60, alignItems: 'center', gap: 12 },
  vazioTexto: { color: '#94a3b8', fontSize: 15 },
  cartao: { backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 10, borderRadius: 14, padding: 14, borderLeftWidth: 4, shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 2 },
  cartaoTopo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cartaoTitulo: { fontSize: 15, fontWeight: '700', color: '#1e293b', flex: 1 },
  tempoBox: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  tempoTexto: { fontSize: 12, color: '#64748b' },
  motivo: { fontSize: 13, color: '#64748b', marginBottom: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  badgeTexto: { fontSize: 12, fontWeight: '600' },
  btnChamar: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#dbeafe', paddingVertical: 8, borderRadius: 10, justifyContent: 'center' },
  btnChamarTexto: { color: '#1d4ed8', fontWeight: '700', fontSize: 14 },
  btnAtendido: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#dcfce7', paddingVertical: 8, borderRadius: 10, justifyContent: 'center' },
  btnAtendidoTexto: { color: '#16a34a', fontWeight: '700', fontSize: 14 },
});
