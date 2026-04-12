import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../lib/api';

interface Tarefa {
  id: string;
  descricao: string;
  tipo: string;
  prioridade: string;
  estado: string;
  prazo?: string;
  grupoResponsavel?: string;
  doente: { id: string; nome: string; estado: string; cama: { numero: string; quarto: string } };
  criadoPor?: { nome: string; role: string };
  responsavel?: { id: string; nome: string; role: string };
}

const prioridadeCor: Record<string, { bg: string; text: string; label: string }> = {
  urgente: { bg: '#fef2f2', text: '#dc2626', label: 'Urgente' },
  alta:    { bg: '#fff7ed', text: '#c2410c', label: 'Alta' },
  media:   { bg: '#fefce8', text: '#854d0e', label: 'Média' },
  baixa:   { bg: '#f0fdf4', text: '#15803d', label: 'Baixa' },
};

const grupoLabel: Record<string, string> = {
  medico: 'Médico', enfermeiro: 'Enfermeiro', auxiliar: 'Auxiliar',
};

const ordem: Record<string, number> = { urgente: 0, alta: 1, media: 2, baixa: 3 };

export default function TarefasScreen() {
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filtro, setFiltro] = useState<'todas' | 'clinica' | 'logistica'>('todas');

  const carregar = async () => {
    try {
      const { data } = await api.get('/tarefas/minhas');
      setTarefas(data.sort((a: Tarefa, b: Tarefa) =>
        (ordem[a.prioridade] ?? 9) - (ordem[b.prioridade] ?? 9)
      ));
    } catch (_e) {
      // ignorar erros de rede
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { carregar(); }, []));

  const concluir = async (id: string) => {
    try {
      await api.patch(`/tarefas/${id}/estado`, { estado: 'concluida' });
      await carregar();
    } catch { /* ignorar */ }
  };

  const filtradas = tarefas.filter((t) => filtro === 'todas' || t.tipo === filtro);
  const pendentes = filtradas.filter((t) => t.estado === 'pendente');
  const emProgresso = filtradas.filter((t) => t.estado === 'em_progresso');

  if (loading) return <View style={s.centro}><ActivityIndicator size="large" color="#2563eb" /></View>;

  return (
    <View style={s.container}>
      {/* Filtros */}
      <View style={s.filtros}>
        {(['todas', 'clinica', 'logistica'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[s.filtro, filtro === f && s.filtroAtivo]}
            onPress={() => setFiltro(f)}
          >
            <Text style={[s.filtroTexto, filtro === f && s.filtroTextoAtivo]}>
              {f === 'todas' ? 'Todas' : f === 'clinica' ? 'Clínicas' : 'Logísticas'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); carregar(); }} />}
      >
        {filtradas.length === 0 ? (
          <View style={s.vazio}>
            <Text style={s.vazioTexto}>Sem tarefas pendentes neste turno</Text>
          </View>
        ) : (
          <>
            {[...emProgresso, ...pendentes].map((t) => {
              const p = prioridadeCor[t.prioridade] ?? prioridadeCor.media;
              const atribuidoA = t.responsavel
                ? `A cargo: ${t.responsavel.nome}`
                : t.grupoResponsavel
                  ? `Para: ${grupoLabel[t.grupoResponsavel] ?? t.grupoResponsavel}`
                  : null;
              return (
                <View key={t.id} style={[s.cartao, { borderLeftColor: p.text }]}>
                  <View style={s.cartaoCabecalho}>
                    <View style={s.cartaoEsq}>
                      <Text style={s.doenteNome}>{t.doente.nome}</Text>
                      <Text style={s.doenteInfo}>Cama {t.doente.cama.quarto}/{t.doente.cama.numero}</Text>
                    </View>
                    <View style={[s.prioridadeBadge, { backgroundColor: p.bg }]}>
                      <Text style={[s.prioridadeTexto, { color: p.text }]}>{p.label}</Text>
                    </View>
                  </View>

                  <Text style={s.tarefaDescricao}>{t.descricao}</Text>

                  {atribuidoA && (
                    <Text style={s.atribuidoTexto}>{atribuidoA}</Text>
                  )}

                  <View style={s.cartaoRodape}>
                    <View style={s.tags}>
                      <View style={[s.tag, { backgroundColor: t.tipo === 'clinica' ? '#dbeafe' : '#f3e8ff' }]}>
                        <Text style={[s.tagTexto, { color: t.tipo === 'clinica' ? '#1d4ed8' : '#7c3aed' }]}>
                          {t.tipo === 'clinica' ? 'Clínica' : 'Logística'}
                        </Text>
                      </View>
                      {t.estado === 'em_progresso' && (
                        <View style={[s.tag, { backgroundColor: '#dbeafe' }]}>
                          <Text style={[s.tagTexto, { color: '#1d4ed8' }]}>Em progresso</Text>
                        </View>
                      )}
                      {t.prazo && (
                        <Text style={s.prazo}>até {new Date(t.prazo).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</Text>
                      )}
                    </View>
                    <TouchableOpacity style={s.concluirBotao} onPress={() => concluir(t.id)}>
                      <Text style={s.concluirTexto}>Concluir</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  filtros: { flexDirection: 'row', padding: 16, gap: 8 },
  filtro: { flex: 1, paddingVertical: 8, borderRadius: 20, backgroundColor: '#e2e8f0', alignItems: 'center' },
  filtroAtivo: { backgroundColor: '#2563eb' },
  filtroTexto: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  filtroTextoAtivo: { color: '#fff' },
  vazio: { padding: 40, alignItems: 'center' },
  vazioTexto: { color: '#94a3b8', fontSize: 15 },
  cartao: { backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 10, borderRadius: 14, padding: 14, borderLeftWidth: 4, shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 2 },
  cartaoCabecalho: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  cartaoEsq: { flex: 1, marginRight: 8 },
  doenteNome: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  doenteInfo: { fontSize: 12, color: '#64748b', marginTop: 2 },
  prioridadeBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  prioridadeTexto: { fontSize: 12, fontWeight: '600' },
  tarefaDescricao: { fontSize: 14, color: '#334155', lineHeight: 20, marginBottom: 4 },
  atribuidoTexto: { fontSize: 12, color: '#64748b', marginBottom: 8, fontStyle: 'italic' },
  cartaoRodape: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tags: { flexDirection: 'row', gap: 6, flex: 1, flexWrap: 'wrap' },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  tagTexto: { fontSize: 11, fontWeight: '500' },
  prazo: { fontSize: 12, color: '#ef4444', fontWeight: '500' },
  concluirBotao: { backgroundColor: '#dcfce7', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  concluirTexto: { color: '#16a34a', fontWeight: '700', fontSize: 13 },
});
