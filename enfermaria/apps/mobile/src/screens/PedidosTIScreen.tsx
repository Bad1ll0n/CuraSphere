import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
  RefreshControl, TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../lib/api';
import { Utilizador } from '../lib/auth';

const TIPO_LABEL: Record<string, string> = {
  listagem_dados: 'Listagem de Dados',
  relatorio: 'Relatório',
  acesso_sistema: 'Acesso a Sistema',
  backup: 'Backup',
  auditoria_dados: 'Auditoria de Dados',
  outro: 'Outro',
};

const ESTADO_COR: Record<string, string> = {
  pendente: '#f59e0b',
  em_curso: '#3b82f6',
  concluido: '#22c55e',
  recusado: '#ef4444',
};

const ESTADO_LABEL: Record<string, string> = {
  pendente: 'Pendente',
  em_curso: 'Em Curso',
  concluido: 'Concluído',
  recusado: 'Recusado',
};

const ESTADOS_ACAO = ['pendente', 'em_curso', 'concluido', 'recusado'];

const ROLES_TI = ['it_admin', 'diretor_ti', 'analista_sistemas', 'dba', 'ciberseguranca', 'bi_analyst'];

interface Pedido {
  id: string;
  titulo: string;
  descricao: string;
  tipo: string;
  estado: string;
  urgente: boolean;
  criadoEm: string;
  criadoPor: { id: string; nome: string; role: string } | null;
  responsavel: { id: string; nome: string; role: string } | null;
}

interface Props { utilizador: Utilizador }

