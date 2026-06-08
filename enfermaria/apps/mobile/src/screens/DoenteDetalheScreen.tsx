import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, RefreshControl, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { useFocusEffect } from '@react-navigation/native';
import api from '../lib/api';
import { Utilizador } from '../lib/auth';
import { useNetworkStatus } from '../lib/network';
import { enqueue } from '../lib/mutation-queue';
import { OfflineBanner } from '../components/OfflineBanner';
import { SyncStatusBanner } from '../components/SyncStatusBanner';
import * as Haptics from 'expo-haptics';
import TabInfo from './doente-detalhe/tabs/TabInfo';
import TabTarefas from './doente-detalhe/tabs/TabTarefas';
import TabMedicacao from './doente-detalhe/tabs/TabMedicacao';
import TabNotas from './doente-detalhe/tabs/TabNotas';
import TabVitais from './doente-detalhe/tabs/TabVitais';
import TabEscalas from './doente-detalhe/tabs/TabEscalas';
import TabFeridas from './doente-detalhe/tabs/TabFeridas';
import TabIA from './doente-detalhe/tabs/TabIA';
import TabAlertas from './doente-detalhe/tabs/TabAlertas';
import ModalAlterarEstado from './doente-detalhe/modals/ModalAlterarEstado';
import ModalCriarTarefa from './doente-detalhe/modals/ModalCriarTarefa';
import ModalPrescreverMedicacao from './doente-detalhe/modals/ModalPrescreverMedicacao';
import ModalHistoricoTarefas from './doente-detalhe/modals/ModalHistoricoTarefas';
import ModalHistoricoMedicacao from './doente-detalhe/modals/ModalHistoricoMedicacao';
import ModalRegistarAlergia from './doente-detalhe/modals/ModalRegistarAlergia';
import ModalContactoEmergencia from './doente-detalhe/modals/ModalContactoEmergencia';
import ModalRegistarVitais from './doente-detalhe/modals/ModalRegistarVitais';
import ModalAltaEstruturada from './doente-detalhe/modals/ModalAltaEstruturada';
import ModalAvaliacaoEscala from './doente-detalhe/modals/ModalAvaliacaoEscala';
import ModalEditarDoente from './doente-detalhe/modals/ModalEditarDoente';

const estadoCor: Record<string, string> = {
  estavel: '#22c55e', grave: '#f97316', critico: '#ef4444', alta_prevista: '#3b82f6',
};
const estadoLabel: Record<string, string> = {
  estavel: 'Estável', grave: 'Grave', critico: 'Crítico', alta_prevista: 'Alta Prevista',
};

interface Props {
  doenteId: string;
  utilizador: Utilizador;
  onVoltar: () => void;
}

type Aba = 'info' | 'tarefas' | 'medicacao' | 'notas' | 'vitais' | 'escalas' | 'feridas' | 'ia' | 'alertas';

