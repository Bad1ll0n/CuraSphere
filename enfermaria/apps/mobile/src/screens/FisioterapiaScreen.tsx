import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import api from '../lib/api';
import { Utilizador } from '../lib/auth';
import i18n from '../lib/i18n';
import { estilosTematicos, LETRA, useEsquema } from '../lib/tema';

interface PlanoReabilitacao {
  id: string;
  objetivos: string;
  frequenciaSemanal: number;
  sessoesPrevistas: number;
  sessoesRealizadas: number;
  estado: string;
  dataInicio: string;
  doente: { nome: string; cama?: { numero: string; quarto: string } };
  fisioterapeuta: { nome: string };
}

interface SessaoFisioterapia {
  id: string;
  data: string;
  duracao: number;
  notas: string;
  evolucao: string;
  plano: { doente: { nome: string } };
}

interface Props { utilizador: Utilizador; onVoltar: () => void }

const estadoCor: Record<string, string> = {
  ativo: '#22c55e', suspenso: '#f59e0b', concluido: '#3b82f6', cancelado: '#ef4444',
};
const evolucaoCor: Record<string, string> = {
  melhoria: '#22c55e', estavel: '#3b82f6', deterioracao: '#ef4444',
};

export default function FisioterapiaScreen({ utilizador, onVoltar }: Props) {
  useEsquema(); // UX-24: volta a desenhar quando o telemóvel muda de claro para escuro
  const [tab, setTab] = useState<'planos' | 'sessoes'>('planos');
  const [planos, setPlanos] = useState<PlanoReabilitacao[]>([]);
  const [sessoes, setSessoes] = useState<SessaoFisioterapia[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [planoAberto, setPlanoAberto] = useState<string | null>(null);
  const [sessoesDePlano, setSessoesDePlano] = useState<SessaoFisioterapia[]>([]);

  const carregar = async () => {
    try {
      const [planosRes, sessoesRes] = await Promise.all([
        api.get('/fisioterapia/planos'),
        api.get('/fisioterapia/sessoes'),
      ]);
      setPlanos(planosRes.data?.data ?? planosRes.data ?? []);
      setSessoes(sessoesRes.data?.data ?? sessoesRes.data ?? []);
    } catch { /* ignorar */ }
    finally { setLoading(false); setRefreshing(false); }
  };

  const abrirPlano = async (planoId: string) => {
    setPlanoAberto(planoId);
    try {
      const { data } = await api.get(`/fisioterapia/sessoes/${planoId}`);
      setSessoesDePlano(data?.data ?? data ?? []);
    } catch { setSessoesDePlano([]); }
  };

  useFocusEffect(useCallback(() => { carregar(); }, []));

  if (loading) return <View style={s.centro}><ActivityIndicator size="large" color="#2563eb" /></View>;

  if (planoAberto) {
    const plano = planos.find(p => p.id === planoAberto);
    return (
      <View style={s.container}>
        <View style={s.header}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={i18n.t('a11y.back')} onPress={() => setPlanoAberto(null)} style={s.voltarBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitulo}>{plano?.doente.nome ?? 'Plano'}</Text>
            <Text style={s.headerSub}>{sessoesDePlano.length} sessões registadas</Text>
          </View>
        </View>
        <ScrollView>
          {sessoesDePlano.length === 0
            ? <View style={s.vazio}><Text style={s.vazioTexto}>Sem sessões registadas</Text></View>
            : sessoesDePlano.map(sess => (
              <View key={sess.id} style={s.cartao}>
                <View style={s.cartaoTopo}>
                  <Text style={s.cartaoTitulo}>{new Date(sess.data).toLocaleDateString('pt-PT')}</Text>
                  {sess.evolucao && (
                    <View style={[s.badge, { backgroundColor: evolucaoCor[sess.evolucao] + '22' }]}>
                      <Text style={[s.badgeTexto, { color: evolucaoCor[sess.evolucao] }]}>{sess.evolucao}</Text>
                    </View>
                  )}
                </View>
                <Text style={s.cartaoSub}>Duração: {sess.duracao} min</Text>
                {sess.notas && <Text style={s.cartaoSub}>Notas: {sess.notas}</Text>}
              </View>
            ))
          }
          <View style={{ height: 32 }} />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={i18n.t('a11y.back')} onPress={onVoltar} style={s.voltarBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitulo}>Fisioterapia</Text>
      </View>

      <View style={s.tabs}>
        {(['planos', 'sessoes'] as const).map(t => (
          <TouchableOpacity accessibilityRole="button" key={t} style={[s.tab, tab === t && s.tabAtivo]} onPress={() => setTab(t)}>
            <Text style={[s.tabTexto, tab === t && s.tabTextoAtivo]}>
              {t === 'planos' ? 'Planos' : 'Sessões'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); carregar(); }} />}>
        {tab === 'planos' && (
          planos.length === 0
            ? <View style={s.vazio}><Text style={s.vazioTexto}>Sem planos ativos</Text></View>
            : planos.map(p => (
              <TouchableOpacity accessibilityRole="button" key={p.id} style={s.cartao} onPress={() => abrirPlano(p.id)} activeOpacity={0.8}>
                <View style={s.cartaoTopo}>
                  <Text style={s.cartaoTitulo}>{p.doente.nome}</Text>
                  <View style={[s.badge, { backgroundColor: estadoCor[p.estado] + '22' }]}>
                    <Text style={[s.badgeTexto, { color: estadoCor[p.estado] }]}>{p.estado}</Text>
                  </View>
                </View>
                {p.doente.cama && (
                  <Text style={s.cartaoSub}>Cama {p.doente.cama.quarto}/{p.doente.cama.numero}</Text>
                )}
                <Text style={s.cartaoSub}>{p.objetivos}</Text>
                <View style={s.progressoRow}>
                  <View style={s.progressoBarra}>
                    <View style={[s.progressoFill, {
                      width: `${Math.min(100, (p.sessoesRealizadas / Math.max(1, p.sessoesPrevistas)) * 100)}%` as any,
                    }]} />
                  </View>
                  <Text style={s.progressoTexto}>{p.sessoesRealizadas}/{p.sessoesPrevistas}</Text>
                </View>
                <Text style={s.verSessoes}>Ver sessões ›</Text>
              </TouchableOpacity>
            ))
        )}

        {tab === 'sessoes' && (
          sessoes.length === 0
            ? <View style={s.vazio}><Text style={s.vazioTexto}>Sem sessões registadas</Text></View>
            : sessoes.map(sess => (
              <View key={sess.id} style={s.cartao}>
                <View style={s.cartaoTopo}>
                  <Text style={s.cartaoTitulo}>{sess.plano?.doente?.nome ?? '—'}</Text>
                  {sess.evolucao && (
                    <View style={[s.badge, { backgroundColor: evolucaoCor[sess.evolucao] + '22' }]}>
                      <Text style={[s.badgeTexto, { color: evolucaoCor[sess.evolucao] }]}>{sess.evolucao}</Text>
                    </View>
                  )}
                </View>
                <Text style={s.cartaoSub}>{new Date(sess.data).toLocaleDateString('pt-PT')} — {sess.duracao} min</Text>
                {sess.notas && <Text style={s.cartaoSub}>{sess.notas}</Text>}
              </View>
            ))
        )}
        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const s = estilosTematicos((c) => ({
  container: { flex: 1, backgroundColor: c.fundo },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { backgroundColor: '#2563eb', paddingTop: 52, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  voltarBtn: { padding: 4 },
  headerTitulo: { fontSize: 20, fontWeight: '700', color: '#fff' },
  headerSub: { fontSize: 13, color: '#bfdbfe', marginTop: 2 },
  tabs: { flexDirection: 'row', backgroundColor: c.superficie, paddingHorizontal: 16, paddingVertical: 10, gap: 8, borderBottomWidth: 1, borderBottomColor: c.borda },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 20, backgroundColor: c.fundo, alignItems: 'center' },
  tabAtivo: { backgroundColor: '#2563eb' },
  tabTexto: { fontSize: LETRA.corpo, fontWeight: '600', color: c.textoTenue },
  tabTextoAtivo: { color: '#fff' },
  vazio: { padding: 40, alignItems: 'center' },
  vazioTexto: { color: c.textoTenue, fontSize: 15 },
  cartao: { backgroundColor: c.superficie, marginHorizontal: 16, marginTop: 12, borderRadius: 14, padding: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 2 },
  cartaoTopo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cartaoTitulo: { fontSize: 15, fontWeight: '700', color: c.texto, flex: 1, marginRight: 8 },
  cartaoSub: { fontSize: 13, color: c.textoTenue, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  badgeTexto: { fontSize: LETRA.corpo, fontWeight: '600', textTransform: 'capitalize' },
  progressoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  progressoBarra: { flex: 1, height: 6, backgroundColor: '#e2e8f0', borderRadius: 3, overflow: 'hidden' },
  progressoFill: { height: 6, backgroundColor: '#2563eb', borderRadius: 3 },
  progressoTexto: { fontSize: LETRA.corpo, color: c.textoTenue, width: 40, textAlign: 'right' },
  verSessoes: { fontSize: 13, color: '#2563eb', marginTop: 8, fontWeight: '600' },
}));
