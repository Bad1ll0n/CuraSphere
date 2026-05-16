import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, TextInput, ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../lib/api';
import { Utilizador } from '../lib/auth';

interface Props { utilizador: Utilizador; onVoltar: () => void }

interface Interconsulta {
  id: string; especialidadeAlvo: string; motivo: string; urgente: boolean;
  estado: 'pendente' | 'aceite' | 'respondida' | 'cancelada'; criadaEm: string;
  resposta?: string; respondidaEm?: string;
  doente: { id: string; nome: string };
  requisitante: { id: string; nome: string };
  medicoResposta?: { id: string; nome: string };
}

const ESPECIALIDADES = [
  'Cardiologia', 'Neurologia', 'Pneumologia', 'Nefrologia', 'Gastroenterologia',
  'Endocrinologia', 'Ortopedia', 'Cirurgia Geral', 'Urologia', 'Medicina Interna',
  'Hematologia', 'Oncologia', 'Psiquiatria', 'Dermatologia',
];

const ESTADO_COR: Record<string, string>   = { pendente: '#d97706', aceite: '#2563eb', respondida: '#16a34a', cancelada: '#64748b' };
const ESTADO_BG: Record<string, string>    = { pendente: '#fef3c7', aceite: '#eff6ff', respondida: '#dcfce7', cancelada: '#f1f5f9' };
const ESTADO_LABEL: Record<string, string> = { pendente: 'Pendente', aceite: 'Aceite', respondida: 'Respondida', cancelada: 'Cancelada' };