export default function DoenteDetalheScreen({ doenteId, utilizador, onVoltar }: Props) {
  const [doente, setDoente] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [alergias, setAlergias] = useState<any[]>([]);
  const [contactos, setContactos] = useState<any[]>([]);
  const [alertas, setAlertas] = useState<any[]>([]);
  const [escalas, setEscalas] = useState<{ braden: any; morse: any }>({ braden: null, morse: null });
  const [sinaisVitais, setSinaisVitais] = useState<any[]>([]);
  const [loadingVitais, setLoadingVitais] = useState(false);
  const [emTurno, setEmTurno] = useState(false);
  const [nota, setNota] = useState('');
  const [gravandoNota, setGravandoNota] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState<Aba>('info');
  const [alterandoEstado, setAlterandoEstado] = useState(false);
  const [modalTarefa, setModalTarefa] = useState(false);
  const [modalMed, setModalMed] = useState(false);
  const [modalHistorico, setModalHistorico] = useState(false);
  const [modalHistoricoMed, setModalHistoricoMed] = useState(false);
  const [modalAlergia, setModalAlergia] = useState(false);
  const [modalContacto, setModalContacto] = useState(false);
  const [modalVitais, setModalVitais] = useState(false);
  const [modalAltaEstruturada, setModalAltaEstruturada] = useState(false);
  const [modalEscala, setModalEscala] = useState<'braden' | 'morse' | null>(null);
  const [modalEditarDoente, setModalEditarDoente] = useState(false);
  const [tarefasHistorico, setTarefasHistorico] = useState<any[]>([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const [medHistorico, setMedHistorico] = useState<any[]>([]);
  const [loadingHistoricoMed, setLoadingHistoricoMed] = useState(false);

  const isOnline = useNetworkStatus();
  const prevAlertIdsRef = React.useRef<Set<string>>(new Set());

  const role = utilizador.role;
  const meuGrupoChave = role === 'medico' ? 'medico' : role === 'auxiliar' ? 'auxiliar' : 'enfermeiro';
  const podePrescreveMed = role === 'medico';
  const podeRegistarMed = ['enfermeiro', 'auxiliar'].includes(role);
  const podeAlterarEstado = ['enfermeiro', 'medico'].includes(role);
  const podeCriarTarefa = emTurno && ['enfermeiro', 'medico'].includes(role);
  const podeCriarNota = emTurno && ['enfermeiro', 'medico', 'auxiliar'].includes(role);
  const podeRegistarVitais = ['enfermeiro', 'auxiliar', 'medico'].includes(role);
  const podeDarAlta = role === 'medico';
  const podeEditarDoente = ['medico', 'enfermeiro', 'administrativo'].includes(role);
  const gruposDisponiveis = role === 'medico' ? ['medico', 'enfermeiro'] : role === 'auxiliar' ? ['auxiliar'] : ['enfermeiro', 'auxiliar'];

  const carregar = async () => {
    try { const { data } = await api.get(`/doentes/${doenteId}`); setDoente(data); }
    finally { setLoading(false); }
  };

  const carregarVitais = async () => {
    setLoadingVitais(true);
    try { const r = await api.get(`/sinais-vitais/${doenteId}`); setSinaisVitais(r.data); }
    catch { setSinaisVitais([]); } finally { setLoadingVitais(false); }
  };

  const carregarAlergias = async () => {
    try { const r = await api.get(`/alergias/${doenteId}`); setAlergias(r.data); } catch { setAlergias([]); }
  };

  const carregarContactos = async () => {
    try { const r = await api.get(`/contactos/${doenteId}`); setContactos(r.data); } catch { setContactos([]); }
  };

  const carregarAlertas = async () => {
    try {
      const r = await api.get(`/alertas/${doenteId}`);
      const novosAlertas: any[] = r.data;
      const TIPOS_CRITICOS = ['ia_watchdog', 'escalacao_automatica', 'news2_critico', 'sepsis', 'sos'];
      const temNovoCritico = novosAlertas.some(
        (a: any) => !a.lido && TIPOS_CRITICOS.includes(a.tipo) && !prevAlertIdsRef.current.has(a.id)
      );
      if (temNovoCritico) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
      prevAlertIdsRef.current = new Set(novosAlertas.map((a: any) => a.id));
      setAlertas(novosAlertas);
    } catch { setAlertas([]); }
  };

  const carregarEscalas = async () => {
    try { const r = await api.get(`/escalas/${doenteId}`); setEscalas(r.data); } catch { }
  };

  const verificarTurnoAtivo = async () => {
    const agora = new Date();
    const min = agora.getHours() * 60 + agora.getMinutes();
    let tipo: string;
    const dataRef = new Date(agora);
    if (min >= 8 * 60 && min < 16 * 60) tipo = 'manha';
    else if (min >= 16 * 60 && min < 23 * 60) tipo = 'tarde';
    else if (min >= 23 * 60) tipo = 'noite';
    else { tipo = 'noite'; dataRef.setDate(dataRef.getDate() - 1); }
    try {
      const r = await api.get(`/horarios/meu?mes=${dataRef.getMonth() + 1}&ano=${dataRef.getFullYear()}`);
      const diaRef = dataRef.toDateString();
      setEmTurno(r.data.some((h: any) => h.horarioTurno.tipo === tipo && new Date(h.horarioTurno.data).toDateString() === diaRef));
    } catch { setEmTurno(false); }
  };

  useFocusEffect(useCallback(() => {
    carregar(); verificarTurnoAtivo(); carregarVitais();
    carregarAlergias(); carregarContactos(); carregarAlertas(); carregarEscalas();
  }, [doenteId]));

  const gravarNota = async () => {
    if (!nota.trim()) return;
    setGravandoNota(true);
    try {
      await api.post(`/doentes/${doenteId}/nota`, { texto: nota });
      setNota(''); await carregar();
      Alert.alert('Sucesso', 'Nota guardada');
    } catch {
      Alert.alert('Erro', 'Não foi possível guardar a nota. Certifica-te que estás em turno.');
    } finally { setGravandoNota(false); }
  };

  const concluirTarefa = async (id: string) => {
    try {
      if (!isOnline) {
        await enqueue({ method: 'PATCH', url: `/tarefas/${id}/estado`, body: { estado: 'concluida' } });
        Alert.alert('Guardado localmente', 'Será enviado quando houver ligação.');
        return;
      }
      await api.patch(`/tarefas/${id}/estado`, { estado: 'concluida' });
      await carregar();
    } catch { Alert.alert('Erro', 'Não foi possível concluir a tarefa'); }
  };

  const concluirMedicacao = async (id: string) => {
    try { await api.patch(`/medicacao/${id}/descontinuar`); await carregar(); }
    catch { Alert.alert('Erro', 'Não foi possível concluir a medicação'); }
  };

  const registarMedicacao = async (id: string) => {
    try {
      if (!isOnline) {
        await enqueue({ method: 'POST', url: `/medicacao/${id}/administrar`, body: {} });
        Alert.alert('Guardado localmente', 'Será enviado quando houver ligação.');
        return;
      }
      await api.post(`/medicacao/${id}/administrar`, {});
      Alert.alert('Registado', 'Administração registada com sucesso');
    } catch { Alert.alert('Erro', 'Não foi possível registar'); }
  };

  const alterarEstado = async (novoEstado: string) => {
    try { await api.patch(`/doentes/${doenteId}/estado`, { estado: novoEstado }); setAlterandoEstado(false); await carregar(); }
    catch { Alert.alert('Erro', 'Não foi possível alterar o estado'); }
  };

  const abrirHistorico = async () => {
    setLoadingHistorico(true); setModalHistorico(true);
    try { const r = await api.get(`/tarefas/doente/${doenteId}`); setTarefasHistorico(r.data.filter((t: any) => t.estado === 'concluida')); }
    catch { setTarefasHistorico([]); } finally { setLoadingHistorico(false); }
  };

  const abrirHistoricoMed = async () => {
    setLoadingHistoricoMed(true); setModalHistoricoMed(true);
    try { const r = await api.get(`/medicacao/doente/${doenteId}`); setMedHistorico(r.data.filter((m: any) => !m.ativo)); }
    catch { setMedHistorico([]); } finally { setLoadingHistoricoMed(false); }
  };

  const removerAlergia = async (id: string) => {
    try { await api.delete(`/alergias/${id}`); await carregarAlergias(); }
    catch { Alert.alert('Erro', 'Não foi possível remover a alergia'); }
  };

  const removerContacto = async (id: string) => {
    try { await api.delete(`/contactos/${id}`); await carregarContactos(); }
    catch { Alert.alert('Erro', 'Não foi possível remover o contacto'); }
  };

  const uploadFoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permissão necessária', 'Ative o acesso à câmara nas definições.'); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: true, aspect: [1, 1] });
    if (result.canceled) return;
    const formData = new FormData();
    formData.append('foto', { uri: result.assets[0].uri, type: 'image/jpeg', name: 'foto.jpg' } as any);
    try {
      const r = await api.patch(`/doentes/${doenteId}/foto`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setDoente((d: any) => ({ ...d, fotoUrl: r.data.fotoUrl }));
    } catch { Alert.alert('Erro', 'Não foi possível guardar a foto'); }
  };

  if (loading) return <View style={s.centro}><ActivityIndicator size="large" color="#2563eb" /></View>;
  if (!doente) return null;

  const tarefas = (doente.tarefas ?? []).filter((t: any) => t.estado !== 'concluida' && t.estado !== 'cancelada');
  const medicacoesAtivas = (doente.medicacoes ?? []).filter((m: any) => m.ativo);

  const abas: { key: Aba; label: string }[] = [
    { key: 'info', label: 'Info' },
    { key: 'tarefas', label: `Tarefas (${tarefas.length})` },
    { key: 'medicacao', label: `Med. (${medicacoesAtivas.length})` },
    { key: 'notas', label: 'Notas' },
    { key: 'vitais', label: 'Vitais' },
    { key: 'escalas', label: 'Escalas' },
    { key: 'feridas', label: 'Feridas' },
    { key: 'ia', label: '🧠 IA' },
    { key: 'alertas', label: `🔔 Alertas${alertas.filter((a: any) => !a.lido).length > 0 ? ` (${alertas.filter((a: any) => !a.lido).length})` : ''}` },
  ];

  return (
    <View style={s.container}>
      <OfflineBanner />
      <SyncStatusBanner />
      <View style={s.header}>
        <TouchableOpacity onPress={onVoltar} style={s.voltarBotao}>
          <Text style={s.voltarTexto}>‹  Voltar</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={['medico', 'enfermeiro', 'chefe_enfermeiros'].includes(role) ? uploadFoto : undefined} activeOpacity={0.8} style={s.avatarContainer}>
          {doente.fotoUrl
            ? <Image source={{ uri: doente.fotoUrl }} style={s.avatar} />
            : <View style={[s.avatar, s.avatarPlaceholder]}><Text style={s.avatarInicial}>{doente.nome?.[0] ?? '?'}</Text></View>
          }
          {['medico', 'enfermeiro', 'chefe_enfermeiros'].includes(role) && <Text style={s.avatarCamIcon}>📷</Text>}
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

      {alergias.length > 0 && (
        <View style={s.bannerAlergia}>
          <Text style={s.bannerAlergiaTexto}>⚠ ALERGIA: {alergias.map((a: any) => `${a.alergenio} (${a.severidade})`).join(', ')}</Text>
        </View>
      )}

      {alertas.length > 0 && (
        <TouchableOpacity style={s.bannerAlerta} onPress={async () => { await api.patch(`/alertas/${doenteId}/ler-todos`); setAlertas([]); }}>
          <Text style={s.bannerAlertaTexto}>🚨 {alertas[0].mensagem}{alertas.length > 1 ? ` (+${alertas.length - 1})` : ''} — Toque para dispensar</Text>
        </TouchableOpacity>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.abas} contentContainerStyle={{ flexDirection: 'row' }}>
        {abas.map((a) => (
          <TouchableOpacity key={a.key} style={[s.aba, abaAtiva === a.key && s.abaAtiva]} onPress={() => setAbaAtiva(a.key)}>
            <Text style={[s.abaTexto, abaAtiva === a.key && s.abaTextoAtivo]}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={s.conteudo} refreshControl={<RefreshControl refreshing={false} onRefresh={carregar} />}>
        {abaAtiva === 'info' && (
          <TabInfo
            doente={doente} alergias={alergias} contactos={contactos}
            podeEditarDoente={podeEditarDoente} podeRegistarVitais={podeRegistarVitais} podeDarAlta={podeDarAlta}
            onEditarDoente={() => setModalEditarDoente(true)}
            onAdicionarAlergia={() => setModalAlergia(true)}
            onRemoverAlergia={removerAlergia}
            onAdicionarContacto={() => setModalContacto(true)}
            onRemoverContacto={removerContacto}
            onDarAlta={() => setModalAltaEstruturada(true)}
          />
        )}
        {abaAtiva === 'tarefas' && (
          <TabTarefas
            tarefas={tarefas} emTurno={emTurno}
            utilizadorId={utilizador.id} meuGrupoChave={meuGrupoChave}
            podeCriarTarefa={podeCriarTarefa}
            onHistorico={abrirHistorico}
            onCriarTarefa={() => setModalTarefa(true)}
            onConcluirTarefa={concluirTarefa}
          />
        )}
        {abaAtiva === 'medicacao' && (
          <TabMedicacao
            doenteId={doenteId}
            medicacoesAtivas={medicacoesAtivas}
            podePrescreveMed={podePrescreveMed} podeRegistarMed={podeRegistarMed}
            onHistorico={abrirHistoricoMed}
            onPrescrever={() => setModalMed(true)}
            onRegistar={registarMedicacao}
            onConcluir={concluirMedicacao}
          />
        )}
        {abaAtiva === 'notas' && (
          <TabNotas
            notas={doente.notasTurno ?? []}
            nota={nota} setNota={setNota}
            gravandoNota={gravandoNota} onGravar={gravarNota}
            podeCriarNota={podeCriarNota}
          />
        )}
        {abaAtiva === 'vitais' && (
          <TabVitais
            sinaisVitais={sinaisVitais} loadingVitais={loadingVitais}
            podeRegistarVitais={podeRegistarVitais}
            onRegistar={() => setModalVitais(true)}
          />
        )}
        {abaAtiva === 'escalas' && (
          <TabEscalas escalas={escalas} onAvaliar={setModalEscala} />
        )}
        {abaAtiva === 'feridas' && (
          <TabFeridas doenteId={doenteId} podeRegistar={['medico', 'enfermeiro', 'tecnico_saude'].includes(role)} />
        )}
        {abaAtiva === 'ia' && (
          <TabIA doenteId={doenteId} />
        )}
        {abaAtiva === 'alertas' && (
          <TabAlertas
            alertas={alertas}
            onMarcarLido={async (id: string) => {
              try {
                await api.patch(`/alertas/${id}/ler`);
                setAlertas((prev: any[]) => prev.map((a) => a.id === id ? { ...a, lido: true } : a));
              } catch { /* ignore */ }
            }}
          />
        )}
      </ScrollView>

      <ModalAlterarEstado visible={alterandoEstado} estadoAtual={doente.estado} onClose={() => setAlterandoEstado(false)} onSelect={alterarEstado} />
      <ModalCriarTarefa visible={modalTarefa} doenteId={doenteId} gruposDisponiveis={gruposDisponiveis} onClose={() => setModalTarefa(false)} onSaved={carregar} />
      <ModalPrescreverMedicacao visible={modalMed} doenteId={doenteId} onClose={() => setModalMed(false)} onSaved={carregar} />
      <ModalHistoricoTarefas visible={modalHistorico} tarefas={tarefasHistorico} loading={loadingHistorico} onClose={() => setModalHistorico(false)} />
      <ModalHistoricoMedicacao visible={modalHistoricoMed} medicacao={medHistorico} loading={loadingHistoricoMed} onClose={() => setModalHistoricoMed(false)} />
      <ModalRegistarAlergia visible={modalAlergia} doenteId={doenteId} onClose={() => setModalAlergia(false)} onSaved={carregarAlergias} />
      <ModalContactoEmergencia visible={modalContacto} doenteId={doenteId} onClose={() => setModalContacto(false)} onSaved={carregarContactos} />
      <ModalRegistarVitais visible={modalVitais} doenteId={doenteId} onClose={() => setModalVitais(false)} onSaved={carregarVitais} />
      <ModalAltaEstruturada visible={modalAltaEstruturada} doenteId={doenteId} onClose={() => setModalAltaEstruturada(false)} onDone={onVoltar} />
      <ModalAvaliacaoEscala visible={modalEscala !== null} tipo={modalEscala} doenteId={doenteId} onClose={() => setModalEscala(null)} onSaved={carregarEscalas} />
      <ModalEditarDoente
        visible={modalEditarDoente} doenteId={doenteId}
        diagnosticoInicial={doente?.diagnosticoPrincipal ?? ''}
        altaPrevistaInicial={doente?.dataAltaPrevista ? doente.dataAltaPrevista.split('T')[0] : ''}
        onClose={() => setModalEditarDoente(false)} onSaved={carregar}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { backgroundColor: '#1e293b', padding: 20, paddingTop: 16 },
  voltarBotao: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, marginBottom: 10 },
  avatarContainer: { position: 'absolute', top: 16, right: 20, alignItems: 'center' },
  avatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' },
  avatarPlaceholder: { backgroundColor: '#3b82f6', alignItems: 'center', justifyContent: 'center' },
  avatarInicial: { fontSize: 20, fontWeight: '700', color: '#fff' },
  avatarCamIcon: { fontSize: 10, marginTop: 2 },
  voltarTexto: { color: '#fff', fontSize: 12, fontWeight: '600' },
  headerInfo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  headerNome: { fontSize: 20, fontWeight: '700', color: '#fff', flex: 1, marginRight: 12 },
  estadoBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  estadoTexto: { fontSize: 12, fontWeight: '600' },
  headerSub: { fontSize: 13, color: '#64748b' },
  abas: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', maxHeight: 44 },
  aba: { paddingVertical: 12, paddingHorizontal: 14, alignItems: 'center' },
  abaAtiva: { borderBottomWidth: 2, borderBottomColor: '#2563eb' },
  abaTexto: { fontSize: 11, color: '#94a3b8', fontWeight: '500' },
  abaTextoAtivo: { color: '#2563eb', fontWeight: '700' },
  conteudo: { flex: 1 },
  bannerAlergia: { backgroundColor: '#fef2f2', borderBottomWidth: 1, borderBottomColor: '#fecaca', paddingHorizontal: 16, paddingVertical: 8 },
  bannerAlergiaTexto: { fontSize: 12, fontWeight: '700', color: '#dc2626' },
  bannerAlerta: { backgroundColor: '#fef9c3', borderBottomWidth: 1, borderBottomColor: '#fde047', paddingHorizontal: 16, paddingVertical: 8 },
  bannerAlertaTexto: { fontSize: 12, fontWeight: '700', color: '#92400e' },
});
