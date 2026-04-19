import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl, TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import api from '../lib/api';
import { Utilizador } from '../lib/auth';

interface DashboardTI {
  utilizadores: { total: number; porRole: { role: string; total: number }[]; sessoesMobile: number };
  auditoria: {
    acoesHoje: number;
    topAcoes: { acao: string; total: number }[];
    recentes: { id: string; acao: string; entidadeTipo: string | null; utilizador: { nome: string; role: string } | null; createdAt: string; ip: string | null }[];
  };
  incidentes: {
    abertos: number; emAnalise: number; criticos: number; resolvidosHoje: number;
    porSubRole: { subRole: string; total: number }[];
    porTipo: { tipo: string; total: number }[];
    recentes: Incidente[];
  };
}

interface Incidente {
  id: string; titulo: string; tipo: string; prioridade: string; estado: string; criadoEm: string;
  criadoPor: { nome: string } | null;
}

type FiltroTipo = 'estado' | 'prioridade';
interface FiltroAtivo { tipo: FiltroTipo; valor: string; label: string; cor: string }

const COR_PRIORIDADE: Record<string, string> = {
  critica: '#ef4444', alta: '#f97316', media: '#eab308', baixa: '#22c55e',
};
const COR_ESTADO: Record<string, string> = {
  aberto: '#ef4444', em_analise: '#f59e0b', resolvido: '#22c55e', fechado: '#94a3b8',
};
const LABEL_ESTADO: Record<string, string> = {
  aberto: 'Aberto', em_analise: 'Em Análise', resolvido: 'Resolvido', fechado: 'Fechado',
};
const LABEL_PRIORIDADE: Record<string, string> = {
  critica: 'Crítica', alta: 'Alta', media: 'Média', baixa: 'Baixa',
};

interface Props { utilizador: Utilizador; onVoltar?: () => void }

function CartaoClicavel({
  titulo, valor, cor, icone, onPress,
}: { titulo: string; valor: string | number; cor: string; icone: keyof typeof Ionicons.glyphMap; onPress: () => void }) {
  return (
    <TouchableOpacity style={[s.cartao, { borderLeftColor: cor }]} onPress={onPress} activeOpacity={0.75}>
      <View style={s.cartaoCabecalho}>
        <View style={[s.cartaoIconBox, { backgroundColor: cor + '20' }]}>
          <Ionicons name={icone} size={18} color={cor} />
        </View>
        <Text style={s.cartaoTitulo}>{titulo}</Text>
        <Ionicons name="chevron-forward" size={14} color="#cbd5e1" />
      </View>
      <Text style={[s.cartaoValor, { color: cor }]}>{valor}</Text>
    </TouchableOpacity>
  );
}

