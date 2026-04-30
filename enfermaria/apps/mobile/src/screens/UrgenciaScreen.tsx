import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import api from '../lib/api';
import { Utilizador } from '../lib/auth';

interface EpisodioUrgencia {
  id: string;
  motivoEntrada: string;
  estado: string;
  prioridadeTriagem: string;
  dataEntrada: string;
  doente: { nome: string; dataNascimento?: string };
  medicoResponsavel?: { nome: string };
}

interface Props { utilizador: Utilizador; onVoltar: () => void }

const triagemCor: Record<string, string> = {
  vermelho: '#dc2626', laranja: '#f97316', amarelo: '#eab308',
  verde: '#22c55e', azul: '#3b82f6',
};
const triagemLabel: Record<string, string> = {
  vermelho: 'Emergente', laranja: 'Muito Urgente', amarelo: 'Urgente',
  verde: 'Pouco Urgente', azul: 'Não Urgente',
};
const estadoCor: Record<string, string> = {
  triagem: '#f59e0b', em_observacao: '#3b82f6', aguarda_resultado: '#8b5cf6',
  alta: '#22c55e', transferido: '#64748b',
};
const estadoLabel: Record<string, string> = {
  triagem: 'Triagem', em_observacao: 'Em Observação', aguarda_resultado: 'Aguarda Resultado',
  alta: 'Alta', transferido: 'Transferido',
};

export default function UrgenciaScreen({ utilizador, onVoltar }: Props) {
  const [episodios, setEpisodios] = useState<EpisodioUrgencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filtro, setFiltro] = useState<'ativos' | 'todos'>('ativos');

  const carregar = async () => {
    try {
      const { data } = await api.get('/urgencia');
      setEpisodios(data?.data ?? data ?? []);
    } catch { /* ignorar */ }
    finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { carregar(); }, []));

  const estadosAtivos = ['triagem', 'em_observacao', 'aguarda_resultado'];
  const filtrados = filtro === 'ativos'
    ? episodios.filter(e => estadosAtivos.includes(e.estado))
    : episodios;

  const tempoEspera = (dataEntrada: string) => {
    const diff = Date.now() - new Date(dataEntrada).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 60) return `${min}min`;
    return `${Math.floor(min / 60)}h ${min % 60}min`;
  };

  if (loading) return <View style={s.centro}><ActivityIndicator size="large" color="#dc2626" /></View>;

  const contadores = {
    vermelho: filtrados.filter(e => e.prioridadeTriagem === 'vermelho').length,
    laranja: filtrados.filter(e => e.prioridadeTriagem === 'laranja').length,
    amarelo: filtrados.filter(e => e.prioridadeTriagem === 'amarelo').length,
    verde: filtrados.filter(e => e.prioridadeTriagem === 'verde').length,
  };

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={onVoltar} style={s.voltarBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitulo}>Urgência</Text>
          <Text style={s.headerSub}>{filtrados.length} episódio(s) activo(s)</Text>
        </View>
      </View>

      {/* Contadores por triagem */}
      <View style={s.contadores}>
        {Object.entries(contadores).map(([cor, n]) => (
          <View key={cor} style={[s.contador, { borderColor: triagemCor[cor] }]}>
            <View style={[s.contadorDot, { backgroundColor: triagemCor[cor] }]} />
            <Text style={s.contadorNum}>{n}</Text>
          </View>
        ))}
      </View>

      <View style={s.filtros}>
        {([
          { key: 'ativos', label: 'Activos' },
          { key: 'todos', label: 'Todos' },
        ] as const).map(f => (
          <TouchableOpacity key={f.key} style={[s.filtro, filtro === f.key && s.filtroAtivo]} onPress={() => setFiltro(f.key)}>
            <Text style={[s.filtroTexto, filtro === f.key && s.filtroTextoAtivo]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); carregar(); }} />}>
        {filtrados.length === 0
          ? <View style={s.vazio}><Text style={s.vazioTexto}>Sem episódios</Text></View>
          : filtrados.map(ep => {
            const triagem = ep.prioridadeTriagem ?? 'verde';
            return (
              <View key={ep.id} style={[s.cartao, { borderLeftColor: triagemCor[triagem] }]}>
                <View style={s.cartaoTopo}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.cartaoTitulo}>{ep.doente.nome}</Text>
                    <View style={s.triagemRow}>
                      <View style={[s.triagemDot, { backgroundColor: triagemCor[triagem] }]} />
                      <Text style={[s.triagemLabel, { color: triagemCor[triagem] }]}>{triagemLabel[triagem]}</Text>
                    </View>
                  </View>
                  <View style={[s.estadoBadge, { backgroundColor: (estadoCor[ep.estado] ?? '#94a3b8') + '22' }]}>
                    <Text style={[s.estadoTexto, { color: estadoCor[ep.estado] ?? '#64748b' }]}>
                      {estadoLabel[ep.estado] ?? ep.estado}
                    </Text>
                  </View>
                </View>

                <Text style={s.motivo}>{ep.motivoEntrada}</Text>

                <View style={s.rodape}>
                  <View style={s.infoRow}>
                    <Ionicons name="time-outline" size={13} color="#64748b" />
                    <Text style={s.infoTexto}>{tempoEspera(ep.dataEntrada)}</Text>
                  </View>
                  {ep.medicoResponsavel && (
                    <View style={s.infoRow}>
                      <Ionicons name="person-outline" size={13} color="#64748b" />
                      <Text style={s.infoTexto}>{ep.medicoResponsavel.nome}</Text>
                    </View>
                  )}
                </View>
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
  header: { backgroundColor: '#dc2626', paddingTop: 52, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  voltarBtn: { padding: 4 },
  headerTitulo: { fontSize: 20, fontWeight: '700', color: '#fff' },
  headerSub: { fontSize: 12, color: '#fecaca', marginTop: 2 },
  contadores: { flexDirection: 'row', backgroundColor: '#fff', paddingVertical: 12, paddingHorizontal: 16, gap: 10, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  contador: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 2, borderRadius: 10, paddingVertical: 6 },
  contadorDot: { width: 10, height: 10, borderRadius: 5 },
  contadorNum: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  filtros: { flexDirection: 'row', padding: 12, gap: 8, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  filtro: { flex: 1, paddingVertical: 7, borderRadius: 20, backgroundColor: '#f1f5f9', alignItems: 'center' },
  filtroAtivo: { backgroundColor: '#dc2626' },
  filtroTexto: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  filtroTextoAtivo: { color: '#fff' },
  vazio: { padding: 40, alignItems: 'center' },
  vazioTexto: { color: '#94a3b8', fontSize: 15 },
  cartao: { backgroundColor: '#fff', marginHorizontal: 16, marginTop: 12, borderRadius: 14, padding: 14, borderLeftWidth: 4, shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 2 },
  cartaoTopo: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
  cartaoTitulo: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  triagemRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  triagemDot: { width: 8, height: 8, borderRadius: 4 },
  triagemLabel: { fontSize: 12, fontWeight: '600' },
  estadoBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  estadoTexto: { fontSize: 12, fontWeight: '600' },
  motivo: { fontSize: 13, color: '#475569', marginBottom: 8 },
  rodape: { flexDirection: 'row', gap: 16 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  infoTexto: { fontSize: 12, color: '#64748b' },
});
