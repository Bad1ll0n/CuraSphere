import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../lib/api';
import { Utilizador } from '../lib/auth';

interface Props { utilizador: Utilizador; onVoltar: () => void }

const tipoLabel: Record<string, string> = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' };
const tipoCor: Record<string, string> = { manha: '#f59e0b', tarde: '#f97316', noite: '#6366f1' };
const roleLabel: Record<string, string> = {
  medico: 'Médico', enfermeiro: 'Enfermeiro', auxiliar: 'Auxiliar',
  tecnico_saude: 'Técnico de Saúde', farmaceutico: 'Farmacêutico',
  administrativo: 'Administrativo', operacional: 'Operacional',
  ti: 'TI', qualidade: 'Qualidade', direcao: 'Direção',
};
const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function HorariosScreen({ utilizador, onVoltar }: Props) {
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [ano, setAno] = useState(hoje.getFullYear());
  const [escala, setEscala] = useState<any>(null);
  const [meuHorario, setMeuHorario] = useState<any[]>([]);
  const [profissionais, setProfissionais] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isChefe = ['enfermeiro', 'medico'].includes(utilizador.role);
  const verSeus = ['enfermeiro', 'auxiliar', 'medico', 'tecnico_saude', 'farmaceutico'].includes(utilizador.role);

  const grupoDoChefe = utilizador.role === 'medico'
    ? ['medico']
    : ['enfermeiro', 'auxiliar'];

  // Modal criar turno
  const [modalDia, setModalDia] = useState<string | null>(null);
  const [novoTipo, setNovoTipo] = useState('manha');
  const [novoProfs, setNovoProfs] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erroModal, setErroModal] = useState('');

  // Modal editar turno
  const [turnoEditando, setTurnoEditando] = useState<any>(null);
  const [editTipo, setEditTipo] = useState('manha');
  const [editProfs, setEditProfs] = useState<string[]>([]);
  const [salvandoEdit, setSalvandoEdit] = useState(false);
  const [erroEdit, setErroEdit] = useState('');

  // Calendário
  const [diaSelec, setDiaSelec] = useState<number | null>(null);

  const carregar = async () => {
    try {
      const [escalR, meuR] = await Promise.all([
        api.get(`/horarios/mes?mes=${mes}&ano=${ano}`).catch(() => ({ data: null })),
        api.get(`/horarios/meu?mes=${mes}&ano=${ano}`),
      ]);
      setEscala(escalR.data);
      setMeuHorario(meuR.data);
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const carregarProfissionais = async () => {
    if (!isChefe) return;
    try {
      const r = await api.get('/utilizadores');
      setProfissionais(r.data.filter((u: any) => grupoDoChefe.includes(u.role)));
    } catch {}
  };

  useFocusEffect(useCallback(() => {
    carregar();
    carregarProfissionais();
  }, [mes, ano]));

  const criarEscala = async () => {
    try {
      await api.post('/horarios', { mes, ano });
      await carregar();
    } catch (e: any) {
      Alert.alert('Erro', e.response?.data?.message ?? 'Erro ao criar escala');
    }
  };

  const abrirModalDia = (dia: string) => {
    setModalDia(dia);
    setNovoTipo('manha');
    setNovoProfs([]);
    setErroModal('');
  };

  const submeterTurno = async () => {
    if (!escala || !modalDia || novoProfs.length === 0) { setErroModal('Selecione pelo menos um profissional'); return; }
    setSalvando(true);
    setErroModal('');
    try {
      await api.post(`/horarios/${escala.id}/turno`, { tipo: novoTipo, data: modalDia, profissionaisIds: novoProfs });
      setModalDia(null);
      await carregar();
    } catch (e: any) {
      setErroModal(e.response?.data?.message ?? 'Erro ao criar turno');
    } finally { setSalvando(false); }
  };

  const abrirEditar = (turno: any) => {
    setTurnoEditando(turno);
    setEditTipo(turno.tipo);
    setEditProfs(turno.profissionais.map((p: any) => p.utilizador.id));
    setErroEdit('');
  };

  const guardarEdicao = async () => {
    if (!turnoEditando || editProfs.length === 0) { setErroEdit('Selecione pelo menos um profissional'); return; }
    setSalvandoEdit(true);
    setErroEdit('');
    try {
      await api.patch(`/horarios/turno/${turnoEditando.id}`, { tipo: editTipo, profissionaisIds: editProfs });
      setTurnoEditando(null);
      await carregar();
    } catch (e: any) {
      setErroEdit(e.response?.data?.message ?? 'Erro ao guardar');
    } finally { setSalvandoEdit(false); }
  };

  const apagarTurno = async () => {
    Alert.alert('Apagar', 'Apagar este turno?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Apagar', style: 'destructive', onPress: async () => {
        try {
          await api.delete(`/horarios/turno/${turnoEditando.id}`);
          setTurnoEditando(null);
          await carregar();
        } catch {}
      }},
    ]);
  };

  const toggleProf = (id: string, lista: string[], setLista: (v: string[]) => void) => {
    setLista(lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id]);
  };

  // Agrupar turnos por dia
  const turnosPorDia: Record<string, any[]> = {};
  if (escala?.turnos) {
    for (const t of escala.turnos) {
      if (verSeus && !t.profissionais.some((p: any) => p.utilizador.id === utilizador.id)) continue;
      if (isChefe && t.profissionais.length > 0 && !t.profissionais.some((p: any) => grupoDoChefe.includes(p.utilizador.role))) continue;
      const dia = new Date(t.data).toISOString().split('T')[0];
      if (!turnosPorDia[dia]) turnosPorDia[dia] = [];
      turnosPorDia[dia].push(t);
    }
  }

  const hojeStr = hoje.toISOString().split('T')[0];

  // Calendário: grelha de células
  const totalDias = new Date(ano, mes, 0).getDate();
  const primeiroDiaSemana = new Date(ano, mes - 1, 1).getDay();
  const celulas: (number | null)[] = [
    ...Array(primeiroDiaSemana).fill(null),
    ...Array.from({ length: totalDias }, (_, i) => i + 1),
  ];
  while (celulas.length % 7 !== 0) celulas.push(null);

  const diaParaStr = (n: number) =>
    `${ano}-${String(mes).padStart(2, '0')}-${String(n).padStart(2, '0')}`;
  const hojeNum = hoje.getFullYear() === ano && hoje.getMonth() + 1 === mes ? hoje.getDate() : null;

  const prevMes = () => {
    if (mes === 1) { setMes(12); setAno(ano - 1); }
    else setMes(mes - 1);
  };
  const nextMes = () => {
    if (mes === 12) { setMes(1); setAno(ano + 1); }
    else setMes(mes + 1);
  };

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onVoltar} style={s.voltarBotao}>
          <Text style={s.voltarTexto}>‹  Voltar</Text>
        </TouchableOpacity>
        <View style={s.headerRow}>
          <Text style={s.titulo}>Horários</Text>
          <View style={s.mesNav}>
            <TouchableOpacity onPress={prevMes} style={s.mesBtn}><Text style={s.mesBtnTexto}>‹</Text></TouchableOpacity>
            <Text style={s.mesTexto}>{meses[mes - 1]} {ano}</Text>
            <TouchableOpacity onPress={nextMes} style={s.mesBtn}><Text style={s.mesBtnTexto}>›</Text></TouchableOpacity>
          </View>
        </View>
      </View>

      {loading ? (
        <View style={s.centro}><ActivityIndicator size="large" color="#2563eb" /></View>
      ) : !escala ? (
        <View style={s.centro}>
          <Text style={s.semEscalaTitulo}>Sem escala para {meses[mes - 1]} {ano}</Text>
          {isChefe && (
            <TouchableOpacity style={s.criarEscalaBtn} onPress={criarEscala}>
              <Text style={s.criarEscalaTexto}>Criar Escala</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); carregar(); }} />}
        >
          {/* Calendário */}
          <View style={s.cal}>
            {/* Cabeçalho dias da semana */}
            <View style={s.calRow}>
              {diasSemana.map((d) => (
                <Text key={d} style={s.calDiaSemana}>{d}</Text>
              ))}
            </View>

            {/* Células */}
            {Array.from({ length: celulas.length / 7 }, (_, semana) => (
              <View key={semana} style={s.calRow}>
                {celulas.slice(semana * 7, semana * 7 + 7).map((n, i) => {
                  if (!n) return <View key={`v-${semana}-${i}`} style={s.cel} />;
                  const str = diaParaStr(n);
                  const turnos = turnosPorDia[str] ?? [];
                  const isHoje = n === hojeNum;
                  const isSelec = n === diaSelec;
                  const temTurno = turnos.length > 0;
                  const tipos = [...new Set(turnos.map((t: any) => t.tipo))] as string[];
                  return (
                    <TouchableOpacity
                      key={str}
                      style={[s.cel, isSelec && s.celSelec]}
                      onPress={() => setDiaSelec(n === diaSelec ? null : n)}
                      activeOpacity={0.7}
                    >
                      <View style={[s.celNum, isHoje && s.celNumHoje]}>
                        <Text style={[s.celNumTexto, isHoje && s.celNumTextoHoje, !temTurno && { color: '#94a3b8' }]}>
                          {n}
                        </Text>
                      </View>
                      <View style={s.celDots}>
                        {tipos.map((t) => (
                          <View key={t} style={[s.dot, { backgroundColor: tipoCor[t] }]} />
                        ))}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>

          {/* Detalhe do dia seleccionado */}
          {diaSelec && (() => {
            const str = diaParaStr(diaSelec);
            const turnos = turnosPorDia[str] ?? [];
            const d = new Date(str + 'T12:00:00');
            const label = `${diasSemana[d.getDay()]}, ${diaSelec} ${meses[mes - 1]}`;
            return (
              <View style={s.detalhe}>
                <View style={s.detalheHeader}>
                  <Text style={s.detalheTitulo}>{label}</Text>
                  {isChefe && (
                    <TouchableOpacity style={s.addDiaBotao} onPress={() => abrirModalDia(str)}>
                      <Text style={s.addDiaTexto}>+</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {turnos.length === 0 ? (
                  <Text style={s.vazioTexto}>Sem turnos</Text>
                ) : turnos.map((t: any) => (
                  <TouchableOpacity
                    key={t.id}
                    style={[s.turnoCard, { borderLeftColor: tipoCor[t.tipo] }]}
                    onPress={() => isChefe ? abrirEditar(t) : null}
                    activeOpacity={isChefe ? 0.7 : 1}
                  >
                    <View style={s.turnoCardTopo}>
                      <View style={[s.turnoPill, { backgroundColor: tipoCor[t.tipo] + '20' }]}>
                        <Text style={[s.turnoPillTexto, { color: tipoCor[t.tipo] }]}>{tipoLabel[t.tipo]}</Text>
                      </View>
                      {isChefe && <Text style={s.editarTexto}>✏️</Text>}
                    </View>
                    <Text style={s.profsList} numberOfLines={2}>
                      {t.profissionais.map((p: any) => p.utilizador.nome.split(' ')[0]).join(', ')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            );
          })()}

          <View style={{ height: 32 }} />
        </ScrollView>
      )}

      {/* Modal: Criar Turno */}
      <Modal visible={!!modalDia} transparent animationType="slide" onRequestClose={() => setModalDia(null)}>
        <View style={s.overlay}>
          <View style={[s.sheet, { maxHeight: '85%' }]}>
            <View style={s.sheetCabecalho}>
              <Text style={s.sheetTitulo}>Novo Turno · {modalDia ? new Date(modalDia + 'T12:00:00').toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' }) : ''}</Text>
              <TouchableOpacity onPress={() => setModalDia(null)}><Text style={s.fechar}>✕</Text></TouchableOpacity>
            </View>

            <Text style={s.formLabel}>Tipo</Text>
            <View style={s.seletorRow}>
              {(['manha', 'tarde', 'noite'] as const).map((t) => (
                <TouchableOpacity key={t} style={[s.seletorOpcao, novoTipo === t && s.seletorAtivo]} onPress={() => setNovoTipo(t)}>
                  <Text style={[s.seletorTexto, novoTipo === t && s.seletorTextoAtivo]}>{tipoLabel[t]}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.formLabel}>Profissionais</Text>
            <ScrollView style={{ maxHeight: 220 }}>
              {profissionais.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={[s.profRow, novoProfs.includes(p.id) && s.profRowAtivo]}
                  onPress={() => toggleProf(p.id, novoProfs, setNovoProfs)}
                >
                  <View style={s.profInfo}>
                    <Text style={s.profNome}>{p.nome}</Text>
                    <Text style={s.profRole}>{roleLabel[p.role] ?? p.role}</Text>
                  </View>
                  {novoProfs.includes(p.id) && <Text style={s.check}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>

            {erroModal ? <Text style={s.erroTexto}>{erroModal}</Text> : null}

            <View style={s.botoes}>
              <TouchableOpacity style={s.cancelarBtn} onPress={() => setModalDia(null)}>
                <Text style={s.cancelarBtnTexto}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.submeterBtn, (novoProfs.length === 0 || salvando) && s.submeterBtnDes]}
                onPress={submeterTurno}
                disabled={novoProfs.length === 0 || salvando}
              >
                <Text style={s.submeterBtnTexto}>{salvando ? 'A criar...' : 'Criar Turno'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal: Editar Turno */}
      <Modal visible={!!turnoEditando} transparent animationType="slide" onRequestClose={() => setTurnoEditando(null)}>
        <View style={s.overlay}>
          <View style={[s.sheet, { maxHeight: '85%' }]}>
            <View style={s.sheetCabecalho}>
              <Text style={s.sheetTitulo}>Editar Turno</Text>
              <TouchableOpacity onPress={() => setTurnoEditando(null)}><Text style={s.fechar}>✕</Text></TouchableOpacity>
            </View>

            <Text style={s.formLabel}>Tipo</Text>
            <View style={s.seletorRow}>
              {(['manha', 'tarde', 'noite'] as const).map((t) => (
                <TouchableOpacity key={t} style={[s.seletorOpcao, editTipo === t && s.seletorAtivo]} onPress={() => setEditTipo(t)}>
                  <Text style={[s.seletorTexto, editTipo === t && s.seletorTextoAtivo]}>{tipoLabel[t]}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.formLabel}>Profissionais</Text>
            <ScrollView style={{ maxHeight: 200 }}>
              {profissionais.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={[s.profRow, editProfs.includes(p.id) && s.profRowAtivo]}
                  onPress={() => toggleProf(p.id, editProfs, setEditProfs)}
                >
                  <View style={s.profInfo}>
                    <Text style={s.profNome}>{p.nome}</Text>
                    <Text style={s.profRole}>{roleLabel[p.role] ?? p.role}</Text>
                  </View>
                  {editProfs.includes(p.id) && <Text style={s.check}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>

            {erroEdit ? <Text style={s.erroTexto}>{erroEdit}</Text> : null}

            <View style={s.botoes}>
              <TouchableOpacity style={[s.cancelarBtn, { backgroundColor: '#fef2f2' }]} onPress={apagarTurno}>
                <Text style={[s.cancelarBtnTexto, { color: '#dc2626' }]}>Apagar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.submeterBtn, (editProfs.length === 0 || salvandoEdit) && s.submeterBtnDes]}
                onPress={guardarEdicao}
                disabled={editProfs.length === 0 || salvandoEdit}
              >
                <Text style={s.submeterBtnTexto}>{salvandoEdit ? 'A guardar...' : 'Guardar'}</Text>
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
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  header: { backgroundColor: '#1e293b', padding: 20, paddingTop: 16 },
  voltarBotao: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    marginBottom: 10,
  },
  voltarTexto: { color: '#fff', fontSize: 12, fontWeight: '600' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  titulo: { fontSize: 20, fontWeight: '700', color: '#fff' },
  mesNav: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mesBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  mesBtnTexto: { color: '#fff', fontSize: 18, fontWeight: '700' },
  mesTexto: { color: '#e2e8f0', fontSize: 13, fontWeight: '600' },
  semEscalaTitulo: { fontSize: 18, fontWeight: '600', color: '#475569', textAlign: 'center', marginBottom: 20 },
  criarEscalaBtn: { backgroundColor: '#2563eb', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  criarEscalaTexto: { color: '#fff', fontWeight: '700', fontSize: 15 },
  // Calendário
  cal: { backgroundColor: '#fff', margin: 16, borderRadius: 16, padding: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 2 },
  calRow: { flexDirection: 'row' },
  calDiaSemana: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: '#94a3b8', paddingBottom: 8 },
  cel: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 8 },
  celSelec: { backgroundColor: '#eff6ff' },
  celNum: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  celNumHoje: { backgroundColor: '#2563eb' },
  celNumTexto: { fontSize: 13, fontWeight: '600', color: '#1e293b' },
  celNumTextoHoje: { color: '#fff', fontWeight: '700' },
  celDots: { flexDirection: 'row', gap: 2, marginTop: 2, height: 6, alignItems: 'center' },
  dot: { width: 5, height: 5, borderRadius: 3 },
  // Detalhe
  detalhe: { marginHorizontal: 16, backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 2 },
  detalheHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  detalheTitulo: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  addDiaBotao: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' },
  addDiaTexto: { color: '#2563eb', fontSize: 20, fontWeight: '700', lineHeight: 26 },
  turnoCard: { borderLeftWidth: 3, paddingLeft: 10, marginBottom: 8, paddingVertical: 6 },
  turnoCardTopo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  profsList: { fontSize: 13, color: '#64748b' },
  editarTexto: { fontSize: 14 },
  turnoPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  turnoPillTexto: { fontSize: 12, fontWeight: '600' },
  vazioTexto: { color: '#94a3b8', fontSize: 14, textAlign: 'center', paddingVertical: 12 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  sheetCabecalho: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sheetTitulo: { fontSize: 17, fontWeight: '700', color: '#1e293b' },
  fechar: { fontSize: 18, color: '#94a3b8', fontWeight: '700' },
  formLabel: { fontSize: 13, fontWeight: '600', color: '#475569', marginTop: 12, marginBottom: 8 },
  seletorRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  seletorOpcao: { flex: 1, paddingVertical: 8, borderRadius: 14, backgroundColor: '#e2e8f0', alignItems: 'center' },
  seletorAtivo: { backgroundColor: '#2563eb' },
  seletorTexto: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  seletorTextoAtivo: { color: '#fff' },
  profRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  profRowAtivo: { backgroundColor: '#eff6ff', borderRadius: 8, paddingHorizontal: 8 },
  profInfo: { flex: 1 },
  profNome: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  profRole: { fontSize: 12, color: '#94a3b8', marginTop: 1 },
  check: { color: '#2563eb', fontWeight: '700', fontSize: 16 },
  erroTexto: { color: '#dc2626', fontSize: 13, marginTop: 8 },
  botoes: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelarBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#e2e8f0', alignItems: 'center' },
  cancelarBtnTexto: { fontWeight: '600', color: '#64748b', fontSize: 14 },
  submeterBtn: { flex: 2, paddingVertical: 12, borderRadius: 10, backgroundColor: '#2563eb', alignItems: 'center' },
  submeterBtnDes: { backgroundColor: '#93c5fd' },
  submeterBtnTexto: { fontWeight: '700', color: '#fff', fontSize: 14 },
});
