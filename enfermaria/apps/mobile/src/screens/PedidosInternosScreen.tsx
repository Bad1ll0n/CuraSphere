import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, TextInput, ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../lib/api';
import { Utilizador } from '../lib/auth';

interface Props { utilizador: Utilizador; onVoltar: () => void }

interface PedidoInterno {
  id: string; tipo: string; descricao: string; prioridade: string; estado: string;
  localOrigem?: string; localDestino?: string; criadoEm: string;
  solicitadoPor: { id: string; nome: string };
  executadoPor?: { id: string; nome: string };
}

const PRIORIDADE_COR: Record<string, string> = { urgente: '#dc2626', alta: '#f97316', media: '#3b82f6', baixa: '#64748b' };
const PRIORIDADE_BG: Record<string, string>  = { urgente: '#fef2f2', alta: '#fff7ed', media: '#eff6ff', baixa: '#f8fafc' };
const PRIORIDADE_LABEL: Record<string, string> = { urgente: 'Urgente', alta: 'Alta', media: 'Média', baixa: 'Baixa' };

const ESTADO_COR: Record<string, string> = { pendente: '#d97706', em_curso: '#2563eb', concluido: '#16a34a', cancelado: '#64748b' };
const ESTADO_BG: Record<string, string>  = { pendente: '#fef3c7', em_curso: '#eff6ff', concluido: '#dcfce7', cancelado: '#f1f5f9' };
const ESTADO_LABEL: Record<string, string> = { pendente: 'Pendente', em_curso: 'Em Curso', concluido: 'Concluído', cancelado: 'Cancelado' };

const TIPOS = ['transporte', 'esterilizacao', 'equipamento', 'limpeza'];
const TIPO_LABEL: Record<string, string> = { transporte: 'Transporte', esterilizacao: 'Esterilização', equipamento: 'Equipamento', limpeza: 'Limpeza' };
const PRIORIDADES = ['baixa', 'media', 'alta', 'urgente'];

