import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import api from '../lib/api';
import { Utilizador } from '../lib/auth';
import i18n from '../lib/i18n';
import { estilosTematicos, LETRA, useEsquema } from '../lib/tema';

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
  useEsquema(); // UX-24: volta a desenhar quando o telemóvel muda de claro para escuro
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
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={i18n.t('a11y.back')} onPress={onVoltar} style={s.voltarBtn}>
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
          <TouchableOpacity accessibilityRole="button" onPress={marcarTodasLidas} disabled={marcandoTodas} style={s.todosBotao}>
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
        <FlatList // PERF-17: virtualizada (antes ScrollView + map montava todas as linhas)
          style={s.lista} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); carregar(); }} tintColor="#6366f1" />}
          data={notificacoes}
          keyExtractor={(n) => n.id}
          initialNumToRender={10}
          windowSize={7}
          ListEmptyComponent={(
            <View style={s.vazio}>
              <Ionicons name="notifications-off-outline" size={48} color="#cbd5e1" />
              <Text style={s.vazioTexto}>Sem notificações</Text>
            </View>
                    )}
          ListFooterComponent={<View style={{ height: 32 }} />}
          renderItem={({ item: n }) => (
            <TouchableOpacity accessibilityRole="button"
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
                  <Text style={s.cardData} numberOfLines={1}>{formatarData(n.criadaEm)}</Text>
                </View>
                <Text style={s.cardCorpo} numberOfLines={2}>{n.corpo}</Text>
                {!n.lida && (
                  <View style={s.tagNaoLida}>
                    <Text style={s.tagNaoLidaText}>Não lida</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const s = estilosTematicos((c) => ({
  container: { flex: 1, backgroundColor: c.fundo },
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
  badgeHeaderText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  todosBotao: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10 },
  todosTexto: { color: '#fff', fontSize: LETRA.corpo, fontWeight: '600' },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  lista: { flex: 1 },
  vazio: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80, gap: 12 },
  vazioTexto: { color: c.textoTenue, fontSize: 15 },
  card: {
    backgroundColor: c.superficie, marginHorizontal: 16, marginTop: 10,
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
  cardTitulo: { flex: 1, fontSize: LETRA.corpo, fontWeight: '500', color: c.textoSecundario },
  cardTituloNaoLido: { color: c.texto, fontWeight: '700' },
  cardData: { fontSize: 13, color: c.textoTenue },
  cardCorpo: { fontSize: LETRA.corpo, color: c.textoTenue, marginTop: 4, lineHeight: 18 },
  tagNaoLida: {
    marginTop: 8, alignSelf: 'flex-start',
    backgroundColor: '#e0e7ff', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2,
  },
  tagNaoLidaText: { fontSize: 13, fontWeight: '700', color: '#6366f1' },
}));
