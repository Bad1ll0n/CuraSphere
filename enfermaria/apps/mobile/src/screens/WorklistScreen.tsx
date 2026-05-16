import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../lib/api';
import { Utilizador } from '../lib/auth';

interface Props { utilizador: Utilizador; onVoltar: () => void }

interface WorklistItem {
  id: string; tipo: string; estado: string; prioridade: string;
  dataHora: string; observacoes?: string;
  doente: { id: string; nome: string };
  solicitadoPor: { id: string; nome: string };
  executadoPor?: { id: string; nome: string };
}

const ESTADO_COR: Record<string, string>   = { pendente: '#d97706', em_curso: '#2563eb', concluido: '#16a34a', cancelado: '#64748b' };
const ESTADO_BG: Record<string, string>    = { pendente: '#fef3c7', em_curso: '#eff6ff', concluido: '#dcfce7', cancelado: '#f1f5f9' };
const ESTADO_LABEL: Record<string, string> = { pendente: 'Pendente', em_curso: 'Em Curso', concluido: 'Concluído', cancelado: 'Cancelado' };

const PRIORIDADE_COR: Record<string, string> = { urgente: '#dc2626', alta: '#f97316', media: '#3b82f6', baixa: '#64748b' };

export default function WorklistScreen({ utilizador, onVoltar }: Props) {
  const [items, setItems] = useState<WorklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filtro, setFiltro] = useState('todos');

  const carregar = async () => {
    try {
      const { data } = await api.get('/worklist');
      setItems(data ?? []);
    } catch {} finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { carregar(); }, []));

  const atualizarEstado = async (id: string, estado: string) => {
    try {
      await api.patch(`/worklist/${id}`, { estado });
      await carregar();
    } catch (e: any) { Alert.alert('Erro', e.response?.data?.message ?? 'Erro'); }
  };

  const filtros = ['todos', 'pendente', 'em_curso', 'concluido'];
  const lista = filtro === 'todos' ? items : items.filter(i => i.estado === filtro);
  const fmt = (d: string) => new Date(d).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={onVoltar} style={s.voltarBotao}>
          <Text style={s.voltarTexto}>‹  Voltar</Text>
        </TouchableOpacity>
        <Text style={s.titulo}>Worklist</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filtrosScroll}>
        <View style={s.filtrosRow}>
          {filtros.map(f => (
            <TouchableOpacity key={f} style={[s.filtroChip, filtro === f && s.filtroChipAtivo]} onPress={() => setFiltro(f)}>
              <Text style={[s.filtroTexto, filtro === f && s.filtroTextoAtivo]}>
                {f === 'todos' ? 'Todos' : ESTADO_LABEL[f]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {loading ? (
        <View style={s.centro}><ActivityIndicator size="large" color="#06b6d4" /></View>
      ) : (
        <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); carregar(); }} />} style={{ flex: 1 }}>
          <View style={s.lista}>
            {lista.length === 0 ? (
              <View style={s.vazio}><Text style={s.vazioTexto}>Sem itens na worklist</Text></View>
            ) : lista.map(item => (
              <View key={item.id} style={[s.card, { borderLeftColor: PRIORIDADE_COR[item.prioridade] ?? '#94a3b8', borderLeftWidth: 4 }]}>
                <View style={s.cardTopo}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.cardTipo}>{item.tipo}</Text>
                    <Text style={s.cardDoente}>{item.doente.nome}</Text>
                  </View>
                  <View style={[s.estadoBadge, { backgroundColor: ESTADO_BG[item.estado] }]}>
                    <Text style={[s.estadoTexto, { color: ESTADO_COR[item.estado] }]}>{ESTADO_LABEL[item.estado]}</Text>
                  </View>
                </View>
                {item.observacoes ? <Text style={s.cardObs}>{item.observacoes}</Text> : null}
                <Text style={s.cardInfo}>{fmt(item.dataHora)} · por {item.solicitadoPor.nome.split(' ')[0]}</Text>
                <View style={s.acoes}>
                  {item.estado === 'pendente' && (
                    <TouchableOpacity style={s.acaoBtn} onPress={() => atualizarEstado(item.id, 'em_curso')}>
                      <Text style={s.acaoTexto}>Iniciar</Text>
                    </TouchableOpacity>
                  )}
                  {item.estado === 'em_curso' && (
                    <TouchableOpacity style={[s.acaoBtn, { backgroundColor: '#dcfce7' }]} onPress={() => atualizarEstado(item.id, 'concluido')}>
                      <Text style={[s.acaoTexto, { color: '#16a34a' }]}>Concluir</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
          </View>
          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { backgroundColor: '#1e293b', padding: 20, paddingTop: 16 },
  voltarBotao: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, marginBottom: 10 },
  voltarTexto: { color: '#fff', fontSize: 12, fontWeight: '600' },
  titulo: { fontSize: 20, fontWeight: '700', color: '#fff' },
  filtrosScroll: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  filtrosRow: { flexDirection: 'row', gap: 8, padding: 12 },
  filtroChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#f1f5f9' },
  filtroChipAtivo: { backgroundColor: '#06b6d4' },
  filtroTexto: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  filtroTextoAtivo: { color: '#fff' },
  lista: { padding: 16, gap: 12 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 1 }, shadowRadius: 6, elevation: 1 },
  cardTopo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  cardTipo: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  cardDoente: { fontSize: 13, color: '#475569', marginTop: 2 },
  cardObs: { fontSize: 13, color: '#64748b', marginBottom: 4 },
  cardInfo: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
  estadoBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  estadoTexto: { fontSize: 11, fontWeight: '700' },
  acoes: { flexDirection: 'row', gap: 8, marginTop: 8 },
  acaoBtn: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 8, backgroundColor: '#eff6ff' },
  acaoTexto: { color: '#2563eb', fontWeight: '700', fontSize: 13 },
  vazio: { backgroundColor: '#fff', borderRadius: 14, padding: 32, alignItems: 'center' },
  vazioTexto: { color: '#94a3b8', fontSize: 14 },
});
