import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import api from '../lib/api';
import { Utilizador } from '../lib/auth';

interface Notificacao {
  id: string;
  titulo: string;
  corpo: string;
  lida: boolean;
  criadaEm: string;
  lidaEm: string | null;
}

interface Props { utilizador: Utilizador; onVoltar: () => void }

function formatarData(iso: string) {
  const d = new Date(iso);
  const agora = new Date();
  const diffMs = agora.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Agora mesmo';
  if (diffMin < 60) return `Há ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `Há ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `Há ${diffD} dias`;
  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' });
}

export default function NotificacoesScreen({ utilizador, onVoltar }: Props) {
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [naoLidas, setNaoLidas] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [marcandoTodas, setMarcandoTodas] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const r = await api.get('/notificacoes?limit=50');
      setNotificacoes(r.data.notificacoes ?? []);
      setNaoLidas(r.data.naoLidas ?? 0);
    } catch { /* silencioso */ }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    carregar();
  }, [carregar]));

  const marcarLida = async (id: string) => {
    setNotificacoes(prev => prev.map(n => n.id === id ? { ...n, lida: true } : n));
    setNaoLidas(prev => Math.max(0, prev - 1));
    try {
      await api.patch(`/notificacoes/${id}/ler`);
    } catch { /* silencioso */ }
  };

  const marcarTodasLidas = async () => {
    setMarcandoTodas(true);
    try {
      await api.patch('/notificacoes/marcar-todas-lidas');
      setNotificacoes(prev => prev.map(n => ({ ...n, lida: true })));
      setNaoLidas(0);
    } catch (e: any) {
      Alert.alert('Erro', e.response?.data?.message ?? 'Não foi possível marcar como lidas');
    } finally {
      setMarcandoTodas(false);
    }
  };

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onVoltar} style={s.voltarBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={s.headerMid}>
          <Text style={s.headerTitulo}>Notificações</Text>
          {naoLidas > 0 && (
            <View style={s.badgeHeader}>
              <Text style={s.badgeHeaderText}>{naoLidas}</Text>
            </View>
          )}
        </View>
        {naoLidas > 0 && (
          <TouchableOpacity onPress={marcarTodasLidas} disabled={marcandoTodas} style={s.todosBotao}>
            {marcandoTodas
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={s.todosTexto}>Ler todas</Text>
            }
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={s.centro}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      ) : (
        <ScrollView
          style={s.lista}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); carregar(); }} tintColor="#6366f1" />}
        >
          {notificacoes.length === 0 ? (
            <View style={s.vazio}>
              <Ionicons name="notifications-off-outline" size={48} color="#cbd5e1" />
              <Text style={s.vazioTexto}>Sem notificações</Text>
            </View>
          ) : notificacoes.map((n) => (
            <TouchableOpacity
              key={n.id}
              style={[s.card, !n.lida && s.cardNaoLido]}
              onPress={() => { if (!n.lida) marcarLida(n.id); }}
              activeOpacity={n.lida ? 1 : 0.75}
            >
              <View style={s.cardEsq}>
                <View style={[s.dot, n.lida ? s.dotLido : s.dotNaoLido]} />
              </View>
              <View style={s.cardConteudo}>
                <View style={s.cardTopo}>
                  <Text style={[s.cardTitulo, !n.lida && s.cardTituloNaoLido]} numberOfLines={1}>
                    {n.titulo}
                  </Text>
                  <Text style={s.cardData}>{formatarData(n.criadaEm)}</Text>
                </View>
                <Text style={s.cardCorpo} numberOfLines={2}>{n.corpo}</Text>
                {!n.lida && (
                  <View style={s.tagNaoLida}>
                    <Text style={s.tagNaoLidaText}>Não lida</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ))}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  header: {
    backgroundColor: '#6366f1',
    paddingTop: 52, paddingBottom: 16, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  voltarBtn: { padding: 4 },
  headerMid: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitulo: { fontSize: 18, fontWeight: '700', color: '#fff' },
  badgeHeader: {
    backgroundColor: '#ef4444', borderRadius: 12,
    minWidth: 22, height: 22, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6,
  },
  badgeHeaderText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  todosBotao: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10 },
  todosTexto: { color: '#fff', fontSize: 12, fontWeight: '600' },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  lista: { flex: 1 },
  vazio: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80, gap: 12 },
  vazioTexto: { color: '#94a3b8', fontSize: 15 },
  card: {
    backgroundColor: '#fff', marginHorizontal: 16, marginTop: 10,
    borderRadius: 14, flexDirection: 'row',
    shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 1 }, shadowRadius: 4,
    elevation: 1, overflow: 'hidden',
  },
  cardNaoLido: {
    backgroundColor: '#eef2ff', borderLeftWidth: 4, borderLeftColor: '#6366f1',
  },
  cardEsq: { width: 24, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 18 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotNaoLido: { backgroundColor: '#6366f1' },
  dotLido: { backgroundColor: '#e2e8f0' },
  cardConteudo: { flex: 1, padding: 14, paddingLeft: 4 },
  cardTopo: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  cardTitulo: { flex: 1, fontSize: 14, fontWeight: '500', color: '#475569' },
  cardTituloNaoLido: { color: '#1e293b', fontWeight: '700' },
  cardData: { fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap' as any },
  cardCorpo: { fontSize: 13, color: '#64748b', marginTop: 4, lineHeight: 18 },
  tagNaoLida: {
    marginTop: 8, alignSelf: 'flex-start',
    backgroundColor: '#e0e7ff', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2,
  },
  tagNaoLidaText: { fontSize: 10, fontWeight: '700', color: '#6366f1' },
});
