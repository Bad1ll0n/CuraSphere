import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, TextInput, ActivityIndicator, RefreshControl,
  Modal, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../lib/api';
import { Utilizador } from '../lib/auth';
import DoenteDetalheScreen from './DoenteDetalheScreen';

interface Doente {
  id: string;
  nome: string;
  numeroProcesso: string;
  estado: string;
  diagnosticoPrincipal: string;
  cama: { numero: string; quarto: string };
}

const estadoCor: Record<string, string> = {
  estavel: '#22c55e', grave: '#f97316', critico: '#ef4444', alta_prevista: '#3b82f6',
};
const estadoLabel: Record<string, string> = {
  estavel: 'Estável', grave: 'Grave', critico: 'Crítico', alta_prevista: 'Alta Prevista',
};

interface Props { utilizador: Utilizador }

export default function DoentesScreen({ utilizador }: Props) {
  const [doentes, setDoentes] = useState<Doente[]>([]);
  const [todos, setTodos] = useState<Doente[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pesquisa, setPesquisa] = useState('');
  const [doenteAberto, setDoenteAberto] = useState<string | null>(null);
  const [verTodos, setVerTodos] = useState(false);

  // Modal admitir doente
  const [modalAdmitir, setModalAdmitir] = useState(false);
  const [camasLivres, setCamasLivres] = useState<any[]>([]);
  const [form, setForm] = useState({ nome: '', dataNascimento: '', diagnosticoPrincipal: '', camaId: '', dataAltaPrevista: '' });
  const [camaAberta, setCamaAberta] = useState(false); // selector de cama
  const [salvando, setSalvando] = useState(false);
  const [erroAdmitir, setErroAdmitir] = useState('');

  const isAdmin = utilizador.role === 'administrativo';
  const isChefe = ['chefe_enfermeiros', 'chefe_medicos'].includes(utilizador.role);
  const podeAdmitir = isAdmin || isChefe;

  const carregar = async () => {
    try {
      const { data } = await api.get('/doentes');
      setDoentes(data);
      if (isAdmin) {
        setTodos(data);
      } else {
        const todosR = await api.get('/doentes?todos=true').catch(() => ({ data }));
        setTodos(todosR.data);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { carregar(); }, []));

  const abrirAdmitir = async () => {
    setForm({ nome: '', dataNascimento: '', diagnosticoPrincipal: '', camaId: '', dataAltaPrevista: '' });
    setErroAdmitir('');
    try {
      const { data } = await api.get('/camas');
      setCamasLivres(data.filter((c: any) => c.estado === 'livre' || c.estado === 'reservada'));
    } catch { setCamasLivres([]); }
    setModalAdmitir(true);
  };

  const admitir = async () => {
    if (!form.nome.trim() || !form.dataNascimento.trim() || !form.diagnosticoPrincipal.trim() || !form.camaId) {
      setErroAdmitir('Preencha todos os campos obrigatórios');
      return;
    }
    setSalvando(true);
    setErroAdmitir('');
    try {
      await api.post('/doentes/admitir', {
        nome: form.nome,
        dataNascimento: new Date(form.dataNascimento),
        diagnosticoPrincipal: form.diagnosticoPrincipal,
        camaId: form.camaId,
        dataAltaPrevista: form.dataAltaPrevista ? new Date(form.dataAltaPrevista) : undefined,
      });
      setModalAdmitir(false);
      await carregar();
      Alert.alert('Sucesso', 'Doente admitido com sucesso');
    } catch (e: any) {
      setErroAdmitir(e.response?.data?.message ?? 'Erro ao admitir doente');
    } finally { setSalvando(false); }
  };

  if (doenteAberto) return (
    <DoenteDetalheScreen
      doenteId={doenteAberto}
      utilizador={utilizador}
      onVoltar={() => setDoenteAberto(null)}
    />
  );

  const lista = verTodos ? todos : doentes;
  const filtrados = lista.filter((d) =>
    d.nome.toLowerCase().includes(pesquisa.toLowerCase()) ||
    d.cama.numero.includes(pesquisa) ||
    d.numeroProcesso.includes(pesquisa),
  ).sort((a, b) => {
    const ordem: Record<string, number> = { critico: 0, grave: 1, estavel: 2, alta_prevista: 3 };
    return (ordem[a.estado] ?? 4) - (ordem[b.estado] ?? 4);
  });

  const camaSelec = camasLivres.find((c) => c.id === form.camaId);

  return (
    <View style={s.container}>
      <View style={s.topo}>
        <View style={s.topoLinha}>
          <TextInput
            style={s.pesquisa}
            placeholder="Pesquisar doente, cama ou processo..."
            value={pesquisa}
            onChangeText={setPesquisa}
          />
          {podeAdmitir && (
            <TouchableOpacity style={s.admitirBotao} onPress={abrirAdmitir}>
              <Text style={s.admitirTexto}>+ Admitir</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={s.filtros}>
          <TouchableOpacity style={[s.filtro, !verTodos && s.filtroAtivo]} onPress={() => setVerTodos(false)}>
            <Text style={[s.filtroTexto, !verTodos && s.filtroTextoAtivo]}>
              {isAdmin ? 'Todos' : 'O meu turno'} ({doentes.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.filtro, verTodos && s.filtroAtivo]} onPress={() => setVerTodos(true)}>
            <Text style={[s.filtroTexto, verTodos && s.filtroTextoAtivo]}>
              Todos ({todos.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={s.centro}><ActivityIndicator size="large" color="#2563eb" /></View>
      ) : (
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); carregar(); }} />}
        >
          {filtrados.length === 0 ? (
            <View style={s.vazio}><Text style={s.vazioTexto}>Sem doentes encontrados</Text></View>
          ) : filtrados.map((d) => (
            <TouchableOpacity key={d.id} style={s.cartao} onPress={() => setDoenteAberto(d.id)} activeOpacity={0.8}>
              <View style={[s.estadoBar, { backgroundColor: estadoCor[d.estado] }]} />
              <View style={s.cartaoConteudo}>
                <View style={s.cartaoCabecalho}>
                  <Text style={s.doenteNome}>{d.nome}</Text>
                  <View style={[s.estadoBadge, { backgroundColor: estadoCor[d.estado] + '20' }]}>
                    <Text style={[s.estadoTexto, { color: estadoCor[d.estado] }]}>{estadoLabel[d.estado]}</Text>
                  </View>
                </View>
                <Text style={s.diagnostico} numberOfLines={1}>{d.diagnosticoPrincipal}</Text>
                <Text style={s.cama}>Cama {d.cama.quarto}/{d.cama.numero} · Proc. {d.numeroProcesso}</Text>
              </View>
            </TouchableOpacity>
          ))}
          <View style={{ height: 16 }} />
        </ScrollView>
      )}

      {/* Modal: Admitir Doente */}
      <Modal visible={modalAdmitir} transparent animationType="slide" onRequestClose={() => setModalAdmitir(false)}>
        <View style={s.overlay}>
          <ScrollView style={s.sheet} keyboardShouldPersistTaps="handled">
            <View style={s.sheetCabecalho}>
              <Text style={s.sheetTitulo}>Admissão de Doente</Text>
              <TouchableOpacity onPress={() => setModalAdmitir(false)}>
                <Text style={s.fechar}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={s.formLabel}>Nome completo *</Text>
            <TextInput
              style={s.formInput}
              value={form.nome}
              onChangeText={(v) => setForm((f) => ({ ...f, nome: v }))}
              placeholder="Nome do doente"
            />

            <Text style={s.formLabel}>Data de Nascimento * (AAAA-MM-DD)</Text>
            <TextInput
              style={s.formInput}
              value={form.dataNascimento}
              onChangeText={(v) => setForm((f) => ({ ...f, dataNascimento: v }))}
              placeholder="Ex: 1980-06-15"
              keyboardType="numbers-and-punctuation"
            />

            <Text style={s.formLabel}>Diagnóstico Principal *</Text>
            <TextInput
              style={[s.formInput, { minHeight: 70, textAlignVertical: 'top' }]}
              value={form.diagnosticoPrincipal}
              onChangeText={(v) => setForm((f) => ({ ...f, diagnosticoPrincipal: v }))}
              placeholder="Descreva o diagnóstico..."
              multiline
            />

            <Text style={s.formLabel}>Cama * ({camasLivres.length} disponíveis)</Text>
            <TouchableOpacity style={s.camaSelector} onPress={() => setCamaAberta(true)}>
              <Text style={[s.camaSelectorTexto, !form.camaId && { color: '#94a3b8' }]}>
                {camaSelec ? `Quarto ${camaSelec.quarto} · Cama ${camaSelec.numero}` : 'Selecionar cama...'}
              </Text>
              <Text style={s.camaArrow}>›</Text>
            </TouchableOpacity>

            <Text style={s.formLabel}>Alta Prevista (opcional, AAAA-MM-DD)</Text>
            <TextInput
              style={s.formInput}
              value={form.dataAltaPrevista}
              onChangeText={(v) => setForm((f) => ({ ...f, dataAltaPrevista: v }))}
              placeholder="Ex: 2026-05-01"
              keyboardType="numbers-and-punctuation"
            />

            {erroAdmitir ? <Text style={s.erroTexto}>{erroAdmitir}</Text> : null}

            <View style={[s.botoes, { marginBottom: 40 }]}>
              <TouchableOpacity style={s.cancelarBtn} onPress={() => setModalAdmitir(false)}>
                <Text style={s.cancelarBtnTexto}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.submeterBtn, (!form.nome.trim() || !form.dataNascimento.trim() || !form.diagnosticoPrincipal.trim() || !form.camaId || salvando) && s.submeterBtnDes]}
                onPress={admitir}
                disabled={!form.nome.trim() || !form.dataNascimento.trim() || !form.diagnosticoPrincipal.trim() || !form.camaId || salvando}
              >
                <Text style={s.submeterBtnTexto}>{salvando ? 'A admitir...' : 'Admitir'}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Modal: Selector de Cama */}
      <Modal visible={camaAberta} transparent animationType="fade" onRequestClose={() => setCamaAberta(false)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setCamaAberta(false)}>
          <View onStartShouldSetResponder={() => true} style={s.camaSheet}>
            <Text style={s.sheetTitulo}>Selecionar Cama</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {camasLivres.length === 0
                ? <Text style={s.semCamas}>Sem camas disponíveis</Text>
                : camasLivres.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={[s.camaOpcao, form.camaId === c.id && s.camaOpcaoAtiva]}
                    onPress={() => { setForm((f) => ({ ...f, camaId: c.id })); setCamaAberta(false); }}
                  >
                    <Text style={s.camaOpcaoTexto}>Quarto {c.quarto} · Cama {c.numero}</Text>
                    {c.estado === 'reservada' && <Text style={s.camaReservada}>(reservada)</Text>}
                    {form.camaId === c.id && <Text style={s.camaCheck}>✓</Text>}
                  </TouchableOpacity>
                ))
              }
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topo: { padding: 16, paddingBottom: 8, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  topoLinha: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  pesquisa: { flex: 1, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, backgroundColor: '#f8fafc' },
  admitirBotao: { backgroundColor: '#2563eb', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, justifyContent: 'center' },
  admitirTexto: { color: '#fff', fontWeight: '700', fontSize: 13 },
  filtros: { flexDirection: 'row', gap: 8 },
  filtro: { flex: 1, paddingVertical: 8, borderRadius: 20, backgroundColor: '#e2e8f0', alignItems: 'center' },
  filtroAtivo: { backgroundColor: '#2563eb' },
  filtroTexto: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  filtroTextoAtivo: { color: '#fff' },
  vazio: { padding: 40, alignItems: 'center' },
  vazioTexto: { color: '#94a3b8', fontSize: 15 },
  cartao: { flexDirection: 'row', backgroundColor: '#fff', marginHorizontal: 16, marginTop: 10, borderRadius: 14, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 2 },
  estadoBar: { width: 5 },
  cartaoConteudo: { flex: 1, padding: 14 },
  cartaoCabecalho: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  doenteNome: { fontSize: 16, fontWeight: '700', color: '#1e293b', flex: 1, marginRight: 8 },
  estadoBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  estadoTexto: { fontSize: 11, fontWeight: '600' },
  diagnostico: { fontSize: 13, color: '#64748b', marginBottom: 4 },
  cama: { fontSize: 12, color: '#94a3b8' },
  // Modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '90%' },
  camaSheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  sheetCabecalho: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sheetTitulo: { fontSize: 17, fontWeight: '700', color: '#1e293b', marginBottom: 12 },
  fechar: { fontSize: 18, color: '#94a3b8', fontWeight: '700' },
  formLabel: { fontSize: 13, fontWeight: '600', color: '#475569', marginTop: 12, marginBottom: 6 },
  formInput: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 10, fontSize: 14, color: '#334155', backgroundColor: '#f8fafc' },
  camaSelector: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 10, backgroundColor: '#f8fafc' },
  camaSelectorTexto: { flex: 1, fontSize: 14, color: '#334155' },
  camaArrow: { fontSize: 18, color: '#94a3b8' },
  camaOpcao: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', gap: 8 },
  camaOpcaoAtiva: { backgroundColor: '#eff6ff', borderRadius: 8, paddingHorizontal: 8 },
  camaOpcaoTexto: { flex: 1, fontSize: 14, color: '#1e293b', fontWeight: '500' },
  camaReservada: { fontSize: 12, color: '#94a3b8', fontStyle: 'italic' },
  camaCheck: { color: '#2563eb', fontWeight: '700', fontSize: 16 },
  semCamas: { color: '#94a3b8', fontSize: 14, textAlign: 'center', padding: 20 },
  erroTexto: { color: '#dc2626', fontSize: 13, marginTop: 8 },
  botoes: { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancelarBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#e2e8f0', alignItems: 'center' },
  cancelarBtnTexto: { fontWeight: '600', color: '#64748b', fontSize: 14 },
  submeterBtn: { flex: 2, paddingVertical: 12, borderRadius: 10, backgroundColor: '#2563eb', alignItems: 'center' },
  submeterBtnDes: { backgroundColor: '#93c5fd' },
  submeterBtnTexto: { fontWeight: '700', color: '#fff', fontSize: 14 },
});
