import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl, Modal, TextInput, Alert, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import api from '../lib/api';
import { Utilizador } from '../lib/auth';

interface EventoAdverso {
  id: string;
  tipo: string;
  gravidade: string;
  descricao: string;
  servicoId?: string;
  acaoCorretiva?: string;
  estado: 'aberto' | 'em_investigacao' | 'encerrado';
  ocorridoEm: string;
  criadoEm: string;
  doente?: { id: string; nome: string };
  registadoPor?: { id: string; nome: string };
}

interface DoenteOpcao {
  id: string;
  nome: string;
  numeroProcesso: string;
}

interface Props { utilizador: Utilizador; onVoltar: () => void }

const TIPO_LABEL: Record<string, string> = {
  queda: 'Queda',
  erro_medicacao: 'Erro de Medicação',
  near_miss: 'Near Miss',
  infecao: 'Infeção',
  lesao_pressao: 'Lesão por Pressão',
  outro: 'Outro',
};

const GRAVIDADE_COR: Record<string, { bg: string; text: string; label: string }> = {
  sem_dano:     { bg: '#dcfce7', text: '#16a34a', label: 'Sem Dano' },
  dano_leve:    { bg: '#fef9c3', text: '#ca8a04', label: 'Dano Leve' },
  dano_moderado:{ bg: '#ffedd5', text: '#ea580c', label: 'Dano Moderado' },
  dano_grave:   { bg: '#fef2f2', text: '#dc2626', label: 'Dano Grave' },
  obito:        { bg: '#1e293b', text: '#ffffff', label: 'Óbito' },
};

const ESTADO_COR: Record<string, { bg: string; text: string; label: string }> = {
  aberto:           { bg: '#fef3c7', text: '#d97706', label: 'Aberto' },
  em_investigacao:  { bg: '#dbeafe', text: '#1d4ed8', label: 'Em Investigação' },
  encerrado:        { bg: '#f1f5f9', text: '#64748b', label: 'Encerrado' },
};

const TIPOS = ['queda', 'erro_medicacao', 'near_miss', 'infecao', 'lesao_pressao', 'outro'];
const GRAVIDADES = ['sem_dano', 'dano_leve', 'dano_moderado', 'dano_grave', 'obito'];
const ESTADOS = ['aberto', 'em_investigacao', 'encerrado'] as const;