export default function PedidosInternosScreen({ utilizador, onVoltar }: Props) {
  const [pedidos, setPedidos] = useState<PedidoInterno[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filtro, setFiltro] = useState('todos');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ tipo: 'transporte', descricao: '', prioridade: 'media', localOrigem: '', localDestino: '' });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const eOperacional = utilizador.role === 'operacional';

  const carregar = async () => {
    try {
      const { data } = await api.get('/pedidos-internos');
      setPedidos(data ?? []);
    } catch {} finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { carregar(); }, []));

  const submeter = async () => {
    if (!form.descricao.trim()) { setErro('Preencha a descrição'); return; }
    setSalvando(true); setErro('');
    try {
      await api.post('/pedidos-internos', form);
      setModal(false);
      setForm({ tipo: 'transporte', descricao: '', prioridade: 'media', localOrigem: '', localDestino: '' });
      await carregar();
    } catch (e: any) { setErro(e.response?.data?.message ?? 'Erro ao criar pedido'); }
    finally { setSalvando(false); }
  };

  const aceitar = async (id: string) => {
    try { await api.patch(`/pedidos-internos/${id}/aceitar`); await carregar(); }
    catch (e: any) { Alert.alert('Erro', e.response?.data?.message ?? 'Erro'); }
  };

  const concluir = async (id: string) => {
    try { await api.patch(`/pedidos-internos/${id}/concluir`); await carregar(); }
    catch (e: any) { Alert.alert('Erro', e.response?.data?.message ?? 'Erro'); }
  };

  const filtros = ['todos', 'pendente', 'em_curso', 'concluido'];
  const pedidosFiltrados = filtro === 'todos' ? pedidos : pedidos.filter(p => p.estado === filtro);

  const fmt = (d: string) => new Date(d).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={onVoltar} style={s.voltarBotao}>
          <Text style={s.voltarTexto}>‹  Voltar</Text>
        </TouchableOpacity>
        <View style={s.headerRow}>
          <Text style={s.titulo}>Pedidos Internos</Text>
          <TouchableOpacity style={s.novoBotao} onPress={() => setModal(true)}>
            <Text style={s.novoTexto}>+ Novo</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Filtros */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filtrosScroll}>
        <View style={s.filtrosRow}>
          {filtros.map(f => (
            <TouchableOpacity key={f} style={[s.filtroChip, filtro === f && s.filtroChipAtivo]} onPress={() => setFiltro(f)}>
              <Text style={[s.filtroTexto, filtro === f && s.filtroTextoAtivo]}>
                {f === 'todos' ? 'Todos' : ESTADO_LABEL[f]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {loading ? (
        <View style={s.centro}><ActivityIndicator size="large" color="#f97316" /></View>
      ) : (
        <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); carregar(); }} />} style={{ flex: 1 }}>
          <View style={s.lista}>
            {pedidosFiltrados.length === 0 ? (
              <View style={s.vazio}><Text style={s.vazioTexto}>Sem pedidos</Text></View>
            ) : pedidosFiltrados.map(p => (
              <View key={p.id} style={[s.card, { borderLeftColor: PRIORIDADE_COR[p.prioridade] }]}>
                <View style={s.cardTopo}>
                  <Text style={s.cardTipo}>{TIPO_LABEL[p.tipo] ?? p.tipo}</Text>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <View style={[s.badge, { backgroundColor: PRIORIDADE_BG[p.prioridade] }]}>
                      <Text style={[s.badgeTexto, { color: PRIORIDADE_COR[p.prioridade] }]}>{PRIORIDADE_LABEL[p.prioridade]}</Text>
                    </View>
                    <View style={[s.badge, { backgroundColor: ESTADO_BG[p.estado] }]}>
                      <Text style={[s.badgeTexto, { color: ESTADO_COR[p.estado] }]}>{ESTADO_LABEL[p.estado]}</Text>
                    </View>
                  </View>
                </View>
                <Text style={s.cardDesc}>{p.descricao}</Text>
                {(p.localOrigem || p.localDestino) && (
                  <Text style={s.cardLocal}>{p.localOrigem}{p.localOrigem && p.localDestino ? ' → ' : ''}{p.localDestino}</Text>
                )}
                <View style={s.cardRodape}>
                  <Text style={s.cardInfo}>{p.solicitadoPor.nome.split(' ')[0]} · {fmt(p.criadoEm)}</Text>
                  {p.executadoPor && <Text style={s.cardInfo}>Executado por {p.executadoPor.nome.split(' ')[0]}</Text>}
                </View>
                {eOperacional && p.estado === 'pendente' && (
                  <TouchableOpacity style={s.acaoBtn} onPress={() => aceitar(p.id)}>
                    <Text style={s.acaoTexto}>Aceitar</Text>
                  </TouchableOpacity>
                )}
                {eOperacional && p.estado === 'em_curso' && p.executadoPor?.id === utilizador.id && (
                  <TouchableOpacity style={[s.acaoBtn, { backgroundColor: '#dcfce7' }]} onPress={() => concluir(p.id)}>
                    <Text style={[s.acaoTexto, { color: '#16a34a' }]}>Concluir</Text>
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
              <Text style={s.sheetTitulo}>Novo Pedido Interno</Text>
              <TouchableOpacity onPress={() => setModal(false)}><Text style={s.fechar}>✕</Text></TouchableOpacity>
            </View>

            <Text style={s.formLabel}>Tipo</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
              {TIPOS.map(t => (
                <TouchableOpacity key={t} style={[s.chip, form.tipo === t && s.chipAtivo]} onPress={() => setForm(f => ({ ...f, tipo: t }))}>
                  <Text style={[s.chipTexto, form.tipo === t && s.chipTextoAtivo]}>{TIPO_LABEL[t]}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.formLabel}>Prioridade</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 4 }}>
              {PRIORIDADES.map(p => (
                <TouchableOpacity key={p} style={[s.chip, form.prioridade === p && { backgroundColor: PRIORIDADE_COR[p] }]} onPress={() => setForm(f => ({ ...f, prioridade: p }))}>
                  <Text style={[s.chipTexto, form.prioridade === p && { color: '#fff' }]}>{PRIORIDADE_LABEL[p]}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.formLabel}>Descrição</Text>
            <TextInput style={[s.input, { height: 80 }]} value={form.descricao} onChangeText={v => setForm(f => ({ ...f, descricao: v }))} placeholder="Descreva o pedido..." placeholderTextColor="#94a3b8" multiline />

            <Text style={s.formLabel}>Local Origem</Text>
            <TextInput style={s.input} value={form.localOrigem} onChangeText={v => setForm(f => ({ ...f, localOrigem: v }))} placeholder="ex: Bloco 2, Quarto 3" placeholderTextColor="#94a3b8" />

            <Text style={s.formLabel}>Local Destino</Text>
            <TextInput style={s.input} value={form.localDestino} onChangeText={v => setForm(f => ({ ...f, localDestino: v }))} placeholder="ex: Farmácia" placeholderTextColor="#94a3b8" />

            {erro ? <Text style={s.erroTexto}>{erro}</Text> : null}

            <View style={s.botoes}>
              <TouchableOpacity style={s.cancelarBtn} onPress={() => setModal(false)}>
                <Text style={s.cancelarTexto}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.submeterBtn, salvando && { opacity: 0.6 }]} onPress={submeter} disabled={salvando}>
                <Text style={s.submeterTexto}>{salvando ? 'A criar...' : 'Criar Pedido'}</Text>
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
  novoBotao: { backgroundColor: '#f97316', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10 },
  novoTexto: { color: '#fff', fontWeight: '700', fontSize: 13 },
  filtrosScroll: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  filtrosRow: { flexDirection: 'row', gap: 8, padding: 12 },
  filtroChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#f1f5f9' },
  filtroChipAtivo: { backgroundColor: '#f97316' },
  filtroTexto: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  filtroTextoAtivo: { color: '#fff' },
  lista: { padding: 16, gap: 12 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, borderLeftWidth: 4, shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 1 }, shadowRadius: 6, elevation: 1 },
  cardTopo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, flexWrap: 'wrap', gap: 6 },
  cardTipo: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  badgeTexto: { fontSize: 11, fontWeight: '700' },
  cardDesc: { fontSize: 13, color: '#475569', marginBottom: 4 },
  cardLocal: { fontSize: 12, color: '#94a3b8', marginBottom: 4 },
  cardRodape: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  cardInfo: { fontSize: 12, color: '#94a3b8' },
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
  chipAtivo: { backgroundColor: '#2563eb' },
  chipTexto: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  chipTextoAtivo: { color: '#fff' },
  input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, fontSize: 14, color: '#1e293b' },
  erroTexto: { color: '#dc2626', fontSize: 13, marginTop: 8 },
  botoes: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelarBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#e2e8f0', alignItems: 'center' },
  cancelarTexto: { fontWeight: '600', color: '#64748b', fontSize: 14 },
  submeterBtn: { flex: 2, paddingVertical: 12, borderRadius: 10, backgroundColor: '#f97316', alignItems: 'center' },
  submeterTexto: { fontWeight: '700', color: '#fff', fontSize: 14 },
});
