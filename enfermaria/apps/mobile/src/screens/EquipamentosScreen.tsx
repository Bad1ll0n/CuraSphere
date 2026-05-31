import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Modal, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import api from '../lib/api';
import { Utilizador } from '../lib/auth';

// ─── Constantes ───────────────────────────────────────────────────────────────

const TIPOS: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  cama_eletrica:  { label: 'Cama Eléctrica',   icon: 'bed-outline' },
  ventilador:     { label: 'Ventilador',        icon: 'cloud-outline' },
  monitor:        { label: 'Monitor',           icon: 'desktop-outline' },
  cadeira_rodas:  { label: 'Cadeira de Rodas',  icon: 'accessibility-outline' },
  bomba_perfusao: { label: 'Bomba de Perfusão', icon: 'water-outline' },
  desfibrilhador: { label: 'Desfibrilhador',   icon: 'flash-outline' },
  outro:          { label: 'Outro',             icon: 'build-outline' },
};

const ESTADO: Record<string, { label: string; cor: string; fundo: string }> = {
  operacional:   { label: 'Operacional',   cor: '#059669', fundo: '#d1fae5' },
  em_manutencao: { label: 'Em Manutenção', cor: '#b45309', fundo: '#fef3c7' },
  avariado:      { label: 'Avariado',      cor: '#dc2626', fundo: '#fee2e2' },
  abatido:       { label: 'Abatido',       cor: '#6b7280', fundo: '#f1f5f9' },
};

const PRIORIDADE: Record<string, { label: string; cor: string }> = {
  urgente: { label: 'Urgente', cor: '#dc2626' },
  alta:    { label: 'Alta',    cor: '#f59e0b' },
  normal:  { label: 'Normal',  cor: '#3b82f6' },
  baixa:   { label: 'Baixa',   cor: '#6b7280' },
};

const TIPOS_MANUTENCAO = ['corretiva', 'preventiva', 'preditiva', 'emergencia'];
const PRIORIDADES_OPCOES = ['urgente', 'alta', 'normal', 'baixa'];
const ESTADOS_MANUTENCAO = ['pendente', 'em_curso', 'concluida', 'cancelada'];

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface Manutencao {
  id: string;
  tipo: string;
  descricao: string;
  estado: string;
  prioridade: string;
  dataReporte: string;
  dataConclusao?: string;
  observacoes?: string;
  reportadoPor?: { nome: string };
  tecnico?: { nome: string };
}

interface Equipamento {
  id: string;
  nome: string;
  tipo: string;
  numeroSerie?: string;
  localizacao?: string;
  estado: string;
  ultimaManutencao?: string;
  proximaManutencao?: string;
  manutencoes?: Manutencao[];
}

interface Props { utilizador: Utilizador; onVoltar: () => void }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function alertaManutencao(proxima?: string): { label: string; cor: string } | null {
  if (!proxima) return null;
  const diff = (new Date(proxima).getTime() - Date.now()) / 86400000;
  if (diff < 0)   return { label: 'Vencida', cor: '#dc2626' };
  if (diff <= 7)  return { label: `${Math.round(diff)}d`, cor: '#f59e0b' };
  if (diff <= 30) return { label: `${Math.round(diff)}d`, cor: '#eab308' };
  return null;
}

