import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import api from '../lib/api';
import { Utilizador } from '../lib/auth';

interface Doente {
  id: string;
  nome: string;
  estado: string;
  diagnosticoPrincipal: string;
  cama: { numero: string; quarto: string };
}

interface Tarefa {
  id: string;
  descricao: string;
  prioridade: string;
  estado: string;
  grupoResponsavel?: string;
  responsavel?: { id: string; nome: string };
}

const prioridadeCor: Record<string, string> = {
  urgente: '#ef4444', alta: '#f97316', media: '#eab308', baixa: '#22c55e',
};
const estadoDoenteCor: Record<string, string> = {
  estavel: '#22c55e', grave: '#f97316', critico: '#ef4444', alta_prevista: '#3b82f6',
};
const estadoDoenteLabel: Record<string, string> = {
  estavel: 'Estável', grave: 'Grave', critico: 'Crítico', alta_prevista: 'Alta Prevista',
};
const grupoLabel: Record<string, string> = {
  medico: 'Médico', enfermeiro: 'Enfermeiro', auxiliar: 'Auxiliar',
};

interface Props { utilizador: Utilizador; onVoltar?: () => void }

export default function TurnoScreen({ utilizador, onVoltar }: Props) {
  const [doentes, setDoentes] = useState<Doente[]>([]);
  const [tarefasPorDoente, setTarefasPorDoente] = useState<Record<string, Tarefa[]>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [doenteAberto, setDoenteAberto] = useState<string | null>(null);
  const [checkInFeito, setCheckInFeito] = useState(false);
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [passagemLoading, setPassagemLoading] = useState(false);

  const meuGrupoChave = utilizador.role === 'medico' ? 'medico'
    : utilizador.role === 'auxiliar' ? 'auxiliar' : 'enfermeiro';

  const carregar = async () => {
    try {
      const { data: doentesResp } = await api.get('/doentes');
      const doentesData = doentesResp.data ?? doentesResp;
      setDoentes(doentesData);

      const tarefasMap: Record<string, Tarefa[]> = {};
      await Promise.all(doentesData.map(async (d: Doente) => {
        try {
          const { data } = await api.get(`/tarefas/doente/${d.id}`);
          tarefasMap[d.id] = data.filter((t: Tarefa) => t.estado !== 'concluida' && t.estado !== 'cancelada');
        } catch { tarefasMap[d.id] = []; }
      }));
      setTarefasPorDoente(tarefasMap);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { carregar(); }, []));

  const fazerCheckIn = async () => {
    setCheckInLoading(true);
    try {
      let lat: number | undefined;
      let lon: number | undefined;

      // Pedir permissão de localização
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        try {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          lat = loc.coords.latitude;
          lon = loc.coords.longitude;
        } catch {
          // Se falhar GPS, prosseguir sem coordenadas (validação por IP)
        }
      }

      const resp = await api.post('/turnos/check-in', { lat, lon });
      const { dentroGeofence } = resp.data;

      setCheckInFeito(true);

      if (!dentroGeofence) {
        Alert.alert(
          '⚠️ Localização fora do hospital',
          'O check-in foi registado, mas a tua localização indica que podes estar fora das instalações hospitalares. O chefe de turno foi notificado.',
          [{ text: 'OK' }],
        );
      } else {
        Alert.alert('✅ Check-in realizado', 'Check-in confirmado com sucesso. Bem-vindo ao turno!');
      }
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Erro ao fazer check-in';
      Alert.alert('Erro', msg);
    } finally {
      setCheckInLoading(false);
    }
  };

  const iniciarPassagem = async () => {
    setPassagemLoading(true);
    try {
      const resp = await api.post('/turnos/iniciar-passagem');
      Alert.alert(
        'Passagem de turno enviada',
        `Desafio enviado a ${resp.data.receptores} profissional(is) online. Aguarda a confirmação.`,
      );
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Erro ao iniciar passagem';
      Alert.alert('Erro na passagem de turno', msg);
    } finally {
      setPassagemLoading(false);
    }
  };

  const concluirTarefa = async (tarefaId: string) => {
    try {
      await api.patch(`/tarefas/${tarefaId}/estado`, { estado: 'concluida' });
      await carregar();
    } catch { /* ignorar */ }
  };

  if (loading) return (
    <View style={{ flex: 1, backgroundColor: '#f1f5f9' }}>
      <View style={s.header}>
        {onVoltar && <TouchableOpacity onPress={onVoltar} style={s.voltarBotao}><Text style={s.voltarTexto}>‹  Voltar</Text></TouchableOpacity>}
        <Text style={s.headerTitulo}>O Meu Turno</Text>
      </View>
      <View style={s.centro}><ActivityIndicator size="large" color="#2563eb" /></View>
    </View>
  );

  return (
    <ScrollView
      style={s.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); carregar(); }} />}
    >
      <View style={s.header}>
        {onVoltar && (
          <TouchableOpacity onPress={onVoltar} style={s.voltarBotao}>
            <Text style={s.voltarTexto}>‹  Voltar</Text>
          </TouchableOpacity>
        )}
        <Text style={s.headerTitulo}>O Meu Turno</Text>
        <Text style={s.headerSubtitulo}>
          {doentes.length > 0 ? `${doentes.length} doente${doentes.length !== 1 ? 's' : ''} atribuído${doentes.length !== 1 ? 's' : ''}` : 'Sem doentes atribuídos'}
        </Text>
      </View>

      {/* Acções de turno */}
      <View style={s.accoesRow}>
        <TouchableOpacity
          style={[s.accaoBotao, checkInFeito ? s.accaoBotaoSucesso : s.accaoBotaoPrimario, checkInLoading && s.accaoBotaoDisabled]}
          onPress={fazerCheckIn}
          disabled={checkInFeito || checkInLoading}
        >
          {checkInLoading
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={s.accaoBotaoTexto}>{checkInFeito ? '✓ Check-in feito' : '📍 Fazer Check-in'}</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.accaoBotao, s.accaoBotaoSecundario, passagemLoading && s.accaoBotaoDisabled]}
          onPress={iniciarPassagem}
          disabled={passagemLoading}
        >
          {passagemLoading
            ? <ActivityIndicator size="small" color="#1e293b" />
            : <Text style={[s.accaoBotaoTexto, { color: '#1e293b' }]}>🔄 Passar Turno</Text>
          }
        </TouchableOpacity>
      </View>

      {doentes.length === 0 && (
        <View style={s.centro}>
          <Text style={s.semTurnoTitulo}>Sem doentes atribuídos</Text>
          <Text style={s.semTurnoSub}>Não tens doentes atribuídos no turno actual</Text>
        </View>
      )}

      {doentes.map((d) => {
        const tarefas = tarefasPorDoente[d.id] ?? [];
        const aberto = doenteAberto === d.id;
        return (
          <TouchableOpacity
            key={d.id}
            style={s.cartao}
            onPress={() => setDoenteAberto(aberto ? null : d.id)}
            activeOpacity={0.8}
          >
            <View style={s.cartaoCabecalho}>
              <View style={s.cartaoCabecalhoEsq}>
                <Text style={s.doenteNome}>{d.nome}</Text>
                <Text style={s.doenteInfo}>Cama {d.cama.quarto}/{d.cama.numero}</Text>
                <Text style={s.doenteInfo} numberOfLines={1}>{d.diagnosticoPrincipal}</Text>
              </View>
              <View style={[s.estadoBadge, { backgroundColor: estadoDoenteCor[d.estado] + '20' }]}>
                <Text style={[s.estadoTexto, { color: estadoDoenteCor[d.estado] }]}>
                  {estadoDoenteLabel[d.estado]}
                </Text>
              </View>
            </View>

            <View style={s.resumo}>
              {tarefas.length > 0 ? (
                <View style={s.badge}>
                  <Text style={s.badgeTexto}>{tarefas.length} tarefa{tarefas.length !== 1 ? 's' : ''}</Text>
                </View>
              ) : (
                <View style={[s.badge, { backgroundColor: '#f0fdf4' }]}>
                  <Text style={[s.badgeTexto, { color: '#16a34a' }]}>Sem tarefas</Text>
                </View>
              )}
            </View>

            {aberto && tarefas.length > 0 && (
              <View style={s.detalhes}>
                <Text style={s.secaoTitulo}>Tarefas Pendentes</Text>
                {tarefas.map((t) => {
                  const podeConcluir =
                    t.responsavel?.id === utilizador.id ||
                    (t.grupoResponsavel === meuGrupoChave && !t.responsavel);
                  return (
                    <View key={t.id} style={s.tarefa}>
                      <View style={[s.prioridadeDot, { backgroundColor: prioridadeCor[t.prioridade] ?? '#94a3b8' }]} />
                      <View style={s.tarefaConteudo}>
                        <Text style={s.tarefaTexto} numberOfLines={2}>{t.descricao}</Text>
                        {t.responsavel ? (
                          <Text style={s.tarefaMeta}>A cargo: {t.responsavel.nome}</Text>
                        ) : t.grupoResponsavel ? (
                          <Text style={s.tarefaMeta}>Para: {grupoLabel[t.grupoResponsavel] ?? t.grupoResponsavel}</Text>
                        ) : null}
                      </View>
                      {podeConcluir && (
                        <TouchableOpacity style={s.concluirBotao} onPress={() => concluirTarefa(t.id)}>
                          <Text style={s.concluirTexto}>✓</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  semTurnoTitulo: { fontSize: 20, fontWeight: '700', color: '#1e293b', textAlign: 'center', marginBottom: 8 },
  semTurnoSub: { fontSize: 15, color: '#64748b', textAlign: 'center', lineHeight: 22 },
  header: { backgroundColor: '#1e293b', padding: 20, paddingTop: 16, paddingBottom: 20 },
  voltarBotao: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, marginBottom: 10 },
  voltarTexto: { color: '#fff', fontSize: 12, fontWeight: '600' },
  headerTitulo: { fontSize: 22, fontWeight: '700', color: '#fff' },
  headerSubtitulo: { fontSize: 14, color: '#94a3b8', marginTop: 2 },
  accoesRow: { flexDirection: 'row', gap: 10, margin: 16 },
  accaoBotao: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  accaoBotaoPrimario: { backgroundColor: '#2563eb' },
  accaoBotaoSucesso: { backgroundColor: '#16a34a' },
  accaoBotaoSecundario: { backgroundColor: '#e2e8f0' },
  accaoBotaoDisabled: { opacity: 0.6 },
  accaoBotaoTexto: { color: '#fff', fontWeight: '700', fontSize: 14 },
  cartao: { backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 12, borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 2 },
  cartaoCabecalho: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cartaoCabecalhoEsq: { flex: 1, marginRight: 12 },
  doenteNome: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  doenteInfo: { fontSize: 13, color: '#64748b', marginTop: 2 },
  estadoBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  estadoTexto: { fontSize: 12, fontWeight: '600' },
  resumo: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  badge: { backgroundColor: '#fee2e2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  badgeTexto: { fontSize: 12, color: '#dc2626', fontWeight: '500' },
  detalhes: { marginTop: 14, borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 14 },
  secaoTitulo: { fontSize: 13, fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  tarefa: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f8fafc', gap: 10 },
  prioridadeDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  tarefaConteudo: { flex: 1 },
  tarefaTexto: { fontSize: 14, color: '#334155' },
  tarefaMeta: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  concluirBotao: { backgroundColor: '#dcfce7', width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  concluirTexto: { color: '#16a34a', fontWeight: '700', fontSize: 16 },
});
