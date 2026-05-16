import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, TextInput, ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../lib/api';
import { Utilizador } from '../lib/auth';

interface Props { utilizador: Utilizador; onVoltar: () => void }

interface Ausencia {
  id: string; tipo: string; dataInicio: string; dataFim: string;
  estado: string; observacoes?: string;
  utilizador?: { id: string; nome: string; role: string };
  aprovadoPor?: { id: string; nome: string };
}
interface SaldoFerias { direitoAnual: number; diasUsados: number; diasRestantes: number; anoAtual: number }

const TIPOS = [
  { value: 'ferias', label: 'Férias' },
  { value: 'baixa_medica', label: 'Baixa Médica' },
  { value: 'formacao', label: 'Formação' },
  { value: 'servico_externo', label: 'Serviço Externo' },
  { value: 'licenca', label: 'Licença' },
  { value: 'outro', label: 'Outro' },
];

const ESTADO_COR: Record<string, string> = { pendente: '#d97706', aprovada: '#16a34a', rejeitada: '#dc2626' };
const ESTADO_BG: Record<string, string>  = { pendente: '#fef3c7', aprovada: '#dcfce7', rejeitada: '#fef2f2' };
const ESTADO_LABEL: Record<string, string> = { pendente: 'Pendente', aprovada: 'Aprovada', rejeitada: 'Rejeitada' };

const isChefe = (role: string) => ['chefe_enfermeiros', 'chefe_medicos', 'direcao', 'administrativo'].includes(role);