export default function InterconsultasScreen({ utilizador, onVoltar }: Props) {
  const [recebidas, setRecebidas] = useState<Interconsulta[]>([]);
  const [enviadas, setEnviadas] = useState<Interconsulta[]>([]);
  const [aba, setAba] = useState<'recebidas' | 'enviadas'>('recebidas');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalNova, setModalNova] = useState(false);
  const [modalResposta, setModalResposta] = useState<string | null>(null);
  const [textoResposta, setTextoResposta] = useState('');
  const [doentes, setDoentes] = useState<{ id: string; nome: string }[]>([]);
  const [form, setForm] = useState({ doenteId: '', especialidadeAlvo: 'Cardiologia', motivo: '', urgente: false });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const carregar = async () => {
    try {
      const [rR, dR] = await Promise.all([
        api.get('/interconsultas'),
        api.get('/doentes').catch(() => ({ data: { data: [] } })),
      ]);
      const d = rR.data ?? {};
      setRecebidas(d.recebidas ?? []);
      setEnviadas(d.enviadas ?? []);
      const dts = dR.data?.data ?? dR.data ?? [];
      setDoentes(Array.isArray(dts) ? dts.map((x: any) => ({ id: x.id, nome: x.nome })) : []);
    } catch {} finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { carregar(); }, []));

  const submeter = async () => {
    if (!form.doenteId || !form.motivo.trim()) { setErro('Preencha o doente e o motivo'); return; }
    setSalvando(true); setErro('');
    try {
      await api.post('/interconsultas', form);
      setModalNova(false);
      setForm({ doenteId: '', especialidadeAlvo: 'Cardiologia', motivo: '', urgente: false });
      await carregar();
    } catch (e: any) { setErro(e.response?.data?.message ?? 'Erro'); }
    finally { setSalvando(false); }
  };

  const responder = async () => {
    if (!textoResposta.trim() || !modalResposta) return;
    try {
      await api.patch(`/interconsultas/${modalResposta}/responder`, { resposta: textoResposta });
      setModalResposta(null); setTextoResposta('');
      await carregar();
    } catch (e: any) { Alert.alert('Erro', e.response?.data?.message ?? 'Erro'); }
  };

  const aceitar = async (id: string) => {
    try { await api.patch(`/interconsultas/${id}/aceitar`); await carregar(); }
    catch (e: any) { Alert.alert('Erro', e.response?.data?.message ?? 'Erro'); }
  };

  const lista = aba === 'recebidas' ? recebidas : enviadas;
  const fmt = (d: string) => new Date(d).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: '2-digit' });

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={onVoltar} style={s.voltarBotao}>
          <Text style={s.voltarTexto}>‹  Voltar</Text>
        </TouchableOpacity>
        <View style={s.headerRow}>
          <Text style={s.titulo}>Interconsultas</Text>
          <TouchableOpacity style={s.novoBotao} onPress={() => setModalNova(true)}>
            <Text style={s.novoTexto}>+ Nova</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Abas */}
      <View style={s.abas}>
        {(['recebidas', 'enviadas'] as const).map(a => (
          <TouchableOpacity key={a} style={[s.aba, aba === a && s.abaAtiva]} onPress={() => setAba(a)}>
            <Text style={[s.abaTexto, aba === a && s.abaTextoAtivo]}>
              {a === 'recebidas' ? `Recebidas (${recebidas.length})` : `Enviadas (${enviadas.length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={s.centro}><ActivityIndicator size="large" color="#8b5cf6" /></View>
      ) : (
        <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); carregar(); }} />} style={{ flex: 1 }}>
          <View style={s.lista}>
            {lista.length === 0 ? (
              <View style={s.vazio}><Text style={s.vazioTexto}>Sem interconsultas</Text></View>
            ) : lista.map(ic => (
              <View key={ic.id} style={[s.card, ic.urgente && { borderLeftWidth: 4, borderLeftColor: '#dc2626' }]}>
                <View style={s.cardTopo}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={s.cardEsp}>{ic.especialidadeAlvo}</Text>
                      {ic.urgente && <Text style={s.urgenteBadge}>URGENTE</Text>}
                    </View>
                    <Text style={s.cardDoente}>{ic.doente.nome}</Text>
                    <Text style={s.cardMotivo}>{ic.motivo}</Text>
                  </View>
                  <View style={[s.estadoBadge, { backgroundColor: ESTADO_BG[ic.estado] }]}>
                    <Text style={[s.estadoTexto, { color: ESTADO_COR[ic.estado] }]}>{ESTADO_LABEL[ic.estado]}</Text>
                  </View>
                </View>
                <View style={s.cardRodape}>
                  <Text style={s.cardInfo}>Por {ic.requisitante.nome.split(' ')[0]} · {fmt(ic.criadaEm)}</Text>
                </View>
                {ic.resposta && (
                  <View style={s.respostaBox}>
                    <Text style={s.respostaLabel}>Resposta de {ic.medicoResposta?.nome.split(' ')[0]}:</Text>
                    <Text style={s.respostaTexto}>{ic.resposta}</Text>
                  </View>
                )}
                {aba === 'recebidas' && ic.estado === 'pendente' && (
                  <TouchableOpacity style={s.acaoBtn} onPress={() => aceitar(ic.id)}>
                    <Text style={s.acaoTexto}>Aceitar</Text>
                  </TouchableOpacity>
                )}
                {aba === 'recebidas' && ic.estado === 'aceite' && (
                  <TouchableOpacity style={[s.acaoBtn, { backgroundColor: '#dcfce7' }]} onPress={() => { setModalResposta(ic.id); setTextoResposta(''); }}>
                    <Text style={[s.acaoTexto, { color: '#16a34a' }]}>Responder</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
          <View style={{ height: 32 }} />
        </ScrollView>
      )}

      {/* Modal Nova Interconsulta */}
      <Modal visible={modalNova} transparent animationType="slide" onRequestClose={() => setModalNova(false)}>
        <View style={s.overlay}>
          <ScrollView style={[s.sheet, { maxHeight: '90%' }]}>
            <View style={s.sheetCab}>
              <Text style={s.sheetTitulo}>Nova Interconsulta</Text>
              <TouchableOpacity onPress={() => setModalNova(false)}><Text style={s.fechar}>✕</Text></TouchableOpacity>
            </View>

            <Text style={s.formLabel}>Doente</Text>
            <ScrollView style={{ maxHeight: 120, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, marginBottom: 4 }}>
              {doentes.map(d => (
                <TouchableOpacity key={d.id} style={[s.listItem, form.doenteId === d.id && s.listItemAtivo]} onPress={() => setForm(f => ({ ...f, doenteId: d.id }))}>
                  <Text style={[s.listItemTexto, form.doenteId === d.id && { color: '#2563eb' }]}>{d.nome}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={s.formLabel}>Especialidade</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {ESPECIALIDADES.map(e => (
                  <TouchableOpacity key={e} style={[s.chip, form.especialidadeAlvo === e && s.chipAtivo]} onPress={() => setForm(f => ({ ...f, especialidadeAlvo: e }))}>
                    <Text style={[s.chipTexto, form.especialidadeAlvo === e && s.chipTextoAtivo]}>{e}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text style={s.formLabel}>Motivo</Text>
            <TextInput style={[s.input, { height: 80 }]} value={form.motivo} onChangeText={v => setForm(f => ({ ...f, motivo: v }))} placeholder="Descreva o motivo da interconsulta..." placeholderTextColor="#94a3b8" multiline />

            <TouchableOpacity style={s.toggleRow} onPress={() => setForm(f => ({ ...f, urgente: !f.urgente }))}>
              <View style={[s.toggle, form.urgente && s.toggleAtivo]} />
              <Text style={s.toggleLabel}>Urgente</Text>
            </TouchableOpacity>

            {erro ? <Text style={s.erroTexto}>{erro}</Text> : null}

            <View style={s.botoes}>
              <TouchableOpacity style={s.cancelarBtn} onPress={() => setModalNova(false)}>
                <Text style={s.cancelarTexto}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.submeterBtn, salvando && { opacity: 0.6 }]} onPress={submeter} disabled={salvando}>
                <Text style={s.submeterTexto}>{salvando ? 'A enviar...' : 'Enviar'}</Text>
              </TouchableOpacity>
            </View>
            <View style={{ height: 20 }} />
          </ScrollView>
        </View>
      </Modal>

      {/* Modal Resposta */}
      <Modal visible={!!modalResposta} transparent animationType="slide" onRequestClose={() => setModalResposta(null)}>
        <View style={s.overlay}>
          <View style={[s.sheet, { maxHeight: '60%' }]}>
            <View style={s.sheetCab}>
              <Text style={s.sheetTitulo}>Responder Interconsulta</Text>
              <TouchableOpacity onPress={() => setModalResposta(null)}><Text style={s.fechar}>✕</Text></TouchableOpacity>
            </View>
            <Text style={s.formLabel}>Resposta</Text>
            <TextInput style={[s.input, { height: 120 }]} value={textoResposta} onChangeText={setTextoResposta} placeholder="Escreva a sua resposta clínica..." placeholderTextColor="#94a3b8" multiline />
            <View style={s.botoes}>
              <TouchableOpacity style={s.cancelarBtn} onPress={() => setModalResposta(null)}>
                <Text style={s.cancelarTexto}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.submeterBtn} onPress={responder}>
                <Text style={s.submeterTexto}>Enviar Resposta</Text>
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
  novoBotao: { backgroundColor: '#8b5cf6', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10 },
  novoTexto: { color: '#fff', fontWeight: '700', fontSize: 13 },
  abas: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  aba: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  abaAtiva: { borderBottomWidth: 2, borderBottomColor: '#8b5cf6' },
  abaTexto: { fontSize: 14, fontWeight: '600', color: '#94a3b8' },
  abaTextoAtivo: { color: '#8b5cf6' },
  lista: { padding: 16, gap: 12 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 1 }, shadowRadius: 6, elevation: 1 },
  cardTopo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  cardEsp: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  urgenteBadge: { fontSize: 10, fontWeight: '800', color: '#dc2626', backgroundColor: '#fef2f2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  cardDoente: { fontSize: 13, color: '#475569', marginTop: 2 },
  cardMotivo: { fontSize: 13, color: '#64748b', marginTop: 4, lineHeight: 18 },
  estadoBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  estadoTexto: { fontSize: 11, fontWeight: '700' },
  cardRodape: { marginTop: 8 },
  cardInfo: { fontSize: 12, color: '#94a3b8' },
  respostaBox: { marginTop: 10, backgroundColor: '#f8fafc', borderRadius: 8, padding: 10, borderLeftWidth: 3, borderLeftColor: '#16a34a' },
  respostaLabel: { fontSize: 12, fontWeight: '700', color: '#16a34a', marginBottom: 4 },
  respostaTexto: { fontSize: 13, color: '#475569' },
  acaoBtn: { marginTop: 10, backgroundColor: '#eff6ff', paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  acaoTexto: { color: '#2563eb', fontWeight: '700', fontSize: 13 },
  vazio: { backgroundColor: '#fff', borderRadius: 14, padding: 32, alignItems: 'center' },
  vazioTexto: { color: '#94a3b8', fontSize: 14 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  sheetCab: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sheetTitulo: { fontSize: 17, fontWeight: '700', color: '#1e293b' },
  fechar: { fontSize: 18, color: '#94a3b8', fontWeight: '700' },
  formLabel: { fontSize: 13, fontWeight: '600', color: '#475569', marginTop: 12, marginBottom: 6 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#e2e8f0' },
  chipAtivo: { backgroundColor: '#8b5cf6' },
  chipTexto: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  chipTextoAtivo: { color: '#fff' },
  input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, fontSize: 14, color: '#1e293b' },
  listItem: { paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  listItemAtivo: { backgroundColor: '#eff6ff' },
  listItemTexto: { fontSize: 14, color: '#1e293b' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  toggle: { width: 44, height: 24, borderRadius: 12, backgroundColor: '#e2e8f0' },
  toggleAtivo: { backgroundColor: '#dc2626' },
  toggleLabel: { fontSize: 14, fontWeight: '600', color: '#475569' },
  erroTexto: { color: '#dc2626', fontSize: 13, marginTop: 8 },
  botoes: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelarBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#e2e8f0', alignItems: 'center' },
  cancelarTexto: { fontWeight: '600', color: '#64748b', fontSize: 14 },
  submeterBtn: { flex: 2, paddingVertical: 12, borderRadius: 10, backgroundColor: '#8b5cf6', alignItems: 'center' },
  submeterTexto: { fontWeight: '700', color: '#fff', fontSize: 14 },
});