function ListaFiltrada({ filtro, onVoltar }: { filtro: FiltroAtivo; onVoltar: () => void }) {
  const [lista, setLista] = useState<Incidente[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const carregar = async () => {
    try {
      const { data } = await api.get('/incidentes-ti');
      const todos: Incidente[] = Array.isArray(data) ? data : [];
      const filtrados = todos.filter(inc =>
        filtro.tipo === 'estado' ? inc.estado === filtro.valor : inc.prioridade === filtro.valor
      );
      setLista(filtrados);
    } catch { /* silencioso */ } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { carregar(); }, [filtro.valor]));

  return (
    <View style={{ flex: 1, backgroundColor: '#f1f5f9' }}>
      {/* Header */}
      <View style={[s.header, { paddingBottom: 20 }]}>
        <TouchableOpacity onPress={onVoltar} style={s.voltarBotao}>
          <Text style={s.voltarTexto}>‹  Dashboard</Text>
        </TouchableOpacity>
        <Text style={s.headerTitulo}>Incidentes — {filtro.label}</Text>
        <View style={[s.filtroTag, { backgroundColor: filtro.cor + '30' }]}>
          <Text style={[s.filtroTagTexto, { color: filtro.cor }]}>
            {filtro.tipo === 'estado' ? 'Estado' : 'Prioridade'}: {filtro.label}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={s.loading}><ActivityIndicator size="large" color="#2563eb" /></View>
      ) : (
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); carregar(); }} />}
        >
          {lista.length === 0 ? (
            <View style={s.vazio}>
              <Ionicons name="checkmark-circle-outline" size={48} color="#22c55e" />
              <Text style={s.vazioTitulo}>Nenhum incidente</Text>
              <Text style={s.vazioSub}>Não há incidentes com este filtro</Text>
            </View>
          ) : (
            <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
              <Text style={s.secaoTitulo}>{lista.length} {lista.length === 1 ? 'incidente' : 'incidentes'}</Text>
              <View style={s.listaCard}>
                {lista.map((inc, i) => {
                  const corP = COR_PRIORIDADE[inc.prioridade] ?? '#94a3b8';
                  const corE = COR_ESTADO[inc.estado] ?? '#94a3b8';
                  return (
                    <View
                      key={inc.id}
                      style={[s.listaItem, i < lista.length - 1 && s.listaItemBorder, { borderLeftWidth: 3, borderLeftColor: filtro.tipo === 'prioridade' ? corP : corE }]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={s.listaTexto}>{inc.titulo}</Text>
                        <Text style={s.listaMeta}>
                          {inc.tipo.replace(/_/g, ' ')} · {inc.criadoPor?.nome ?? 'Sistema'}
                        </Text>
                        <Text style={s.listaData}>
                          {new Date(inc.criadoEm).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 4 }}>
                        <View style={[s.badge, { backgroundColor: corP + '20' }]}>
                          <Text style={[s.badgeTexto, { color: corP }]}>{LABEL_PRIORIDADE[inc.prioridade] ?? inc.prioridade}</Text>
                        </View>
                        <View style={[s.badge, { backgroundColor: corE + '20' }]}>
                          <Text style={[s.badgeTexto, { color: corE }]}>{LABEL_ESTADO[inc.estado] ?? inc.estado}</Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </View>
  );
}

export default function DashboardTIScreen({ utilizador, onVoltar }: Props) {
  const [dados, setDados] = useState<DashboardTI | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filtroAtivo, setFiltroAtivo] = useState<FiltroAtivo | null>(null);

  const carregar = async () => {
    try {
      const { data } = await api.get('/dashboard/ti');
      setDados(data);
    } catch { /* silencioso */ } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => {
    carregar();
    setFiltroAtivo(null);
  }, []));

  if (filtroAtivo) {
    return <ListaFiltrada filtro={filtroAtivo} onVoltar={() => setFiltroAtivo(null)} />;
  }

  if (loading) return (
    <View style={s.loading}><ActivityIndicator size="large" color="#2563eb" /></View>
  );

  const { utilizadores, auditoria, incidentes } = dados ?? {} as DashboardTI;

  return (
    <ScrollView
      style={s.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); carregar(); }} />}
    >
      {/* Cabeçalho */}
      <View style={s.header}>
        {onVoltar && (
          <TouchableOpacity onPress={onVoltar} style={s.voltarBotao}>
            <Text style={s.voltarTexto}>‹  Voltar</Text>
          </TouchableOpacity>
        )}
        <Text style={s.headerTitulo}>Dashboard TI</Text>
        <Text style={s.headerSub}>Olá, {utilizador.nome.split(' ')[0]}</Text>
      </View>

      {/* Incidentes — cartões clicáveis */}
      <View style={s.secao}>
        <Text style={s.secaoTitulo}>Incidentes TI · toque para filtrar</Text>
        <View style={s.grelha}>
          <CartaoClicavel
            titulo="Abertos" valor={incidentes?.abertos ?? 0} cor="#ef4444" icone="alert-circle-outline"
            onPress={() => setFiltroAtivo({ tipo: 'estado', valor: 'aberto', label: 'Abertos', cor: '#ef4444' })}
          />
          <CartaoClicavel
            titulo="Em Análise" valor={incidentes?.emAnalise ?? 0} cor="#f59e0b" icone="time-outline"
            onPress={() => setFiltroAtivo({ tipo: 'estado', valor: 'em_analise', label: 'Em Análise', cor: '#f59e0b' })}
          />
          <CartaoClicavel
            titulo="Críticos" valor={incidentes?.criticos ?? 0} cor="#dc2626" icone="flame-outline"
            onPress={() => setFiltroAtivo({ tipo: 'prioridade', valor: 'critica', label: 'Críticos', cor: '#dc2626' })}
          />
          <CartaoClicavel
            titulo="Resolvidos Hoje" valor={incidentes?.resolvidosHoje ?? 0} cor="#22c55e" icone="checkmark-circle-outline"
            onPress={() => setFiltroAtivo({ tipo: 'estado', valor: 'resolvido', label: 'Resolvidos', cor: '#22c55e' })}
          />
        </View>
      </View>

      {/* Sistema */}
      <View style={s.secao}>
        <Text style={s.secaoTitulo}>Sistema</Text>
        <View style={s.grelha}>
          <View style={[s.cartao, { borderLeftColor: '#6366f1' }]}>
            <View style={s.cartaoCabecalho}>
              <View style={[s.cartaoIconBox, { backgroundColor: '#6366f120' }]}>
                <Ionicons name="person-outline" size={18} color="#6366f1" />
              </View>
              <Text style={s.cartaoTitulo}>Utilizadores Ativos</Text>
            </View>
            <Text style={[s.cartaoValor, { color: '#6366f1' }]}>{utilizadores?.total ?? 0}</Text>
          </View>
          <View style={[s.cartao, { borderLeftColor: '#8b5cf6' }]}>
            <View style={s.cartaoCabecalho}>
              <View style={[s.cartaoIconBox, { backgroundColor: '#8b5cf620' }]}>
                <Ionicons name="phone-portrait-outline" size={18} color="#8b5cf6" />
              </View>
              <Text style={s.cartaoTitulo}>Sessões Mobile</Text>
            </View>
            <Text style={[s.cartaoValor, { color: '#8b5cf6' }]}>{utilizadores?.sessoesMobile ?? 0}</Text>
          </View>
          <View style={[s.cartao, { borderLeftColor: '#ec4899' }]}>
            <View style={s.cartaoCabecalho}>
              <View style={[s.cartaoIconBox, { backgroundColor: '#ec489920' }]}>
                <Ionicons name="pulse-outline" size={18} color="#ec4899" />
              </View>
              <Text style={s.cartaoTitulo}>Ações Hoje</Text>
            </View>
            <Text style={[s.cartaoValor, { color: '#ec4899' }]}>{auditoria?.acoesHoje ?? 0}</Text>
          </View>
        </View>
      </View>

      {/* Incidentes recentes */}
      {(incidentes?.recentes?.length ?? 0) > 0 && (
        <View style={s.secao}>
          <Text style={s.secaoTitulo}>Incidentes Recentes</Text>
          <View style={s.listaCard}>
            {incidentes.recentes.slice(0, 8).map((inc, i) => {
              const corP = COR_PRIORIDADE[inc.prioridade] ?? '#94a3b8';
              const corE = COR_ESTADO[inc.estado] ?? '#94a3b8';
              return (
                <View key={inc.id} style={[s.listaItem, i < Math.min(incidentes.recentes.length, 8) - 1 && s.listaItemBorder]}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.listaTexto} numberOfLines={1}>{inc.titulo}</Text>
                    <Text style={s.listaMeta}>{inc.tipo.replace(/_/g, ' ')} · {inc.criadoPor?.nome ?? ''}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <View style={[s.badge, { backgroundColor: corP + '20' }]}>
                      <Text style={[s.badgeTexto, { color: corP }]}>{LABEL_PRIORIDADE[inc.prioridade] ?? inc.prioridade}</Text>
                    </View>
                    <View style={[s.badge, { backgroundColor: corE + '20' }]}>
                      <Text style={[s.badgeTexto, { color: corE }]}>{LABEL_ESTADO[inc.estado] ?? inc.estado}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Top ações */}
      {auditoria?.topAcoes?.length > 0 && (
        <View style={s.secao}>
          <Text style={s.secaoTitulo}>Top Ações (7 dias)</Text>
          <View style={s.listaCard}>
            {auditoria.topAcoes.slice(0, 6).map((a, i) => (
              <View key={i} style={[s.listaItem, i < auditoria.topAcoes.slice(0, 6).length - 1 && s.listaItemBorder]}>
                <Text style={s.listaTexto}>{a.acao}</Text>
                <View style={[s.badge, { backgroundColor: '#eef2ff' }]}>
                  <Text style={[s.badgeTexto, { color: '#6366f1' }]}>{a.total}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Atividade recente */}
      {auditoria?.recentes?.length > 0 && (
        <View style={s.secao}>
          <Text style={s.secaoTitulo}>Atividade Recente</Text>
          <View style={s.listaCard}>
            {auditoria.recentes.slice(0, 10).map((a, i) => (
              <View key={a.id} style={[s.listaItem, i < Math.min(auditoria.recentes.length, 10) - 1 && s.listaItemBorder]}>
                <View style={{ flex: 1 }}>
                  <Text style={s.listaTexto} numberOfLines={1}>{a.acao}</Text>
                  <Text style={s.listaMeta}>{a.utilizador?.nome ?? 'Sistema'} · {a.ip ?? ''}</Text>
                </View>
                <Text style={s.listaHora}>{new Date(a.createdAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</Text>
              </View>
            ))}
          </View>
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
  voltarBotao: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, marginBottom: 12 },
  voltarTexto: { color: '#fff', fontSize: 14, fontWeight: '600' },
  headerTitulo: { fontSize: 22, fontWeight: '700', color: '#fff' },
  headerSub: { fontSize: 13, color: '#94a3b8', marginTop: 4 },
  filtroTag: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginTop: 10 },
  filtroTagTexto: { fontSize: 12, fontWeight: '700' },
  secao: { paddingHorizontal: 16, paddingTop: 20 },
  secaoTitulo: { fontSize: 11, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  grelha: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cartao: { flex: 1, minWidth: '45%', backgroundColor: '#fff', borderRadius: 14, padding: 14, borderLeftWidth: 3, shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 2 },
  cartaoCabecalho: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  cartaoIconBox: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  cartaoTitulo: { fontSize: 11, fontWeight: '600', color: '#64748b', flex: 1 },
  cartaoValor: { fontSize: 22, fontWeight: '700' },
  listaCard: { backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 2 },
  listaItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  listaItemBorder: { borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  listaTexto: { fontSize: 13, color: '#1e293b', flex: 1 },
  listaMeta: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  listaData: { fontSize: 10, color: '#cbd5e1', marginTop: 1 },
  listaHora: { fontSize: 11, color: '#94a3b8' },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgeTexto: { fontSize: 11, fontWeight: '700' },
  vazio: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 48, gap: 12 },
  vazioTitulo: { fontSize: 18, fontWeight: '700', color: '#1e293b', textAlign: 'center' },
  vazioSub: { fontSize: 14, color: '#94a3b8', textAlign: 'center' },
});
