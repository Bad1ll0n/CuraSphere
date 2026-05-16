import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, TextInput, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../lib/api';
import { Utilizador } from '../lib/auth';

interface Props { utilizador: Utilizador; onVoltar: () => void }

interface Sessao {
  id: string; tipo: string; estado: string; data: string; duracao: number;
  descricao?: string; evolucao?: string;
  doente?: { id: string; nome: string };
}

const SUBROLE_TITULO: Record<string, string> = {
  nutricao_clinica:   'Nutrição Clínica',
  psicologia_clinica: 'Psicologia Clínica',
  reabilitacao_fala:  'Terapia da Fala',
  tae:                'TAE',
};

const ESTADO_COR: Record<string, string>   = { agendada: '#2563eb', realizada: '#16a34a', cancelada: '#64748b', faltou: '#d97706' };
const ESTADO_BG: Record<string, string>    = { agendada: '#eff6ff', realizada: '#dcfce7', cancelada: '#f1f5f9', faltou: '#fef3c7' };
const ESTADO_LABEL: Record<string, string> = { agendada: 'Agendada', realizada: 'Realizada', cancelada: 'Cancelada', faltou: 'Faltou' };

export default function EspecialidadesScreen({ utilizador, onVoltar }: Props) {
  const [sessoes, setSessoes] = useState<Sessao[]>([]);
  const [doentes, setDoentes] = useState<{ id: string; nome: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modal, setModal] = useState<'nova' | 'evolucao' | null>(null);
  const [sessaoSel, setSessaoSel] = useState<Sessao | null>(null);
  const [form, setForm] = useState({ doenteId: '', tipo: '', data: '', duracao: '60', descricao: '' });
  const [evolucaoTexto, setEvolucaoTexto] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const titulo = SUBROLE_TITULO[utilizador.subRole ?? ''] ?? 'Especialidades';

  const carregar = async () => {
    try {
      const [sR, dR] = await Promise.all([
        api.get('/especialidades/sessoes'),
        api.get('/doentes').catch(() => ({ data: { data: [] } })),
      ]);
      setSessoes(sR.data ?? []);
      const dts = dR.data?.data ?? dR.data ?? [];
      setDoentes(Array.isArray(dts) ? dts.map((x: any) => ({ id: x.id, nome: x.nome })) : []);
    } catch {} finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { carregar(); }, []));

  const submeterNova = async () => {
    if (!form.doenteId || !form.data) { setErro('Selecione o doente e a data'); return; }
    setSalvando(true); setErro('');
    try {
      await api.post('/especialidades/sessoes', { ...form, duracao: Number(form.duracao) });
      setModal(null);
      setForm({ doenteId: '', tipo: '', data: '', duracao: '60', descricao: '' });
      await carregar();
    } catch (e: any) { setErro(e.response?.data?.message ?? 'Erro'); }
    finally { setSalvando(false); }
  };

  const submeterEvolucao = async () => {
    if (!sessaoSel || !evolucaoTexto.trim()) return;
    setSalvando(true);
    try {
      await api.patch(`/especialidades/sessoes/${sessaoSel.id}`, { evolucao: evolucaoTexto, estado: 'realizada' });
      setModal(null); setSessaoSel(null); setEvolucaoTexto('');
      await carregar();
    } catch (e: any) { setErro(e.response?.data?.message ?? 'Erro'); }
    finally { setSalvando(false); }
  };

  const fmt = (d: string) => new Date(d).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={onVoltar} style={s.voltarBotao}>
          <Text style={s.voltarTexto}>‹  Voltar</Text>
        </TouchableOpacity>
        <View style={s.headerRow}>
          <Text style={s.titulo}>{titulo}</Text>
          <TouchableOpacity style={s.novoBotao} onPress={() => setModal('nova')}>
            <Text style={s.novoTexto}>+ Nova</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={s.centro}><ActivityIndicator size="large" color="#14b8a6" /></View>
      ) : (
        <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); carregar(); }} />} style={{ flex: 1 }}>
          <View style={s.lista}>
            {sessoes.length === 0 ? (
              <View style={s.vazio}><Text style={s.vazioTexto}>Sem sessões registadas</Text></View>
            ) : sessoes.map(s2 => (
              <TouchableOpacity key={s2.id} style={s.card} activeOpacity={0.7}
                onPress={() => { if (s2.estado === 'agendada') { setSessaoSel(s2); setEvolucaoTexto(s2.evolucao ?? ''); setModal('evolucao'); } }}>
                <View style={s.cardTopo}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.cardTipo}>{s2.tipo || titulo}</Text>
                    <Text style={s.cardDoente}>{s2.doente?.nome ?? '—'}</Text>
                    <Text style={s.cardData}>{fmt(s2.data)} · {s2.duracao} min</Text>
                  </View>
                  <View style={[s.estadoBadge, { backgroundColor: ESTADO_BG[s2.estado] }]}>
                    <Text style={[s.estadoTexto, { color: ESTADO_COR[s2.estado] }]}>{ESTADO_LABEL[s2.estado]}</Text>
                  </View>
                </View>
                {s2.descricao ? <Text style={s.cardDesc}>{s2.descricao}</Text> : null}
                {s2.evolucao ? (
                  <View style={s.evolucaoBox}>
                    <Text style={s.evolucaoLabel}>Evolução:</Text>
                    <Text style={s.evolucaoTexto}>{s2.evolucao}</Text>
                  </View>
                ) : null}
                {s2.estado === 'agendada' && <Text style={s.editarHint}>Toque para registar evolução</Text>}
              </TouchableOpacity>
            ))}
          </View>
          <View style={{ height: 32 }} />
        </ScrollView>
      )}

      {/* Modal Nova Sessão */}
      <Modal visible={modal === 'nova'} transparent animationType="slide" onRequestClose={() => setModal(null)}>
        <View style={s.overlay}>
          <ScrollView style={[s.sheet, { maxHeight: '85%' }]}>
            <View style={s.sheetCab}>
              <Text style={s.sheetTitulo}>Nova Sessão</Text>
              <TouchableOpacity onPress={() => setModal(null)}><Text style={s.fechar}>✕</Text></TouchableOpacity>
            </View>

            <Text style={s.formLabel}>Doente</Text>
            <ScrollView style={{ maxHeight: 120, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10 }}>
              {doentes.map(d => (
                <TouchableOpacity key={d.id} style={[s.listItem, form.doenteId === d.id && s.listItemAtivo]} onPress={() => setForm(f => ({ ...f, doenteId: d.id }))}>
                  <Text style={[s.listItemTexto, form.doenteId === d.id && { color: '#14b8a6' }]}>{d.nome}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={s.formLabel}>Tipo de Sessão</Text>
            <TextInput style={s.input} value={form.tipo} onChangeText={v => setForm(f => ({ ...f, tipo: v }))} placeholder={titulo} placeholderTextColor="#94a3b8" />

            <Text style={s.formLabel}>Data (AAAA-MM-DDTHH:MM)</Text>
            <TextInput style={s.input} value={form.data} onChangeText={v => setForm(f => ({ ...f, data: v }))} placeholder="2025-07-01T10:00" placeholderTextColor="#94a3b8" />

            <Text style={s.formLabel}>Duração (min)</Text>
            <TextInput style={s.input} value={form.duracao} onChangeText={v => setForm(f => ({ ...f, duracao: v }))} keyboardType="numeric" placeholder="60" placeholderTextColor="#94a3b8" />

            <Text style={s.formLabel}>Descrição (opcional)</Text>
            <TextInput style={[s.input, { height: 80 }]} value={form.descricao} onChangeText={v => setForm(f => ({ ...f, descricao: v }))} placeholder="Notas iniciais..." placeholderTextColor="#94a3b8" multiline />

            {erro ? <Text style={s.erroTexto}>{erro}</Text> : null}

            <View style={s.botoes}>
              <TouchableOpacity style={s.cancelarBtn} onPress={() => setModal(null)}>
                <Text style={s.cancelarTexto}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.submeterBtn, salvando && { opacity: 0.6 }]} onPress={submeterNova} disabled={salvando}>
                <Text style={s.submeterTexto}>{salvando ? 'A criar...' : 'Criar'}</Text>
              </TouchableOpacity>
            </View>
            <View style={{ height: 20 }} />
          </ScrollView>
        </View>
      </Modal>

      {/* Modal Evolução */}
      <Modal visible={modal === 'evolucao'} transparent animationType="slide" onRequestClose={() => setModal(null)}>
        <View style={s.overlay}>
          <View style={[s.sheet, { maxHeight: '65%' }]}>
            <View style={s.sheetCab}>
              <Text style={s.sheetTitulo}>Registar Evolução</Text>
              <TouchableOpacity onPress={() => setModal(null)}><Text style={s.fechar}>✕</Text></TouchableOpacity>
            </View>
            {sessaoSel && <Text style={s.sessaoInfo}>{sessaoSel.doente?.nome} · {fmt(sessaoSel.data)}</Text>}
            <Text style={s.formLabel}>Evolução clínica</Text>
            <TextInput style={[s.input, { height: 120 }]} value={evolucaoTexto} onChangeText={setEvolucaoTexto} placeholder="Descreva a evolução da sessão..." placeholderTextColor="#94a3b8" multiline />
            {erro ? <Text style={s.erroTexto}>{erro}</Text> : null}
            <View style={s.botoes}>
              <TouchableOpacity style={s.cancelarBtn} onPress={() => setModal(null)}>
                <Text style={s.cancelarTexto}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.submeterBtn, salvando && { opacity: 0.6 }]} onPress={submeterEvolucao} disabled={salvando}>
                <Text style={s.submeterTexto}>{salvando ? 'A guardar...' : 'Guardar'}</Text>
              </TouchableOpacity>
            </View>
          </View>
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
  novoBotao: { backgroundColor: '#14b8a6', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10 },
  novoTexto: { color: '#fff', fontWeight: '700', fontSize: 13 },
  lista: { padding: 16, gap: 12 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 1 }, shadowRadius: 6, elevation: 1 },
  cardTopo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  cardTipo: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  cardDoente: { fontSize: 13, color: '#475569', marginTop: 2 },
  cardData: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  cardDesc: { fontSize: 13, color: '#64748b', marginBottom: 4 },
  estadoBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  estadoTexto: { fontSize: 11, fontWeight: '700' },
  evolucaoBox: { marginTop: 8, backgroundColor: '#f0fdf4', borderRadius: 8, padding: 10, borderLeftWidth: 3, borderLeftColor: '#14b8a6' },
  evolucaoLabel: { fontSize: 11, fontWeight: '700', color: '#14b8a6', marginBottom: 2 },
  evolucaoTexto: { fontSize: 13, color: '#475569' },
  editarHint: { fontSize: 11, color: '#94a3b8', marginTop: 6, textAlign: 'right' },
  vazio: { backgroundColor: '#fff', borderRadius: 14, padding: 32, alignItems: 'center' },
  vazioTexto: { color: '#94a3b8', fontSize: 14 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  sheetCab: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sheetTitulo: { fontSize: 17, fontWeight: '700', color: '#1e293b' },
  fechar: { fontSize: 18, color: '#94a3b8', fontWeight: '700' },
  sessaoInfo: { fontSize: 13, color: '#64748b', marginBottom: 8 },
  formLabel: { fontSize: 13, fontWeight: '600', color: '#475569', marginTop: 12, marginBottom: 6 },
  input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, fontSize: 14, color: '#1e293b' },
  listItem: { paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  listItemAtivo: { backgroundColor: '#f0fdf4' },
  listItemTexto: { fontSize: 14, color: '#1e293b' },
  erroTexto: { color: '#dc2626', fontSize: 13, marginTop: 8 },
  botoes: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelarBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#e2e8f0', alignItems: 'center' },
  cancelarTexto: { fontWeight: '600', color: '#64748b', fontSize: 14 },
  submeterBtn: { flex: 2, paddingVertical: 12, borderRadius: 10, backgroundColor: '#14b8a6', alignItems: 'center' },
  submeterTexto: { fontWeight: '700', color: '#fff', fontSize: 14 },
});
