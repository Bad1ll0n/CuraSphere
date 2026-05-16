import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Modal, ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../lib/api';
import { Utilizador } from '../lib/auth';

interface Props { utilizador: Utilizador; onVoltar: () => void }

interface CatalogoItem {
  id: string; dci: string; nomeMarca?: string; formaFarmaceutica: string;
  classeTerap: string; unidade: string; concentracao?: string;
  codigoATC?: string; ativo: boolean;
}

const FORMAS = ['comprimido', 'cápsula', 'solução_injectável', 'solução_oral', 'pomada', 'creme', 'inalador', 'colírio', 'outro'];
const CLASSES = ['analgésico', 'antibiótico', 'anticoagulante', 'anti-hipertensor', 'antidiabético', 'broncodilatador', 'diurético', 'ansiolítico', 'cardiovascular', 'outro'];

const FORMA_LABEL: Record<string, string> = {
  comprimido: 'Comprimido', cápsula: 'Cápsula', solução_injectável: 'Injectável',
  solução_oral: 'Sol. Oral', pomada: 'Pomada', creme: 'Creme',
  inalador: 'Inalador', colírio: 'Colírio', outro: 'Outro',
};

export default function CatalogoScreen({ utilizador, onVoltar }: Props) {
  const [catalogo, setCatalogo] = useState<CatalogoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<'criar' | 'editar' | null>(null);
  const [editItem, setEditItem] = useState<CatalogoItem | null>(null);
  const [form, setForm] = useState({ dci: '', nomeMarca: '', formaFarmaceutica: 'comprimido', classeTerap: 'analgésico', unidade: 'mg', concentracao: '', codigoATC: '' });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const canEdit = ['farmaceutico', 'administrativo'].includes(utilizador.role);

  const carregar = async (q = search) => {
    try {
      const { data } = await api.get(`/catalogo${q ? `?search=${encodeURIComponent(q)}` : ''}`);
      setCatalogo(data ?? []);
    } catch {} finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { carregar(); }, []));

  const resetForm = () => setForm({ dci: '', nomeMarca: '', formaFarmaceutica: 'comprimido', classeTerap: 'analgésico', unidade: 'mg', concentracao: '', codigoATC: '' });

  const abrirEditar = (item: CatalogoItem) => {
    setEditItem(item);
    setForm({ dci: item.dci, nomeMarca: item.nomeMarca ?? '', formaFarmaceutica: item.formaFarmaceutica, classeTerap: item.classeTerap, unidade: item.unidade, concentracao: item.concentracao ?? '', codigoATC: item.codigoATC ?? '' });
    setErro('');
    setModal('editar');
  };

  const submeter = async () => {
    if (!form.dci.trim()) { setErro('DCI é obrigatória'); return; }
    setSalvando(true); setErro('');
    try {
      if (modal === 'criar') {
        await api.post('/catalogo', form);
      } else if (editItem) {
        await api.patch(`/catalogo/${editItem.id}`, form);
      }
      setModal(null); resetForm(); setEditItem(null);
      await carregar();
    } catch (e: any) { setErro(e.response?.data?.message ?? 'Erro'); }
    finally { setSalvando(false); }
  };

  const desativar = async (item: CatalogoItem) => {
    Alert.alert('Remover do Catálogo', `Remover ${item.dci}?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: async () => {
        try { await api.delete(`/catalogo/${item.id}`); await carregar(); }
        catch (e: any) { Alert.alert('Erro', e.response?.data?.message ?? 'Erro'); }
      }},
    ]);
  };

  const lista = catalogo.filter(i =>
    i.dci.toLowerCase().includes(search.toLowerCase()) ||
    (i.nomeMarca ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={onVoltar} style={s.voltarBotao}>
          <Text style={s.voltarTexto}>‹  Voltar</Text>
        </TouchableOpacity>
        <View style={s.headerRow}>
          <Text style={s.titulo}>Catálogo</Text>
          {canEdit && (
            <TouchableOpacity style={s.novoBotao} onPress={() => { resetForm(); setErro(''); setModal('criar'); }}>
              <Text style={s.novoTexto}>+ Novo</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={s.searchBox}>
        <TextInput
          style={s.searchInput}
          value={search}
          onChangeText={v => { setSearch(v); carregar(v); }}
          placeholder="Pesquisar por DCI ou nome comercial..."
          placeholderTextColor="#94a3b8"
          returnKeyType="search"
        />
      </View>

      {loading ? (
        <View style={s.centro}><ActivityIndicator size="large" color="#ec4899" /></View>
      ) : (
        <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); carregar(); }} />} style={{ flex: 1 }}>
          <View style={s.lista}>
            {lista.length === 0 ? (
              <View style={s.vazio}><Text style={s.vazioTexto}>Sem resultados</Text></View>
            ) : lista.map(item => (
              <TouchableOpacity key={item.id} style={[s.card, !item.ativo && s.cardInativo]} activeOpacity={canEdit ? 0.7 : 1} onPress={() => canEdit && abrirEditar(item)}>
                <View style={s.cardTopo}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.cardDCI}>{item.dci}</Text>
                    {item.nomeMarca ? <Text style={s.cardMarca}>{item.nomeMarca}</Text> : null}
                    <Text style={s.cardSub}>{item.concentracao ? `${item.concentracao} · ` : ''}{item.unidade}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <View style={s.formaBadge}>
                      <Text style={s.formaTexto}>{FORMA_LABEL[item.formaFarmaceutica] ?? item.formaFarmaceutica}</Text>
                    </View>
                    {!item.ativo && <Text style={s.inativoTexto}>Inactivo</Text>}
                  </View>
                </View>
                <Text style={s.cardClasse}>{item.classeTerap}{item.codigoATC ? ` · ${item.codigoATC}` : ''}</Text>
                {canEdit && item.ativo && (
                  <TouchableOpacity onPress={() => desativar(item)} style={s.eliminarLink}>
                    <Text style={s.eliminarTexto}>Remover do catálogo</Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            ))}
          </View>
          <View style={{ height: 32 }} />
        </ScrollView>
      )}

      <Modal visible={!!modal} transparent animationType="slide" onRequestClose={() => setModal(null)}>
        <View style={s.overlay}>
          <ScrollView style={[s.sheet, { maxHeight: '90%' }]}>
            <View style={s.sheetCab}>
              <Text style={s.sheetTitulo}>{modal === 'criar' ? 'Novo Medicamento' : 'Editar Medicamento'}</Text>
              <TouchableOpacity onPress={() => setModal(null)}><Text style={s.fechar}>✕</Text></TouchableOpacity>
            </View>

            <Text style={s.formLabel}>DCI *</Text>
            <TextInput style={s.input} value={form.dci} onChangeText={v => setForm(f => ({ ...f, dci: v }))} placeholder="Denominação Comum Internacional" placeholderTextColor="#94a3b8" />

            <Text style={s.formLabel}>Nome Comercial</Text>
            <TextInput style={s.input} value={form.nomeMarca} onChangeText={v => setForm(f => ({ ...f, nomeMarca: v }))} placeholder="Nome de marca (opcional)" placeholderTextColor="#94a3b8" />

            <Text style={s.formLabel}>Forma Farmacêutica</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {FORMAS.map(f => (
                  <TouchableOpacity key={f} style={[s.chip, form.formaFarmaceutica === f && s.chipAtivo]} onPress={() => setForm(ff => ({ ...ff, formaFarmaceutica: f }))}>
                    <Text style={[s.chipTexto, form.formaFarmaceutica === f && s.chipTextoAtivo]}>{FORMA_LABEL[f] ?? f}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text style={s.formLabel}>Classe Terapêutica</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {CLASSES.map(c => (
                  <TouchableOpacity key={c} style={[s.chip, form.classeTerap === c && s.chipAtivo]} onPress={() => setForm(ff => ({ ...ff, classeTerap: c }))}>
                    <Text style={[s.chipTexto, form.classeTerap === c && s.chipTextoAtivo]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text style={s.formLabel}>Unidade (mg, ml, UI…)</Text>
            <TextInput style={s.input} value={form.unidade} onChangeText={v => setForm(f => ({ ...f, unidade: v }))} placeholder="mg" placeholderTextColor="#94a3b8" />

            <Text style={s.formLabel}>Concentração</Text>
            <TextInput style={s.input} value={form.concentracao} onChangeText={v => setForm(f => ({ ...f, concentracao: v }))} placeholder="ex: 500mg" placeholderTextColor="#94a3b8" />

            <Text style={s.formLabel}>Código ATC</Text>
            <TextInput style={s.input} value={form.codigoATC} onChangeText={v => setForm(f => ({ ...f, codigoATC: v }))} placeholder="ex: N02BE01" placeholderTextColor="#94a3b8" autoCapitalize="characters" />

            {erro ? <Text style={s.erroTexto}>{erro}</Text> : null}

            <View style={s.botoes}>
              <TouchableOpacity style={s.cancelarBtn} onPress={() => setModal(null)}>
                <Text style={s.cancelarTexto}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.submeterBtn, salvando && { opacity: 0.6 }]} onPress={submeter} disabled={salvando}>
                <Text style={s.submeterTexto}>{salvando ? 'A guardar...' : modal === 'criar' ? 'Adicionar' : 'Guardar'}</Text>
              </TouchableOpacity>
            </View>
            <View style={{ height: 20 }} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { backgroundColor: '#1e293b', padding: 20, paddingTop: 16 },
  voltarBotao: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, marginBottom: 10 },
  voltarTexto: { color: '#fff', fontSize: 12, fontWeight: '600' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  titulo: { fontSize: 20, fontWeight: '700', color: '#fff' },
  novoBotao: { backgroundColor: '#ec4899', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10 },
  novoTexto: { color: '#fff', fontWeight: '700', fontSize: 13 },
  searchBox: { padding: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  searchInput: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, fontSize: 14, color: '#1e293b' },
  lista: { padding: 16, gap: 10 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 1 }, shadowRadius: 6, elevation: 1 },
  cardInativo: { opacity: 0.5 },
  cardTopo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  cardDCI: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  cardMarca: { fontSize: 13, color: '#64748b', marginTop: 1 },
  cardSub: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  cardClasse: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
  formaBadge: { backgroundColor: '#f1f5f9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  formaTexto: { fontSize: 11, fontWeight: '600', color: '#64748b' },
  inativoTexto: { fontSize: 10, color: '#dc2626', fontWeight: '700' },
  eliminarLink: { marginTop: 8 },
  eliminarTexto: { fontSize: 12, color: '#dc2626', textDecorationLine: 'underline' },
  vazio: { backgroundColor: '#fff', borderRadius: 14, padding: 32, alignItems: 'center' },
  vazioTexto: { color: '#94a3b8', fontSize: 14 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  sheetCab: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sheetTitulo: { fontSize: 17, fontWeight: '700', color: '#1e293b' },
  fechar: { fontSize: 18, color: '#94a3b8', fontWeight: '700' },
  formLabel: { fontSize: 13, fontWeight: '600', color: '#475569', marginTop: 12, marginBottom: 6 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#e2e8f0' },
  chipAtivo: { backgroundColor: '#ec4899' },
  chipTexto: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  chipTextoAtivo: { color: '#fff' },
  input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, fontSize: 14, color: '#1e293b' },
  erroTexto: { color: '#dc2626', fontSize: 13, marginTop: 8 },
  botoes: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelarBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#e2e8f0', alignItems: 'center' },
  cancelarTexto: { fontWeight: '600', color: '#64748b', fontSize: 14 },
  submeterBtn: { flex: 2, paddingVertical: 12, borderRadius: 10, backgroundColor: '#ec4899', alignItems: 'center' },
  submeterTexto: { fontWeight: '700', color: '#fff', fontSize: 14 },
});