function formatarData(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function EquipamentosScreen({ utilizador, onVoltar }: Props) {
  const role = utilizador.role;
  const podeGerirEquip     = ['operacional', 'ti'].includes(role);
  const podeReportar       = ['operacional', 'ti', 'enfermeiro', 'medico', 'auxiliar'].includes(role);
  const podeAtualizarMan   = ['operacional', 'ti'].includes(role);
  const podeVerManutencoes = ['operacional', 'ti', 'direcao', 'administrativo'].includes(role);

  const [aba, setAba] = useState<'inventario' | 'alertas'>('inventario');
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [alertas, setAlertas] = useState<Equipamento[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [pesquisa, setPesquisa] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');

  // Modal detalhe equipamento
  const [detalhe, setDetalhe] = useState<Equipamento | null>(null);
  const [manutDetalhe, setManutDetalhe] = useState<Manutencao[] | null>(null);
  const [carregandoMan, setCarregandoMan] = useState(false);

  // Modal nova manutenção
  const [modalNovaMan, setModalNovaMan] = useState<{ equipId: string; equipNome: string } | null>(null);
  const [novaManTipo, setNovaManTipo] = useState('corretiva');
  const [novaManDesc, setNovaManDesc] = useState('');
  const [novaManPrior, setNovaManPrior] = useState('normal');
  const [novaManObs, setNovaManObs] = useState('');
  const [gravando, setGravando] = useState(false);

  // Modal atualizar manutenção
  const [modalAtualizar, setModalAtualizar] = useState<Manutencao | null>(null);
  const [novoEstadoMan, setNovoEstadoMan] = useState('');
  const [obsAtualizacao, setObsAtualizacao] = useState('');
  const [atualizando, setAtualizando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const params = new URLSearchParams();
      if (pesquisa) params.set('search', pesquisa);
      if (filtroEstado) params.set('estado', filtroEstado);
      const [eqRes, alRes] = await Promise.all([
        api.get(`/equipamentos?${params}`),
        api.get('/equipamentos/alertas-manutencao'),
      ]);
      setEquipamentos(eqRes.data);
      setAlertas(alRes.data);
    } catch {
      // silencioso
    } finally {
      setCarregando(false);
    }
  }, [pesquisa, filtroEstado]);

  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  const abrirDetalhe = async (eq: Equipamento) => {
    setDetalhe(eq);
    setManutDetalhe(null);
    setCarregandoMan(true);
    try {
      const r = await api.get(`/equipamentos/${eq.id}/manutencoes`);
      setManutDetalhe(r.data);
    } catch {
      setManutDetalhe([]);
    } finally {
      setCarregandoMan(false);
    }
  };

  const abrirNovaMan = (equipId: string, equipNome: string) => {
    setNovaManTipo('corretiva');
    setNovaManDesc('');
    setNovaManPrior('normal');
    setNovaManObs('');
    setModalNovaMan({ equipId, equipNome });
  };

  const gravarManutencao = async () => {
    if (!modalNovaMan || !novaManDesc.trim()) {
      Alert.alert('Atenção', 'A descrição é obrigatória.');
      return;
    }
    setGravando(true);
    try {
      await api.post(`/equipamentos/${modalNovaMan.equipId}/manutencoes`, {
        tipo: novaManTipo,
        descricao: novaManDesc.trim(),
        prioridade: novaManPrior,
        observacoes: novaManObs.trim() || undefined,
      });
      setModalNovaMan(null);
      carregar();
      if (detalhe?.id === modalNovaMan.equipId) {
        const r = await api.get(`/equipamentos/${modalNovaMan.equipId}/manutencoes`);
        setManutDetalhe(r.data);
      }
    } catch {
      Alert.alert('Erro', 'Não foi possível registar a manutenção.');
    } finally {
      setGravando(false);
    }
  };

  const abrirAtualizar = (man: Manutencao) => {
    setNovoEstadoMan(man.estado);
    setObsAtualizacao(man.observacoes ?? '');
    setModalAtualizar(man);
  };

  const gravarAtualizacao = async () => {
    if (!modalAtualizar) return;
    setAtualizando(true);
    try {
      await api.patch(`/equipamentos/manutencoes/${modalAtualizar.id}`, {
        estado: novoEstadoMan,
        observacoes: obsAtualizacao.trim() || undefined,
      });
      setModalAtualizar(null);
      carregar();
      if (detalhe) {
        const r = await api.get(`/equipamentos/${detalhe.id}/manutencoes`);
        setManutDetalhe(r.data);
      }
    } catch {
      Alert.alert('Erro', 'Não foi possível actualizar a manutenção.');
    } finally {
      setAtualizando(false);
    }
  };

  // ─── Cards ──────────────────────────────────────────────────────────────────

  const renderEquipamento = (eq: Equipamento) => {
    const est = ESTADO[eq.estado] ?? { label: eq.estado, cor: '#6b7280', fundo: '#f1f5f9' };
    const tipo = TIPOS[eq.tipo] ?? { label: eq.tipo, icon: 'build-outline' as keyof typeof Ionicons.glyphMap };
    const alerta = alertaManutencao(eq.proximaManutencao);
    return (
      <TouchableOpacity key={eq.id} style={s.card} onPress={() => abrirDetalhe(eq)} activeOpacity={0.75}>
        <View style={s.cardTopo}>
          <View style={[s.tipoBox, { backgroundColor: '#f1f5f9' }]}>
            <Ionicons name={tipo.icon} size={18} color="#475569" />
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={s.cardNome}>{eq.nome}</Text>
            <Text style={s.cardSub}>{tipo.label}{eq.localizacao ? ` · ${eq.localizacao}` : ''}</Text>
          </View>
          <View style={[s.estadoBadge, { backgroundColor: est.fundo }]}>
            <Text style={[s.estadoLabel, { color: est.cor }]}>{est.label}</Text>
          </View>
        </View>
        <View style={s.cardRodape}>
          {eq.numeroSerie && <Text style={s.cardMeta}>S/N: {eq.numeroSerie}</Text>}
          {eq.ultimaManutencao && <Text style={s.cardMeta}>Última manutenção: {formatarData(eq.ultimaManutencao)}</Text>}
          {alerta && (
            <View style={[s.alertaBadge, { backgroundColor: alerta.cor + '18' }]}>
              <Ionicons name="time-outline" size={11} color={alerta.cor} />
              <Text style={[s.alertaLabel, { color: alerta.cor }]}>Próx. manutenção: {alerta.label}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onVoltar} style={s.btnVoltar} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color="#0f172a" />
        </TouchableOpacity>
        <Text style={s.headerTitulo}>Equipamentos</Text>
        <View style={{ width: 38 }} />
      </View>

      {/* Tabs */}
      <View style={s.tabRow}>
        {(['inventario', 'alertas'] as const).map((t) => (
          <TouchableOpacity key={t} style={[s.tab, aba === t && s.tabAtiva]} onPress={() => setAba(t)}>
            <Text style={[s.tabLabel, aba === t && s.tabLabelAtiva]}>
              {t === 'inventario' ? 'Inventário' : `Alertas${alertas.length ? ` (${alertas.length})` : ''}`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {aba === 'inventario' && (
        <>
          {/* Pesquisa */}
          <View style={s.pesquisaRow}>
            <View style={s.pesquisaBox}>
              <Ionicons name="search-outline" size={16} color="#94a3b8" />
              <TextInput
                style={s.pesquisaInput}
                placeholder="Pesquisar equipamento..."
                placeholderTextColor="#94a3b8"
                value={pesquisa}
                onChangeText={setPesquisa}
                onSubmitEditing={carregar}
                returnKeyType="search"
              />
            </View>
          </View>

          {/* Filtro estado */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filtroScroll} contentContainerStyle={{ paddingHorizontal: 16, gap: 6 }}>
            {['', 'operacional', 'em_manutencao', 'avariado', 'abatido'].map((e) => {
              const est = ESTADO[e];
              const ativo = filtroEstado === e;
              return (
                <TouchableOpacity
                  key={e || 'todos'}
                  style={[s.filtroPill, ativo && { backgroundColor: (est?.cor ?? '#0f172a') + '18', borderColor: est?.cor ?? '#0f172a' }]}
                  onPress={() => { setFiltroEstado(e); }}
                  activeOpacity={0.7}
                >
                  <Text style={[s.filtroPillLabel, ativo && { color: est?.cor ?? '#0f172a', fontWeight: '600' }]}>
                    {e ? (est?.label ?? e) : 'Todos'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </>
      )}

      {/* Conteúdo */}
      {carregando ? (
        <View style={s.centro}>
          <ActivityIndicator size="large" color="#0f172a" />
        </View>
      ) : aba === 'inventario' ? (
        <ScrollView contentContainerStyle={s.lista}>
          {equipamentos.length === 0 ? (
            <Text style={s.vazio}>Nenhum equipamento encontrado.</Text>
          ) : (
            equipamentos.map(renderEquipamento)
          )}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={s.lista}>
          {alertas.length === 0 ? (
            <Text style={s.vazio}>Sem alertas de manutenção.</Text>
          ) : (
            alertas.map(renderEquipamento)
          )}
        </ScrollView>
      )}

      {/* ─── Modal Detalhe Equipamento ──────────────────────────────────────── */}
      <Modal visible={!!detalhe} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setDetalhe(null)}>
        {detalhe && (
          <View style={s.modal}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitulo} numberOfLines={1}>{detalhe.nome}</Text>
              <TouchableOpacity onPress={() => setDetalhe(null)} style={s.modalFechar}>
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={s.modalBody} contentContainerStyle={{ paddingBottom: 32 }}>
              {/* Info */}
              <View style={s.infoGrid}>
                <InfoRow label="Tipo"         valor={(TIPOS[detalhe.tipo]?.label ?? detalhe.tipo)} />
                <InfoRow label="Estado"       valor={(ESTADO[detalhe.estado]?.label ?? detalhe.estado)} corValor={ESTADO[detalhe.estado]?.cor} />
                <InfoRow label="Localização"  valor={detalhe.localizacao ?? '—'} />
                <InfoRow label="Nº Série"     valor={detalhe.numeroSerie ?? '—'} />
                <InfoRow label="Últ. manutenção" valor={formatarData(detalhe.ultimaManutencao)} />
                <InfoRow label="Próx. manutenção" valor={formatarData(detalhe.proximaManutencao)} corValor={alertaManutencao(detalhe.proximaManutencao)?.cor} />
              </View>

              {/* Botão reportar */}
              {podeReportar && (
                <TouchableOpacity style={s.btnReportar} onPress={() => abrirNovaMan(detalhe.id, detalhe.nome)} activeOpacity={0.8}>
                  <Ionicons name="add-circle-outline" size={18} color="#fff" />
                  <Text style={s.btnReportarLabel}>Reportar Manutenção</Text>
                </TouchableOpacity>
              )}

              {/* Histórico manutenções */}
              <Text style={s.secaoTitulo}>Histórico de Manutenções</Text>
              {carregandoMan ? (
                <ActivityIndicator size="small" color="#0f172a" style={{ marginTop: 12 }} />
              ) : !manutDetalhe || manutDetalhe.length === 0 ? (
                <Text style={s.vazio}>Sem manutenções registadas.</Text>
              ) : (
                manutDetalhe.map((man) => {
                  const pr = PRIORIDADE[man.prioridade] ?? { label: man.prioridade, cor: '#6b7280' };
                  const est = ESTADO[man.estado] ?? { label: man.estado, cor: '#6b7280', fundo: '#f1f5f9' };
                  return (
                    <TouchableOpacity
                      key={man.id}
                      style={s.manCard}
                      onPress={() => podeAtualizarMan && abrirAtualizar(man)}
                      activeOpacity={podeAtualizarMan ? 0.75 : 1}
                    >
                      <View style={s.manCardTopo}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.manTipo}>{man.tipo.charAt(0).toUpperCase() + man.tipo.slice(1)}</Text>
                          <Text style={s.manDesc} numberOfLines={2}>{man.descricao}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end', gap: 4 }}>
                          <View style={[s.estadoBadge, { backgroundColor: est.fundo }]}>
                            <Text style={[s.estadoLabel, { color: est.cor }]}>{est.label}</Text>
                          </View>
                          <Text style={[s.priorBadge, { color: pr.cor }]}>{pr.label}</Text>
                        </View>
                      </View>
                      <View style={s.manCardRodape}>
                        <Text style={s.cardMeta}>Reportado: {formatarData(man.dataReporte)}</Text>
                        {man.reportadoPor && <Text style={s.cardMeta}>Por: {man.reportadoPor.nome}</Text>}
                        {man.tecnico && <Text style={s.cardMeta}>Técnico: {man.tecnico.nome}</Text>}
                        {podeAtualizarMan && <Text style={[s.cardMeta, { color: '#6366f1' }]}>Toque para atualizar →</Text>}
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        )}
      </Modal>

      {/* ─── Modal Nova Manutenção ──────────────────────────────────────────── */}
      <Modal visible={!!modalNovaMan} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalNovaMan(null)}>
        {modalNovaMan && (
          <View style={s.modal}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitulo} numberOfLines={1}>Reportar Manutenção</Text>
              <TouchableOpacity onPress={() => setModalNovaMan(null)} style={s.modalFechar}>
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={s.modalBody} contentContainerStyle={{ paddingBottom: 40 }}>
              <Text style={s.equip}>{modalNovaMan.equipNome}</Text>

              <CampoLabel label="Tipo de Manutenção" />
              <View style={s.gradeOpcoes}>
                {TIPOS_MANUTENCAO.map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[s.opcaoBtn, novaManTipo === t && s.opcaoBtnAtivo]}
                    onPress={() => setNovaManTipo(t)}
                  >
                    <Text style={[s.opcaoBtnLabel, novaManTipo === t && s.opcaoBtnLabelAtivo]}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <CampoLabel label="Prioridade" />
              <View style={[s.gradeOpcoes, { flexWrap: 'nowrap' }]}>
                {PRIORIDADES_OPCOES.map((p) => {
                  const pr = PRIORIDADE[p];
                  const ativo = novaManPrior === p;
                  return (
                    <TouchableOpacity
                      key={p}
                      style={[s.opcaoBtn, { flex: 1 }, ativo && { backgroundColor: pr.cor + '20', borderColor: pr.cor }]}
                      onPress={() => setNovaManPrior(p)}
                    >
                      <Text style={[s.opcaoBtnLabel, ativo && { color: pr.cor, fontWeight: '600' }]}>{pr.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <CampoLabel label="Descrição *" />
              <TextInput
                style={s.textarea}
                placeholder="Descreva o problema ou trabalho a realizar..."
                placeholderTextColor="#94a3b8"
                multiline
                numberOfLines={4}
                value={novaManDesc}
                onChangeText={setNovaManDesc}
                textAlignVertical="top"
              />

              <CampoLabel label="Observações" />
              <TextInput
                style={s.textarea}
                placeholder="Notas adicionais (opcional)..."
                placeholderTextColor="#94a3b8"
                multiline
                numberOfLines={3}
                value={novaManObs}
                onChangeText={setNovaManObs}
                textAlignVertical="top"
              />

              <TouchableOpacity
                style={[s.btnPrimario, gravando && s.btnDesativado]}
                onPress={gravarManutencao}
                disabled={gravando}
                activeOpacity={0.8}
              >
                {gravando ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={s.btnPrimarioLabel}>Registar</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        )}
      </Modal>

      {/* ─── Modal Atualizar Manutenção ─────────────────────────────────────── */}
      <Modal visible={!!modalAtualizar} animationType="fade" transparent onRequestClose={() => setModalAtualizar(null)}>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <Text style={s.sheetTitulo}>Atualizar Manutenção</Text>

            <CampoLabel label="Estado" />
            <View style={s.gradeOpcoes}>
              {ESTADOS_MANUTENCAO.map((e) => {
                const est = ESTADO[e] ?? { cor: '#6b7280', label: e };
                const ativo = novoEstadoMan === e;
                return (
                  <TouchableOpacity
                    key={e}
                    style={[s.opcaoBtn, ativo && { backgroundColor: (est.cor) + '20', borderColor: est.cor }]}
                    onPress={() => setNovoEstadoMan(e)}
                  >
                    <Text style={[s.opcaoBtnLabel, ativo && { color: est.cor, fontWeight: '600' }]}>
                      {(ESTADO[e]?.label ?? e)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <CampoLabel label="Observações" />
            <TextInput
              style={s.textarea}
              placeholder="Notas sobre a resolução..."
              placeholderTextColor="#94a3b8"
              multiline
              numberOfLines={3}
              value={obsAtualizacao}
              onChangeText={setObsAtualizacao}
              textAlignVertical="top"
            />

            <View style={s.sheetBotoes}>
              <TouchableOpacity style={s.btnSecundario} onPress={() => setModalAtualizar(null)}>
                <Text style={s.btnSecundarioLabel}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.btnPrimario, { flex: 1 }, atualizando && s.btnDesativado]}
                onPress={gravarAtualizacao}
                disabled={atualizando}
                activeOpacity={0.8}
              >
                {atualizando ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={s.btnPrimarioLabel}>Guardar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function InfoRow({ label, valor, corValor }: { label: string; valor: string; corValor?: string }) {
  return (
    <View style={s.infoRow}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={[s.infoValor, corValor ? { color: corValor, fontWeight: '600' } : {}]}>{valor}</Text>
    </View>
  );
}

function CampoLabel({ label }: { label: string }) {
  return <Text style={s.campoLabel}>{label}</Text>;
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container:        { flex: 1, backgroundColor: '#f8fafc' },

  header:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 56 : 16, paddingBottom: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  btnVoltar:        { width: 38, height: 38, borderRadius: 10, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  headerTitulo:     { fontSize: 17, fontWeight: '700', color: '#0f172a' },

  tabRow:           { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  tab:              { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabAtiva:         { borderBottomWidth: 2, borderBottomColor: '#0f172a' },
  tabLabel:         { fontSize: 13, color: '#94a3b8', fontWeight: '500' },
  tabLabelAtiva:    { color: '#0f172a', fontWeight: '700' },

  pesquisaRow:      { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6, backgroundColor: '#fff' },
  pesquisaBox:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', borderRadius: 10, paddingHorizontal: 12, gap: 8 },
  pesquisaInput:    { flex: 1, height: 38, fontSize: 14, color: '#0f172a' },

  filtroScroll:     { flexGrow: 0, backgroundColor: '#fff', paddingVertical: 8 },
  filtroPill:       { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff' },
  filtroPillLabel:  { fontSize: 12, color: '#64748b', fontWeight: '500' },

  lista:            { padding: 16, gap: 10, paddingBottom: 32 },
  centro:           { flex: 1, alignItems: 'center', justifyContent: 'center' },
  vazio:            { textAlign: 'center', color: '#94a3b8', fontSize: 14, marginTop: 32 },

  card:             { backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#e2e8f0' },
  cardTopo:         { flexDirection: 'row', alignItems: 'flex-start' },
  tipoBox:          { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardNome:         { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  cardSub:          { fontSize: 12, color: '#64748b', marginTop: 2 },
  cardRodape:       { marginTop: 8, gap: 3 },
  cardMeta:         { fontSize: 11, color: '#94a3b8' },
  estadoBadge:      { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  estadoLabel:      { fontSize: 11, fontWeight: '600' },
  alertaBadge:      { flexDirection: 'row', alignItems: 'center', gap: 3, alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, marginTop: 2 },
  alertaLabel:      { fontSize: 11, fontWeight: '600' },
  priorBadge:       { fontSize: 11, fontWeight: '600' },

  // modal
  modal:            { flex: 1, backgroundColor: '#fff' },
  modalHeader:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 56 : 20, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  modalTitulo:      { fontSize: 17, fontWeight: '700', color: '#0f172a', flex: 1, marginRight: 12 },
  modalFechar:      { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  modalBody:        { flex: 1, paddingHorizontal: 20, paddingTop: 16 },

  infoGrid:         { backgroundColor: '#f8fafc', borderRadius: 12, padding: 14, gap: 8, marginBottom: 16 },
  infoRow:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoLabel:        { fontSize: 13, color: '#64748b', flex: 1 },
  infoValor:        { fontSize: 13, color: '#0f172a', fontWeight: '500', textAlign: 'right', flex: 1 },

  btnReportar:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#0f172a', borderRadius: 10, paddingVertical: 12, marginBottom: 20 },
  btnReportarLabel: { color: '#fff', fontSize: 14, fontWeight: '700' },

  secaoTitulo:      { fontSize: 14, fontWeight: '700', color: '#0f172a', marginBottom: 10 },

  manCard:          { backgroundColor: '#f8fafc', borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  manCardTopo:      { flexDirection: 'row', gap: 8 },
  manTipo:          { fontSize: 13, fontWeight: '700', color: '#0f172a', marginBottom: 2 },
  manDesc:          { fontSize: 12, color: '#475569' },
  manCardRodape:    { marginTop: 6, gap: 2 },

  equip:            { fontSize: 15, fontWeight: '700', color: '#0f172a', marginBottom: 16 },
  campoLabel:       { fontSize: 13, color: '#64748b', fontWeight: '600', marginBottom: 6, marginTop: 14 },
  gradeOpcoes:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  opcaoBtn:         { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff' },
  opcaoBtnAtivo:    { backgroundColor: '#0f172a18', borderColor: '#0f172a' },
  opcaoBtnLabel:    { fontSize: 13, color: '#475569' },
  opcaoBtnLabelAtivo: { color: '#0f172a', fontWeight: '600' },
  textarea:         { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, fontSize: 14, color: '#0f172a', backgroundColor: '#fff', minHeight: 88 },

  btnPrimario:      { backgroundColor: '#0f172a', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  btnPrimarioLabel: { color: '#fff', fontSize: 15, fontWeight: '700' },
  btnDesativado:    { opacity: 0.5 },

  // overlay sheet (atualizar manutenção)
  overlay:          { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet:            { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24 },
  sheetTitulo:      { fontSize: 17, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  sheetBotoes:      { flexDirection: 'row', gap: 10, marginTop: 20 },
  btnSecundario:    { flex: 1, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  btnSecundarioLabel: { fontSize: 15, color: '#475569', fontWeight: '600' },
});