function nowIso() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtData(d: string) {
  return new Date(d).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function EventosAdversosScreen({ utilizador, onVoltar }: Props) {
  const [eventos, setEventos] = useState<EventoAdverso[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filtros
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroGravidade, setFiltroGravidade] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');

  // Detalhe
  const [eventoSel, setEventoSel] = useState<EventoAdverso | null>(null);
  const [detailAcao, setDetailAcao] = useState('');
  const [detailEstado, setDetailEstado] = useState<'aberto' | 'em_investigacao' | 'encerrado'>('aberto');
  const [salvando, setSalvando] = useState(false);

  // Novo evento
  const [modalNovo, setModalNovo] = useState(false);
  const [novoTipo, setNovoTipo] = useState('');
  const [novoGravidade, setNovoGravidade] = useState('');
  const [novoDescricao, setNovoDescricao] = useState('');
  const [novoServico, setNovoServico] = useState('');
  const [novoDoenteId, setNovoDoenteId] = useState('');
  const [novoDoenteNome, setNovoDoenteNome] = useState('');
  const [novoAcaoCorretiva, setNovoAcaoCorretiva] = useState('');
  const [novoOcorridoEm, setNovoOcorridoEm] = useState(nowIso());
  const [criando, setCriando] = useState(false);

  // Picker de doentes
  const [modalDoentes, setModalDoentes] = useState(false);
  const [doentes, setDoentes] = useState<DoenteOpcao[]>([]);
  const [loadingDoentes, setLoadingDoentes] = useState(false);
  const [searchDoente, setSearchDoente] = useState('');

  const podeRegistar = ['medico', 'enfermeiro', 'auxiliar', 'qualidade'].includes(utilizador.role);
  const podeGerir = ['qualidade', 'direcao', 'medico'].includes(utilizador.role);

  const carregar = async () => {
    try {
      const params: Record<string, string> = {};
      if (filtroTipo) params.tipo = filtroTipo;
      if (filtroGravidade) params.gravidade = filtroGravidade;
      if (filtroEstado) params.estado = filtroEstado;
      const r = await api.get('/eventos-adversos', { params });
      setEventos(r.data ?? []);
    } catch { /* ignorar */ }
    finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { carregar(); }, [filtroTipo, filtroGravidade, filtroEstado]));

  const abrirDetalhe = (ev: EventoAdverso) => {
    setEventoSel(ev);
    setDetailAcao(ev.acaoCorretiva ?? '');
    setDetailEstado(ev.estado);
  };

  const guardarDetalhe = async () => {
    if (!eventoSel) return;
    setSalvando(true);
    try {
      await api.patch(`/eventos-adversos/${eventoSel.id}`, {
        acaoCorretiva: detailAcao || undefined,
        estado: detailEstado,
      });
      setEventoSel(null);
      await carregar();
    } catch {
      if (Platform.OS === 'web') {
        (window as any).alert('Erro ao guardar alterações.');
      } else {
        Alert.alert('Erro', 'Não foi possível guardar as alterações.');
      }
    } finally { setSalvando(false); }
  };

  const carregarDoentes = async () => {
    setLoadingDoentes(true);
    try {
      const r = await api.get('/doentes', { params: { todos: 'true' } });
      setDoentes(r.data?.data ?? r.data ?? []);
    } catch { /* ignorar */ }
    finally { setLoadingDoentes(false); }
  };

  const abrirPickerDoentes = async () => {
    setSearchDoente('');
    setModalDoentes(true);
    await carregarDoentes();
  };

  const selecionarDoente = (d: DoenteOpcao) => {
    setNovoDoenteId(d.id);
    setNovoDoenteNome(d.nome);
    setModalDoentes(false);
  };

  const abrirModalNovo = () => {
    setNovoTipo('');
    setNovoGravidade('');
    setNovoDescricao('');
    setNovoServico('');
    setNovoDoenteId('');
    setNovoDoenteNome('');
    setNovoAcaoCorretiva('');
    setNovoOcorridoEm(nowIso());
    setModalNovo(true);
  };

  const criarEvento = async () => {
    if (!novoTipo) {
      if (Platform.OS === 'web') { (window as any).alert('Selecione o tipo de evento.'); } else { Alert.alert('Validação', 'Selecione o tipo de evento.'); }
      return;
    }
    if (!novoGravidade) {
      if (Platform.OS === 'web') { (window as any).alert('Selecione a gravidade.'); } else { Alert.alert('Validação', 'Selecione a gravidade.'); }
      return;
    }
    if (!novoDescricao.trim()) {
      if (Platform.OS === 'web') { (window as any).alert('A descrição é obrigatória.'); } else { Alert.alert('Validação', 'A descrição é obrigatória.'); }
      return;
    }
    setCriando(true);
    try {
      await api.post('/eventos-adversos', {
        tipo: novoTipo,
        gravidade: novoGravidade,
        descricao: novoDescricao.trim(),
        servicoId: novoServico.trim() || undefined,
        doenteId: novoDoenteId || undefined,
        acaoCorretiva: novoAcaoCorretiva.trim() || undefined,
        ocorridoEm: novoOcorridoEm.trim() || new Date().toISOString(),
      });
      setModalNovo(false);
      await carregar();
    } catch {
      if (Platform.OS === 'web') {
        (window as any).alert('Erro ao registar evento.');
      } else {
        Alert.alert('Erro', 'Não foi possível registar o evento.');
      }
    } finally { setCriando(false); }
  };

  const ciclarFiltro = (
    atual: string,
    setter: (v: string) => void,
    opcoes: string[],
  ) => {
    const idx = opcoes.indexOf(atual);
    if (idx === -1 || idx === opcoes.length - 1) setter('');
    else setter(opcoes[idx + 1]);
  };

  const totalAbertos = eventos.filter(e => e.estado === 'aberto').length;
  const totalGraves = eventos.filter(e => e.gravidade === 'dano_grave' || e.gravidade === 'obito').length;

  const doentesVisiveis = doentes.filter(d =>
    !searchDoente || d.nome.toLowerCase().includes(searchDoente.toLowerCase()) || d.numeroProcesso.includes(searchDoente)
  );

  if (loading) return <View style={s.centro}><ActivityIndicator size="large" color="#dc2626" /></View>;

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onVoltar} style={s.voltarBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitulo}>Eventos Adversos</Text>
          <Text style={s.headerSub}>Registo e gestão de ocorrências</Text>
        </View>
      </View>

      {/* KPI chips */}
      <View style={s.kpiRow}>
        <View style={s.kpiChip}>
          <Text style={s.kpiValor}>{eventos.length}</Text>
          <Text style={s.kpiLabel}>Total</Text>
        </View>
        <View style={[s.kpiChip, totalAbertos > 0 && s.kpiChipAmbar]}>
          <Text style={[s.kpiValor, totalAbertos > 0 && s.kpiValorAmbar]}>{totalAbertos}</Text>
          <Text style={[s.kpiLabel, totalAbertos > 0 && s.kpiLabelAmbar]}>Abertos</Text>
        </View>
        <View style={[s.kpiChip, totalGraves > 0 && s.kpiChipVermelho]}>
          <Text style={[s.kpiValor, totalGraves > 0 && s.kpiValorVermelho]}>{totalGraves}</Text>
          <Text style={[s.kpiLabel, totalGraves > 0 && s.kpiLabelVermelho]}>Graves</Text>
        </View>
      </View>

      {/* Filtros */}
      <View style={s.filtrosRow}>
        <TouchableOpacity
          style={[s.filtroPill, filtroTipo && s.filtroPillAtivo]}
          onPress={() => ciclarFiltro(filtroTipo, setFiltroTipo, TIPOS)}
        >
          <Text style={[s.filtroPillTexto, filtroTipo && s.filtroPillTextoAtivo]}>
            {filtroTipo ? TIPO_LABEL[filtroTipo] : 'Tipo'}
          </Text>
          {filtroTipo ? (
            <Ionicons name="close-circle" size={14} color="#dc2626" onPress={() => setFiltroTipo('')} />
          ) : (
            <Ionicons name="chevron-down" size={14} color="#94a3b8" />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.filtroPill, filtroGravidade && s.filtroPillAtivo]}
          onPress={() => ciclarFiltro(filtroGravidade, setFiltroGravidade, GRAVIDADES)}
        >
          <Text style={[s.filtroPillTexto, filtroGravidade && s.filtroPillTextoAtivo]}>
            {filtroGravidade ? GRAVIDADE_COR[filtroGravidade]?.label : 'Gravidade'}
          </Text>
          {filtroGravidade ? (
            <Ionicons name="close-circle" size={14} color="#dc2626" onPress={() => setFiltroGravidade('')} />
          ) : (
            <Ionicons name="chevron-down" size={14} color="#94a3b8" />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.filtroPill, filtroEstado && s.filtroPillAtivo]}
          onPress={() => ciclarFiltro(filtroEstado, setFiltroEstado, [...ESTADOS])}
        >
          <Text style={[s.filtroPillTexto, filtroEstado && s.filtroPillTextoAtivo]}>
            {filtroEstado ? ESTADO_COR[filtroEstado]?.label : 'Estado'}
          </Text>
          {filtroEstado ? (
            <Ionicons name="close-circle" size={14} color="#dc2626" onPress={() => setFiltroEstado('')} />
          ) : (
            <Ionicons name="chevron-down" size={14} color="#94a3b8" />
          )}
        </TouchableOpacity>
      </View>

      {/* Lista */}
      <ScrollView
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); carregar(); }} />}
      >
        {eventos.length === 0 ? (
          <View style={s.vazio}>
            <Ionicons name="checkmark-circle-outline" size={48} color="#94a3b8" />
            <Text style={s.vazioTexto}>Sem eventos adversos registados</Text>
          </View>
        ) : eventos.map(ev => {
          const grav = GRAVIDADE_COR[ev.gravidade] ?? { bg: '#f1f5f9', text: '#64748b', label: ev.gravidade };
          const est = ESTADO_COR[ev.estado] ?? { bg: '#f1f5f9', text: '#64748b', label: ev.estado };
          return (
            <TouchableOpacity key={ev.id} style={[s.cartao, { borderLeftColor: grav.text }]} onPress={() => abrirDetalhe(ev)} activeOpacity={0.85}>
              {/* Linha badges */}
              <View style={s.cartaoBadges}>
                <View style={[s.badge, { backgroundColor: grav.bg }]}>
                  <Text style={[s.badgeTexto, { color: grav.text }]}>{grav.label}</Text>
                </View>
                <View style={[s.badge, { backgroundColor: est.bg }]}>
                  <Text style={[s.badgeTexto, { color: est.text }]}>{est.label}</Text>
                </View>
                <View style={[s.badge, { backgroundColor: '#f1f5f9' }]}>
                  <Text style={[s.badgeTexto, { color: '#475569' }]}>{TIPO_LABEL[ev.tipo] ?? ev.tipo}</Text>
                </View>
              </View>

              {/* Descrição */}
              <Text style={s.cartaoDescricao} numberOfLines={2}>{ev.descricao}</Text>

              {/* Meta */}
              <View style={s.cartaoMeta}>
                {ev.doente && (
                  <View style={s.infoRow}>
                    <Ionicons name="person-outline" size={13} color="#94a3b8" />
                    <Text style={s.infoTexto}>{ev.doente.nome}</Text>
                  </View>
                )}
                <View style={s.infoRow}>
                  <Ionicons name="calendar-outline" size={13} color="#94a3b8" />
                  <Text style={s.infoTexto}>{fmtData(ev.ocorridoEm)}</Text>
                </View>
                {ev.registadoPor && (
                  <View style={s.infoRow}>
                    <Ionicons name="create-outline" size={13} color="#94a3b8" />
                    <Text style={s.infoTexto}>{ev.registadoPor.nome}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
        <View style={{ height: 96 }} />
      </ScrollView>

      {/* FAB */}
      {podeRegistar && (
        <TouchableOpacity style={s.fab} onPress={abrirModalNovo}>
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Modal Detalhe */}
      <Modal visible={!!eventoSel} animationType="slide" transparent onRequestClose={() => setEventoSel(null)}>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitulo}>Detalhes do Evento</Text>
              <TouchableOpacity onPress={() => setEventoSel(null)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}>
              {eventoSel && (() => {
                const grav = GRAVIDADE_COR[eventoSel.gravidade] ?? { bg: '#f1f5f9', text: '#64748b', label: eventoSel.gravidade };
                const est = ESTADO_COR[eventoSel.estado] ?? { bg: '#f1f5f9', text: '#64748b', label: eventoSel.estado };
                return (
                  <>
                    <View style={[s.cartaoBadges, { marginTop: 12, marginBottom: 16 }]}>
                      <View style={[s.badge, { backgroundColor: grav.bg }]}>
                        <Text style={[s.badgeTexto, { color: grav.text }]}>{grav.label}</Text>
                      </View>
                      <View style={[s.badge, { backgroundColor: est.bg }]}>
                        <Text style={[s.badgeTexto, { color: est.text }]}>{est.label}</Text>
                      </View>
                      <View style={[s.badge, { backgroundColor: '#f1f5f9' }]}>
                        <Text style={[s.badgeTexto, { color: '#475569' }]}>{TIPO_LABEL[eventoSel.tipo] ?? eventoSel.tipo}</Text>
                      </View>
                    </View>

                    <Text style={s.detalheSecTitulo}>Descrição</Text>
                    <Text style={s.detalheTexto}>{eventoSel.descricao}</Text>

                    {eventoSel.doente && (
                      <>
                        <Text style={s.detalheSecTitulo}>Doente</Text>
                        <Text style={s.detalheTexto}>{eventoSel.doente.nome}</Text>
                      </>
                    )}

                    <Text style={s.detalheSecTitulo}>Ocorrido Em</Text>
                    <Text style={s.detalheTexto}>{fmtData(eventoSel.ocorridoEm)}</Text>

                    {eventoSel.registadoPor && (
                      <>
                        <Text style={s.detalheSecTitulo}>Registado Por</Text>
                        <Text style={s.detalheTexto}>{eventoSel.registadoPor.nome}</Text>
                      </>
                    )}

                    {eventoSel.acaoCorretiva && !podeGerir && (
                      <>
                        <Text style={s.detalheSecTitulo}>Ação Corretiva</Text>
                        <Text style={s.detalheTexto}>{eventoSel.acaoCorretiva}</Text>
                      </>
                    )}

                    {podeGerir && (
                      <View style={s.gerirBox}>
                        <Text style={s.gerirTitulo}>Gestão</Text>

                        <Text style={s.labelCampo}>Ação Corretiva</Text>
                        <TextInput
                          style={[s.input, s.inputMulti]}
                          placeholder="Descreva a ação corretiva..."
                          multiline
                          numberOfLines={3}
                          value={detailAcao}
                          onChangeText={setDetailAcao}
                          textAlignVertical="top"
                        />

                        <Text style={s.labelCampo}>Estado</Text>
                        <View style={s.estadoBotoesRow}>
                          {ESTADOS.map(est2 => {
                            const cfg = ESTADO_COR[est2];
                            const ativo = detailEstado === est2;
                            return (
                              <TouchableOpacity
                                key={est2}
                                style={[s.estadoBtn, ativo && { backgroundColor: cfg.bg, borderColor: cfg.text }]}
                                onPress={() => setDetailEstado(est2)}
                              >
                                <Text style={[s.estadoBtnTexto, ativo && { color: cfg.text, fontWeight: '700' }]}>
                                  {cfg.label}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>

                        <TouchableOpacity
                          style={[s.btnGuardar, salvando && s.btnGuardarDis]}
                          onPress={guardarDetalhe}
                          disabled={salvando}
                        >
                          {salvando ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.btnGuardarTexto}>Guardar Alterações</Text>}
                        </TouchableOpacity>
                      </View>
                    )}
                  </>
                );
              })()}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal Novo Evento */}
      <Modal visible={modalNovo} animationType="slide" transparent onRequestClose={() => setModalNovo(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitulo}>Novo Evento Adverso</Text>
              <TouchableOpacity onPress={() => setModalNovo(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}>
              {/* Tipo */}
              <Text style={s.labelCampo}>Tipo <Text style={{ color: '#dc2626' }}>*</Text></Text>
              <View style={s.opcoesBotoesGrid}>
                {TIPOS.map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[s.opcaoBtn, novoTipo === t && s.opcaoBtnAtivo]}
                    onPress={() => setNovoTipo(t)}
                  >
                    <Text style={[s.opcaoBtnTexto, novoTipo === t && s.opcaoBtnTextoAtivo]}>
                      {TIPO_LABEL[t]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Gravidade */}
              <Text style={[s.labelCampo, { marginTop: 16 }]}>Gravidade <Text style={{ color: '#dc2626' }}>*</Text></Text>
              <View style={s.opcoesBotoesGrid}>
                {GRAVIDADES.map(g => {
                  const cfg = GRAVIDADE_COR[g];
                  const ativo = novoGravidade === g;
                  return (
                    <TouchableOpacity
                      key={g}
                      style={[s.opcaoBtn, ativo && { backgroundColor: cfg.bg, borderColor: cfg.text }]}
                      onPress={() => setNovoGravidade(g)}
                    >
                      <Text style={[s.opcaoBtnTexto, ativo && { color: cfg.text, fontWeight: '700' }]}>
                        {cfg.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Descrição */}
              <Text style={[s.labelCampo, { marginTop: 16 }]}>Descrição <Text style={{ color: '#dc2626' }}>*</Text></Text>
              <TextInput
                style={[s.input, s.inputMulti]}
                placeholder="Descreva o evento ocorrido..."
                multiline
                numberOfLines={4}
                value={novoDescricao}
                onChangeText={setNovoDescricao}
                textAlignVertical="top"
              />

              {/* Serviço */}
              <Text style={[s.labelCampo, { marginTop: 16 }]}>Serviço (opcional)</Text>
              <TextInput
                style={s.input}
                placeholder="ID ou nome do serviço"
                value={novoServico}
                onChangeText={setNovoServico}
              />

              {/* Doente */}
              <Text style={[s.labelCampo, { marginTop: 16 }]}>Doente (opcional)</Text>
              <View style={s.doenteRow}>
                <Text style={s.doenteNomeTexto} numberOfLines={1}>
                  {novoDoenteNome || 'Nenhum doente selecionado'}
                </Text>
                <TouchableOpacity style={s.btnSelDoente} onPress={abrirPickerDoentes}>
                  <Text style={s.btnSelDoenteTexto}>{novoDoenteId ? 'Alterar' : 'Selecionar'}</Text>
                </TouchableOpacity>
                {novoDoenteId ? (
                  <TouchableOpacity onPress={() => { setNovoDoenteId(''); setNovoDoenteNome(''); }} style={{ paddingLeft: 6 }}>
                    <Ionicons name="close-circle" size={18} color="#94a3b8" />
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* Ocorrido Em */}
              <Text style={[s.labelCampo, { marginTop: 16 }]}>Ocorrido Em</Text>
              <TextInput
                style={s.input}
                placeholder="YYYY-MM-DDTHH:mm"
                value={novoOcorridoEm}
                onChangeText={setNovoOcorridoEm}
              />

              {/* Ação Corretiva */}
              <Text style={[s.labelCampo, { marginTop: 16 }]}>Ação Corretiva (opcional)</Text>
              <TextInput
                style={[s.input, s.inputMulti]}
                placeholder="Ação corretiva imediata..."
                multiline
                numberOfLines={3}
                value={novoAcaoCorretiva}
                onChangeText={setNovoAcaoCorretiva}
                textAlignVertical="top"
              />

              <TouchableOpacity
                style={[s.btnGuardar, { marginTop: 24 }, criando && s.btnGuardarDis]}
                onPress={criarEvento}
                disabled={criando}
              >
                {criando ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.btnGuardarTexto}>Registar Evento</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal Picker Doentes */}
      <Modal visible={modalDoentes} animationType="slide" transparent onRequestClose={() => setModalDoentes(false)}>
        <View style={s.modalOverlay}>
          <View style={[s.modalSheet, { maxHeight: '70%' }]}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitulo}>Selecionar Doente</Text>
              <TouchableOpacity onPress={() => setModalDoentes(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
              <TextInput
                style={s.inputSearch}
                placeholder="Pesquisar por nome ou processo..."
                value={searchDoente}
                onChangeText={setSearchDoente}
                autoFocus
              />
            </View>

            {loadingDoentes ? (
              <View style={s.centro}><ActivityIndicator color="#dc2626" /></View>
            ) : (
              <ScrollView style={{ flex: 1 }}>
                {doentesVisiveis.length === 0 ? (
                  <View style={s.vazio}>
                    <Text style={s.vazioTexto}>Nenhum doente encontrado</Text>
                  </View>
                ) : doentesVisiveis.map(d => (
                  <TouchableOpacity key={d.id} style={s.doenteItem} onPress={() => selecionarDoente(d)}>
                    <View style={s.doenteItemIcone}>
                      <Ionicons name="person" size={18} color="#dc2626" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.doenteItemNome}>{d.nome}</Text>
                      <Text style={s.doenteItemProc}>Proc. {d.numeroProcesso}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
                  </TouchableOpacity>
                ))}
                <View style={{ height: 24 }} />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Header
  header: { backgroundColor: '#dc2626', paddingTop: 52, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  voltarBtn: { padding: 4 },
  headerTitulo: { fontSize: 20, fontWeight: '700', color: '#fff' },
  headerSub: { fontSize: 11, color: '#fecaca', marginTop: 2 },

  // KPI
  kpiRow: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingVertical: 12, paddingHorizontal: 16, gap: 12 },
  kpiChip: { flex: 1, alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 12, paddingVertical: 10 },
  kpiChipAmbar: { backgroundColor: '#fffbeb' },
  kpiChipVermelho: { backgroundColor: '#fef2f2' },
  kpiValor: { fontSize: 22, fontWeight: '800', color: '#1e293b' },
  kpiValorAmbar: { color: '#d97706' },
  kpiValorVermelho: { color: '#dc2626' },
  kpiLabel: { fontSize: 11, color: '#94a3b8', marginTop: 2, fontWeight: '500' },
  kpiLabelAmbar: { color: '#d97706' },
  kpiLabelVermelho: { color: '#dc2626' },

  // Filtros
  filtrosRow: { flexDirection: 'row', backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 10, gap: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  filtroPill: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: '#f1f5f9', borderRadius: 20, paddingVertical: 7, paddingHorizontal: 10, borderWidth: 1, borderColor: 'transparent' },
  filtroPillAtivo: { backgroundColor: '#fef2f2', borderColor: '#dc2626' },
  filtroPillTexto: { fontSize: 12, fontWeight: '600', color: '#94a3b8' },
  filtroPillTextoAtivo: { color: '#dc2626' },

  // Lista
  vazio: { padding: 60, alignItems: 'center', gap: 12 },
  vazioTexto: { color: '#94a3b8', fontSize: 15 },
  cartao: { backgroundColor: '#fff', marginHorizontal: 16, marginTop: 12, borderRadius: 14, padding: 14, borderLeftWidth: 4, shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 2 },
  cartaoBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20 },
  badgeTexto: { fontSize: 11, fontWeight: '700' },
  cartaoDescricao: { fontSize: 14, color: '#334155', marginTop: 8, lineHeight: 20 },
  cartaoMeta: { marginTop: 8, gap: 3 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  infoTexto: { fontSize: 12, color: '#94a3b8' },

  // FAB
  fab: { position: 'absolute', bottom: 28, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: '#dc2626', alignItems: 'center', justifyContent: 'center', shadowColor: '#dc2626', shadowOpacity: 0.4, shadowOffset: { width: 0, height: 4 }, shadowRadius: 10, elevation: 8 },

  // Modais
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '92%', flex: 1 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  modalTitulo: { fontSize: 17, fontWeight: '700', color: '#1e293b' },

  // Detalhe
  detalheSecTitulo: { fontSize: 11, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 16, marginBottom: 4 },
  detalheTexto: { fontSize: 14, color: '#334155', lineHeight: 21 },
  gerirBox: { marginTop: 24, padding: 16, backgroundColor: '#f8fafc', borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0' },
  gerirTitulo: { fontSize: 13, fontWeight: '700', color: '#1e293b', marginBottom: 12 },

  // Estado botões
  estadoBotoesRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 6 },
  estadoBtn: { flex: 1, minWidth: 90, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#f1f5f9', borderWidth: 1.5, borderColor: '#e2e8f0', alignItems: 'center' },
  estadoBtnTexto: { fontSize: 12, color: '#64748b', fontWeight: '600' },

  // Formulário
  labelCampo: { fontSize: 12, fontWeight: '700', color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.6 },
  input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#1e293b' },
  inputMulti: { minHeight: 80, paddingTop: 10 },
  inputSearch: { backgroundColor: '#f1f5f9', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#1e293b' },

  // Opções botões grid
  opcoesBotoesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  opcaoBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10, backgroundColor: '#f1f5f9', borderWidth: 1.5, borderColor: '#e2e8f0' },
  opcaoBtnAtivo: { backgroundColor: '#fef2f2', borderColor: '#dc2626' },
  opcaoBtnTexto: { fontSize: 13, color: '#64748b', fontWeight: '600' },
  opcaoBtnTextoAtivo: { color: '#dc2626', fontWeight: '700' },

  // Doente picker row
  doenteRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  doenteNomeTexto: { flex: 1, fontSize: 13, color: '#64748b' },
  btnSelDoente: { backgroundColor: '#dc2626', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  btnSelDoenteTexto: { fontSize: 12, fontWeight: '700', color: '#fff' },

  // Doente list item
  doenteItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', gap: 12 },
  doenteItemIcone: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#fef2f2', alignItems: 'center', justifyContent: 'center' },
  doenteItemNome: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  doenteItemProc: { fontSize: 12, color: '#94a3b8', marginTop: 2 },

  // Guardar
  btnGuardar: { backgroundColor: '#dc2626', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  btnGuardarDis: { opacity: 0.6 },
  btnGuardarTexto: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