export default function PedidosTIScreen({ utilizador }: Props) {
  const [todos, setTodos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [atualizando, setAtualizando] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<'todos' | 'pendente' | 'em_curso' | 'concluido'>('todos');

  const eTI = ROLES_TI.includes(utilizador.role);

  const carregar = async () => {
    try {
      const { data } = await api.get('/pedidos-ti');
      setTodos(Array.isArray(data) ? data : []);
    } catch { /* silencioso */ } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { carregar(); }, []));

  const atualizarEstado = async (id: string, estado: string) => {
    setAtualizando(id);
    try {
      await api.patch(`/pedidos-ti/${id}`, { estado });
      setTodos(prev => prev.map(p => p.id === id ? { ...p, estado } : p));
    } catch { /* silencioso */ } finally {
      setAtualizando(null);
    }
  };

  const visiveis = filtro === 'todos' ? todos : todos.filter(p => p.estado === filtro);
  const pendentes = todos.filter(p => p.estado === 'pendente').length;
  const emCurso = todos.filter(p => p.estado === 'em_curso').length;

  if (loading) return (
    <View style={s.loading}><ActivityIndicator size="large" color="#2563eb" /></View>
  );

  return (
    <ScrollView
      style={s.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); carregar(); }} />}
    >
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitulo}>Pedidos TI</Text>
        <Text style={s.headerSub}>Solicitações e pedidos ao departamento de TI</Text>
        <View style={s.headerStats}>
          <View style={s.stat}>
            <Text style={[s.statNum, { color: '#f59e0b' }]}>{pendentes}</Text>
            <Text style={s.statLabel}>Pendentes</Text>
          </View>
          <View style={s.statDiv} />
          <View style={s.stat}>
            <Text style={[s.statNum, { color: '#3b82f6' }]}>{emCurso}</Text>
            <Text style={s.statLabel}>Em Curso</Text>
          </View>
        </View>
      </View>

      {/* Filtros */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filtrosRow} contentContainerStyle={s.filtrosContent}>
        {(['todos', 'pendente', 'em_curso', 'concluido'] as const).map(f => (
          <TouchableOpacity
            key={f}
            style={[s.filtroBotao, filtro === f && s.filtroBotaoAtivo]}
            onPress={() => setFiltro(f)}
          >
            <Text style={[s.filtroTexto, filtro === f && s.filtroTextoAtivo]}>
              {f === 'todos' ? 'Todos' : ESTADO_LABEL[f]}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Lista */}
      {visiveis.length === 0 ? (
        <View style={s.vazio}>
          <Text style={s.vazioTitulo}>Sem pedidos</Text>
          <Text style={s.vazioSub}>Não existem pedidos {filtro !== 'todos' ? ESTADO_LABEL[filtro].toLowerCase() + 's' : ''}</Text>
        </View>
      ) : (
        <View style={s.secao}>
          {visiveis.map(pedido => {
            const aberto = expandido === pedido.id;
            return (
              <TouchableOpacity
                key={pedido.id}
                style={s.cartao}
                onPress={() => setExpandido(aberto ? null : pedido.id)}
                activeOpacity={0.8}
              >
                <View style={[s.urgenteBarra, { backgroundColor: pedido.urgente ? '#ef4444' : '#e2e8f0' }]} />
                <View style={s.cartaoCorpo}>
                  <View style={s.cabecalho}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.titulo} numberOfLines={aberto ? undefined : 1}>{pedido.titulo}</Text>
                      <Text style={s.tipoTexto}>{TIPO_LABEL[pedido.tipo] ?? pedido.tipo}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      {pedido.urgente && (
                        <View style={s.urgenteBadge}>
                          <Text style={s.urgenteTexto}>Urgente</Text>
                        </View>
                      )}
                      <View style={[s.estadoBadge, { backgroundColor: (ESTADO_COR[pedido.estado] ?? '#94a3b8') + '20' }]}>
                        <Text style={[s.estadoTexto, { color: ESTADO_COR[pedido.estado] ?? '#94a3b8' }]}>
                          {ESTADO_LABEL[pedido.estado] ?? pedido.estado}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <Text style={s.metaTexto}>
                    {pedido.criadoPor?.nome ?? 'Sistema'} · {new Date(pedido.criadoEm).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })}
                  </Text>

                  {aberto && (
                    <View style={s.detalhe}>
                      <Text style={s.descricao}>{pedido.descricao}</Text>
                      {pedido.responsavel && (
                        <Text style={s.responsavelTexto}>Responsável: {pedido.responsavel.nome}</Text>
                      )}
                      {eTI && (
                        <>
                          <Text style={s.acoesTotulo}>Alterar estado</Text>
                          <View style={s.acoesRow}>
                            {ESTADOS_ACAO.map(e => (
                              <TouchableOpacity
                                key={e}
                                style={[
                                  s.acaoBotao,
                                  pedido.estado === e && { backgroundColor: (ESTADO_COR[e] ?? '#2563eb') + '20', borderColor: ESTADO_COR[e] ?? '#2563eb' },
                                ]}
                                onPress={() => atualizarEstado(pedido.id, e)}
                                disabled={atualizando === pedido.id || pedido.estado === e}
                              >
                                <Text style={[s.acaoTexto, pedido.estado === e && { color: ESTADO_COR[e] ?? '#2563eb', fontWeight: '700' }]}>
                                  {ESTADO_LABEL[e]}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </>
                      )}
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9' },
  header: { backgroundColor: '#0f172a', padding: 24, paddingTop: 20 },
  headerTitulo: { fontSize: 22, fontWeight: '700', color: '#fff' },
  headerSub: { fontSize: 12, color: '#64748b', marginTop: 4 },
  headerStats: { flexDirection: 'row', alignItems: 'center', marginTop: 16, gap: 16 },
  stat: { alignItems: 'center' },
  statNum: { fontSize: 28, fontWeight: '800' },
  statLabel: { fontSize: 11, color: '#64748b', marginTop: 2 },
  statDiv: { width: 1, height: 32, backgroundColor: '#1e293b' },
  filtrosRow: { marginTop: 12 },
  filtrosContent: { paddingHorizontal: 16, gap: 8, paddingBottom: 4 },
  filtroBotao: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#e2e8f0' },
  filtroBotaoAtivo: { backgroundColor: '#2563eb' },
  filtroTexto: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  filtroTextoAtivo: { color: '#fff' },
  secao: { paddingHorizontal: 16, paddingTop: 12 },
  cartao: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 14, marginBottom: 10, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 2 },
  urgenteBarra: { width: 4 },
  cartaoCorpo: { flex: 1, padding: 14 },
  cabecalho: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  titulo: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  tipoTexto: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  urgenteBadge: { backgroundColor: '#fef2f2', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  urgenteTexto: { fontSize: 10, fontWeight: '700', color: '#ef4444' },
  estadoBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  estadoTexto: { fontSize: 11, fontWeight: '600' },
  metaTexto: { fontSize: 12, color: '#94a3b8', marginTop: 6 },
  detalhe: { marginTop: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 12 },
  descricao: { fontSize: 13, color: '#475569', lineHeight: 20, marginBottom: 10 },
  responsavelTexto: { fontSize: 12, color: '#6366f1', fontWeight: '600', marginBottom: 10 },
  acoesTotulo: { fontSize: 11, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  acoesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  acaoBotao: { borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  acaoTexto: { fontSize: 12, color: '#64748b' },
  vazio: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 48 },
  vazioTitulo: { fontSize: 18, fontWeight: '700', color: '#1e293b', textAlign: 'center' },
  vazioSub: { fontSize: 14, color: '#94a3b8', textAlign: 'center', marginTop: 6 },
});
