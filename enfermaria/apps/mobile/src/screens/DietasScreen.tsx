import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl, Modal, TextInput, Alert, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import api from '../lib/api';
import { Utilizador } from '../lib/auth';

// ─── Types ──────────────────────────────────────────────────────────────────

interface PrescricaoDieta {
  id: string;
  tipo: TipoDieta;
  restricoes: string[];
  observacoes?: string;
  criadaEm: string;
  ativa: boolean;
  criadaPor: { id: string; nome: string };
}

interface RegistoDieta {
  doente: { id: string; nome: string; cama: { quarto: string; numero: string } };
  dieta: PrescricaoDieta | null;
}

interface DoenteSimples {
  id: string;
  nome: string;
  estado?: string;
  cama?: { quarto: string; numero: string };
}

type TipoDieta = 'normal' | 'hipocalórica' | 'diabética' | 'renal' | 'hepática' | 'líquida' | 'jejum';

interface Props { utilizador: Utilizador; onVoltar: () => void }

// ─── Constants ───────────────────────────────────────────────────────────────

const TIPOS_DIETA: { valor: TipoDieta; label: string; cor: string }[] = [
  { valor: 'normal',       label: 'Normal',       cor: '#16a34a' },
  { valor: 'hipocalórica', label: 'Hipocalórica',  cor: '#2563eb' },
  { valor: 'diabética',    label: 'Diabética',     cor: '#d97706' },
  { valor: 'renal',        label: 'Renal',         cor: '#7c3aed' },
  { valor: 'hepática',     label: 'Hepática',      cor: '#b45309' },
  { valor: 'líquida',      label: 'Líquida',       cor: '#0891b2' },
  { valor: 'jejum',        label: 'Jejum',         cor: '#dc2626' },
];

const RESTRICOES: { valor: string; label: string }[] = [
  { valor: 'gluten',    label: 'Glúten' },
  { valor: 'lactose',   label: 'Lactose' },
  { valor: 'sal',       label: 'Sal' },
  { valor: 'potassio',  label: 'Potássio' },
  { valor: 'fosforo',   label: 'Fósforo' },
  { valor: 'proteina',  label: 'Proteína' },
  { valor: 'gordura',   label: 'Gordura' },
  { valor: 'acucar',    label: 'Açúcar' },
];

