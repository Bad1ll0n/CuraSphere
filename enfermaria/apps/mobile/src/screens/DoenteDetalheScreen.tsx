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
  const [abaAtiva, setAbaAtiva] = useState<'info' | 'tarefas' | 'medicacao' | 'notas' | 'vitais' | 'escalas'>('info');
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

  // Alergias
  const [alergias, setAlergias] = useState<any[]>([]);
  const [modalAlergia, setModalAlergia] = useState(false);
  const [alergenio, setAlergenio] = useState('');
  const [alergiaTipo, setAlergiaTipo] = useState('medicamento');
  const [alergiaSev, setAlergiaSev] = useState('moderada');
  const [alergiaNotas, setAlergiaNotas] = useState('');
  const [salvandoAlergia, setSalvandoAlergia] = useState(false);

  // Contactos de emergência
  const [contactos, setContactos] = useState<any[]>([]);
  const [modalContacto, setModalContacto] = useState(false);
  const [contactoNome, setContactoNome] = useState('');
  const [contactoRelacao, setContactoRelacao] = useState('');
  const [contactoTel, setContactoTel] = useState('');
  const [contactoPrincipal, setContactoPrincipal] = useState(false);
  const [salvandoContacto, setSalvandoContacto] = useState(false);

  // Alertas clínicos
  const [alertas, setAlertas] = useState<any[]>([]);

  // Escalas de risco
  const [escalas, setEscalas] = useState<{ braden: any; morse: any }>({ braden: null, morse: null });
  const [modalEscala, setModalEscala] = useState<'braden' | 'morse' | null>(null);
  const [escalaItens, setEscalaItens] = useState<Record<string, number>>({});
  const [salvandoEscala, setSalvandoEscala] = useState(false);

  // Editar dados do doente
  const [modalEditarDoente, setModalEditarDoente] = useState(false);
  const [editDiagnostico, setEditDiagnostico] = useState('');
  const [editAltaPrevista, setEditAltaPrevista] = useState('');
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);

  // Alta estruturada
  const [modalAltaEstruturada, setModalAltaEstruturada] = useState(false);
  const [altaMotivo, setAltaMotivo] = useState('melhoria');
  const [altaDestino, setAltaDestino] = useState('domicilio');
  const [altaResumo, setAltaResumo] = useState('');
  const [altaPrescricao, setAltaPrescricao] = useState('');
  const [altaMedFamilia, setAltaMedFamilia] = useState('');
  const [salvandoAlta, setSalvandoAlta] = useState(false);

  // Sinais vitais
  const [sinaisVitais, setSinaisVitais] = useState<any[]>([]);
  const [loadingVitais, setLoadingVitais] = useState(false);
  const [modalVitais, setModalVitais] = useState(false);
  const [salvandoVitais, setSalvandoVitais] = useState(false);
  const [vPressaoS, setVPressaoS] = useState('');
  const [vPressaoD, setVPressaoD] = useState('');
  const [vPulso, setVPulso] = useState('');
  const [vTemp, setVTemp] = useState('');
  const [vSpO2, setVSpO2] = useState('');
  const [vFreqResp, setVFreqResp] = useState('');
  const [vPeso, setVPeso] = useState('');
  const [vNotas, setVNotas] = useState('');

  const role = utilizador.role;

  const meuGrupoChave = role === 'medico' ? 'medico'
    : role === 'auxiliar' ? 'auxiliar' : 'enfermeiro';

  const podePrescreveMed = role === 'medico';
  const podeRegistarMed = ['enfermeiro', 'auxiliar'].includes(role);
  const podeAlterarEstado = ['enfermeiro', 'medico'].includes(role);
  const podeCriarTarefa = emTurno && ['enfermeiro', 'medico'].includes(role);
  const podeCriarNota = emTurno && ['enfermeiro', 'medico', 'auxiliar'].includes(role);
  const podeRegistarVitais = ['enfermeiro', 'auxiliar', 'medico'].includes(role);
  const podeDarAlta = role === 'medico';
  const podeEditarDoente = ['medico', 'enfermeiro', 'administrativo'].includes(role);

  const gruposDisponiveis = (() => {
    if (role === 'medico') return ['medico', 'enfermeiro'];
    if (role === 'auxiliar') return ['auxiliar'];
    return ['enfermeiro', 'auxiliar'];
  })();

  const carregarAlergias = async () => {
    try { const r = await api.get(`/alergias/${doenteId}`); setAlergias(r.data); } catch { setAlergias([]); }
  };

  const carregarContactos = async () => {
    try { const r = await api.get(`/contactos/${doenteId}`); setContactos(r.data); } catch { setContactos([]); }
  };

  const carregarAlertas = async () => {
    try { const r = await api.get(`/alertas/${doenteId}`); setAlertas(r.data); } catch { setAlertas([]); }
  };

  const carregarEscalas = async () => {
    try { const r = await api.get(`/escalas/${doenteId}`); setEscalas(r.data); } catch { }
  };

  const abrirEditarDoente = () => {
    setEditDiagnostico(doente?.diagnosticoPrincipal ?? '');
    setEditAltaPrevista(doente?.dataAltaPrevista ? doente.dataAltaPrevista.split('T')[0] : '');
    setModalEditarDoente(true);
  };

  const submeterEdicaoDoente = async () => {
    setSalvandoEdicao(true);
    try {
      await api.patch(`/doentes/${doenteId}`, {
        diagnosticoPrincipal: editDiagnostico || undefined,
        dataAltaPrevista: editAltaPrevista ? new Date(editAltaPrevista) : null,
      });
      setModalEditarDoente(false);
      await carregar();
    } catch (e: any) {
      Alert.alert('Erro', e.response?.data?.message ?? 'Erro ao editar doente');
    } finally { setSalvandoEdicao(false); }
  };

  const submeterEscala = async () => {
    if (!modalEscala) return;
    setSalvandoEscala(true);
    try {
      await api.post(`/escalas/${doenteId}`, { tipo: modalEscala, itens: escalaItens });
      setModalEscala(null); setEscalaItens({});
      await carregarEscalas();
    } catch (e: any) {
      Alert.alert('Erro', e.response?.data?.message ?? 'Erro ao registar escala');
    } finally { setSalvandoEscala(false); }
  };

  const submeterAltaEstruturada = async () => {
    if (!altaResumo.trim()) { Alert.alert('Atenção', 'O resumo clínico é obrigatório'); return; }
    setSalvandoAlta(true);
    try {
      await api.post(`/doentes/${doenteId}/alta-estruturada`, {
        motivoAlta: altaMotivo,
        destino: altaMotivo !== 'obito' ? altaDestino : undefined,
        resumoClinical: altaResumo,
        prescricaoSaida: altaPrescricao || undefined,
        medicoFamilia: altaMedFamilia || undefined,
      });
      setModalAltaEstruturada(false);
      onVoltar();
    } catch (e: any) {
      Alert.alert('Erro', e.response?.data?.message ?? 'Erro ao dar alta');
    } finally { setSalvandoAlta(false); }
  };

  const submeterAlergia = async () => {
    if (!alergenio.trim()) return;
    setSalvandoAlergia(true);
    try {
      await api.post(`/alergias/${doenteId}`, { alergenio, tipo: alergiaTipo, severidade: alergiaSev, notas: alergiaNotas || undefined });
      setModalAlergia(false);
      await carregarAlergias();
    } catch (e: any) {
      Alert.alert('Erro', e.response?.data?.message ?? 'Erro ao registar alergia');
    } finally { setSalvandoAlergia(false); }
  };

  const removerAlergia = async (id: string) => {
    try { await api.delete(`/alergias/${id}`); await carregarAlergias(); }
    catch { Alert.alert('Erro', 'Não foi possível remover a alergia'); }
  };

  const submeterContacto = async () => {
    if (!contactoNome.trim() || !contactoTel.trim()) return;
    setSalvandoContacto(true);
    try {
      await api.post(`/contactos/${doenteId}`, { nome: contactoNome, relacao: contactoRelacao || 'outro', telefone: contactoTel, principal: contactoPrincipal });
      setModalContacto(false);
      await carregarContactos();
    } catch (e: any) {
      Alert.alert('Erro', e.response?.data?.message ?? 'Erro ao guardar contacto');
    } finally { setSalvandoContacto(false); }
  };

  const removerContacto = async (id: string) => {
    try { await api.delete(`/contactos/${id}`); await carregarContactos(); }
    catch { Alert.alert('Erro', 'Não foi possível remover o contacto'); }
  };

  const carregarVitais = async () => {
    setLoadingVitais(true);
    try {
      const r = await api.get(`/sinais-vitais/${doenteId}`);
      setSinaisVitais(r.data);
    } catch { setSinaisVitais([]); }
    finally { setLoadingVitais(false); }
  };

  const abrirModalVitais = () => {
    setVPressaoS(''); setVPressaoD(''); setVPulso(''); setVTemp('');
    setVSpO2(''); setVFreqResp(''); setVPeso(''); setVNotas('');
    setModalVitais(true);
  };

  const submeterVitais = async () => {
    setSalvandoVitais(true);
    try {
      await api.post(`/sinais-vitais/${doenteId}`, {
        pressaoSistolica:       vPressaoS  ? parseInt(vPressaoS)   : undefined,
        pressaoDiastolica:      vPressaoD  ? parseInt(vPressaoD)   : undefined,
        pulso:                  vPulso     ? parseInt(vPulso)      : undefined,
        temperatura:            vTemp      ? parseFloat(vTemp)     : undefined,
        saturacaoO2:            vSpO2      ? parseInt(vSpO2)       : undefined,
        frequenciaRespiratoria: vFreqResp  ? parseInt(vFreqResp)   : undefined,
        peso:                   vPeso      ? parseFloat(vPeso)     : undefined,
        notas:                  vNotas || undefined,
      });
      setModalVitais(false);
      await carregarVitais();
    } catch (e: any) {
      Alert.alert('Erro', e.response?.data?.message ?? 'Erro ao registar sinais vitais');
    } finally {
      setSalvandoVitais(false);
    }
  };

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
    carregarVitais();
    carregarAlergias();
    carregarContactos();
    carregarAlertas();
    carregarEscalas();
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
    { key: 'vitais', label: 'Vitais' },
    { key: 'escalas', label: 'Escalas' },
  ];

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onVoltar} style={s.voltarBotao}>
          <Text style={s.voltarTexto}>‹  Voltar</Text>
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

      {/* Banner de Alergias */}
      {alergias.length > 0 && (
        <View style={s.bannerAlergia}>
          <Text style={s.bannerAlergiaTexto}>
            ⚠ ALERGIA: {alergias.map((a: any) => `${a.alergenio} (${a.severidade})`).join(', ')}
          </Text>
        </View>
      )}

      {/* Banner de Alertas Clínicos */}
      {alertas.length > 0 && (
        <TouchableOpacity
          style={s.bannerAlerta}
          onPress={async () => { await api.patch(`/alertas/${doenteId}/ler-todos`); setAlertas([]); }}
        >
          <Text style={s.bannerAlertaTexto}>🚨 {alertas[0].mensagem}{alertas.length > 1 ? ` (+${alertas.length - 1})` : ''} — Toque para dispensar</Text>
        </TouchableOpacity>
      )}

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
            {podeEditarDoente && (
              <View style={s.secaoHeader}>
                <Text style={s.secaoTitulo}>Dados Clínicos</Text>
                <TouchableOpacity style={[s.iconBotao, s.iconBotaoAzul]} onPress={abrirEditarDoente}>
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>✎</Text>
                </TouchableOpacity>
              </View>
            )}
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
                  const medicos = todos.filter((a: any) => a.utilizador.role === 'medico');
                  const enfermagem = todos.filter((a: any) => a.utilizador.role !== 'medico');

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

          {/* Alergias */}
          <View style={s.infoCard}>
            <View style={s.secaoHeader}>
              <Text style={s.infoLabel}>ALERGIAS</Text>
              {podeRegistarVitais && (
                <TouchableOpacity onPress={() => { setAlergenio(''); setAlergiaTipo('medicamento'); setAlergiaSev('moderada'); setAlergiaNotas(''); setModalAlergia(true); }} style={[s.iconBotao, s.iconBotaoAzul]}>
                  <Text style={s.iconBotaoTextoAzul}>+</Text>
                </TouchableOpacity>
              )}
            </View>
            {alergias.length === 0 ? (
              <Text style={s.vazioTexto}>Sem alergias registadas</Text>
            ) : alergias.map((a: any) => {
              const cor = a.severidade === 'anafilaxia' ? '#ef4444' : a.severidade === 'grave' ? '#f97316' : a.severidade === 'moderada' ? '#f59e0b' : '#64748b';
              return (
                <View key={a.id} style={s.alergiaRow}>
                  <View style={[s.alergiaBadge, { backgroundColor: cor + '20' }]}>
                    <Text style={[s.alergiaBadgeTexto, { color: cor }]}>{a.severidade}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.alergiaNome}>{a.alergenio}</Text>
                    <Text style={s.alergiaTipo}>{a.tipo}</Text>
                  </View>
                  {podeRegistarVitais && (
                    <TouchableOpacity onPress={() => Alert.alert('Remover', `Remover alergia "${a.alergenio}"?`, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Remover', style: 'destructive', onPress: () => removerAlergia(a.id) }])}>
                      <Text style={{ color: '#ef4444', fontSize: 16, paddingHorizontal: 4 }}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>

          {/* Contactos de Emergência */}
          <View style={s.infoCard}>
            <View style={s.secaoHeader}>
              <Text style={s.infoLabel}>CONTACTOS DE EMERGÊNCIA</Text>
              <TouchableOpacity onPress={() => { setContactoNome(''); setContactoRelacao(''); setContactoTel(''); setContactoPrincipal(false); setModalContacto(true); }} style={[s.iconBotao, s.iconBotaoAzul]}>
                <Text style={s.iconBotaoTextoAzul}>+</Text>
              </TouchableOpacity>
            </View>
            {contactos.length === 0 ? (
              <Text style={s.vazioTexto}>Sem contactos registados</Text>
            ) : contactos.map((c: any) => (
              <View key={c.id} style={s.contactoRow}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={s.contactoNome}>{c.nome}</Text>
                    {c.principal && <View style={s.contactoPrincipalBadge}><Text style={s.contactoPrincipalTexto}>Principal</Text></View>}
                  </View>
                  <Text style={s.contactoMeta}>{c.relacao} · {c.telefone}</Text>
                </View>
                <TouchableOpacity onPress={() => Alert.alert('Remover', `Remover contacto "${c.nome}"?`, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Remover', style: 'destructive', onPress: () => removerContacto(c.id) }])}>
                  <Text style={{ color: '#ef4444', fontSize: 16, paddingHorizontal: 4 }}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>

          {/* Botão Dar Alta */}
          {podeDarAlta && !doente.dataAlta && (
            <TouchableOpacity
              style={{ backgroundColor: '#dc2626', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8, marginHorizontal: 16, marginBottom: 16 }}
              onPress={() => { setAltaMotivo('melhoria'); setAltaDestino('domicilio'); setAltaResumo(''); setAltaPrescricao(''); setAltaMedFamilia(''); setModalAltaEstruturada(true); }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Dar Alta ao Doente</Text>
            </TouchableOpacity>
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

        {/* Aba Vitais */}
        {abaAtiva === 'vitais' && (
          <View style={s.secao}>
            <View style={s.secaoHeader}>
              <Text style={s.secaoTitulo}>Sinais Vitais</Text>
              {podeRegistarVitais && (
                <TouchableOpacity onPress={abrirModalVitais} style={[s.iconBotao, s.iconBotaoAzul]}>
                  <Text style={s.iconBotaoTextoAzul}>+</Text>
                </TouchableOpacity>
              )}
            </View>

            {loadingVitais ? (
              <ActivityIndicator color="#2563eb" style={{ padding: 20 }} />
            ) : sinaisVitais.length === 0 ? (
              <Text style={s.vazioTexto}>Sem registos de sinais vitais</Text>
            ) : sinaisVitais.map((sv: any, i: number) => {
              const taCor = (() => {
                const s = sv.pressaoSistolica;
                if (!s) return '#94a3b8';
                if (s >= 160 || s < 80) return '#ef4444';
                if (s >= 140 || s < 90) return '#f59e0b';
                return '#22c55e';
              })();
              const pulsoCor = (() => {
                const p = sv.pulso;
                if (!p) return '#94a3b8';
                if (p > 120 || p < 50) return '#ef4444';
                if (p > 100 || p < 60) return '#f59e0b';
                return '#22c55e';
              })();
              const tempCor = (() => {
                const t = sv.temperatura;
                if (!t) return '#94a3b8';
                if (t > 38.5 || t < 35) return '#ef4444';
                if (t > 37.5) return '#f59e0b';
                return '#22c55e';
              })();
              const spO2Cor = (() => {
                const o = sv.saturacaoO2;
                if (!o) return '#94a3b8';
                if (o < 90) return '#ef4444';
                if (o < 95) return '#f59e0b';
                return '#22c55e';
              })();

              return (
                <View key={sv.id} style={s.vitaisCard}>
                  <View style={s.vitaisCardHeader}>
                    <Text style={s.vitaisData}>
                      {new Date(sv.data).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    <Text style={s.vitaisAutor}>{sv.registadoPor?.nome}</Text>
                  </View>
                  <View style={s.vitaisGrid}>
                    {sv.pressaoSistolica != null && (
                      <View style={[s.vitaisItem, { borderLeftColor: taCor }]}>
                        <Text style={s.vitaisLabel}>TA</Text>
                        <Text style={[s.vitaisValor, { color: taCor }]}>{sv.pressaoSistolica}/{sv.pressaoDiastolica}</Text>
                        <Text style={s.vitaisUnidade}>mmHg</Text>
                      </View>
                    )}
                    {sv.pulso != null && (
                      <View style={[s.vitaisItem, { borderLeftColor: pulsoCor }]}>
                        <Text style={s.vitaisLabel}>Pulso</Text>
                        <Text style={[s.vitaisValor, { color: pulsoCor }]}>{sv.pulso}</Text>
                        <Text style={s.vitaisUnidade}>bpm</Text>
                      </View>
                    )}
                    {sv.temperatura != null && (
                      <View style={[s.vitaisItem, { borderLeftColor: tempCor }]}>
                        <Text style={s.vitaisLabel}>Temp.</Text>
                        <Text style={[s.vitaisValor, { color: tempCor }]}>{sv.temperatura.toFixed(1)}</Text>
                        <Text style={s.vitaisUnidade}>ºC</Text>
                      </View>
                    )}
                    {sv.saturacaoO2 != null && (
                      <View style={[s.vitaisItem, { borderLeftColor: spO2Cor }]}>
                        <Text style={s.vitaisLabel}>SpO₂</Text>
                        <Text style={[s.vitaisValor, { color: spO2Cor }]}>{sv.saturacaoO2}%</Text>
                        <Text style={s.vitaisUnidade}>O₂</Text>
                      </View>
                    )}
                    {sv.frequenciaRespiratoria != null && (
                      <View style={[s.vitaisItem, { borderLeftColor: '#64748b' }]}>
                        <Text style={s.vitaisLabel}>FR</Text>
                        <Text style={[s.vitaisValor, { color: '#64748b' }]}>{sv.frequenciaRespiratoria}</Text>
                        <Text style={s.vitaisUnidade}>rpm</Text>
                      </View>
                    )}
                    {sv.peso != null && (
                      <View style={[s.vitaisItem, { borderLeftColor: '#64748b' }]}>
                        <Text style={s.vitaisLabel}>Peso</Text>
                        <Text style={[s.vitaisValor, { color: '#64748b' }]}>{sv.peso}</Text>
                        <Text style={s.vitaisUnidade}>kg</Text>
                      </View>
                    )}
                  </View>
                  {sv.notas ? <Text style={s.vitaisNota}>{sv.notas}</Text> : null}
                </View>
              );
            })}
          </View>
        )}

        {/* Aba Escalas */}
        {abaAtiva === 'escalas' && (
          <View style={s.secao}>
            {/* Braden */}
            <View style={s.escalaCard}>
              <View style={s.escalaCardHeader}>
                <View>
                  <Text style={s.escalaTitulo}>Escala de Braden</Text>
                  <Text style={s.escalaSubtitulo}>Risco de úlcera de pressão</Text>
                </View>
                <TouchableOpacity style={s.avaliarBotao} onPress={() => { setModalEscala('braden'); setEscalaItens({}); }}>
                  <Text style={s.avaliarBotaoTexto}>+ Avaliar</Text>
                </TouchableOpacity>
              </View>
              {escalas.braden ? (
                <View style={s.escalaResultado}>
                  <View style={[s.escalaBadge, { backgroundColor: escalas.braden.risco === 'baixo' ? '#dcfce7' : escalas.braden.risco === 'moderado' ? '#fef9c3' : escalas.braden.risco === 'alto' ? '#ffedd5' : '#fee2e2' }]}>
                    <Text style={[s.escalaBadgeTexto, { color: escalas.braden.risco === 'baixo' ? '#16a34a' : escalas.braden.risco === 'moderado' ? '#92400e' : escalas.braden.risco === 'alto' ? '#c2410c' : '#b91c1c' }]}>
                      {escalas.braden.risco === 'muito_alto' ? 'Muito Alto' : escalas.braden.risco === 'alto' ? 'Alto' : escalas.braden.risco === 'moderado' ? 'Moderado' : 'Baixo'}
                    </Text>
                  </View>
                  <Text style={s.escalaPontuacao}>{escalas.braden.pontuacao} pts</Text>
                  <Text style={s.escalaData}>{new Date(escalas.braden.criadaEm).toLocaleDateString('pt-PT')}</Text>
                </View>
              ) : (
                <Text style={s.escalaSemDados}>Sem avaliação registada</Text>
              )}
            </View>

            {/* Morse */}
            <View style={s.escalaCard}>
              <View style={s.escalaCardHeader}>
                <View>
                  <Text style={s.escalaTitulo}>Escala de Morse</Text>
                  <Text style={s.escalaSubtitulo}>Risco de queda</Text>
                </View>
                <TouchableOpacity style={s.avaliarBotao} onPress={() => { setModalEscala('morse'); setEscalaItens({}); }}>
                  <Text style={s.avaliarBotaoTexto}>+ Avaliar</Text>
                </TouchableOpacity>
              </View>
              {escalas.morse ? (
                <View style={s.escalaResultado}>
                  <View style={[s.escalaBadge, { backgroundColor: escalas.morse.risco === 'baixo' ? '#dcfce7' : escalas.morse.risco === 'moderado' ? '#fef9c3' : '#fee2e2' }]}>
                    <Text style={[s.escalaBadgeTexto, { color: escalas.morse.risco === 'baixo' ? '#16a34a' : escalas.morse.risco === 'moderado' ? '#92400e' : '#b91c1c' }]}>
                      {escalas.morse.risco === 'alto' ? 'Alto' : escalas.morse.risco === 'moderado' ? 'Moderado' : 'Baixo'}
                    </Text>
                  </View>
                  <Text style={s.escalaPontuacao}>{escalas.morse.pontuacao} pts</Text>
                  <Text style={s.escalaData}>{new Date(escalas.morse.criadaEm).toLocaleDateString('pt-PT')}</Text>
                </View>
              ) : (
                <Text style={s.escalaSemDados}>Sem avaliação registada</Text>
              )}
            </View>
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

      {/* Modal: Registar Alergia */}
      <Modal visible={modalAlergia} transparent animationType="slide" onRequestClose={() => setModalAlergia(false)}>
        <View style={s.overlay}>
          <View style={s.modalSheet}>
            <View style={s.sheetCabecalho}>
              <Text style={s.sheetTitulo}>Registar Alergia</Text>
              <TouchableOpacity onPress={() => setModalAlergia(false)}><Text style={s.fecharTexto}>✕</Text></TouchableOpacity>
            </View>
            <Text style={s.formLabel}>Agente alérgeno *</Text>
            <TextInput style={s.formInput} value={alergenio} onChangeText={setAlergenio} placeholder="Ex: Penicilina, Ibuprofeno..." />
            <Text style={s.formLabel}>Tipo</Text>
            <View style={s.seletorRow}>
              {(['medicamento', 'alimento', 'ambiental', 'outro'] as const).map((t) => (
                <TouchableOpacity key={t} style={[s.seletorOpcao, alergiaTipo === t && s.seletorAtivo]} onPress={() => setAlergiaTipo(t)}>
                  <Text style={[s.seletorTexto, alergiaTipo === t && s.seletorTextoAtivo]}>{t === 'medicamento' ? 'Med.' : t === 'alimento' ? 'Alim.' : t === 'ambiental' ? 'Amb.' : 'Outro'}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={s.formLabel}>Severidade</Text>
            <View style={s.seletorRow}>
              {(['ligeira', 'moderada', 'grave', 'anafilaxia'] as const).map((sev) => (
                <TouchableOpacity key={sev} style={[s.seletorOpcao, alergiaSev === sev && s.seletorAtivo]} onPress={() => setAlergiaSev(sev)}>
                  <Text style={[s.seletorTexto, alergiaSev === sev && s.seletorTextoAtivo]}>{sev === 'ligeira' ? 'Ligeira' : sev === 'moderada' ? 'Moder.' : sev === 'grave' ? 'Grave' : 'Anafilax.'}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={s.formLabel}>Notas</Text>
            <TextInput style={s.formInput} value={alergiaNotas} onChangeText={setAlergiaNotas} placeholder="Observações..." />
            <View style={s.modalBotoes}>
              <TouchableOpacity style={s.cancelarBotao} onPress={() => setModalAlergia(false)}><Text style={s.cancelarTexto}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity style={[s.submeterBotao, (!alergenio.trim() || salvandoAlergia) && s.submeterDesativado]} onPress={submeterAlergia} disabled={!alergenio.trim() || salvandoAlergia}>
                <Text style={s.submeterTexto}>{salvandoAlergia ? 'A guardar...' : 'Registar'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal: Contacto de Emergência */}
      <Modal visible={modalContacto} transparent animationType="slide" onRequestClose={() => setModalContacto(false)}>
        <View style={s.overlay}>
          <View style={s.modalSheet}>
            <View style={s.sheetCabecalho}>
              <Text style={s.sheetTitulo}>Contacto de Emergência</Text>
              <TouchableOpacity onPress={() => setModalContacto(false)}><Text style={s.fecharTexto}>✕</Text></TouchableOpacity>
            </View>
            <Text style={s.formLabel}>Nome *</Text>
            <TextInput style={s.formInput} value={contactoNome} onChangeText={setContactoNome} placeholder="Nome completo" />
            <Text style={s.formLabel}>Relação</Text>
            <View style={s.seletorRow}>
              {(['cônjuge', 'filho/a', 'pai/mãe', 'outro'] as const).map((r) => (
                <TouchableOpacity key={r} style={[s.seletorOpcao, contactoRelacao === r && s.seletorAtivo]} onPress={() => setContactoRelacao(r)}>
                  <Text style={[s.seletorTexto, contactoRelacao === r && s.seletorTextoAtivo]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={s.formLabel}>Telefone *</Text>
            <TextInput style={s.formInput} value={contactoTel} onChangeText={setContactoTel} placeholder="9xx xxx xxx" keyboardType="phone-pad" />
            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }} onPress={() => setContactoPrincipal(!contactoPrincipal)}>
              <View style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: '#2563eb', backgroundColor: contactoPrincipal ? '#2563eb' : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                {contactoPrincipal && <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>✓</Text>}
              </View>
              <Text style={{ fontSize: 14, color: '#1e293b' }}>Contacto principal</Text>
            </TouchableOpacity>
            <View style={s.modalBotoes}>
              <TouchableOpacity style={s.cancelarBotao} onPress={() => setModalContacto(false)}><Text style={s.cancelarTexto}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity style={[s.submeterBotao, (!contactoNome.trim() || !contactoTel.trim() || salvandoContacto) && s.submeterDesativado]} onPress={submeterContacto} disabled={!contactoNome.trim() || !contactoTel.trim() || salvandoContacto}>
                <Text style={s.submeterTexto}>{salvandoContacto ? 'A guardar...' : 'Guardar'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal: Registar Sinais Vitais */}
      <Modal visible={modalVitais} transparent animationType="slide" onRequestClose={() => setModalVitais(false)}>
        <View style={s.overlay}>
          <View style={[s.modalSheet, s.modalSheetTall]}>
            <View style={s.sheetCabecalho}>
              <Text style={s.sheetTitulo}>Registar Sinais Vitais</Text>
              <TouchableOpacity onPress={() => setModalVitais(false)}>
                <Text style={s.fecharTexto}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={s.vitaisFormRow}>
                <View style={s.vitaisFormItem}>
                  <Text style={s.formLabel}>TA Sistólica (mmHg)</Text>
                  <TextInput style={s.formInput} value={vPressaoS} onChangeText={setVPressaoS} keyboardType="numeric" placeholder="120" />
                </View>
                <View style={s.vitaisFormItem}>
                  <Text style={s.formLabel}>TA Diastólica (mmHg)</Text>
                  <TextInput style={s.formInput} value={vPressaoD} onChangeText={setVPressaoD} keyboardType="numeric" placeholder="80" />
                </View>
              </View>
              <View style={s.vitaisFormRow}>
                <View style={s.vitaisFormItem}>
                  <Text style={s.formLabel}>Pulso (bpm)</Text>
                  <TextInput style={s.formInput} value={vPulso} onChangeText={setVPulso} keyboardType="numeric" placeholder="72" />
                </View>
                <View style={s.vitaisFormItem}>
                  <Text style={s.formLabel}>Temperatura (ºC)</Text>
                  <TextInput style={s.formInput} value={vTemp} onChangeText={setVTemp} keyboardType="decimal-pad" placeholder="36.5" />
                </View>
              </View>
              <View style={s.vitaisFormRow}>
                <View style={s.vitaisFormItem}>
                  <Text style={s.formLabel}>SpO₂ (%)</Text>
                  <TextInput style={s.formInput} value={vSpO2} onChangeText={setVSpO2} keyboardType="numeric" placeholder="98" />
                </View>
                <View style={s.vitaisFormItem}>
                  <Text style={s.formLabel}>Freq. Resp. (rpm)</Text>
                  <TextInput style={s.formInput} value={vFreqResp} onChangeText={setVFreqResp} keyboardType="numeric" placeholder="16" />
                </View>
              </View>
              <Text style={s.formLabel}>Peso (kg)</Text>
              <TextInput style={s.formInput} value={vPeso} onChangeText={setVPeso} keyboardType="decimal-pad" placeholder="70.5" />
              <Text style={s.formLabel}>Notas</Text>
              <TextInput
                style={[s.formInput, { minHeight: 50, textAlignVertical: 'top' }]}
                value={vNotas}
                onChangeText={setVNotas}
                placeholder="Observações adicionais..."
                multiline
              />
            </ScrollView>
            <View style={s.modalBotoes}>
              <TouchableOpacity style={s.cancelarBotao} onPress={() => setModalVitais(false)}>
                <Text style={s.cancelarTexto}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.submeterBotao, salvandoVitais && s.submeterDesativado]}
                onPress={submeterVitais}
                disabled={salvandoVitais}
              >
                <Text style={s.submeterTexto}>{salvandoVitais ? 'A guardar...' : 'Guardar'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal: Alta Estruturada */}
      <Modal visible={modalAltaEstruturada} transparent animationType="slide" onRequestClose={() => setModalAltaEstruturada(false)}>
        <View style={s.overlay}>
          <View style={[s.modalSheet, s.modalSheetTall]}>
            <View style={s.sheetCabecalho}>
              <Text style={s.sheetTitulo}>Alta do Doente</Text>
              <TouchableOpacity onPress={() => setModalAltaEstruturada(false)}>
                <Text style={s.fecharTexto}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.formLabel}>Motivo de Alta *</Text>
              <View style={s.seletorRow}>
                {([['melhoria', 'Melhoria Clínica'], ['transferencia', 'Transferência'], ['pedido_proprio', 'Pedido Próprio'], ['obito', 'Óbito']] as const).map(([k, label]) => (
                  <TouchableOpacity key={k} style={[s.seletorOpcao, altaMotivo === k && s.seletorAtivo]} onPress={() => setAltaMotivo(k)}>
                    <Text style={[s.seletorTexto, altaMotivo === k && s.seletorTextoAtivo]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {altaMotivo !== 'obito' && (
                <>
                  <Text style={s.formLabel}>Destino</Text>
                  <View style={s.seletorRow}>
                    {([['domicilio', 'Domicílio'], ['outro_hospital', 'Outro Hospital'], ['lar', 'Lar'], ['outro', 'Outro']] as const).map(([k, label]) => (
                      <TouchableOpacity key={k} style={[s.seletorOpcao, altaDestino === k && s.seletorAtivo]} onPress={() => setAltaDestino(k)}>
                        <Text style={[s.seletorTexto, altaDestino === k && s.seletorTextoAtivo]}>{label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              <Text style={s.formLabel}>Resumo Clínico *</Text>
              <TextInput
                style={[s.formInput, { minHeight: 90, textAlignVertical: 'top' }]}
                value={altaResumo}
                onChangeText={setAltaResumo}
                placeholder="Descrever evolução clínica e estado à saída..."
                multiline
              />

              <Text style={s.formLabel}>Prescrição de Saída</Text>
              <TextInput
                style={[s.formInput, { minHeight: 70, textAlignVertical: 'top' }]}
                value={altaPrescricao}
                onChangeText={setAltaPrescricao}
                placeholder="Medicação prescrita para o domicílio (opcional)"
                multiline
              />

              <Text style={s.formLabel}>Médico de Família / Referenciação</Text>
              <TextInput
                style={s.formInput}
                value={altaMedFamilia}
                onChangeText={setAltaMedFamilia}
                placeholder="Nome ou contacto (opcional)"
              />

              <View style={s.modalBotoes}>
                <TouchableOpacity style={s.cancelarBotao} onPress={() => setModalAltaEstruturada(false)}>
                  <Text style={s.cancelarTexto}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.submeterBotao, { backgroundColor: '#dc2626' }, (salvandoAlta || !altaResumo.trim()) && s.submeterDesativado]}
                  onPress={submeterAltaEstruturada}
                  disabled={salvandoAlta || !altaResumo.trim()}
                >
                  <Text style={s.submeterTexto}>{salvandoAlta ? 'A processar...' : 'Confirmar Alta'}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal: Avaliação de Escala */}
      <Modal visible={modalEscala !== null} transparent animationType="slide" onRequestClose={() => setModalEscala(null)}>
        <View style={s.overlay}>
          <View style={[s.modalSheet, s.modalSheetTall]}>
            <View style={s.sheetCabecalho}>
              <Text style={s.sheetTitulo}>{modalEscala === 'braden' ? 'Escala de Braden' : 'Escala de Morse'}</Text>
              <TouchableOpacity onPress={() => setModalEscala(null)}>
                <Text style={s.fecharTexto}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {modalEscala === 'braden' && (
                <>
                  {([
                    { key: 'percepcaoSensorial', label: 'Percepção Sensorial', opts: [[1,'Completamente limitada'],[2,'Muito limitada'],[3,'Ligeiramente limitada'],[4,'Sem limitação']] },
                    { key: 'humidade', label: 'Humidade', opts: [[1,'Permanentemente húmido'],[2,'Muito húmido'],[3,'Ocasionalmente húmido'],[4,'Raramente húmido']] },
                    { key: 'atividade', label: 'Atividade', opts: [[1,'Acamado'],[2,'Sentado'],[3,'Anda ocasionalmente'],[4,'Anda frequentemente']] },
                    { key: 'mobilidade', label: 'Mobilidade', opts: [[1,'Imóvel'],[2,'Muito limitada'],[3,'Ligeiramente limitada'],[4,'Sem limitação']] },
                    { key: 'nutricao', label: 'Nutrição', opts: [[1,'Muito pobre'],[2,'Provavelmente inadequada'],[3,'Adequada'],[4,'Excelente']] },
                    { key: 'friccaoCisalhamento', label: 'Fricção e Cisalhamento', opts: [[1,'Problema'],[2,'Problema potencial'],[3,'Sem problema aparente']] },
                  ] as { key: string; label: string; opts: [number, string][] }[]).map((item) => (
                    <View key={item.key} style={{ marginBottom: 14 }}>
                      <Text style={s.formLabel}>{item.label}</Text>
                      <View style={{ gap: 4 }}>
                        {item.opts.map(([val, desc]) => (
                          <TouchableOpacity
                            key={val}
                            style={[s.escalaOpcao, escalaItens[item.key] === val && s.escalaOpcaoAtiva]}
                            onPress={() => setEscalaItens(prev => ({ ...prev, [item.key]: val }))}
                          >
                            <Text style={[s.escalaOpcaoNum, escalaItens[item.key] === val && { color: '#fff' }]}>{val}</Text>
                            <Text style={[s.escalaOpcaoDesc, escalaItens[item.key] === val && { color: '#fff' }]}>{desc}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  ))}
                  <View style={s.escalaPontuacaoRow}>
                    <Text style={s.escalaPontuacaoLabel}>Pontuação total:</Text>
                    <Text style={s.escalaPontuacaoValor}>
                      {Object.values(escalaItens).reduce((a: number, b: number) => a + b, 0)} / 23
                    </Text>
                  </View>
                </>
              )}

              {modalEscala === 'morse' && (
                <>
                  {([
                    { key: 'historiaQueda', label: 'Histórico de Quedas (últimos 3 meses)', opts: [[0,'Não (0)'],[25,'Sim (25)']] },
                    { key: 'diagnosticoSecundario', label: 'Diagnóstico Secundário', opts: [[0,'Não (0)'],[15,'Sim (15)']] },
                    { key: 'ajudaMarcha', label: 'Ajuda na Marcha', opts: [[0,'Nenhuma / Acamado (0)'],[15,'Canadiana / Andarilho (15)'],[30,'Segura em móveis (30)']] },
                    { key: 'heparinaIV', label: 'Terapia Intravenosa / Heparina', opts: [[0,'Não (0)'],[20,'Sim (20)']] },
                    { key: 'marchaTransferencia', label: 'Marcha / Transferência', opts: [[0,'Normal / Acamado (0)'],[10,'Debilitado (10)'],[20,'Comprometido (20)']] },
                    { key: 'estadoMental', label: 'Estado Mental', opts: [[0,'Orientado (0)'],[15,'Confuso / Esquece limitações (15)']] },
                  ] as { key: string; label: string; opts: [number, string][] }[]).map((item) => (
                    <View key={item.key} style={{ marginBottom: 14 }}>
                      <Text style={s.formLabel}>{item.label}</Text>
                      <View style={s.seletorRow}>
                        {item.opts.map(([val, desc]) => (
                          <TouchableOpacity
                            key={val}
                            style={[s.seletorOpcao, escalaItens[item.key] === val && s.seletorAtivo]}
                            onPress={() => setEscalaItens(prev => ({ ...prev, [item.key]: val }))}
                          >
                            <Text style={[s.seletorTexto, escalaItens[item.key] === val && s.seletorTextoAtivo]}>{desc}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  ))}
                  <View style={s.escalaPontuacaoRow}>
                    <Text style={s.escalaPontuacaoLabel}>Pontuação total:</Text>
                    <Text style={s.escalaPontuacaoValor}>
                      {Object.values(escalaItens).reduce((a: number, b: number) => a + b, 0)} / 125
                    </Text>
                  </View>
                </>
              )}

              <View style={s.modalBotoes}>
                <TouchableOpacity style={s.cancelarBotao} onPress={() => setModalEscala(null)}>
                  <Text style={s.cancelarTexto}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.submeterBotao, salvandoEscala && s.submeterDesativado]}
                  onPress={submeterEscala}
                  disabled={salvandoEscala}
                >
                  <Text style={s.submeterTexto}>{salvandoEscala ? 'A registar...' : 'Registar'}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
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

      {/* Modal: Editar Dados do Doente */}
      <Modal visible={modalEditarDoente} transparent animationType="slide" onRequestClose={() => setModalEditarDoente(false)}>
        <View style={s.overlay}>
          <View style={s.modalSheet}>
            <View style={s.sheetCabecalho}>
              <Text style={s.sheetTitulo}>Editar Dados Clínicos</Text>
              <TouchableOpacity onPress={() => setModalEditarDoente(false)}>
                <Text style={s.fecharTexto}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={s.formLabel}>Diagnóstico Principal</Text>
            <TextInput
              style={[s.formInput, { minHeight: 60, textAlignVertical: 'top' }]}
              value={editDiagnostico}
              onChangeText={setEditDiagnostico}
              placeholder="Diagnóstico principal..."
              multiline
            />
            <Text style={s.formLabel}>Alta Prevista (AAAA-MM-DD)</Text>
            <TextInput
              style={s.formInput}
              value={editAltaPrevista}
              onChangeText={setEditAltaPrevista}
              placeholder="Ex: 2026-04-20"
              keyboardType="numeric"
            />
            <View style={s.modalBotoes}>
              <TouchableOpacity style={s.cancelarBotao} onPress={() => setModalEditarDoente(false)}>
                <Text style={s.cancelarTexto}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.submeterBotao, salvandoEdicao && s.submeterDesativado]}
                onPress={submeterEdicaoDoente}
                disabled={salvandoEdicao}
              >
                <Text style={s.submeterTexto}>{salvandoEdicao ? 'A guardar...' : 'Guardar'}</Text>
              </TouchableOpacity>
            </View>
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
  voltarBotao: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, marginBottom: 10 },
  voltarTexto: { color: '#fff', fontSize: 12, fontWeight: '600' },
  headerInfo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  headerNome: { fontSize: 20, fontWeight: '700', color: '#fff', flex: 1, marginRight: 12 },
  estadoBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  estadoTexto: { fontSize: 12, fontWeight: '600' },
  headerSub: { fontSize: 13, color: '#64748b' },
  abas: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  aba: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  abaAtiva: { borderBottomWidth: 2, borderBottomColor: '#2563eb' },
  abaTexto: { fontSize: 11, color: '#94a3b8', fontWeight: '500' },
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
  // Banners
  bannerAlergia: { backgroundColor: '#fef2f2', borderBottomWidth: 1, borderBottomColor: '#fecaca', paddingHorizontal: 16, paddingVertical: 8 },
  bannerAlergiaTexto: { fontSize: 12, fontWeight: '700', color: '#dc2626' },
  bannerAlerta: { backgroundColor: '#fef9c3', borderBottomWidth: 1, borderBottomColor: '#fde047', paddingHorizontal: 16, paddingVertical: 8 },
  bannerAlertaTexto: { fontSize: 12, fontWeight: '700', color: '#92400e' },
  // Alergias
  alergiaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  alergiaBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  alergiaBadgeTexto: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  alergiaNome: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  alergiaTipo: { fontSize: 11, color: '#64748b' },
  // Contactos
  contactoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  contactoNome: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  contactoMeta: { fontSize: 12, color: '#64748b', marginTop: 1 },
  contactoPrincipalBadge: { backgroundColor: '#eff6ff', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  contactoPrincipalTexto: { fontSize: 10, fontWeight: '700', color: '#2563eb' },
  // Sinais Vitais
  vitaisCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10 },
  vitaisCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  vitaisData: { fontSize: 13, fontWeight: '700', color: '#1e293b' },
  vitaisAutor: { fontSize: 11, color: '#94a3b8' },
  vitaisGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  vitaisItem: { backgroundColor: '#f8fafc', borderRadius: 10, padding: 10, minWidth: 80, alignItems: 'center', borderLeftWidth: 3 },
  vitaisLabel: { fontSize: 10, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.4 },
  vitaisValor: { fontSize: 18, fontWeight: '800', marginTop: 2 },
  vitaisUnidade: { fontSize: 10, color: '#94a3b8', marginTop: 1 },
  vitaisNota: { fontSize: 12, color: '#64748b', marginTop: 8, fontStyle: 'italic' },
  vitaisFormRow: { flexDirection: 'row', gap: 10, marginBottom: 0 },
  vitaisFormItem: { flex: 1 },
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
  // Escalas
  escalaCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12 },
  escalaCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  escalaTitulo: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  escalaSubtitulo: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  avaliarBotao: { backgroundColor: '#2563eb', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 },
  avaliarBotaoTexto: { color: '#fff', fontSize: 13, fontWeight: '700' },
  escalaResultado: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  escalaBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  escalaBadgeTexto: { fontSize: 12, fontWeight: '700' },
  escalaPontuacao: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  escalaData: { fontSize: 12, color: '#94a3b8', marginLeft: 'auto' },
  escalaSemDados: { fontSize: 13, color: '#94a3b8', fontStyle: 'italic' },
  escalaOpcao: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 10, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
  escalaOpcaoAtiva: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  escalaOpcaoNum: { fontSize: 14, fontWeight: '800', color: '#2563eb', width: 20, textAlign: 'center' },
  escalaOpcaoDesc: { fontSize: 13, color: '#334155', flex: 1 },
  escalaPontuacaoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#e2e8f0', marginTop: 8 },
  escalaPontuacaoLabel: { fontSize: 13, fontWeight: '600', color: '#475569' },
  escalaPontuacaoValor: { fontSize: 20, fontWeight: '800', color: '#2563eb' },
});
