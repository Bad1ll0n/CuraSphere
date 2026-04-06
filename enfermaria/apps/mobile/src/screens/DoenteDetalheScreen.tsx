import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, TextInput, Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../lib/api';
import { Utilizador } from '../lib/auth';

interface Props {
  doenteId: string;
  utilizador: Utilizador;
  onVoltar: () => void;
}

const estadoCor: Record<string, string> = {
  estavel: '#22c55e', grave: '#f97316', critico: '#ef4444', alta_prevista: '#3b82f6',
};
const estadoLabel: Record<string, string> = {
  estavel: 'Estável', grave: 'Grave', critico: 'Crítico', alta_prevista: 'Alta Prevista',
};

export default function DoenteDetalheScreen({ doenteId, utilizador, onVoltar }: Props) {
  const [doente, setDoente] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [nota, setNota] = useState('');
  const [gravandoNota, setGravandoNota] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState<'info' | 'tarefas' | 'medicacao' | 'notas'>('info');

  const carregar = async () => {
    try {
      const { data } = await api.get(`/doentes/${doenteId}`);
      setDoente(data);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { carregar(); }, [doenteId]));

  const gravarNota = async () => {
    if (!nota.trim()) return;
    setGravandoNota(true);
    try {
      const turno = await api.get('/turnos/ativo');
      await api.post('/turnos/nota', { turnoId: turno.data.id, doenteId, texto: nota });
      setNota('');
      await carregar();
      Alert.alert('Sucesso', 'Nota guardada');
    } catch {
      Alert.alert('Erro', 'Não foi possível guardar a nota');
    } finally {
      setGravandoNota(false);
    }
  };

  const concluirTarefa = async (tarefaId: string) => {
    await api.patch(`/tarefas/${tarefaId}/estado`, { estado: 'concluida' });
    await carregar();
  };

  const registarMedicacao = async (medicacaoId: string) => {
    try {
      await api.post(`/medicacao/${medicacaoId}/administrar`, {});
      Alert.alert('Registado', 'Administração registada com sucesso');
    } catch {
      Alert.alert('Erro', 'Não foi possível registar');
    }
  };

  if (loading) return <View style={s.centro}><ActivityIndicator size="large" color="#2563eb" /></View>;
  if (!doente) return null;

  const abas: { key: typeof abaAtiva; label: string }[] = [
    { key: 'info', label: 'Info' },
    { key: 'tarefas', label: `Tarefas (${doente.tarefas?.length ?? 0})` },
    { key: 'medicacao', label: 'Med.' },
    { key: 'notas', label: 'Notas' },
  ];

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onVoltar} style={s.voltarBotao}>
          <Text style={s.voltarTexto}>← Voltar</Text>
        </TouchableOpacity>
        <View style={s.headerInfo}>
          <Text style={s.headerNome}>{doente.nome}</Text>
          <View style={[s.estadoBadge, { backgroundColor: estadoCor[doente.estado] + '20' }]}>
            <Text style={[s.estadoTexto, { color: estadoCor[doente.estado] }]}>{estadoLabel[doente.estado]}</Text>
          </View>
        </View>
        <Text style={s.headerSub}>Cama {doente.cama?.quarto}/{doente.cama?.numero} · Proc. {doente.numeroProcesso}</Text>
      </View>

      {/* Abas */}
      <View style={s.abas}>
        {abas.map((a) => (
          <TouchableOpacity key={a.key} style={[s.aba, abaAtiva === a.key && s.abaAtiva]} onPress={() => setAbaAtiva(a.key)}>
            <Text style={[s.abaTexto, abaAtiva === a.key && s.abaTextoAtivo]}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={s.conteudo} refreshControl={<RefreshControl refreshing={false} onRefresh={carregar} />}>

        {/* Aba Info */}
        {abaAtiva === 'info' && (
          <View style={s.secao}>
            <View style={s.infoCard}>
              <Text style={s.infoLabel}>Diagnóstico Principal</Text>
              <Text style={s.infoValor}>{doente.diagnosticoPrincipal}</Text>
            </View>
            <View style={s.infoCard}>
              <Text style={s.infoLabel}>Data de Nascimento</Text>
              <Text style={s.infoValor}>{new Date(doente.dataNascimento).toLocaleDateString('pt-PT')}</Text>
            </View>
            <View style={s.infoCard}>
              <Text style={s.infoLabel}>Data de Admissão</Text>
              <Text style={s.infoValor}>{new Date(doente.dataAdmissao).toLocaleDateString('pt-PT')}</Text>
            </View>
            {doente.dataAltaPrevista && (
              <View style={s.infoCard}>
                <Text style={s.infoLabel}>Alta Prevista</Text>
                <Text style={s.infoValor}>{new Date(doente.dataAltaPrevista).toLocaleDateString('pt-PT')}</Text>
              </View>
            )}
          </View>
        )}

        {/* Aba Tarefas */}
        {abaAtiva === 'tarefas' && (
          <View style={s.secao}>
            {doente.tarefas?.length === 0 ? (
              <Text style={s.vazioTexto}>Sem tarefas pendentes</Text>
            ) : doente.tarefas?.map((t: any) => (
              <View key={t.id} style={s.tarefaCard}>
                <View style={s.tarefaEsq}>
                  <View style={[s.prioridadeDot, { backgroundColor: t.prioridade === 'urgente' ? '#ef4444' : t.prioridade === 'alta' ? '#f97316' : t.prioridade === 'media' ? '#eab308' : '#22c55e' }]} />
                  <Text style={s.tarefaDescricao}>{t.descricao}</Text>
                </View>
                {t.estado !== 'concluida' && (
                  <TouchableOpacity style={s.concluirBotao} onPress={() => concluirTarefa(t.id)}>
                    <Text style={s.concluirTexto}>✓</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Aba Medicação */}
        {abaAtiva === 'medicacao' && (
          <View style={s.secao}>
            {doente.medicacoes?.filter((m: any) => m.ativo).length === 0 ? (
              <Text style={s.vazioTexto}>Sem medicação ativa</Text>
            ) : doente.medicacoes?.filter((m: any) => m.ativo).map((m: any) => (
              <View key={m.id} style={s.medicacaoCard}>
                <View style={s.medicacaoInfo}>
                  <Text style={s.medicacaoNome}>{m.nome} {m.dose}</Text>
                  <Text style={s.medicacaoDetalhe}>{m.via} · {m.frequencia}</Text>
                </View>
                {['enfermeiro', 'chefe_turno'].includes(utilizador.role) && (
                  <TouchableOpacity style={s.administrarBotao} onPress={() => registarMedicacao(m.id)}>
                    <Text style={s.administrarTexto}>Registar</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Aba Notas */}
        {abaAtiva === 'notas' && (
          <View style={s.secao}>
            <View style={s.notaInput}>
              <TextInput
                style={s.notaTextInput}
                value={nota}
                onChangeText={setNota}
                placeholder="Escrever nota de turno..."
                multiline
                numberOfLines={3}
              />
              <TouchableOpacity style={[s.notaBotao, !nota.trim() && s.notaBotaoDesativado]} onPress={gravarNota} disabled={gravandoNota || !nota.trim()}>
                <Text style={s.notaBotaoTexto}>Guardar</Text>
              </TouchableOpacity>
            </View>
            {doente.notasTurno?.length === 0 ? (
              <Text style={s.vazioTexto}>Sem notas registadas</Text>
            ) : doente.notasTurno?.map((n: any) => (
              <View key={n.id} style={s.notaCard}>
                <View style={s.notaCabecalho}>
                  <Text style={s.notaAutor}>{n.autor.nome}</Text>
                  <Text style={s.notaData}>{new Date(n.criadaEm).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</Text>
                </View>
                <Text style={s.notaTexto}>{n.texto}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { backgroundColor: '#1e293b', padding: 20, paddingTop: 16 },
  voltarBotao: { marginBottom: 10 },
  voltarTexto: { color: '#94a3b8', fontSize: 14 },
  headerInfo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  headerNome: { fontSize: 20, fontWeight: '700', color: '#fff', flex: 1, marginRight: 12 },
  estadoBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  estadoTexto: { fontSize: 12, fontWeight: '600' },
  headerSub: { fontSize: 13, color: '#64748b' },
  abas: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  aba: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  abaAtiva: { borderBottomWidth: 2, borderBottomColor: '#2563eb' },
  abaTexto: { fontSize: 13, color: '#94a3b8', fontWeight: '500' },
  abaTextoAtivo: { color: '#2563eb', fontWeight: '700' },
  conteudo: { flex: 1 },
  secao: { padding: 16 },
  infoCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8 },
  infoLabel: { fontSize: 12, color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  infoValor: { fontSize: 15, color: '#1e293b', fontWeight: '500' },
  tarefaCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center' },
  tarefaEsq: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  prioridadeDot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  tarefaDescricao: { flex: 1, fontSize: 14, color: '#334155' },
  concluirBotao: { backgroundColor: '#dcfce7', width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  concluirTexto: { color: '#16a34a', fontWeight: '700', fontSize: 16 },
  medicacaoCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center' },
  medicacaoInfo: { flex: 1 },
  medicacaoNome: { fontSize: 15, fontWeight: '600', color: '#1e293b' },
  medicacaoDetalhe: { fontSize: 13, color: '#64748b', marginTop: 2 },
  administrarBotao: { backgroundColor: '#dbeafe', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 },
  administrarTexto: { color: '#1d4ed8', fontWeight: '600', fontSize: 13 },
  notaInput: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12 },
  notaTextInput: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 10, fontSize: 14, color: '#334155', minHeight: 80, textAlignVertical: 'top', marginBottom: 10 },
  notaBotao: { backgroundColor: '#2563eb', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  notaBotaoDesativado: { backgroundColor: '#93c5fd' },
  notaBotaoTexto: { color: '#fff', fontWeight: '700', fontSize: 14 },
  notaCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8 },
  notaCabecalho: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  notaAutor: { fontSize: 13, fontWeight: '600', color: '#475569' },
  notaData: { fontSize: 12, color: '#94a3b8' },
  notaTexto: { fontSize: 14, color: '#334155', lineHeight: 20 },
  vazioTexto: { color: '#94a3b8', fontSize: 14, textAlign: 'center', padding: 20 },
});
