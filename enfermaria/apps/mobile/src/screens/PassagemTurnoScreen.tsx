import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import api from '../lib/api';
import { Utilizador } from '../lib/auth';

interface Props { utilizador: Utilizador; onVoltar: () => void }

const estadoCor: Record<string, string> = {
  estavel: '#22c55e', grave: '#f97316', critico: '#ef4444', alta_prevista: '#3b82f6',
};
const estadoLabel: Record<string, string> = {
  estavel: 'Estável', grave: 'Grave', critico: 'Crítico', alta_prevista: 'Alta Prevista',
};
const prioridadeCor: Record<string, string> = {
  urgente: '#ef4444', alta: '#f97316', media: '#f59e0b', baixa: '#22c55e',
};

export default function PassagemTurnoScreen({ utilizador, onVoltar }: Props) {
  const [dados, setDados] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [confirmado, setConfirmado] = useState(false);
  const [expandido, setExpandido] = useState<string | null>(null);

  const carregar = async () => {
    try {
      const { data } = await api.get('/turnos/passagem-turno');
      setDados(data);
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { carregar(); }, []));

  const confirmar = async () => {
    setConfirmando(true);
    try {
      await api.post('/turnos/confirmar-passagem');
      setConfirmado(true);
      Alert.alert('Passagem confirmada', 'Confirmaste a receção da passagem de turno.');
    } catch {
      Alert.alert('Erro', 'Não foi possível confirmar a passagem.');
    } finally {
      setConfirmando(false);
    }
  };

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onVoltar} style={s.voltarBotao}>
          <Text style={s.voltarTexto}>‹  Voltar</Text>
        </TouchableOpacity>
        <Text style={s.titulo}>Passagem de Turno</Text>
        <Text style={s.subtitulo}>Informação do turno anterior</Text>
      </View>

      {loading ? (
        <View style={s.centro}><ActivityIndicator size="large" color="#2563eb" /></View>
      ) : dados.length === 0 ? (
        <View style={s.centro}>
          <Ionicons name="checkmark-circle-outline" size={56} color="#d1fae5" />
          <Text style={s.vazioTitulo}>Sem passagem pendente</Text>
          <Text style={s.vazioSub}>Não há informação do turno anterior para consultar.</Text>
        </View>
      ) : (
        <ScrollView
          style={s.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); carregar(); }} />}
        >
          {/* Resumo */}
          <View style={s.resumoBox}>
            <View style={s.resumoItem}>
              <Text style={s.resumoNum}>{dados.length}</Text>
              <Text style={s.resumoLabel}>Doentes</Text>
            </View>
            <View style={s.resumoDivider} />
            <View style={s.resumoItem}>
              <Text style={s.resumoNum}>{dados.reduce((a, d) => a + (d.tarefasPendentes?.length ?? 0), 0)}</Text>
              <Text style={s.resumoLabel}>Tarefas</Text>
            </View>
            <View style={s.resumoDivider} />
            <View style={s.resumoItem}>
              <Text style={s.resumoNum}>{dados.reduce((a, d) => a + (d.medicacoesAtivas?.length ?? 0), 0)}</Text>
              <Text style={s.resumoLabel}>Medicações</Text>
            </View>
          </View>

          {/* Lista de doentes */}
          {dados.map((item: any) => {
            const d = item.doente;
            const aberto = expandido === d.id;
            const tarefas = item.tarefasPendentes ?? [];
            const notas = item.notasAnteriores ?? [];
            const meds = item.medicacoesAtivas ?? [];

            return (
              <TouchableOpacity
                key={d.id}
                style={s.card}
                onPress={() => setExpandido(aberto ? null : d.id)}
                activeOpacity={0.8}
              >
                {/* Linha principal */}
                <View style={s.cardTopo}>
                  <View style={[s.estadoBar, { backgroundColor: estadoCor[d.estado] }]} />
                  <View style={{ flex: 1 }}>
                    <View style={s.cardHeader}>
                      <Text style={s.doenteNome}>{d.nome}</Text>
                      <View style={[s.estadoBadge, { backgroundColor: estadoCor[d.estado] + '20' }]}>
                        <Text style={[s.estadoBadgeTexto, { color: estadoCor[d.estado] }]}>{estadoLabel[d.estado]}</Text>
                      </View>
                    </View>
                    <Text style={s.doenteSub}>Cama {d.cama?.quarto}/{d.cama?.numero}</Text>

                    {/* Contadores */}
                    <View style={s.contadores}>
                      {tarefas.length > 0 && (
                        <View style={s.contador}>
                          <Ionicons name="checkbox-outline" size={12} color="#f59e0b" />
                          <Text style={[s.contadorTexto, { color: '#f59e0b' }]}>{tarefas.length} tarefa{tarefas.length !== 1 ? 's' : ''}</Text>
                        </View>
                      )}
                      {meds.length > 0 && (
                        <View style={s.contador}>
                          <Ionicons name="medical-outline" size={12} color="#6366f1" />
                          <Text style={[s.contadorTexto, { color: '#6366f1' }]}>{meds.length} medicação{meds.length !== 1 ? 'ões' : ''}</Text>
                        </View>
                      )}
                      {notas.length > 0 && (
                        <View style={s.contador}>
                          <Ionicons name="document-text-outline" size={12} color="#64748b" />
                          <Text style={[s.contadorTexto, { color: '#64748b' }]}>{notas.length} nota{notas.length !== 1 ? 's' : ''}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <Ionicons name={aberto ? 'chevron-up' : 'chevron-down'} size={18} color="#cbd5e1" />
                </View>

                {/* Detalhe expandido */}
                {aberto && (
                  <View style={s.detalhe}>
                    {/* Tarefas */}
                    {tarefas.length > 0 && (
                      <View style={s.secao}>
                        <Text style={s.secaoTitulo}>Tarefas Pendentes</Text>
                        {tarefas.map((t: any) => (
                          <View key={t.id} style={s.tarefaRow}>
                            <View style={[s.priorBadge, { backgroundColor: prioridadeCor[t.prioridade] + '20' }]}>
                              <Text style={[s.priorTexto, { color: prioridadeCor[t.prioridade] }]}>{t.prioridade}</Text>
                            </View>
                            <Text style={s.tarefaDesc} numberOfLines={2}>{t.descricao}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Medicações */}
                    {meds.length > 0 && (
                      <View style={s.secao}>
                        <Text style={s.secaoTitulo}>Medicações Ativas</Text>
                        {meds.map((m: any) => (
                          <View key={m.id} style={s.medRow}>
                            <Ionicons name="medical-outline" size={14} color="#6366f1" />
                            <View style={{ flex: 1, marginLeft: 8 }}>
                              <Text style={s.medNome}>{m.nome}</Text>
                              <Text style={s.medDetalhe}>{m.dose} · {m.via} · {m.frequencia}</Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Notas */}
                    {notas.length > 0 && (
                      <View style={s.secao}>
                        <Text style={s.secaoTitulo}>Notas do Turno Anterior</Text>
                        {notas.slice(0, 3).map((n: any) => (
                          <View key={n.id} style={s.notaBox}>
                            <View style={s.notaHeader}>
                              <Text style={s.notaAutor}>{n.autor?.nome}</Text>
                              <Text style={s.notaData}>
                                {new Date(n.criadaEm).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                              </Text>
                            </View>
                            <Text style={s.notaTexto}>{n.conteudo}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {tarefas.length === 0 && meds.length === 0 && notas.length === 0 && (
                      <Text style={s.semInfo}>Sem informação adicional registada.</Text>
                    )}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}

          {/* Botão confirmar */}
          <View style={{ padding: 16, paddingTop: 8 }}>
            <TouchableOpacity
              style={[s.confirmarBotao, confirmado && s.confirmarBotaoOk]}
              onPress={confirmar}
              disabled={confirmando || confirmado}
              activeOpacity={0.85}
            >
              {confirmando
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.confirmarTexto}>
                    {confirmado ? '✓ Passagem confirmada' : 'Confirmar receção da passagem'}
                  </Text>
              }
            </TouchableOpacity>
          </View>

          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },

  header: { backgroundColor: '#1e293b', padding: 20, paddingTop: 16, paddingBottom: 20 },
  voltarBotao: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, marginBottom: 10 },
  voltarTexto: { color: '#fff', fontSize: 12, fontWeight: '600' },
  titulo: { fontSize: 20, fontWeight: '700', color: '#fff' },
  subtitulo: { fontSize: 13, color: '#94a3b8', marginTop: 2 },

  scroll: { flex: 1 },

  resumoBox: {
    flexDirection: 'row', backgroundColor: '#fff',
    marginHorizontal: 16, marginTop: 16, borderRadius: 16,
    padding: 16, alignItems: 'center', justifyContent: 'space-around',
    shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 2,
  },
  resumoItem: { alignItems: 'center' },
  resumoNum: { fontSize: 24, fontWeight: '800', color: '#0f172a' },
  resumoLabel: { fontSize: 11, color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', marginTop: 2 },
  resumoDivider: { width: 1, height: 32, backgroundColor: '#e2e8f0' },

  card: {
    backgroundColor: '#fff', marginHorizontal: 16, marginTop: 10,
    borderRadius: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 2,
  },
  cardTopo: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  estadoBar: { width: 4, height: '100%', borderRadius: 2, position: 'absolute', left: 0, top: 0, bottom: 0 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  doenteNome: { fontSize: 15, fontWeight: '700', color: '#1e293b', flex: 1, marginRight: 8 },
  doenteSub: { fontSize: 12, color: '#64748b' },
  estadoBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  estadoBadgeTexto: { fontSize: 11, fontWeight: '700' },

  contadores: { flexDirection: 'row', gap: 10, marginTop: 6, flexWrap: 'wrap' },
  contador: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  contadorTexto: { fontSize: 11, fontWeight: '600' },

  detalhe: { borderTopWidth: 1, borderTopColor: '#f1f5f9', padding: 14, paddingLeft: 18 },
  secao: { marginBottom: 14 },
  secaoTitulo: { fontSize: 11, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },

  tarefaRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  priorBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  priorTexto: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  tarefaDesc: { fontSize: 13, color: '#334155', flex: 1 },

  medRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
  medNome: { fontSize: 13, fontWeight: '600', color: '#1e293b' },
  medDetalhe: { fontSize: 11, color: '#64748b', marginTop: 1 },

  notaBox: { backgroundColor: '#f8fafc', borderRadius: 10, padding: 10, marginBottom: 6 },
  notaHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  notaAutor: { fontSize: 12, fontWeight: '700', color: '#475569' },
  notaData: { fontSize: 11, color: '#94a3b8' },
  notaTexto: { fontSize: 13, color: '#334155', lineHeight: 18 },

  semInfo: { fontSize: 13, color: '#94a3b8', textAlign: 'center', paddingVertical: 8 },

  vazioTitulo: { fontSize: 18, fontWeight: '700', color: '#1e293b', textAlign: 'center' },
  vazioSub: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 20 },

  confirmarBotao: {
    backgroundColor: '#2563eb', borderRadius: 14,
    paddingVertical: 15, alignItems: 'center',
    shadowColor: '#2563eb', shadowOpacity: 0.3, shadowOffset: { width: 0, height: 4 }, shadowRadius: 8, elevation: 4,
  },
  confirmarBotaoOk: { backgroundColor: '#22c55e', shadowColor: '#22c55e' },
  confirmarTexto: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
