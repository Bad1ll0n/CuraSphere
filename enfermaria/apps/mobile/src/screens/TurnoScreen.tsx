import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import api from '../lib/api';
import { Utilizador } from '../lib/auth';

interface Tarefa {
  id: string;
  descricao: string;
  tipo: string;
  prioridade: string;
  estado: string;
  prazo?: string;
  doente: { id: string; nome: string; estado: string; cama: { numero: string; quarto: string } };
}

interface PassagemDoente {
  doente: { id: string; nome: string; estado: string; diagnosticoPrincipal: string; cama: { numero: string; quarto: string } };
  tarefasPendentes: Tarefa[];
  notasAnteriores: { id: string; texto: string; autor: { nome: string } }[];
  medicacoesAtivas: { id: string; nome: string; dose: string; via: string; frequencia: string }[];
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

interface Props { utilizador: Utilizador }

export default function TurnoScreen({ utilizador }: Props) {
  const [passagem, setPassagem] = useState<PassagemDoente[]>([]);
  const [checkInFeito, setCheckInFeito] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [doenteAberto, setDoenteAberto] = useState<string | null>(null);

  const fazerCheckIn = async () => {
    try {
      await api.post('/turnos/check-in');
      setCheckInFeito(true);
      await carregarPassagem();
    } catch (err: any) {
      const msg = err.response?.data?.message ?? 'Erro ao fazer check-in';
      if (msg.includes('já realizado')) {
        setCheckInFeito(true);
        await carregarPassagem();
      } else {
        Alert.alert('Erro', msg);
      }
    }
  };

  const carregarPassagem = async () => {
    try {
      const { data } = await api.get('/turnos/passagem-turno');
      setPassagem(data);
    } catch (_e) {
      // turno pode não existir ainda
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const concluirTarefa = async (tarefaId: string) => {
    await api.patch(`/tarefas/${tarefaId}/estado`, { estado: 'concluida' });
    await carregarPassagem();
  };

  useEffect(() => {
    // Tentar carregar passagem (se já fez check-in)
    api.get('/turnos/passagem-turno')
      .then(({ data }) => { setPassagem(data); setCheckInFeito(true); })
      .catch((_e) => { /* sem turno ativo */ })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <View style={s.centro}><ActivityIndicator size="large" color="#2563eb" /></View>
  );

  if (!checkInFeito) return (
    <View style={s.centro}>
      <Text style={s.checkInTitulo}>Bem-vindo, {utilizador.nome}</Text>
      <Text style={s.checkInSubtitulo}>Faça check-in para iniciar o turno e receber a passagem</Text>
      <TouchableOpacity style={s.checkInBotao} onPress={fazerCheckIn}>
        <Text style={s.checkInBotaoTexto}>Fazer Check-in</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <ScrollView
      style={s.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); carregarPassagem(); }} />}
    >
      <View style={s.header}>
        <Text style={s.headerTitulo}>Passagem de Turno</Text>
        <Text style={s.headerSubtitulo}>{passagem.length} doentes atribuídos</Text>
      </View>

      {passagem.length === 0 ? (
        <View style={s.vazio}>
          <Text style={s.vazioTexto}>Sem doentes atribuídos neste turno</Text>
        </View>
      ) : (
        passagem.map((p) => (
          <TouchableOpacity
            key={p.doente.id}
            style={s.cartao}
            onPress={() => setDoenteAberto(doenteAberto === p.doente.id ? null : p.doente.id)}
            activeOpacity={0.8}
          >
            {/* Cabeçalho do doente */}
            <View style={s.cartaoCabecalho}>
              <View style={s.cartaoCabecalhoEsq}>
                <Text style={s.doenteNome}>{p.doente.nome}</Text>
                <Text style={s.doenteInfo}>Cama {p.doente.cama.quarto}/{p.doente.cama.numero}</Text>
                <Text style={s.doenteInfo} numberOfLines={1}>{p.doente.diagnosticoPrincipal}</Text>
              </View>
              <View style={[s.estadoBadge, { backgroundColor: estadoDoenteCor[p.doente.estado] + '20' }]}>
                <Text style={[s.estadoTexto, { color: estadoDoenteCor[p.doente.estado] }]}>
                  {estadoDoenteLabel[p.doente.estado]}
                </Text>
              </View>
            </View>

            {/* Resumo */}
            <View style={s.resumo}>
              {p.tarefasPendentes.length > 0 && (
                <View style={s.badge}>
                  <Text style={s.badgeTexto}>{p.tarefasPendentes.length} tarefa{p.tarefasPendentes.length > 1 ? 's' : ''}</Text>
                </View>
              )}
              {p.medicacoesAtivas.length > 0 && (
                <View style={[s.badge, { backgroundColor: '#ede9fe' }]}>
                  <Text style={[s.badgeTexto, { color: '#7c3aed' }]}>{p.medicacoesAtivas.length} medicação</Text>
                </View>
              )}
              {p.notasAnteriores.length > 0 && (
                <View style={[s.badge, { backgroundColor: '#fef9c3' }]}>
                  <Text style={[s.badgeTexto, { color: '#854d0e' }]}>{p.notasAnteriores.length} nota{p.notasAnteriores.length > 1 ? 's' : ''}</Text>
                </View>
              )}
            </View>

            {/* Detalhes expandidos */}
            {doenteAberto === p.doente.id && (
              <View style={s.detalhes}>
                {p.tarefasPendentes.length > 0 && (
                  <View>
                    <Text style={s.secaoTitulo}>Tarefas Pendentes</Text>
                    {p.tarefasPendentes.map((t) => (
                      <View key={t.id} style={s.tarefa}>
                        <View style={[s.prioridadeDot, { backgroundColor: prioridadeCor[t.prioridade] }]} />
                        <Text style={s.tarefaTexto} numberOfLines={2}>{t.descricao}</Text>
                        <TouchableOpacity
                          style={s.concluirBotao}
                          onPress={() => concluirTarefa(t.id)}
                        >
                          <Text style={s.concluirTexto}>✓</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

                {p.medicacoesAtivas.length > 0 && (
                  <View style={{ marginTop: 12 }}>
                    <Text style={s.secaoTitulo}>Medicação Ativa</Text>
                    {p.medicacoesAtivas.map((m) => (
                      <View key={m.id} style={s.medicacao}>
                        <Text style={s.medicacaoNome}>{m.nome} {m.dose}</Text>
                        <Text style={s.medicacaoInfo}>{m.via} · {m.frequencia}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {p.notasAnteriores.length > 0 && (
                  <View style={{ marginTop: 12 }}>
                    <Text style={s.secaoTitulo}>Notas do Turno Anterior</Text>
                    {p.notasAnteriores.map((n) => (
                      <View key={n.id} style={s.nota}>
                        <Text style={s.notaAutor}>{n.autor.nome}</Text>
                        <Text style={s.notaTexto}>{n.texto}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#f1f5f9' },
  header: { padding: 20, paddingBottom: 12 },
  headerTitulo: { fontSize: 22, fontWeight: '700', color: '#1e293b' },
  headerSubtitulo: { fontSize: 14, color: '#64748b', marginTop: 2 },
  checkInTitulo: { fontSize: 22, fontWeight: '700', color: '#1e293b', textAlign: 'center', marginBottom: 8 },
  checkInSubtitulo: { fontSize: 15, color: '#64748b', textAlign: 'center', marginBottom: 32, lineHeight: 22 },
  checkInBotao: { backgroundColor: '#2563eb', paddingHorizontal: 40, paddingVertical: 16, borderRadius: 14 },
  checkInBotaoTexto: { color: '#fff', fontSize: 17, fontWeight: '700' },
  vazio: { padding: 32, alignItems: 'center' },
  vazioTexto: { color: '#94a3b8', fontSize: 15 },
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
  tarefa: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
  prioridadeDot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  tarefaTexto: { flex: 1, fontSize: 14, color: '#334155' },
  concluirBotao: { backgroundColor: '#dcfce7', width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  concluirTexto: { color: '#16a34a', fontWeight: '700', fontSize: 16 },
  medicacao: { paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
  medicacaoNome: { fontSize: 14, fontWeight: '600', color: '#334155' },
  medicacaoInfo: { fontSize: 13, color: '#64748b', marginTop: 2 },
  nota: { backgroundColor: '#fefce8', borderRadius: 8, padding: 10, marginBottom: 6 },
  notaAutor: { fontSize: 12, fontWeight: '600', color: '#92400e', marginBottom: 4 },
  notaTexto: { fontSize: 14, color: '#451a03' },
});
