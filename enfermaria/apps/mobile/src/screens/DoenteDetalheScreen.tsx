import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, TextInput, Alert, ActivityIndicator, RefreshControl, Modal,
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
const prioridadeCor: Record<string, string> = {
  urgente: '#ef4444', alta: '#f97316', media: '#eab308', baixa: '#22c55e',
};
const grupoLabel: Record<string, string> = {
  medico: 'Médico', enfermeiro: 'Enfermeiro', auxiliar: 'Auxiliar',
};

export default function DoenteDetalheScreen({ doenteId, utilizador, onVoltar }: Props) {
  const [doente, setDoente] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [nota, setNota] = useState('');
  const [gravandoNota, setGravandoNota] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState<'info' | 'tarefas' | 'medicacao' | 'notas'>('info');
  const [emTurno, setEmTurno] = useState(false);
  const [alterandoEstado, setAlterandoEstado] = useState(false);
  const [salvando, setSalvando] = useState(false);

  // Tarefa modal
  const [modalTarefa, setModalTarefa] = useState(false);
  const [tarefaDesc, setTarefaDesc] = useState('');
  const [tarefaTipo, setTarefaTipo] = useState<'clinica' | 'logistica'>('clinica');
  const [tarefaPrioridade, setTarefaPrioridade] = useState('media');
  const [tarefaGrupo, setTarefaGrupo] = useState('');

  // Medicação modal
  const [modalMed, setModalMed] = useState(false);
  const [medNome, setMedNome] = useState('');
  const [medDose, setMedDose] = useState('');
  const [medVia, setMedVia] = useState('');
  const [medFreq, setMedFreq] = useState('');

  // Histórico tarefas
  const [modalHistorico, setModalHistorico] = useState(false);
  const [tarefasHistorico, setTarefasHistorico] = useState<any[]>([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);

  // Histórico medicação
  const [modalHistoricoMed, setModalHistoricoMed] = useState(false);
  const [medHistorico, setMedHistorico] = useState<any[]>([]);
  const [loadingHistoricoMed, setLoadingHistoricoMed] = useState(false);

  const role = utilizador.role;

  const meuGrupoChave = ['medico', 'chefe_medicos'].includes(role) ? 'medico'
    : role === 'auxiliar' ? 'auxiliar' : 'enfermeiro';

  const podePrescreveMed = ['medico', 'chefe_medicos'].includes(role);
  const podeRegistarMed = ['enfermeiro', 'chefe_enfermeiros', 'chefe_turno', 'auxiliar'].includes(role);
  const podeAlterarEstado = ['enfermeiro', 'medico', 'chefe_turno', 'chefe_enfermeiros', 'chefe_medicos'].includes(role);
  const podeCriarTarefa = emTurno && ['enfermeiro', 'medico', 'chefe_turno', 'chefe_enfermeiros', 'chefe_medicos'].includes(role);
  const podeCriarNota = emTurno && ['enfermeiro', 'medico', 'chefe_turno', 'chefe_enfermeiros', 'chefe_medicos', 'auxiliar'].includes(role);

  const gruposDisponiveis = (() => {
    if (['medico', 'chefe_medicos'].includes(role)) return ['medico', 'enfermeiro'];
    if (role === 'auxiliar') return ['auxiliar'];
    return ['enfermeiro', 'auxiliar'];
  })();

  const verificarTurnoAtivo = async () => {
    const agora = new Date();
    const min = agora.getHours() * 60 + agora.getMinutes();
    let tipo: string;
    const dataRef = new Date(agora);
    if (min >= 8 * 60 && min < 16 * 60) { tipo = 'manha'; }
    else if (min >= 16 * 60 && min < 23 * 60) { tipo = 'tarde'; }
    else if (min >= 23 * 60) { tipo = 'noite'; }
    else { tipo = 'noite'; dataRef.setDate(dataRef.getDate() - 1); }

    try {
      const r = await api.get(`/horarios/meu?mes=${dataRef.getMonth() + 1}&ano=${dataRef.getFullYear()}`);
      const diaRef = dataRef.toDateString();
      const temTurno = r.data.some((h: any) =>
        h.horarioTurno.tipo === tipo &&
        new Date(h.horarioTurno.data).toDateString() === diaRef,
      );
      setEmTurno(temTurno);
    } catch { setEmTurno(false); }
  };

  const carregar = async () => {
    try {
      const { data } = await api.get(`/doentes/${doenteId}`);
      setDoente(data);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => {
    carregar();
    verificarTurnoAtivo();
  }, [doenteId]));

  const gravarNota = async () => {
    if (!nota.trim()) return;
    setGravandoNota(true);
    try {
      await api.post(`/doentes/${doenteId}/nota`, { texto: nota });
      setNota('');
      await carregar();
      Alert.alert('Sucesso', 'Nota guardada');
    } catch {
      Alert.alert('Erro', 'Não foi possível guardar a nota. Certifica-te que estás em turno.');
    } finally {
      setGravandoNota(false);
    }
  };

  const concluirTarefa = async (tarefaId: string) => {
    try {
      await api.patch(`/tarefas/${tarefaId}/estado`, { estado: 'concluida' });
      await carregar();
    } catch {
      Alert.alert('Erro', 'Não foi possível concluir a tarefa');
    }
  };

  const concluirMedicacao = async (medId: string) => {
    try {
      await api.patch(`/medicacao/${medId}/descontinuar`);
      await carregar();
    } catch {
      Alert.alert('Erro', 'Não foi possível concluir a medicação');
    }
  };

  const registarMedicacao = async (medicacaoId: string) => {
    try {
      await api.post(`/medicacao/${medicacaoId}/administrar`, {});
      Alert.alert('Registado', 'Administração registada com sucesso');
    } catch {
      Alert.alert('Erro', 'Não foi possível registar');
    }
  };

  const alterarEstado = async (novoEstado: string) => {
    try {
      await api.patch(`/doentes/${doenteId}/estado`, { estado: novoEstado });
      setAlterandoEstado(false);
      await carregar();
    } catch {
      Alert.alert('Erro', 'Não foi possível alterar o estado');
    }
  };

  const abrirModalTarefa = () => {
    setTarefaDesc('');
    setTarefaTipo('clinica');
    setTarefaPrioridade('media');
    setTarefaGrupo(gruposDisponiveis[0] ?? '');
    setModalTarefa(true);
  };

  const submeterTarefa = async () => {
    if (!tarefaDesc.trim() || !tarefaGrupo) return;
    setSalvando(true);
    try {
      await api.post(`/doentes/${doenteId}/tarefa`, {
        descricao: tarefaDesc,
        tipo: tarefaTipo,
        prioridade: tarefaPrioridade,
        grupoResponsavel: tarefaGrupo,
      });
      setModalTarefa(false);
      await carregar();
    } catch (e: any) {
      Alert.alert('Erro', e.response?.data?.message ?? 'Erro ao criar tarefa');
    } finally {
      setSalvando(false);
    }
  };

  const abrirModalMed = () => {
    setMedNome(''); setMedDose(''); setMedVia(''); setMedFreq('');
    setModalMed(true);
  };

  const submeterMed = async () => {
    if (!medNome.trim() || !medDose.trim() || !medVia.trim() || !medFreq.trim()) return;
    setSalvando(true);
    try {
      await api.post('/medicacao/prescrever', {
        doenteId, nome: medNome, dose: medDose, via: medVia, frequencia: medFreq,
      });
      setModalMed(false);
      await carregar();
    } catch (e: any) {
      Alert.alert('Erro', e.response?.data?.message ?? 'Erro ao prescrever medicação');
    } finally {
      setSalvando(false);
    }
  };

  const abrirHistorico = async () => {
    setLoadingHistorico(true);
    setModalHistorico(true);
    try {
      const r = await api.get(`/tarefas/doente/${doenteId}`);
      setTarefasHistorico(r.data.filter((t: any) => t.estado === 'concluida'));
    } catch { setTarefasHistorico([]); }
    finally { setLoadingHistorico(false); }
  };

  const abrirHistoricoMed = async () => {
    setLoadingHistoricoMed(true);
    setModalHistoricoMed(true);
    try {
      const r = await api.get(`/medicacao/doente/${doenteId}`);
      setMedHistorico(r.data.filter((m: any) => !m.ativo));
    } catch { setMedHistorico([]); }
    finally { setLoadingHistoricoMed(false); }
  };

  if (loading) return <View style={s.centro}><ActivityIndicator size="large" color="#2563eb" /></View>;
  if (!doente) return null;

  const tarefas = (doente.tarefas ?? []).filter((t: any) => t.estado !== 'concluida' && t.estado !== 'cancelada');
  const medicacoesAtivas = (doente.medicacoes ?? []).filter((m: any) => m.ativo);

  const abas: { key: typeof abaAtiva; label: string }[] = [
    { key: 'info', label: 'Info' },
    { key: 'tarefas', label: `Tarefas (${tarefas.length})` },
    { key: 'medicacao', label: `Med. (${medicacoesAtivas.length})` },
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
          <TouchableOpacity
            style={[s.estadoBadge, { backgroundColor: estadoCor[doente.estado] + '30' }]}
            onPress={() => podeAlterarEstado && setAlterandoEstado(true)}
            disabled={!podeAlterarEstado}
          >
            <Text style={[s.estadoTexto, { color: estadoCor[doente.estado] }]}>
              {estadoLabel[doente.estado]}{podeAlterarEstado ? ' ▾' : ''}
            </Text>
          </TouchableOpacity>
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
            {doente.atribuicoesHorario?.length > 0 && (
              <View style={s.infoCard}>
                <Text style={s.infoLabel}>Profissionais Atribuídos</Text>
                {(() => {
                  const map = new Map<string, any>();
                  for (const a of doente.atribuicoesHorario) {
                    const uid = a.utilizador.id;
                    if (!map.has(uid) || new Date(a.horarioTurno.data) > new Date(map.get(uid).horarioTurno.data)) {
                      map.set(uid, a);
                    }
                  }
                  const todos = Array.from(map.values());
                  const turnoLabel = (tipo: string) => tipo === 'manha' ? 'Manhã' : tipo === 'tarde' ? 'Tarde' : 'Noite';
                  const dataLabel = (data: string) => new Date(data).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' });
                  const medicos = todos.filter((a: any) => ['medico', 'chefe_medicos'].includes(a.utilizador.role));
                  const enfermagem = todos.filter((a: any) => !['medico', 'chefe_medicos'].includes(a.utilizador.role));

                  const renderLinha = (a: any) => (
                    <View key={a.utilizador.id} style={s.atribLinha}>
                      <Text style={s.atribNome}>{a.utilizador.nome}</Text>
                      <Text style={s.atribMeta}>
                        {turnoLabel(a.horarioTurno.tipo)} · {dataLabel(a.horarioTurno.data)}
                      </Text>
                    </View>
                  );

                  return (
                    <>
                      {medicos.length > 0 && (
                        <View style={s.grupoAtrib}>
                          <View style={[s.grupoTag, { backgroundColor: '#eff6ff' }]}>
                            <Text style={[s.grupoTagTexto, { color: '#2563eb' }]}>Médicos</Text>
                          </View>
                          {medicos.map(renderLinha)}
                        </View>
                      )}
                      {enfermagem.length > 0 && (
                        <View style={[s.grupoAtrib, medicos.length > 0 && { marginTop: 10 }]}>
                          <View style={[s.grupoTag, { backgroundColor: '#f0fdf4' }]}>
                            <Text style={[s.grupoTagTexto, { color: '#16a34a' }]}>Enfermagem</Text>
                          </View>
                          {enfermagem.map(renderLinha)}
                        </View>
                      )}
                    </>
                  );
                })()}
              </View>
            )}
          </View>
        )}

        {/* Aba Tarefas — todos vêem, só o responsável pode concluir */}
        {abaAtiva === 'tarefas' && (
          <View style={s.secao}>
            <View style={s.secaoHeader}>
              <Text style={s.secaoTitulo}>Tarefas Pendentes</Text>
              <View style={s.secaoAcoes}>
                <TouchableOpacity onPress={abrirHistorico} style={s.iconBotao}>
                  <Text style={s.iconBotaoTexto}>⏱</Text>
                </TouchableOpacity>
                {podeCriarTarefa && (
                  <TouchableOpacity onPress={abrirModalTarefa} style={[s.iconBotao, s.iconBotaoAzul]}>
                    <Text style={s.iconBotaoTextoAzul}>+</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
            {tarefas.length === 0 ? (
              <Text style={s.vazioTexto}>Sem tarefas pendentes</Text>
            ) : tarefas.map((t: any) => {
              const podeConcluir = emTurno && (
                t.responsavel?.id === utilizador.id ||
                (t.grupoResponsavel === meuGrupoChave && !t.responsavel)
              );
              return (
                <View key={t.id} style={s.tarefaCard}>
                  <View style={[s.prioridadeDot, { backgroundColor: prioridadeCor[t.prioridade] ?? '#94a3b8' }]} />
                  <View style={s.tarefaConteudo}>
                    <Text style={s.tarefaDescricao}>{t.descricao}</Text>
                    <Text style={s.tarefaMeta}>
                      {t.responsavel
                        ? `A cargo: ${t.responsavel.nome}`
                        : t.grupoResponsavel
                          ? `Para: ${grupoLabel[t.grupoResponsavel] ?? t.grupoResponsavel}`
                          : ''}
                      {t.criadoPor ? `  · Por ${t.criadoPor.nome}` : ''}
                    </Text>
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

        {/* Aba Medicação */}
        {abaAtiva === 'medicacao' && (
          <View style={s.secao}>
            <View style={s.secaoHeader}>
              <Text style={s.secaoTitulo}>Medicação Ativa</Text>
              <View style={s.secaoAcoes}>
                <TouchableOpacity onPress={abrirHistoricoMed} style={s.iconBotao}>
                  <Text style={s.iconBotaoTexto}>⏱</Text>
                </TouchableOpacity>
                {podePrescreveMed && (
                  <TouchableOpacity onPress={abrirModalMed} style={[s.iconBotao, s.iconBotaoAzul]}>
                    <Text style={s.iconBotaoTextoAzul}>+</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
            {medicacoesAtivas.length === 0 ? (
              <Text style={s.vazioTexto}>Sem medicação ativa</Text>
            ) : medicacoesAtivas.map((m: any) => (
              <View key={m.id} style={s.medicacaoCard}>
                <View style={s.medicacaoInfo}>
                  <Text style={s.medicacaoNome}>{m.nome} {m.dose}</Text>
                  <Text style={s.medicacaoDetalhe}>{m.via} · {m.frequencia}</Text>
                  {m.prescritoPor && (
                    <Text style={s.medicacaoDetalhe}>Prescrito por {m.prescritoPor.nome}</Text>
                  )}
                </View>
                <View style={s.medicacaoBotoes}>
                  {podeRegistarMed && (
                    <TouchableOpacity style={s.administrarBotao} onPress={() => registarMedicacao(m.id)}>
                      <Text style={s.administrarTexto}>Registar</Text>
                    </TouchableOpacity>
                  )}
                  {podePrescreveMed && (
                    <TouchableOpacity style={s.descontinuarBotao} onPress={() => {
                      Alert.alert('Confirmar', 'Concluir esta medicação?', [
                        { text: 'Cancelar', style: 'cancel' },
                        { text: 'Concluir', style: 'destructive', onPress: () => concluirMedicacao(m.id) },
                      ]);
                    }}>
                      <Text style={s.descontinuarTexto}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Aba Notas */}
        {abaAtiva === 'notas' && (
          <View style={s.secao}>
            {podeCriarNota && (
              <View style={s.notaInput}>
                <TextInput
                  style={s.notaTextInput}
                  value={nota}
                  onChangeText={setNota}
                  placeholder="Escrever nota de turno..."
                  multiline
                  numberOfLines={3}
                />
                <TouchableOpacity
                  style={[s.notaBotao, !nota.trim() && s.notaBotaoDesativado]}
                  onPress={gravarNota}
                  disabled={gravandoNota || !nota.trim()}
                >
                  <Text style={s.notaBotaoTexto}>Guardar</Text>
                </TouchableOpacity>
              </View>
            )}
            {(doente.notasTurno ?? []).length === 0 ? (
              <Text style={s.vazioTexto}>Sem notas registadas</Text>
            ) : doente.notasTurno.map((n: any) => (
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

      {/* Modal: Alterar Estado */}
      <Modal visible={alterandoEstado} transparent animationType="fade" onRequestClose={() => setAlterandoEstado(false)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setAlterandoEstado(false)}>
          <View onStartShouldSetResponder={() => true} style={s.estadoSheet}>
            <Text style={s.sheetTitulo}>Alterar Estado</Text>
            {Object.entries(estadoLabel)
              .filter(([k]) => k !== doente.estado)
              .map(([k, label]) => (
                <TouchableOpacity key={k} style={s.estadoOpcao} onPress={() => alterarEstado(k)}>
                  <View style={[s.estadoDot, { backgroundColor: estadoCor[k] }]} />
                  <Text style={s.estadoOpcaoTexto}>{label}</Text>
                </TouchableOpacity>
              ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Modal: Criar Tarefa */}
      <Modal visible={modalTarefa} transparent animationType="slide" onRequestClose={() => setModalTarefa(false)}>
        <View style={s.overlay}>
          <View style={s.modalSheet}>
            <View style={s.sheetCabecalho}>
              <Text style={s.sheetTitulo}>Nova Tarefa</Text>
              <TouchableOpacity onPress={() => setModalTarefa(false)}>
                <Text style={s.fecharTexto}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={s.formLabel}>Descrição *</Text>
            <TextInput
              style={[s.formInput, { minHeight: 60, textAlignVertical: 'top' }]}
              value={tarefaDesc}
              onChangeText={setTarefaDesc}
              placeholder="Descrever a tarefa..."
              multiline
            />

            <Text style={s.formLabel}>Tipo</Text>
            <View style={s.seletorRow}>
              {(['clinica', 'logistica'] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[s.seletorOpcao, tarefaTipo === t && s.seletorAtivo]}
                  onPress={() => setTarefaTipo(t)}
                >
                  <Text style={[s.seletorTexto, tarefaTipo === t && s.seletorTextoAtivo]}>
                    {t === 'clinica' ? 'Clínica' : 'Logística'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.formLabel}>Prioridade</Text>
            <View style={s.seletorRow}>
              {(['baixa', 'media', 'alta', 'urgente'] as const).map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[s.seletorOpcao, tarefaPrioridade === p && s.seletorAtivo]}
                  onPress={() => setTarefaPrioridade(p)}
                >
                  <Text style={[s.seletorTexto, tarefaPrioridade === p && s.seletorTextoAtivo]}>
                    {p === 'baixa' ? 'Baixa' : p === 'media' ? 'Média' : p === 'alta' ? 'Alta' : 'Urgente'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.formLabel}>Para</Text>
            <View style={s.seletorRow}>
              {gruposDisponiveis.map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[s.seletorOpcao, tarefaGrupo === g && s.seletorAtivo]}
                  onPress={() => setTarefaGrupo(g)}
                >
                  <Text style={[s.seletorTexto, tarefaGrupo === g && s.seletorTextoAtivo]}>
                    {grupoLabel[g] ?? g}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={s.modalBotoes}>
              <TouchableOpacity style={s.cancelarBotao} onPress={() => setModalTarefa(false)}>
                <Text style={s.cancelarTexto}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.submeterBotao, (!tarefaDesc.trim() || !tarefaGrupo || salvando) && s.submeterDesativado]}
                onPress={submeterTarefa}
                disabled={!tarefaDesc.trim() || !tarefaGrupo || salvando}
              >
                <Text style={s.submeterTexto}>{salvando ? 'A guardar...' : 'Criar Tarefa'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal: Prescrever Medicação */}
      <Modal visible={modalMed} transparent animationType="slide" onRequestClose={() => setModalMed(false)}>
        <View style={s.overlay}>
          <View style={s.modalSheet}>
            <View style={s.sheetCabecalho}>
              <Text style={s.sheetTitulo}>Prescrever Medicação</Text>
              <TouchableOpacity onPress={() => setModalMed(false)}>
                <Text style={s.fecharTexto}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={s.formLabel}>Medicamento *</Text>
            <TextInput style={s.formInput} value={medNome} onChangeText={setMedNome} placeholder="Nome do medicamento" />

            <Text style={s.formLabel}>Dose *</Text>
            <TextInput style={s.formInput} value={medDose} onChangeText={setMedDose} placeholder="Ex: 500mg" />

            <Text style={s.formLabel}>Via *</Text>
            <TextInput style={s.formInput} value={medVia} onChangeText={setMedVia} placeholder="Ex: Oral, IV, IM" />

            <Text style={s.formLabel}>Frequência *</Text>
            <TextInput style={s.formInput} value={medFreq} onChangeText={setMedFreq} placeholder="Ex: 8 em 8 horas" />

            <View style={s.modalBotoes}>
              <TouchableOpacity style={s.cancelarBotao} onPress={() => setModalMed(false)}>
                <Text style={s.cancelarTexto}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.submeterBotao, (!medNome.trim() || !medDose.trim() || !medVia.trim() || !medFreq.trim() || salvando) && s.submeterDesativado]}
                onPress={submeterMed}
                disabled={!medNome.trim() || !medDose.trim() || !medVia.trim() || !medFreq.trim() || salvando}
              >
                <Text style={s.submeterTexto}>{salvando ? 'A guardar...' : 'Prescrever'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal: Histórico Tarefas */}
      <Modal visible={modalHistorico} transparent animationType="slide" onRequestClose={() => setModalHistorico(false)}>
        <View style={s.overlay}>
          <View style={[s.modalSheet, s.modalSheetTall]}>
            <View style={s.sheetCabecalho}>
              <Text style={s.sheetTitulo}>Tarefas Concluídas</Text>
              <TouchableOpacity onPress={() => setModalHistorico(false)}>
                <Text style={s.fecharTexto}>✕</Text>
              </TouchableOpacity>
            </View>
            {loadingHistorico ? (
              <ActivityIndicator color="#2563eb" style={{ padding: 20 }} />
            ) : tarefasHistorico.length === 0 ? (
              <Text style={s.vazioTexto}>Sem tarefas concluídas</Text>
            ) : (
              <ScrollView>
                {tarefasHistorico.map((t) => (
                  <View key={t.id} style={s.historicoItem}>
                    <Text style={s.historicoDescricao}>{t.descricao}</Text>
                    <Text style={s.historicoMeta}>
                      {t.responsavel ? t.responsavel.nome : grupoLabel[t.grupoResponsavel] ?? ''}
                      {t.concluidaEm
                        ? `  · ${new Date(t.concluidaEm).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`
                        : ''}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal: Histórico Medicação */}
      <Modal visible={modalHistoricoMed} transparent animationType="slide" onRequestClose={() => setModalHistoricoMed(false)}>
        <View style={s.overlay}>
          <View style={[s.modalSheet, s.modalSheetTall]}>
            <View style={s.sheetCabecalho}>
              <Text style={s.sheetTitulo}>Medicação Terminada</Text>
              <TouchableOpacity onPress={() => setModalHistoricoMed(false)}>
                <Text style={s.fecharTexto}>✕</Text>
              </TouchableOpacity>
            </View>
            {loadingHistoricoMed ? (
              <ActivityIndicator color="#2563eb" style={{ padding: 20 }} />
            ) : medHistorico.length === 0 ? (
              <Text style={s.vazioTexto}>Sem medicação terminada</Text>
            ) : (
              <ScrollView>
                {medHistorico.map((m) => (
                  <View key={m.id} style={s.historicoItem}>
                    <Text style={s.historicoDescricao}>{m.nome} {m.dose}</Text>
                    <Text style={s.historicoMeta}>
                      {m.via} · {m.frequencia}
                      {m.terminadoEm
                        ? `  · Terminado ${new Date(m.terminadoEm).toLocaleDateString('pt-PT')}`
                        : ''}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
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
  abaTexto: { fontSize: 12, color: '#94a3b8', fontWeight: '500' },
  abaTextoAtivo: { color: '#2563eb', fontWeight: '700' },
  conteudo: { flex: 1 },
  secao: { padding: 16 },
  secaoHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  secaoTitulo: { fontSize: 13, fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5 },
  secaoAcoes: { flexDirection: 'row', gap: 6 },
  iconBotao: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' },
  iconBotaoAzul: { backgroundColor: '#2563eb' },
  iconBotaoTexto: { fontSize: 15 },
  iconBotaoTextoAzul: { color: '#fff', fontWeight: '700', fontSize: 20, lineHeight: 24 },
  infoCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8 },
  infoLabel: { fontSize: 12, color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  infoValor: { fontSize: 15, color: '#1e293b', fontWeight: '500', marginTop: 2 },
  grupoAtrib: { gap: 2 },
  grupoTag: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginBottom: 4 },
  grupoTagTexto: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  atribLinha: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3 },
  atribNome: { fontSize: 14, fontWeight: '600', color: '#1e293b', flex: 1 },
  atribMeta: { fontSize: 12, color: '#64748b', fontWeight: '500' },
  // Tarefas
  tarefaCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  prioridadeDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  tarefaConteudo: { flex: 1 },
  tarefaDescricao: { fontSize: 14, color: '#334155', fontWeight: '500' },
  tarefaMeta: { fontSize: 12, color: '#94a3b8', marginTop: 3 },
  concluirBotao: { backgroundColor: '#dcfce7', width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  concluirTexto: { color: '#16a34a', fontWeight: '700', fontSize: 16 },
  // Medicação
  medicacaoCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center' },
  medicacaoInfo: { flex: 1 },
  medicacaoNome: { fontSize: 15, fontWeight: '600', color: '#1e293b' },
  medicacaoDetalhe: { fontSize: 13, color: '#64748b', marginTop: 2 },
  medicacaoBotoes: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  administrarBotao: { backgroundColor: '#dbeafe', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 },
  administrarTexto: { color: '#1d4ed8', fontWeight: '600', fontSize: 13 },
  descontinuarBotao: { backgroundColor: '#fee2e2', width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  descontinuarTexto: { color: '#dc2626', fontWeight: '700', fontSize: 14 },
  // Notas
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
  // Modals
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  estadoSheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalSheetTall: { maxHeight: '80%' },
  sheetTitulo: { fontSize: 18, fontWeight: '700', color: '#1e293b', marginBottom: 4 },
  sheetCabecalho: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  fecharTexto: { fontSize: 18, color: '#94a3b8', fontWeight: '700' },
  estadoDot: { width: 10, height: 10, borderRadius: 5 },
  estadoOpcao: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  estadoOpcaoTexto: { fontSize: 16, color: '#1e293b', fontWeight: '500' },
  // Form
  formLabel: { fontSize: 13, fontWeight: '600', color: '#475569', marginTop: 12, marginBottom: 6 },
  formInput: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 10, fontSize: 14, color: '#334155', backgroundColor: '#f8fafc' },
  seletorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  seletorOpcao: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: '#e2e8f0' },
  seletorAtivo: { backgroundColor: '#2563eb' },
  seletorTexto: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  seletorTextoAtivo: { color: '#fff' },
  modalBotoes: { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancelarBotao: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#e2e8f0', alignItems: 'center' },
  cancelarTexto: { fontWeight: '600', color: '#64748b', fontSize: 14 },
  submeterBotao: { flex: 2, paddingVertical: 12, borderRadius: 10, backgroundColor: '#2563eb', alignItems: 'center' },
  submeterDesativado: { backgroundColor: '#93c5fd' },
  submeterTexto: { fontWeight: '700', color: '#fff', fontSize: 14 },
  // Histórico
  historicoItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  historicoDescricao: { fontSize: 14, color: '#334155', fontWeight: '500' },
  historicoMeta: { fontSize: 12, color: '#94a3b8', marginTop: 3 },
});