function tipoCfg(tipo: TipoDieta) {
  return TIPOS_DIETA.find(t => t.valor === tipo) ?? { valor: tipo, label: tipo, cor: '#64748b' };
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function DietasScreen({ utilizador, onVoltar }: Props) {
  const [registos, setRegistos] = useState<RegistoDieta[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal state
  const [modalVisivel, setModalVisivel]     = useState(false);
  const [doentes, setDoentes]               = useState<DoenteSimples[]>([]);
  const [loadingDoentes, setLoadingDoentes] = useState(false);
  const [pesquisa, setPesquisa]             = useState('');
  const [doenteId, setDoenteId]             = useState<string | null>(null);
  const [tipoSel, setTipoSel]               = useState<TipoDieta>('normal');
  const [restricoesSel, setRestricoesSel]   = useState<string[]>([]);
  const [observacoes, setObservacoes]       = useState('');
  const [salvando, setSalvando]             = useState(false);

  const podePrescrever = ['medico', 'enfermeiro'].includes(utilizador.role);

  // ─── Data loading ─────────────────────────────────────────────────────────

  const carregar = async () => {
    try {
      const r = await api.get('/dietas/hoje');
      setRegistos(r.data ?? []);
    } catch { /* ignorar */ }
    finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { carregar(); }, []));

  const carregarDoentes = async () => {
    setLoadingDoentes(true);
    try {
      const r = await api.get('/doentes?estado=internado');
      setDoentes(r.data?.data ?? r.data ?? []);
    } catch { /* ignorar */ }
    finally { setLoadingDoentes(false); }
  };

  // ─── Modal helpers ────────────────────────────────────────────────────────

  const abrirModal = () => {
    setDoenteId(null);
    setTipoSel('normal');
    setRestricoesSel([]);
    setObservacoes('');
    setPesquisa('');
    setModalVisivel(true);
    carregarDoentes();
  };

  const fecharModal = () => setModalVisivel(false);

  const toggleRestricao = (valor: string) => {
    setRestricoesSel(prev =>
      prev.includes(valor) ? prev.filter(r => r !== valor) : [...prev, valor]
    );
  };

  const salvar = async () => {
    if (!doenteId) {
      Alert.alert('Atenção', 'Seleccione um doente.');
      return;
    }
    setSalvando(true);
    try {
      await api.post('/dietas', {
        doenteId,
        tipo: tipoSel,
        restricoes: restricoesSel,
        observacoes: observacoes.trim() || undefined,
      });
      fecharModal();
      await carregar();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Erro ao guardar dieta.';
      if (Platform.OS === 'web') {
        (window as any).alert(msg);
      } else {
        Alert.alert('Erro', msg);
      }
    } finally {
      setSalvando(false);
    }
  };

  // ─── Derived data ─────────────────────────────────────────────────────────

  const comDieta    = registos.filter(r => r.dieta !== null);
  const semDieta    = registos.filter(r => r.dieta === null);

  const doentesFiltrados = pesquisa.trim()
    ? doentes.filter(d => d.nome.toLowerCase().includes(pesquisa.toLowerCase()))
    : doentes;

  const fmtData = (d: string) =>
    new Date(d).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: '2-digit' });

  // ─── Loading ──────────────────────────────────────────────────────────────

  if (loading) return <View style={s.centro}><ActivityIndicator size="large" color="#16a34a" /></View>;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onVoltar} style={s.voltarBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitulo}>Dietas</Text>
          <Text style={s.headerSub}>Prescrições dietéticas do dia</Text>
        </View>
      </View>

      {/* Stats bar */}
      <View style={s.statsBar}>
        <View style={s.statItem}>
          <Ionicons name="restaurant-outline" size={15} color="#16a34a" />
          <Text style={s.statTexto}>Total com dieta: <Text style={s.statValor}>{comDieta.length}</Text></Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.statItem}>
          <Ionicons name="warning-outline" size={15} color={semDieta.length > 0 ? '#d97706' : '#94a3b8'} />
          <Text style={[s.statTexto, semDieta.length > 0 && s.statTextoAviso]}>
            Sem dieta: <Text style={[s.statValor, semDieta.length > 0 && s.statValorAviso]}>{semDieta.length}</Text>
          </Text>
        </View>
      </View>

      {/* List */}
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); carregar(); }} />}
        style={{ flex: 1 }}
      >
        {/* Patients with diet */}
        {comDieta.length > 0 && (
          <>
            <View style={s.seccaoHeader}>
              <Ionicons name="checkmark-circle-outline" size={16} color="#16a34a" />
              <Text style={s.seccaoTitulo}>Com dieta prescrita</Text>
              <View style={s.seccaoBadge}>
                <Text style={s.seccaoBadgeTexto}>{comDieta.length}</Text>
              </View>
            </View>

            {comDieta.map(({ doente, dieta }) => {
              const cfg = tipoCfg(dieta!.tipo);
              return (
                <View key={doente.id} style={[s.cartao, { borderLeftColor: cfg.cor }]}>
                  <View style={s.cartaoTopo}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.cartaoTitulo}>{doente.nome}</Text>
                      <View style={s.infoRow}>
                        <Ionicons name="bed-outline" size={13} color="#94a3b8" />
                        <Text style={s.cartaoProc}>Quarto {doente.cama.quarto} · Cama {doente.cama.numero}</Text>
                      </View>
                    </View>
                    <View style={[s.tipoBadge, { backgroundColor: cfg.cor + '22' }]}>
                      <Text style={[s.tipoTexto, { color: cfg.cor }]}>{cfg.label}</Text>
                    </View>
                  </View>

                  {/* Restrictions */}
                  {dieta!.restricoes.length > 0 && (
                    <View style={s.restricoesRow}>
                      {dieta!.restricoes.map(r => {
                        const rl = RESTRICOES.find(x => x.valor === r);
                        return (
                          <View key={r} style={s.restricaoBadge}>
                            <Text style={s.restricaoTexto}>{rl?.label ?? r}</Text>
                          </View>
                        );
                      })}
                    </View>
                  )}

                  {/* Observações */}
                  {!!dieta!.observacoes && (
                    <View style={s.infoRow}>
                      <Ionicons name="document-text-outline" size={13} color="#64748b" />
                      <Text style={s.infoTexto} numberOfLines={2}>{dieta!.observacoes}</Text>
                    </View>
                  )}

                  {/* Footer */}
                  <View style={s.cartaoRodape}>
                    <Ionicons name="person-outline" size={12} color="#94a3b8" />
                    <Text style={s.rodapeTexto}>{dieta!.criadaPor.nome}</Text>
                    <Text style={s.rodapeSep}>·</Text>
                    <Ionicons name="calendar-outline" size={12} color="#94a3b8" />
                    <Text style={s.rodapeTexto}>{fmtData(dieta!.criadaEm)}</Text>
                  </View>
                </View>
              );
            })}
          </>
        )}

        {/* Patients without diet */}
        {semDieta.length > 0 && (
          <>
            <View style={[s.seccaoHeader, { marginTop: comDieta.length > 0 ? 8 : 0 }]}>
              <Ionicons name="alert-circle-outline" size={16} color="#d97706" />
              <Text style={[s.seccaoTitulo, { color: '#d97706' }]}>Sem dieta prescrita</Text>
              <View style={[s.seccaoBadge, s.seccaoBadgeAviso]}>
                <Text style={[s.seccaoBadgeTexto, s.seccaoBadgeTextoAviso]}>{semDieta.length}</Text>
              </View>
            </View>

            {semDieta.map(({ doente }) => (
              <View key={doente.id} style={[s.cartao, { borderLeftColor: '#f59e0b' }]}>
                <View style={s.cartaoTopo}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.cartaoTitulo}>{doente.nome}</Text>
                    <View style={s.infoRow}>
                      <Ionicons name="bed-outline" size={13} color="#94a3b8" />
                      <Text style={s.cartaoProc}>Quarto {doente.cama.quarto} · Cama {doente.cama.numero}</Text>
                    </View>
                  </View>
                  <View style={s.semDietaBadge}>
                    <Text style={s.semDietaTexto}>Sem dieta</Text>
                  </View>
                </View>
              </View>
            ))}
          </>
        )}

        {/* Empty state */}
        {registos.length === 0 && (
          <View style={s.vazio}>
            <Ionicons name="restaurant-outline" size={48} color="#94a3b8" />
            <Text style={s.vazioTexto}>Sem registos de dieta para hoje</Text>
          </View>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* FAB */}
      {podePrescrever && (
        <TouchableOpacity style={s.fab} onPress={abrirModal}>
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Prescription Modal */}
      <Modal visible={modalVisivel} animationType="slide" transparent onRequestClose={fecharModal}>
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            {/* Modal Header */}
            <View style={s.modalHeader}>
              <Text style={s.modalTitulo}>Prescrever Dieta</Text>
              <TouchableOpacity onPress={fecharModal} style={s.modalFechar}>
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              {/* Patient picker */}
              <Text style={s.labelSeccao}>Doente *</Text>
              <View style={s.pesquisaBox}>
                <Ionicons name="search-outline" size={16} color="#94a3b8" style={{ marginRight: 6 }} />
                <TextInput
                  style={s.pesquisaInput}
                  placeholder="Pesquisar doente..."
                  placeholderTextColor="#94a3b8"
                  value={pesquisa}
                  onChangeText={setPesquisa}
                />
              </View>

              {loadingDoentes ? (
                <ActivityIndicator size="small" color="#16a34a" style={{ marginVertical: 16 }} />
              ) : (
                <ScrollView style={s.doenteListaBox} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                  {doentesFiltrados.length === 0 ? (
                    <Text style={s.doenteVazio}>Nenhum doente encontrado</Text>
                  ) : doentesFiltrados.map(d => (
                    <TouchableOpacity
                      key={d.id}
                      style={[s.doenteItem, doenteId === d.id && s.doenteItemSel]}
                      onPress={() => setDoenteId(d.id)}
                    >
                      <Ionicons
                        name={doenteId === d.id ? 'checkmark-circle' : 'ellipse-outline'}
                        size={18}
                        color={doenteId === d.id ? '#16a34a' : '#cbd5e1'}
                      />
                      <View style={{ flex: 1, marginLeft: 8 }}>
                        <Text style={[s.doenteNome, doenteId === d.id && s.doenteNomeSel]}>{d.nome}</Text>
                        {d.cama && (
                          <Text style={s.doenteInfo}>Quarto {d.cama.quarto} · Cama {d.cama.numero}</Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              {/* Diet type */}
              <Text style={s.labelSeccao}>Tipo de Dieta *</Text>
              <View style={s.tiposGrid}>
                {TIPOS_DIETA.map(t => (
                  <TouchableOpacity
                    key={t.valor}
                    style={[s.tipoOpcao, tipoSel === t.valor && { backgroundColor: t.cor + '22', borderColor: t.cor }]}
                    onPress={() => setTipoSel(t.valor)}
                  >
                    <View style={[s.tipoRadio, tipoSel === t.valor && { borderColor: t.cor }]}>
                      {tipoSel === t.valor && <View style={[s.tipoRadioInner, { backgroundColor: t.cor }]} />}
                    </View>
                    <Text style={[s.tipoOpcaoTexto, tipoSel === t.valor && { color: t.cor, fontWeight: '700' }]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Restrictions */}
              <Text style={s.labelSeccao}>Restrições</Text>
              <View style={s.restricoesGrid}>
                {RESTRICOES.map(r => {
                  const sel = restricoesSel.includes(r.valor);
                  return (
                    <TouchableOpacity
                      key={r.valor}
                      style={[s.restricaoChip, sel && s.restricaoChipSel]}
                      onPress={() => toggleRestricao(r.valor)}
                    >
                      <Text style={[s.restricaoChipTexto, sel && s.restricaoChipTextoSel]}>{r.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Observations */}
              <Text style={s.labelSeccao}>Observações</Text>
              <TextInput
                style={s.observacoesInput}
                placeholder="Notas adicionais sobre a dieta..."
                placeholderTextColor="#94a3b8"
                value={observacoes}
                onChangeText={setObservacoes}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              <View style={{ height: 16 }} />
            </ScrollView>

            {/* Modal Actions */}
            <View style={s.modalActions}>
              <TouchableOpacity style={s.btnCancelar} onPress={fecharModal} disabled={salvando}>
                <Text style={s.btnCancelarTexto}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.btnGuardar} onPress={salvar} disabled={salvando}>
                {salvando
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={s.btnGuardarTexto}>Guardar</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#f1f5f9' },
  centro:     { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Header
  header:      { backgroundColor: '#16a34a', paddingTop: 52, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  voltarBtn:   { padding: 4 },
  headerTitulo: { fontSize: 20, fontWeight: '700', color: '#fff' },
  headerSub:   { fontSize: 11, color: '#bbf7d0', marginTop: 2 },

  // Stats bar
  statsBar:       { flexDirection: 'row', backgroundColor: '#fff', paddingVertical: 10, paddingHorizontal: 20, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  statItem:       { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  statDivider:    { width: 1, height: 20, backgroundColor: '#e2e8f0', marginHorizontal: 12 },
  statTexto:      { fontSize: 13, color: '#64748b' },
  statValor:      { fontWeight: '700', color: '#1e293b' },
  statTextoAviso: { color: '#d97706' },
  statValorAviso: { color: '#d97706' },

  // Section headers
  seccaoHeader:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 6, gap: 6 },
  seccaoTitulo:      { fontSize: 13, fontWeight: '700', color: '#16a34a', flex: 1 },
  seccaoBadge:       { backgroundColor: '#dcfce7', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  seccaoBadgeTexto:  { fontSize: 11, fontWeight: '700', color: '#16a34a' },
  seccaoBadgeAviso:  { backgroundColor: '#fef3c7' },
  seccaoBadgeTextoAviso: { color: '#d97706' },

  // Cards
  cartao:      { backgroundColor: '#fff', marginHorizontal: 16, marginTop: 10, borderRadius: 14, padding: 14, borderLeftWidth: 4, shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 2 },
  cartaoTopo:  { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
  cartaoTitulo: { fontSize: 15, fontWeight: '700', color: '#1e293b', marginBottom: 2 },
  cartaoProc:  { fontSize: 12, color: '#94a3b8' },
  tipoBadge:   { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  tipoTexto:   { fontSize: 12, fontWeight: '700' },

  // Restrictions chips (display)
  restricoesRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 6 },
  restricaoBadge:  { backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  restricaoTexto:  { fontSize: 11, color: '#475569', fontWeight: '500' },

  // Sem dieta badge
  semDietaBadge: { backgroundColor: '#fef3c7', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  semDietaTexto: { fontSize: 12, fontWeight: '700', color: '#d97706' },

  // Info row
  infoRow:    { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  infoTexto:  { fontSize: 13, color: '#64748b', flex: 1 },

  // Card footer
  cartaoRodape:  { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  rodapeTexto:   { fontSize: 11, color: '#94a3b8' },
  rodapeSep:     { fontSize: 11, color: '#cbd5e1', marginHorizontal: 2 },

  // Empty state
  vazio:      { padding: 60, alignItems: 'center', gap: 12 },
  vazioTexto: { color: '#94a3b8', fontSize: 15 },

  // FAB
  fab: { position: 'absolute', bottom: 28, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: '#16a34a', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowOffset: { width: 0, height: 4 }, shadowRadius: 8, elevation: 6 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalBox:     { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '92%', paddingBottom: Platform.OS === 'ios' ? 32 : 16 },
  modalHeader:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  modalTitulo:  { flex: 1, fontSize: 17, fontWeight: '700', color: '#1e293b' },
  modalFechar:  { padding: 4 },

  labelSeccao: { fontSize: 13, fontWeight: '700', color: '#475569', paddingHorizontal: 20, marginTop: 18, marginBottom: 8 },

  // Patient search
  pesquisaBox:   { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, marginHorizontal: 20, paddingHorizontal: 12, paddingVertical: 8 },
  pesquisaInput: { flex: 1, fontSize: 14, color: '#1e293b' },
  doenteListaBox: { maxHeight: 200, marginHorizontal: 20, marginTop: 6, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, backgroundColor: '#f8fafc' },
  doenteVazio:   { textAlign: 'center', color: '#94a3b8', fontSize: 13, paddingVertical: 20 },
  doenteItem:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  doenteItemSel: { backgroundColor: '#f0fdf4' },
  doenteNome:    { fontSize: 14, color: '#1e293b', fontWeight: '500' },
  doenteNomeSel: { color: '#16a34a', fontWeight: '700' },
  doenteInfo:    { fontSize: 11, color: '#94a3b8', marginTop: 1 },

  // Diet type radio grid
  tiposGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20 },
  tipoOpcao:     { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: '#e2e8f0', backgroundColor: '#f8fafc', minWidth: '44%', flex: 1 },
  tipoRadio:     { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#cbd5e1', alignItems: 'center', justifyContent: 'center' },
  tipoRadioInner: { width: 9, height: 9, borderRadius: 5 },
  tipoOpcaoTexto: { fontSize: 13, color: '#475569', fontWeight: '500', flex: 1 },

  // Restriction chips (modal)
  restricoesGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20 },
  restricaoChip:        { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f1f5f9', borderWidth: 1.5, borderColor: '#e2e8f0' },
  restricaoChipSel:     { backgroundColor: '#dcfce7', borderColor: '#16a34a' },
  restricaoChipTexto:   { fontSize: 13, color: '#475569', fontWeight: '500' },
  restricaoChipTextoSel: { color: '#16a34a', fontWeight: '700' },

  // Observations
  observacoesInput: { marginHorizontal: 20, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, fontSize: 14, color: '#1e293b', minHeight: 80 },

  // Modal actions
  modalActions:     { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingTop: 12 },
  btnCancelar:      { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#f1f5f9', alignItems: 'center' },
  btnCancelarTexto: { fontSize: 15, fontWeight: '700', color: '#64748b' },
  btnGuardar:       { flex: 2, paddingVertical: 14, borderRadius: 12, backgroundColor: '#16a34a', alignItems: 'center' },
  btnGuardarTexto:  { fontSize: 15, fontWeight: '700', color: '#fff' },
});
