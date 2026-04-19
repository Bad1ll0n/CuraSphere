import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
  RefreshControl, TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../lib/api';
import { Utilizador } from '../lib/auth';

const SUBROLE_TIPOS: Record<string, string[]> = {
  sysadmin:         ['infraestrutura', 'rede'],
  his_erp:          ['his_erp'],
  database_admin:   ['base_dados'],
  security_officer: ['seguranca'],
  dados_clinicos:   ['dados_clinicos'],
};

const TIPO_LABEL: Record<string, string> = {
  infraestrutura: 'Infraestrutura', rede: 'Rede', his_erp: 'HIS/ERP',
  base_dados: 'Base de Dados', seguranca: 'Segurança', dados_clinicos: 'Dados Clínicos', outro: 'Outro',
};

const PRIORIDADE_COR: Record<string, string> = {
  critica: '#ef4444', alta: '#f97316', media: '#eab308', baixa: '#22c55e',
};

const ESTADO_COR: Record<string, string> = {
  aberto: '#ef4444', em_analise: '#f59e0b', resolvido: '#22c55e', fechado: '#94a3b8',
};

const ESTADO_LABEL: Record<string, string> = {
  aberto: 'Aberto', em_analise: 'Em Análise', resolvido: 'Resolvido', fechado: 'Fechado',
};

const ESTADOS_ACAO = ['aberto', 'em_analise', 'resolvido', 'fechado'];

interface Incidente {
  id: string;
  titulo: string;
  descricao: string;
  tipo: string;
  subRoleAlvo: string | null;
  prioridade: string;
  estado: string;
  criadoEm: string;
  criadoPor: { id: string; nome: string; role: string } | null;
}

interface Props { utilizador: Utilizador }

