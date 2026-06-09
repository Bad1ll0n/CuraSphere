import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../lib/api';
import { Utilizador } from '../lib/auth';
import ModalRegistarVitais from './doente-detalhe/modals/ModalRegistarVitais';

interface Doente {
  id: string;
  nome: string;
  cama: { numero: string; quarto: string } | null;
  ultimoNews2?: number | null;
  ultimosVitaisEm?: string | null;
}

const news2Cor = (score: number | null | undefined) => {
  if (score == null) return '#64748b';
  if (score >= 7) return '#ef4444';
  if (score >= 5) return '#f97316';
  if (score >= 3) return '#f59e0b';
  return '#22c55e';
};

const news2Label = (score: number | null | undefined) => {
  if (score == null) return '—';
  if (score >= 7) return 'Crítico';
  if (score >= 5) return 'Alto';
  if (score >= 3) return 'Médio';
  return 'Normal';
};

interface Props { utilizador: Utilizador }

export default function RegistarVitaisRapidoScreen({ utilizador: _utilizador }: Props) {
  const [doentes, setDoentes] = useState<Doente[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [doenteAlvo, setDoenteAlvo] = useState<Doente | null>(null);
  const [modalVitais, setModalVitais] = useState(false);

  const carregar = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const { data } = await api.get('/doentes?limit=50');
      const lista = Array.isArray(data) ? data : (data?.data ?? []);

      // Para cada doente, busca o último sinal vital
      const comVitais = await Promise.all(
        lista.map(async (d: any) => {
          try {
            const vr = await api.get(`/sinais-vitais/doente/${d.id}?limit=1`);
            const vitais = Array.isArray(vr.data) ? vr.data : (vr.data?.data ?? []);
            const ultimo = vitais[0];
            return {
              id: d.id,
              nome: d.nome,
              cama: d.cama ?? null,
              ultimoNews2: ultimo?.news2Score ?? null,
              ultimosVitaisEm: ultimo?.registadoEm ?? null,
            } as Doente;
          } catch {
            return { id: d.id, nome: d.nome, cama: d.cama ?? null, ultimoNews2: null, ultimosVitaisEm: null } as Doente;
          }
        })
      );

      // Ordenar: crítico primeiro, depois por última hora sem registo
      comVitais.sort((a, b) => {
        const sa = a.ultimoNews2 ?? -1;
        const sb = b.ultimoNews2 ?? -1;
        return sb - sa;
      });

      setDoentes(comVitais);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  const abrirModal = (d: Doente) => {
    setDoenteAlvo(d);
    setModalVitais(true);
  };

  const tempoDesdeUltimo = (isoStr: string | null | undefined) => {
    if (!isoStr) return 'Sem registo';
    const diff = Date.now() - new Date(isoStr).getTime();
    const h = Math.floor(diff / 3_600_000);
    const m = Math.floor((diff % 3_600_000) / 60_000);
    if (h > 0) return `há ${h}h${m > 0 ? ` ${m}m` : ''}`;
    return `há ${m}m`;
  };

  if (loading) return (
    <View style={estilos.centrado}>
      <ActivityIndicator size="large" color="#2563eb" />
    </View>
  );

  return (
    <View style={estilos.container}>
      <View style={estilos.header}>
        <Text style={estilos.titulo}>Registo Rápido — Vitais</Text>
        <Text style={estilos.subtitulo}>{doentes.length} doentes · toque para registar</Text>
      </View>

      <ScrollView
        contentContainerStyle={estilos.lista}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); carregar(true); }} tintColor="#2563eb" />}
      >
        {doentes.map(d => {
          const score = d.ultimoNews2;
          const cor = news2Cor(score);
          return (
            <TouchableOpacity key={d.id} style={estilos.card} activeOpacity={0.75} onPress={() => abrirModal(d)}>
              <View style={[estilos.news2Badge, { backgroundColor: cor + '22', borderColor: cor + '55' }]}>
                <Text style={[estilos.news2Score, { color: cor }]}>{score ?? '—'}</Text>
                <Text style={[estilos.news2Label, { color: cor }]}>{news2Label(score)}</Text>
              </View>
              <View style={estilos.cardInfo}>
                <Text style={estilos.nomePaciente} numberOfLines={1}>{d.nome}</Text>
                <Text style={estilos.camaText}>
                  {d.cama ? `Cama ${d.cama.numero} · ${d.cama.quarto}` : 'Sem cama'}
                </Text>
                <Text style={estilos.ultimoText}>{tempoDesdeUltimo(d.ultimosVitaisEm)}</Text>
              </View>
              <View style={estilos.btnRegistar}>
                <Text style={estilos.btnRegistarText}>Registar</Text>
              </View>
            </TouchableOpacity>
          );
        })}
        {doentes.length === 0 && (
          <Text style={estilos.vazio}>Sem doentes atribuídos neste turno</Text>
        )}
      </ScrollView>

      {doenteAlvo && (
        <ModalRegistarVitais
          visible={modalVitais}
          doenteId={doenteAlvo.id}
          onClose={() => { setModalVitais(false); setDoenteAlvo(null); }}
          onSaved={() => { setModalVitais(false); setDoenteAlvo(null); carregar(); }}
        />
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  centrado: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  titulo: { fontSize: 20, fontWeight: '700', color: '#0f172a' },
  subtitulo: { fontSize: 13, color: '#64748b', marginTop: 2 },
  lista: { padding: 16, gap: 10 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  news2Badge: {
    width: 60,
    height: 60,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  news2Score: { fontSize: 22, fontWeight: '800', lineHeight: 26 },
  news2Label: { fontSize: 10, fontWeight: '600' },
  cardInfo: { flex: 1, minWidth: 0 },
  nomePaciente: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  camaText: { fontSize: 12, color: '#64748b', marginTop: 2 },
  ultimoText: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  btnRegistar: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  btnRegistarText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  vazio: { textAlign: 'center', color: '#94a3b8', fontSize: 15, marginTop: 60 },
});
