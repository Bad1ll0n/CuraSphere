import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl, Alert, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import api from '../lib/api';
import { Utilizador } from '../lib/auth';

interface MedicacaoMAR {
  id: string;
  medicamentoNome: string;
  dose: string;
  via: string;
  frequencia: string;
  horarios: string[];
  estado: string;
  doente: { id: string; nome: string; cama?: { numero: string; quarto: string } };
  proximaAdministracao?: string;
  administradoHoje: boolean;
}

interface Props { utilizador: Utilizador; onVoltar: () => void }

const viaCor: Record<string, string> = {
  oral: '#3b82f6', ev: '#8b5cf6', im: '#f97316', sc: '#06b6d4',
  sl: '#ec4899', topico: '#22c55e', inalacao: '#64748b',
};

export default function MARScreen({ utilizador, onVoltar }: Props) {
  const [medicacoes, setMedicacoes] = useState<MedicacaoMAR[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filtro, setFiltro] = useState<'pendentes' | 'todas'>('pendentes');

  const carregar = async () => {
    try {
      const { data } = await api.get('/medicacao/mar');
      setMedicacoes(data?.data ?? data ?? []);
    } catch { /* ignorar */ }
    finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { carregar(); }, []));

  const administrar = (id: string, nome: string) => {
    const acao = async () => {
      try {
        await api.post(`/medicacao/${id}/administrar`, {});
        await carregar();
      } catch { /* ignorar */ }
    };
    if (Platform.OS === 'web') {
      if ((window as any).confirm(`Confirmar administração de ${nome}?`)) acao();
    } else {
      Alert.alert('Administrar', `Confirmar administração de ${nome}?`, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Confirmar', onPress: acao },
      ]);
    }
  };

  if (loading) return <View style={s.centro}><ActivityIndicator size="large" color="#2563eb" /></View>;

  const filtradas = filtro === 'pendentes'
    ? medicacoes.filter(m => !m.administradoHoje)
    : medicacoes;

  const pendentes = filtradas.filter(m => !m.administradoHoje).length;

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={onVoltar} style={s.voltarBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitulo}>MAR — Medicação</Text>
          <Text style={s.headerSub}>{pendentes} administração(ões) pendente(s)</Text>
        </View>
      </View>

      <View style={s.filtros}>
        {([
          { key: 'pendentes', label: 'Pendentes' },
          { key: 'todas', label: 'Todas' },
        ] as const).map(f => (
          <TouchableOpacity key={f.key} style={[s.filtro, filtro === f.key && s.filtroAtivo]} onPress={() => setFiltro(f.key)}>
            <Text style={[s.filtroTexto, filtro === f.key && s.filtroTextoAtivo]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); carregar(); }} />}>
        {filtradas.length === 0
          ? (
            <View style={s.vazio}>
              <Ionicons name="checkmark-circle-outline" size={48} color="#22c55e" />
              <Text style={s.vazioTexto}>Todas as medicações administradas</Text>
            </View>
          )
          : filtradas.map(m => {
            const corVia = viaCor[m.via] ?? '#64748b';
            return (
              <View key={m.id} style={[s.cartao, m.administradoHoje && s.cartaoAdministrado]}>
                <View style={s.cartaoTopo}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.medicamentoNome}>{m.medicamentoNome}</Text>
                    <Text style={s.doenteNome}>{m.doente.nome}</Text>
                    {m.doente.cama && (
                      <Text style={s.cama}>Cama {m.doente.cama.quarto}/{m.doente.cama.numero}</Text>
                    )}
                  </View>
                  {m.administradoHoje
                    ? <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
                    : <Ionicons name="time-outline" size={22} color="#f59e0b" />
                  }
                </View>

                <View style={s.tags}>
                  <View style={[s.tag, { backgroundColor: corVia + '22' }]}>
                    <Text style={[s.tagTexto, { color: corVia }]}>{m.via.toUpperCase()}</Text>
                  </View>
                  <View style={[s.tag, { backgroundColor: '#f1f5f9' }]}>
                    <Text style={s.tagTexto}>{m.dose}</Text>
                  </View>
                  <View style={[s.tag, { backgroundColor: '#f1f5f9' }]}>
                    <Text style={s.tagTexto}>{m.frequencia}</Text>
                  </View>
                </View>

                {m.horarios && m.horarios.length > 0 && (
                  <Text style={s.horarios}>Horários: {m.horarios.join(' · ')}</Text>
                )}

                {!m.administradoHoje && (
                  <TouchableOpacity
                    style={s.btnAdministrar}
                    onPress={() => administrar(m.id, m.medicamentoNome)}
                  >
                    <Ionicons name="medical-outline" size={15} color="#1d4ed8" />
                    <Text style={s.btnAdministrarTexto}>Administrar</Text>
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
  vazio: { padding: 60, alignItems: 'center', gap: 12 },
  vazioTexto: { color: '#94a3b8', fontSize: 15 },
  cartao: { backgroundColor: '#fff', marginHorizontal: 16, marginTop: 12, borderRadius: 14, padding: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 2 },
  cartaoAdministrado: { opacity: 0.65 },
  cartaoTopo: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  medicamentoNome: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  doenteNome: { fontSize: 13, color: '#475569', marginTop: 2 },
  cama: { fontSize: 12, color: '#94a3b8', marginTop: 1 },
  tags: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 4 },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  tagTexto: { fontSize: 11, fontWeight: '600', color: '#475569' },
  horarios: { fontSize: 12, color: '#64748b', marginTop: 4 },
  btnAdministrar: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#dbeafe', paddingVertical: 8, borderRadius: 10, justifyContent: 'center', marginTop: 10 },
  btnAdministrarTexto: { color: '#1d4ed8', fontWeight: '700', fontSize: 14 },
});
