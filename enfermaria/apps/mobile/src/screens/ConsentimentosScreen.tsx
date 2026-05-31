import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Modal, ActivityIndicator, Alert, Platform, Switch,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import api from '../lib/api';
import { Utilizador } from '../lib/auth';

// ─── Constantes ───────────────────────────────────────────────────────────────

const TIPOS: Record<string, string> = {
  cirurgia:               'Cirurgia',
  procedimento_invasivo:  'Procedimento Invasivo',
  anestesia:              'Anestesia',
  transfusao:             'Transfusão',
  outro:                  'Outro',
};

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface Doente {
  id: string;
  nome: string;
  numeroCama?: string;
  numeroProcesso?: string;
}

interface Consentimento {
  id: string;
  tipo: string;
  descricao: string;
  criadoEm: string;
  assinadoDoenteEm?: string;
  assinadoTestemunhaEm?: string;
  recusado: boolean;
  motivoRecusa?: string;
  criadoPor?: { nome: string; role: string };
  testemunha?: { nome: string; role: string };
}

interface Props { utilizador: Utilizador; onVoltar: () => void }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatarDataHora(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-PT', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function estadoConsentimento(c: Consentimento): { label: string; cor: string; fundo: string } {
  if (c.recusado)         return { label: 'Recusado',  cor: '#dc2626', fundo: '#fee2e2' };
  if (c.assinadoDoenteEm) return { label: 'Assinado',  cor: '#059669', fundo: '#d1fae5' };
  return                         { label: 'Pendente',  cor: '#b45309', fundo: '#fef3c7' };
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function ConsentimentosScreen({ utilizador, onVoltar }: Props) {
  const role = utilizador.role;
  const podeCriar   = ['medico', 'enfermeiro'].includes(role);
  const podeAssinar = ['medico', 'enfermeiro', 'administrativo'].includes(role);

  // Pesquisa de doente
  const [pesquisaDoente, setPesquisaDoente] = useState('');
  const [doentes, setDoentes] = useState<Doente[]>([]);
  const [carregandoDoentes, setCarregandoDoentes] = useState(false);
  const [doenteSelec, setDoenteSelec] = useState<Doente | null>(null);

  // Consentimentos do doente seleccionado
  const [consentimentos, setConsentimentos] = useState<Consentimento[]>([]);
  const [carregando, setCarregando] = useState(false);

  // Modal criar
  const [modalCriar, setModalCriar] = useState(false);
  const [novoTipo, setNovoTipo] = useState('cirurgia');
  const [novaDesc, setNovaDesc] = useState('');
  const [criando, setCriando] = useState(false);

  // Modal assinar
  const [modalAssinar, setModalAssinar] = useState<Consentimento | null>(null);
  const [confirmacaoAssinar, setConfirmacaoAssinar] = useState(false);
  const [assinando, setAssinando] = useState(false);

  // Modal recusar
  const [modalRecusar, setModalRecusar] = useState<Consentimento | null>(null);
  const [motivoRecusa, setMotivoRecusa] = useState('');
  const [recusando, setRecusando] = useState(false);

  // Pesquisar doentes
  const pesquisarDoentes = useCallback(async (q: string) => {
    if (q.length < 2) { setDoentes([]); return; }
    setCarregandoDoentes(true);
    try {
      const r = await api.get(`/doentes?search=${encodeURIComponent(q)}&limit=20`);
      const lista = Array.isArray(r.data) ? r.data : (r.data.doentes ?? []);
      setDoentes(lista);
    } catch {
      setDoentes([]);
    } finally {
      setCarregandoDoentes(false);
    }
  }, []);

  const seleccionarDoente = async (d: Doente) => {
    setDoenteSelec(d);
    setDoentes([]);
    setPesquisaDoente('');
    await carregarConsentimentos(d.id);
  };

  const carregarConsentimentos = async (doenteId: string) => {
    setCarregando(true);
    try {
      const r = await api.get(`/consentimentos/doente/${doenteId}`);
      setConsentimentos(r.data ?? []);
    } catch {
      setConsentimentos([]);
    } finally {
      setCarregando(false);
    }
  };

  useFocusEffect(useCallback(() => {
    if (doenteSelec) carregarConsentimentos(doenteSelec.id);
  }, [doenteSelec?.id]));

  // Criar consentimento
  const criarConsentimento = async () => {
    if (!doenteSelec || !novaDesc.trim()) {
      Alert.alert('Atenção', 'A descrição do procedimento é obrigatória.');
      return;
    }
    setCriando(true);
    try {
      await api.post('/consentimentos', {
        doenteId: doenteSelec.id,
        tipo: novoTipo,
        descricao: novaDesc.trim(),
      });
      setModalCriar(false);
      setNovoTipo('cirurgia');
      setNovaDesc('');
      await carregarConsentimentos(doenteSelec.id);
    } catch {
      Alert.alert('Erro', 'Não foi possível criar o consentimento.');
    } finally {
      setCriando(false);
    }
  };

  // Assinar consentimento
  const assinarConsentimento = async () => {
    if (!modalAssinar || !doenteSelec) return;
    setAssinando(true);
    try {
      await api.post(`/consentimentos/${modalAssinar.id}/assinar`, {
        testemunhaId: utilizador.id,
      });
      setModalAssinar(null);
      setConfirmacaoAssinar(false);
      await carregarConsentimentos(doenteSelec.id);
    } catch (e: any) {
      Alert.alert('Erro', e?.response?.data?.message ?? 'Não foi possível registar a assinatura.');
    } finally {
      setAssinando(false);
    }
  };

  // Recusar consentimento
  const recusarConsentimento = async () => {
    if (!modalRecusar || !doenteSelec || !motivoRecusa.trim()) {
      Alert.alert('Atenção', 'O motivo de recusa é obrigatório.');
      return;
    }
    setRecusando(true);
    try {
      await api.post(`/consentimentos/${modalRecusar.id}/recusar`, {
        motivo: motivoRecusa.trim(),
      });
      setModalRecusar(null);
      setMotivoRecusa('');
      await carregarConsentimentos(doenteSelec.id);
    } catch (e: any) {
      Alert.alert('Erro', e?.response?.data?.message ?? 'Não foi possível registar a recusa.');
    } finally {
      setRecusando(false);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onVoltar} style={s.btnVoltar} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color="#0f172a" />
        </TouchableOpacity>
        <Text style={s.headerTitulo}>Consentimentos</Text>
        {doenteSelec && podeCriar ? (
          <TouchableOpacity style={s.btnNovo} onPress={() => { setNovoTipo('cirurgia'); setNovaDesc(''); setModalCriar(true); }} activeOpacity={0.8}>
            <Ionicons name="add" size={20} color="#fff" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 38 }} />
        )}
      </View>

      {/* Seletor de doente */}
      <View style={s.doenteSelector}>
        {doenteSelec ? (
          <View style={s.doenteSelecCard}>
            <View style={s.doenteSelecInfo}>
              <Ionicons name="person-circle-outline" size={20} color="#6366f1" />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={s.doenteNome}>{doenteSelec.nome}</Text>
                {doenteSelec.numeroCama && <Text style={s.doenteSub}>Cama {doenteSelec.numeroCama}</Text>}
              </View>
            </View>
            <TouchableOpacity onPress={() => { setDoenteSelec(null); setConsentimentos([]); }} style={s.btnMudar}>
              <Text style={s.btnMudarLabel}>Mudar</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View>
            <View style={s.pesquisaBox}>
              <Ionicons name="search-outline" size={16} color="#94a3b8" />
              <TextInput
                style={s.pesquisaInput}
                placeholder="Pesquisar doente por nome ou processo..."
                placeholderTextColor="#94a3b8"
                value={pesquisaDoente}
                onChangeText={(t) => { setPesquisaDoente(t); pesquisarDoentes(t); }}
              />
              {carregandoDoentes && <ActivityIndicator size="small" color="#6366f1" />}
            </View>
            {doentes.length > 0 && (
              <View style={s.doentesLista}>
                {doentes.map((d) => (
                  <TouchableOpacity key={d.id} style={s.doenteItem} onPress={() => seleccionarDoente(d)} activeOpacity={0.7}>
                    <Text style={s.doenteItemNome}>{d.nome}</Text>
                    {d.numeroCama && <Text style={s.doenteItemSub}>Cama {d.numeroCama}</Text>}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}
      </View>

      {/* Conteúdo */}
      {!doenteSelec ? (
        <View style={s.centro}>
          <Ionicons name="document-text-outline" size={48} color="#cbd5e1" />
          <Text style={s.emptyTitulo}>Seleccione um doente</Text>
          <Text style={s.emptySub}>Pesquise pelo nome ou número de processo</Text>
        </View>
      ) : carregando ? (
        <View style={s.centro}>
          <ActivityIndicator size="large" color="#0f172a" />
        </View>
      ) : consentimentos.length === 0 ? (
        <View style={s.centro}>
          <Ionicons name="document-outline" size={48} color="#cbd5e1" />
          <Text style={s.emptyTitulo}>Sem consentimentos</Text>
          <Text style={s.emptySub}>Nenhum consentimento registado para este doente.</Text>
          {podeCriar && (
            <TouchableOpacity style={s.btnNovoCentro} onPress={() => { setNovoTipo('cirurgia'); setNovaDesc(''); setModalCriar(true); }} activeOpacity={0.8}>
              <Text style={s.btnNovoCentroLabel}>Criar Primeiro Consentimento</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.lista}>
          {consentimentos.map((c) => {
            const est = estadoConsentimento(c);
            const pendente = !c.assinadoDoenteEm && !c.recusado;
            return (
              <View key={c.id} style={s.card}>
                <View style={s.cardTopo}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.cardTipo}>{TIPOS[c.tipo] ?? c.tipo}</Text>
                    <Text style={s.cardDesc} numberOfLines={3}>{c.descricao}</Text>
                  </View>
                  <View style={[s.estadoBadge, { backgroundColor: est.fundo }]}>
                    <Text style={[s.estadoLabel, { color: est.cor }]}>{est.label}</Text>
                  </View>
                </View>

                <View style={s.cardMeta}>
                  <Text style={s.metaTexto}>Criado por {c.criadoPor?.nome ?? '—'} · {formatarDataHora(c.criadoEm)}</Text>
                  {c.assinadoDoenteEm && (
                    <Text style={[s.metaTexto, { color: '#059669' }]}>
                      ✓ Assinado em {formatarDataHora(c.assinadoDoenteEm)}
                    </Text>
                  )}
                  {c.assinadoTestemunhaEm && c.testemunha && (
                    <Text style={[s.metaTexto, { color: '#059669' }]}>
                      ✓ Testemunhado por {c.testemunha.nome} em {formatarDataHora(c.assinadoTestemunhaEm)}
                    </Text>
                  )}
                  {c.recusado && c.motivoRecusa && (
                    <Text style={[s.metaTexto, { color: '#dc2626' }]}>
                      Motivo de recusa: {c.motivoRecusa}
                    </Text>
                  )}
                </View>

                {pendente && podeAssinar && (
                  <View style={s.cardAcoes}>
                    <TouchableOpacity
                      style={s.btnAssinar}
                      onPress={() => { setConfirmacaoAssinar(false); setModalAssinar(c); }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="checkmark-circle-outline" size={15} color="#fff" />
                      <Text style={s.btnAssinarLabel}>Assinar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={s.btnRecusar}
                      onPress={() => { setMotivoRecusa(''); setModalRecusar(c); }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="close-circle-outline" size={15} color="#dc2626" />
                      <Text style={s.btnRecusarLabel}>Recusar</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* ─── Modal Criar Consentimento ───────────────────────────────────────── */}
      <Modal visible={modalCriar} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalCriar(false)}>
        <View style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitulo}>Novo Consentimento</Text>
            <TouchableOpacity onPress={() => setModalCriar(false)} style={s.modalFechar}>
              <Ionicons name="close" size={22} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView style={s.modalBody} contentContainerStyle={{ paddingBottom: 40 }}>
            {doenteSelec && (
              <View style={s.doenteInfoBox}>
                <Ionicons name="person-outline" size={16} color="#6366f1" />
                <Text style={s.doenteInfoNome}>{doenteSelec.nome}</Text>
              </View>
            )}

            <Text style={s.campoLabel}>Tipo de Consentimento</Text>
            <View style={s.gradeOpcoes}>
              {Object.entries(TIPOS).map(([key, label]) => (
                <TouchableOpacity
                  key={key}
                  style={[s.opcaoBtn, novoTipo === key && s.opcaoBtnAtivo]}
                  onPress={() => setNovoTipo(key)}
                >
                  <Text style={[s.opcaoBtnLabel, novoTipo === key && s.opcaoBtnLabelAtivo]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.campoLabel}>Descrição do Procedimento *</Text>
            <TextInput
              style={s.textarea}
              placeholder="Descreva o procedimento para o qual é solicitado consentimento..."
              placeholderTextColor="#94a3b8"
              multiline
              numberOfLines={5}
              value={novaDesc}
              onChangeText={setNovaDesc}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[s.btnPrimario, (!novaDesc.trim() || criando) && s.btnDesativado]}
              onPress={criarConsentimento}
              disabled={!novaDesc.trim() || criando}
              activeOpacity={0.8}
            >
              {criando ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={s.btnPrimarioLabel}>Criar Consentimento</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* ─── Modal Assinar ──────────────────────────────────────────────────── */}
      <Modal visible={!!modalAssinar} animationType="fade" transparent onRequestClose={() => setModalAssinar(null)}>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <Text style={s.sheetTitulo}>Registar Assinatura</Text>
            {modalAssinar && (
              <View style={s.sheetInfoBox}>
                <Text style={s.sheetInfoTipo}>{TIPOS[modalAssinar.tipo] ?? modalAssinar.tipo}</Text>
                <Text style={s.sheetInfoDesc} numberOfLines={2}>{modalAssinar.descricao}</Text>
              </View>
            )}
            <Text style={s.sheetTexto}>
              Confirme que o doente foi devidamente informado sobre o procedimento e que assinou o documento de consentimento na presença do profissional de saúde.
            </Text>

            <TouchableOpacity
              style={s.confirmacaoRow}
              onPress={() => setConfirmacaoAssinar((v) => !v)}
              activeOpacity={0.8}
            >
              <Switch
                value={confirmacaoAssinar}
                onValueChange={setConfirmacaoAssinar}
                trackColor={{ false: '#e2e8f0', true: '#059669' }}
                thumbColor="#fff"
              />
              <Text style={s.confirmacaoLabel}>
                Confirmo que o doente assinou fisicamente e que uma cópia foi entregue.
              </Text>
            </TouchableOpacity>

            <View style={s.sheetBotoes}>
              <TouchableOpacity style={s.btnSecundario} onPress={() => { setModalAssinar(null); setConfirmacaoAssinar(false); }}>
                <Text style={s.btnSecundarioLabel}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.btnVerde, { flex: 1 }, (!confirmacaoAssinar || assinando) && s.btnDesativado]}
                onPress={assinarConsentimento}
                disabled={!confirmacaoAssinar || assinando}
                activeOpacity={0.8}
              >
                {assinando ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={s.btnPrimarioLabel}>Confirmar Assinatura</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── Modal Recusar ──────────────────────────────────────────────────── */}
      <Modal visible={!!modalRecusar} animationType="fade" transparent onRequestClose={() => setModalRecusar(null)}>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <Text style={s.sheetTitulo}>Registar Recusa</Text>
            <Text style={[s.sheetTexto, { marginBottom: 12 }]}>
              O registo de recusa é obrigatório por lei e ficará permanentemente no processo do doente.
            </Text>

            <Text style={s.campoLabel}>Motivo da Recusa *</Text>
            <TextInput
              style={[s.textarea, { minHeight: 72 }]}
              placeholder="Indique o motivo declarado pelo doente..."
              placeholderTextColor="#94a3b8"
              multiline
              numberOfLines={3}
              value={motivoRecusa}
              onChangeText={setMotivoRecusa}
              textAlignVertical="top"
            />

            <View style={s.sheetBotoes}>
              <TouchableOpacity style={s.btnSecundario} onPress={() => setModalRecusar(null)}>
                <Text style={s.btnSecundarioLabel}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.btnVermelho, { flex: 1 }, (!motivoRecusa.trim() || recusando) && s.btnDesativado]}
                onPress={recusarConsentimento}
                disabled={!motivoRecusa.trim() || recusando}
                activeOpacity={0.8}
              >
                {recusando ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={s.btnPrimarioLabel}>Registar Recusa</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container:        { flex: 1, backgroundColor: '#f8fafc' },

  header:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 56 : 16, paddingBottom: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  btnVoltar:        { width: 38, height: 38, borderRadius: 10, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  headerTitulo:     { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  btnNovo:          { width: 38, height: 38, borderRadius: 10, backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center' },

  doenteSelector:   { backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  doenteSelecCard:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  doenteSelecInfo:  { flexDirection: 'row', alignItems: 'center', flex: 1 },
  doenteNome:       { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  doenteSub:        { fontSize: 12, color: '#64748b', marginTop: 1 },
  btnMudar:         { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  btnMudarLabel:    { fontSize: 12, color: '#475569', fontWeight: '600' },

  pesquisaBox:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', borderRadius: 10, paddingHorizontal: 12, gap: 8 },
  pesquisaInput:    { flex: 1, height: 40, fontSize: 14, color: '#0f172a' },
  doentesLista:     { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, marginTop: 4, overflow: 'hidden' },
  doenteItem:       { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  doenteItemNome:   { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  doenteItemSub:    { fontSize: 12, color: '#64748b', marginTop: 1 },

  lista:            { padding: 16, gap: 10, paddingBottom: 32 },
  centro:           { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyTitulo:      { fontSize: 16, fontWeight: '700', color: '#334155', marginTop: 8 },
  emptySub:         { fontSize: 13, color: '#94a3b8', textAlign: 'center', paddingHorizontal: 32 },
  btnNovoCentro:    { marginTop: 12, backgroundColor: '#6366f1', borderRadius: 10, paddingHorizontal: 20, paddingVertical: 12 },
  btnNovoCentroLabel: { color: '#fff', fontWeight: '700', fontSize: 14 },

  card:             { backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#e2e8f0' },
  cardTopo:         { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardTipo:         { fontSize: 15, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  cardDesc:         { fontSize: 13, color: '#475569', lineHeight: 18 },
  estadoBadge:      { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, alignSelf: 'flex-start' },
  estadoLabel:      { fontSize: 11, fontWeight: '700' },
  cardMeta:         { marginTop: 10, gap: 2 },
  metaTexto:        { fontSize: 11, color: '#94a3b8' },
  cardAcoes:        { flexDirection: 'row', gap: 8, marginTop: 12 },
  btnAssinar:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: '#059669', borderRadius: 8, paddingVertical: 10 },
  btnAssinarLabel:  { color: '#fff', fontSize: 13, fontWeight: '700' },
  btnRecusar:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1, borderColor: '#fca5a5', borderRadius: 8, paddingVertical: 10 },
  btnRecusarLabel:  { color: '#dc2626', fontSize: 13, fontWeight: '700' },

  modal:            { flex: 1, backgroundColor: '#fff' },
  modalHeader:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 56 : 20, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  modalTitulo:      { fontSize: 17, fontWeight: '700', color: '#0f172a', flex: 1, marginRight: 12 },
  modalFechar:      { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  modalBody:        { flex: 1, paddingHorizontal: 20, paddingTop: 16 },

  doenteInfoBox:    { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#eef2ff', borderRadius: 10, padding: 12, marginBottom: 16 },
  doenteInfoNome:   { fontSize: 14, fontWeight: '700', color: '#4338ca', flex: 1 },

  campoLabel:       { fontSize: 13, color: '#64748b', fontWeight: '600', marginBottom: 8, marginTop: 16 },
  gradeOpcoes:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  opcaoBtn:         { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff' },
  opcaoBtnAtivo:    { backgroundColor: '#eef2ff', borderColor: '#6366f1' },
  opcaoBtnLabel:    { fontSize: 13, color: '#475569' },
  opcaoBtnLabelAtivo: { color: '#6366f1', fontWeight: '700' },
  textarea:         { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, fontSize: 14, color: '#0f172a', backgroundColor: '#fff', minHeight: 100 },

  btnPrimario:      { backgroundColor: '#6366f1', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  btnPrimarioLabel: { color: '#fff', fontSize: 15, fontWeight: '700' },
  btnVerde:         { backgroundColor: '#059669', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  btnVermelho:      { backgroundColor: '#dc2626', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  btnDesativado:    { opacity: 0.45 },

  overlay:          { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet:            { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: Platform.OS === 'ios' ? 44 : 24 },
  sheetTitulo:      { fontSize: 17, fontWeight: '700', color: '#0f172a', marginBottom: 12 },
  sheetInfoBox:     { backgroundColor: '#f8fafc', borderRadius: 10, padding: 12, marginBottom: 12 },
  sheetInfoTipo:    { fontSize: 14, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  sheetInfoDesc:    { fontSize: 13, color: '#475569' },
  sheetTexto:       { fontSize: 13, color: '#64748b', lineHeight: 19 },
  confirmacaoRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 16, marginBottom: 4 },
  confirmacaoLabel: { flex: 1, fontSize: 13, color: '#334155', lineHeight: 18 },
  sheetBotoes:      { flexDirection: 'row', gap: 10, marginTop: 16 },
  btnSecundario:    { flex: 1, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  btnSecundarioLabel: { fontSize: 15, color: '#475569', fontWeight: '600' },
});