export default function IncidentesSubRoleScreen({ utilizador }: Props) {
  const [todos, setTodos] = useState<Incidente[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [atualizando, setAtualizando] = useState<string | null>(null);

  const tiposFiltro = utilizador.subRole ? SUBROLE_TIPOS[utilizador.subRole] : null;

  const carregar = async () => {
    try {
      const { data } = await api.get('/incidentes-ti');
      const lista: Incidente[] = Array.isArray(data) ? data : [];
      const filtrados = tiposFiltro
        ? lista.filter(i => tiposFiltro.includes(i.tipo))
        : lista;
      setTodos(filtrados);
    } catch { /* silencioso */ } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { carregar(); }, []));

  const atualizarEstado = async (id: string, estado: string) => {
    setAtualizando(id);
    try {
      await api.patch(`/incidentes-ti/${id}`, { estado });
      setTodos(prev => prev.map(i => i.id === id ? { ...i, estado } : i));
    } catch { /* silencioso */ } finally {
      setAtualizando(null);
    }
  };

  const ativos = todos.filter(i => i.estado === 'aberto' || i.estado === 'em_analise');
  const resolvidos = todos.filter(i => i.estado === 'resolvido' || i.estado === 'fechado');

  if (loading) return (
    <View style={s.loading}><ActivityIndicator size="large" color="#2563eb" /></View>
  );

  const renderIncidente = (inc: Incidente) => {
    const aberto = expandido === inc.id;
    return (
      <TouchableOpacity
        key={inc.id}
        style={s.cartao}
        onPress={() => setExpandido(aberto ? null : inc.id)}
        activeOpacity={0.8}
      >
        {/* Linha de prioridade */}
        <View style={[s.prioridadeBarra, { backgroundColor: PRIORIDADE_COR[inc.prioridade] ?? '#94a3b8' }]} />

        <View style={s.cartaoCorpo}>
          {/* Cabeçalho */}
          <View style={s.cabecalho}>
            <Text style={s.titulo} numberOfLines={aberto ? undefined : 1}>{inc.titulo}</Text>
            <View style={[s.estadoBadge, { backgroundColor: (ESTADO_COR[inc.estado] ?? '#94a3b8') + '20' }]}>
              <Text style={[s.estadoTexto, { color: ESTADO_COR[inc.estado] ?? '#94a3b8' }]}>
                {ESTADO_LABEL[inc.estado] ?? inc.estado}
              </Text>
            </View>
          </View>

          {/* Meta */}
          <View style={s.meta}>
            <Text style={s.metaTexto}>{TIPO_LABEL[inc.tipo] ?? inc.tipo}</Text>
            <Text style={s.metaSep}>·</Text>
            <Text style={s.metaTexto}>{inc.criadoPor?.nome ?? 'Sistema'}</Text>
            <Text style={s.metaSep}>·</Text>
            <Text style={s.metaTexto}>{new Date(inc.criadoEm).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })}</Text>
          </View>

          {/* Expandido */}
          {aberto && (
            <View style={s.detalhe}>
              <Text style={s.descricao}>{inc.descricao}</Text>
              <Text style={s.acoesTotulo}>Alterar estado</Text>
              <View style={s.acoesRow}>
                {ESTADOS_ACAO.map(e => (
                  <TouchableOpacity
                    key={e}
                    style={[
                      s.acaoBotao,
                      inc.estado === e && { backgroundColor: (ESTADO_COR[e] ?? '#2563eb') + '20', borderColor: ESTADO_COR[e] ?? '#2563eb' },
                    ]}
                    onPress={() => atualizarEstado(inc.id, e)}
                    disabled={atualizando === inc.id || inc.estado === e}
                  >
                    <Text style={[s.acaoTexto, inc.estado === e && { color: ESTADO_COR[e] ?? '#2563eb', fontWeight: '700' }]}>
                      {ESTADO_LABEL[e]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ScrollView
      style={s.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); carregar(); }} />}
    >
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitulo}>Os Meus Incidentes</Text>
        <Text style={s.headerSub}>
          {tiposFiltro ? tiposFiltro.map(t => TIPO_LABEL[t]).join(' · ') : 'Todos os tipos'}
        </Text>
        <View style={s.headerStats}>
          <View style={s.stat}>
            <Text style={[s.statNum, { color: '#ef4444' }]}>{ativos.length}</Text>
            <Text style={s.statLabel}>Ativos</Text>
          </View>
          <View style={s.statDiv} />
          <View style={s.stat}>
            <Text style={[s.statNum, { color: '#22c55e' }]}>{resolvidos.length}</Text>
            <Text style={s.statLabel}>Resolvidos</Text>
          </View>
        </View>
      </View>

      {todos.length === 0 ? (
        <View style={s.vazio}>
          <Text style={s.vazioTitulo}>Sem incidentes ativos</Text>
          <Text style={s.vazioSub}>Nenhum incidente atribuído à tua área</Text>
        </View>
      ) : (
        <>
          {ativos.length > 0 && (
            <View style={s.secao}>
              <Text style={s.secaoTitulo}>Ativos ({ativos.length})</Text>
              {ativos.map(renderIncidente)}
            </View>
          )}
          {resolvidos.length > 0 && (
            <View style={s.secao}>
              <Text style={s.secaoTitulo}>Resolvidos / Fechados</Text>
              {resolvidos.map(renderIncidente)}
            </View>
          )}
        </>
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
  secao: { paddingHorizontal: 16, paddingTop: 16 },
  secaoTitulo: { fontSize: 11, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  cartao: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 14, marginBottom: 10, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 2 },
  prioridadeBarra: { width: 4 },
  cartaoCorpo: { flex: 1, padding: 14 },
  cabecalho: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  titulo: { flex: 1, fontSize: 14, fontWeight: '600', color: '#1e293b' },
  estadoBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  estadoTexto: { fontSize: 11, fontWeight: '600' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  metaTexto: { fontSize: 12, color: '#94a3b8' },
  metaSep: { fontSize: 12, color: '#cbd5e1' },
  detalhe: { marginTop: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 12 },
  descricao: { fontSize: 13, color: '#475569', lineHeight: 20, marginBottom: 12 },
  acoesTotulo: { fontSize: 11, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  acoesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  acaoBotao: { borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  acaoTexto: { fontSize: 12, color: '#64748b' },
  vazio: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 48 },
  vazioTitulo: { fontSize: 18, fontWeight: '700', color: '#1e293b', textAlign: 'center' },
  vazioSub: { fontSize: 14, color: '#94a3b8', textAlign: 'center', marginTop: 6 },
});