export default function FeriasScreen({ utilizador, onVoltar }: Props) {
  const [saldo, setSaldo] = useState<SaldoFerias | null>(null);
  const [minhas, setMinhas] = useState<Ausencia[]>([]);
  const [paraAprovar, setParaAprovar] = useState<Ausencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ tipo: 'ferias', dataInicio: '', dataFim: '', observacoes: '' });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const podeAprovar = isChefe(utilizador.role);

  const carregar = async () => {
    try {
      const [sR, mR, aR] = await Promise.all([
        api.get('/rh/saldo-ferias').catch(() => ({ data: null })),
        api.get('/rh/ausencias/minhas'),
        podeAprovar ? api.get('/rh/ausencias/para-aprovar') : Promise.resolve({ data: [] }),
      ]);
      setSaldo(sR.data);
      setMinhas(mR.data ?? []);
      setParaAprovar(aR.data ?? []);
    } catch {} finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { carregar(); }, []));

  const submeter = async () => {
    if (!form.dataInicio || !form.dataFim) { setErro('Preencha as datas'); return; }
    setSalvando(true); setErro('');
    try {
      await api.post('/rh/ausencias', form);
      setModal(false);
      setForm({ tipo: 'ferias', dataInicio: '', dataFim: '', observacoes: '' });
      await carregar();
    } catch (e: any) { setErro(e.response?.data?.message ?? 'Erro ao submeter pedido'); }
    finally { setSalvando(false); }
  };

  const aprovar = async (id: string) => {
    try { await api.patch(`/rh/ausencias/${id}/aprovar`); await carregar(); }
    catch (e: any) { Alert.alert('Erro', e.response?.data?.message ?? 'Erro'); }
  };

  const rejeitar = async (id: string) => {
    Alert.alert('Rejeitar', 'Rejeitar este pedido?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Rejeitar', style: 'destructive', onPress: async () => {
        try { await api.patch(`/rh/ausencias/${id}/rejeitar`); await carregar(); }
        catch (e: any) { Alert.alert('Erro', e.response?.data?.message ?? 'Erro'); }
      }},
    ]);
  };

  const eliminar = async (id: string) => {
    Alert.alert('Eliminar', 'Eliminar este pedido?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        try { await api.delete(`/rh/ausencias/${id}`); await carregar(); }
        catch {}
      }},
    ]);
  };

  const fmt = (d: string) => d ? new Date(d).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '';

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={onVoltar} style={s.voltarBotao}>
          <Text style={s.voltarTexto}>‹  Voltar</Text>
        </TouchableOpacity>
        <View style={s.headerRow}>
          <Text style={s.titulo}>As Minhas Férias</Text>
          <TouchableOpacity style={s.novoBotao} onPress={() => setModal(true)}>
            <Text style={s.novoTexto}>+ Pedir</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={s.centro}><ActivityIndicator size="large" color="#2563eb" /></View>
      ) : (
        <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); carregar(); }} />}>

          {/* Saldo */}
          {saldo && (
            <View style={s.saldoCard}>
              <Text style={s.saldoTitulo}>Saldo de Férias {saldo.anoAtual}</Text>
              <View style={s.saldoRow}>
                <View style={s.saldoItem}>
                  <Text style={s.saldoNum}>{saldo.direitoAnual}</Text>
                  <Text style={s.saldoLabel}>Direito</Text>
                </View>
                <View style={s.saldoItem}>
                  <Text style={[s.saldoNum, { color: '#dc2626' }]}>{saldo.diasUsados}</Text>
                  <Text style={s.saldoLabel}>Usados</Text>
                </View>
                <View style={s.saldoItem}>
                  <Text style={[s.saldoNum, { color: '#16a34a' }]}>{saldo.diasRestantes}</Text>
                  <Text style={s.saldoLabel}>Restantes</Text>
                </View>
              </View>
              <View style={s.barraFundo}>
                <View style={[s.barraPreench, { width: `${Math.min(100, (saldo.diasUsados / saldo.direitoAnual) * 100)}%` as any }]} />
              </View>
            </View>
          )}

          {/* Pedidos para aprovar */}
          {podeAprovar && paraAprovar.length > 0 && (
            <View style={s.secao}>
              <Text style={s.secaoTitulo}>Para Aprovar ({paraAprovar.length})</Text>
              {paraAprovar.map(a => (
                <View key={a.id} style={s.card}>
                  <View style={s.cardTopo}>
                    <View>
                      <Text style={s.cardNome}>{a.utilizador?.nome ?? '—'}</Text>
                      <Text style={s.cardDatas}>{TIPOS.find(t => t.value === a.tipo)?.label ?? a.tipo} · {fmt(a.dataInicio)} – {fmt(a.dataFim)}</Text>
                    </View>
                    <View style={[s.estadoBadge, { backgroundColor: ESTADO_BG[a.estado] }]}>
                      <Text style={[s.estadoTexto, { color: ESTADO_COR[a.estado] }]}>{ESTADO_LABEL[a.estado] ?? a.estado}</Text>
                    </View>
                  </View>
                  {a.estado === 'pendente' && (
                    <View style={s.acoes}>
                      <TouchableOpacity style={s.rejeitarBtn} onPress={() => rejeitar(a.id)}>
                        <Text style={s.rejeitarTexto}>Rejeitar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={s.aprovarBtn} onPress={() => aprovar(a.id)}>
                        <Text style={s.aprovarTexto}>Aprovar</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* Os meus pedidos */}
          <View style={s.secao}>
            <Text style={s.secaoTitulo}>Os Meus Pedidos</Text>
            {minhas.length === 0 ? (
              <View style={s.vazio}><Text style={s.vazioTexto}>Sem pedidos registados</Text></View>
            ) : minhas.map(a => (
              <View key={a.id} style={s.card}>
                <View style={s.cardTopo}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.cardNome}>{TIPOS.find(t => t.value === a.tipo)?.label ?? a.tipo}</Text>
                    <Text style={s.cardDatas}>{fmt(a.dataInicio)} – {fmt(a.dataFim)}</Text>
                    {a.observacoes ? <Text style={s.cardObs}>{a.observacoes}</Text> : null}
                  </View>
                  <View style={[s.estadoBadge, { backgroundColor: ESTADO_BG[a.estado] }]}>
                    <Text style={[s.estadoTexto, { color: ESTADO_COR[a.estado] }]}>{ESTADO_LABEL[a.estado] ?? a.estado}</Text>
                  </View>
                </View>
                {a.estado === 'pendente' && (
                  <TouchableOpacity onPress={() => eliminar(a.id)} style={s.eliminarLink}>
                    <Text style={s.eliminarTexto}>Eliminar pedido</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>

          <View style={{ height: 32 }} />
        </ScrollView>
      )}

      <Modal visible={modal} transparent animationType="slide" onRequestClose={() => setModal(false)}>
        <View style={s.overlay}>
          <ScrollView style={[s.sheet, { maxHeight: '85%' }]}>
            <View style={s.sheetCab}>
              <Text style={s.sheetTitulo}>Novo Pedido</Text>
              <TouchableOpacity onPress={() => setModal(false)}><Text style={s.fechar}>✕</Text></TouchableOpacity>
            </View>

            <Text style={s.formLabel}>Tipo</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {TIPOS.map(t => (
                  <TouchableOpacity key={t.value} style={[s.chip, form.tipo === t.value && s.chipAtivo]} onPress={() => setForm(f => ({ ...f, tipo: t.value }))}>
                    <Text style={[s.chipTexto, form.tipo === t.value && s.chipTextoAtivo]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text style={s.formLabel}>Data Início (AAAA-MM-DD)</Text>
            <TextInput style={s.input} value={form.dataInicio} onChangeText={v => setForm(f => ({ ...f, dataInicio: v }))} placeholder="2025-07-01" placeholderTextColor="#94a3b8" />

            <Text style={s.formLabel}>Data Fim (AAAA-MM-DD)</Text>
            <TextInput style={s.input} value={form.dataFim} onChangeText={v => setForm(f => ({ ...f, dataFim: v }))} placeholder="2025-07-15" placeholderTextColor="#94a3b8" />

            <Text style={s.formLabel}>Observações (opcional)</Text>
            <TextInput style={[s.input, { height: 80 }]} value={form.observacoes} onChangeText={v => setForm(f => ({ ...f, observacoes: v }))} placeholder="..." placeholderTextColor="#94a3b8" multiline />

            {erro ? <Text style={s.erroTexto}>{erro}</Text> : null}

            <View style={s.botoes}>
              <TouchableOpacity style={s.cancelarBtn} onPress={() => setModal(false)}>
                <Text style={s.cancelarTexto}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.submeterBtn, salvando && { opacity: 0.6 }]} onPress={submeter} disabled={salvando}>
                <Text style={s.submeterTexto}>{salvando ? 'A enviar...' : 'Submeter'}</Text>
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
  novoBotao: { backgroundColor: '#0ea5e9', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10 },
  novoTexto: { color: '#fff', fontWeight: '700', fontSize: 13 },
  saldoCard: { margin: 16, backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 2 },
  saldoTitulo: { fontSize: 14, fontWeight: '700', color: '#1e293b', marginBottom: 12 },
  saldoRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 12 },
  saldoItem: { alignItems: 'center' },
  saldoNum: { fontSize: 28, fontWeight: '800', color: '#1e293b' },
  saldoLabel: { fontSize: 12, color: '#64748b', marginTop: 2 },
  barraFundo: { height: 8, backgroundColor: '#e2e8f0', borderRadius: 4 },
  barraPreench: { height: 8, backgroundColor: '#dc2626', borderRadius: 4 },
  secao: { paddingHorizontal: 16, marginBottom: 8 },
  secaoTitulo: { fontSize: 11, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10, marginTop: 8 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 1 }, shadowRadius: 6, elevation: 1 },
  cardTopo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardNome: { fontSize: 14, fontWeight: '700', color: '#1e293b', marginBottom: 2 },
  cardDatas: { fontSize: 13, color: '#64748b' },
  cardObs: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
  estadoBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  estadoTexto: { fontSize: 11, fontWeight: '700' },
  acoes: { flexDirection: 'row', gap: 8, marginTop: 10 },
  rejeitarBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: '#fef2f2', alignItems: 'center' },
  rejeitarTexto: { color: '#dc2626', fontWeight: '700', fontSize: 13 },
  aprovarBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: '#dcfce7', alignItems: 'center' },
  aprovarTexto: { color: '#16a34a', fontWeight: '700', fontSize: 13 },
  eliminarLink: { marginTop: 8 },
  eliminarTexto: { fontSize: 12, color: '#dc2626', textDecorationLine: 'underline' },
  vazio: { backgroundColor: '#fff', borderRadius: 14, padding: 24, alignItems: 'center' },
  vazioTexto: { color: '#94a3b8', fontSize: 14 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  sheetCab: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sheetTitulo: { fontSize: 17, fontWeight: '700', color: '#1e293b' },
  fechar: { fontSize: 18, color: '#94a3b8', fontWeight: '700' },
  formLabel: { fontSize: 13, fontWeight: '600', color: '#475569', marginTop: 12, marginBottom: 6 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#e2e8f0' },
  chipAtivo: { backgroundColor: '#2563eb' },
  chipTexto: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  chipTextoAtivo: { color: '#fff' },
  input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, fontSize: 14, color: '#1e293b' },
  erroTexto: { color: '#dc2626', fontSize: 13, marginTop: 8 },
  botoes: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelarBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#e2e8f0', alignItems: 'center' },
  cancelarTexto: { fontWeight: '600', color: '#64748b', fontSize: 14 },
  submeterBtn: { flex: 2, paddingVertical: 12, borderRadius: 10, backgroundColor: '#2563eb', alignItems: 'center' },
  submeterTexto: { fontWeight: '700', color: '#fff', fontSize: 14 },
});
