import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Modal,
  StyleSheet, ActivityIndicator, RefreshControl,
  TextInput, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import api from '../lib/api';
import { Utilizador } from '../lib/auth';

interface EpisodioUrgencia {
  id: string;
  nomeTemporario?: string;
  queixaPrincipal: string;
  triagem: string;
  estadoEpisodio: string;
  dataEntrada: string;
  notas?: string;
  doente?: { id: string; nome: string };
  medicoResponsavel?: { id: string; nome: string };
  triadoPor?: { id: string; nome: string };
}

interface Props { utilizador: Utilizador; onVoltar: () => void }

const TRIAGEM = [
  { id: 'vermelho', label: 'Emergente',     tempo: 'Imediato',  cor: '#dc2626', bg: '#fef2f2' },
  { id: 'laranja',  label: 'Muito Urgente', tempo: '≤ 10 min',  cor: '#ea580c', bg: '#fff7ed' },
  { id: 'amarelo',  label: 'Urgente',       tempo: '≤ 60 min',  cor: '#ca8a04', bg: '#fefce8' },
  { id: 'verde',    label: 'Pouco Urgente', tempo: '≤ 2 h',     cor: '#16a34a', bg: '#f0fdf4' },
  { id: 'azul',     label: 'Não Urgente',   tempo: '≤ 4 h',     cor: '#2563eb', bg: '#eff6ff' },
];

const triagemById: Record<string, typeof TRIAGEM[0]> = Object.fromEntries(TRIAGEM.map(t => [t.id, t]));

const ESTADO_LABEL: Record<string, string> = {
  triagem:           'Em Triagem',
  sala_espera:       'Sala de Espera',
  em_atendimento:    'Em Atendimento',
  aguarda_resultado: 'Aguarda Resultado',
  alta_urgencia:     'Alta',
  alta:              'Alta',
  internado:         'Internado',
  transferido:       'Transferido',
  em_observacao:     'Em Observação',
};

const ESTADO_COR: Record<string, string> = {
  triagem:           '#f59e0b',
  sala_espera:       '#8b5cf6',
  em_atendimento:    '#3b82f6',
  aguarda_resultado: '#8b5cf6',
  alta_urgencia:     '#22c55e',
  alta:              '#22c55e',
  internado:         '#22c55e',
  transferido:       '#64748b',
  em_observacao:     '#3b82f6',
};

const PROXIMOS_ESTADOS: Record<string, Array<{ estado: string; label: string }>> = {
  triagem:           [{ estado: 'sala_espera',    label: 'Sala de Espera' }],
  sala_espera:       [{ estado: 'em_atendimento', label: 'Em Atendimento' }, { estado: 'transferido', label: 'Transferido' }],
  em_atendimento:    [{ estado: 'aguarda_resultado', label: 'Aguarda Resultado' }, { estado: 'alta_urgencia', label: 'Alta' }, { estado: 'internado', label: 'Internado' }, { estado: 'transferido', label: 'Transferido' }],
  aguarda_resultado: [{ estado: 'em_atendimento', label: 'Em Atendimento' }, { estado: 'alta_urgencia', label: 'Alta' }, { estado: 'transferido', label: 'Transferido' }],
  em_observacao:     [{ estado: 'em_atendimento', label: 'Em Atendimento' }, { estado: 'alta_urgencia', label: 'Alta' }],
};

const ESTADOS_ATIVOS = ['triagem', 'sala_espera', 'em_atendimento', 'aguarda_resultado', 'em_observacao'];
const PODE_TRIAR = ['enfermeiro', 'medico', 'administrativo'];

function tempoEspera(dataEntrada: string) {
  const diff = Math.floor((Date.now() - new Date(dataEntrada).getTime()) / 60000);
  if (diff < 60) return `${diff} min`;
  return `${Math.floor(diff / 60)}h ${diff % 60}min`;
}

export default function UrgenciaScreen({ utilizador, onVoltar }: Props) {
  const [episodios, setEpisodios] = useState<EpisodioUrgencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filtro, setFiltro] = useState<'ativos' | 'todos'>('ativos');

  // Modal nova entrada
  const [modalEntrada, setModalEntrada] = useState(false);
  const [formQueixa, setFormQueixa] = useState('');
  const [formTriagem, setFormTriagem] = useState('');
  const [formNome, setFormNome] = useState('');
  const [formNotas, setFormNotas] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Modal ações episódio
  const [episodioSel, setEpisodioSel] = useState<EpisodioUrgencia | null>(null);
  const [atualizando, setAtualizando] = useState(false);

  const podeTriar = PODE_TRIAR.includes(utilizador.role);

  const carregar = async () => {
    try {
      const { data } = await api.get('/urgencia/lista');
      setEpisodios(Array.isArray(data) ? data : []);
    } catch { /* ignorar */ }
    finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { carregar(); }, []));

  const filtrados = filtro === 'ativos'
    ? episodios.filter(e => ESTADOS_ATIVOS.includes(e.estadoEpisodio))
    : episodios;

  // Contadores por cor (só activos)
  const ativos = episodios.filter(e => ESTADOS_ATIVOS.includes(e.estadoEpisodio));
  const contadores = TRIAGEM.reduce<Record<string, number>>((acc, t) => {
    acc[t.id] = ativos.filter(e => e.triagem === t.id).length;
    return acc;
  }, {});

  const registarEntrada = async () => {
    if (!formQueixa.trim()) { Alert.alert('Campo obrigatório', 'Indique a queixa principal.'); return; }
    if (!formTriagem) { Alert.alert('Campo obrigatório', 'Seleccione a prioridade de triagem.'); return; }
    setSubmitting(true);
    try {
      await api.post('/urgencia/episodio', {
        queixaPrincipal: formQueixa.trim(),
        triagem: formTriagem,
        nomeTemporario: formNome.trim() || undefined,
        notas: formNotas.trim() || undefined,
      });
      setModalEntrada(false);
      setFormQueixa(''); setFormTriagem(''); setFormNome(''); setFormNotas('');
      await carregar();
    } catch (e: any) {
      Alert.alert('Erro', e?.response?.data?.message ?? 'Erro ao registar entrada');
    } finally { setSubmitting(false); }
  };

  const mudarEstado = async (episodioId: string, novoEstado: string) => {
    setAtualizando(true);
    try {
      await api.patch(`/urgencia/${episodioId}/estado`, { estado: novoEstado });
      setEpisodioSel(null);
      await carregar();
    } catch (e: any) {
      Alert.alert('Erro', e?.response?.data?.message ?? 'Erro ao actualizar estado');
    } finally { setAtualizando(false); }
  };

  if (loading) return <View style={s.centro}><ActivityIndicator size="large" color="#dc2626" /></View>;

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onVoltar} style={s.voltarBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitulo}>Urgência</Text>
          <Text style={s.headerSub}>{ativos.length} episódio(s) activo(s)</Text>
        </View>
        {podeTriar && (
          <TouchableOpacity onPress={() => setModalEntrada(true)} style={s.addBtn}>
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      {/* Contadores Manchester */}
      <View style={s.contadoresRow}>
        {TRIAGEM.map(t => (
          <View key={t.id} style={[s.contadorCard, { borderColor: t.cor, backgroundColor: t.bg }]}>
            <View style={[s.dot, { backgroundColor: t.cor }]} />
            <Text style={[s.contadorNum, { color: t.cor }]}>{contadores[t.id]}</Text>
          </View>
        ))}
      </View>

      {/* Filtros */}
      <View style={s.filtros}>
        {([{ key: 'ativos', label: 'Activos' }, { key: 'todos', label: 'Todos' }] as const).map(f => (
          <TouchableOpacity key={f.key} style={[s.filtro, filtro === f.key && s.filtroAtivo]} onPress={() => setFiltro(f.key)}>
            <Text style={[s.filtroTexto, filtro === f.key && s.filtroTextoAtivo]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); carregar(); }} />}>
        {filtrados.length === 0 ? (
          <View style={s.vazio}>
            <Ionicons name="medical-outline" size={40} color="#cbd5e1" />
            <Text style={s.vazioTexto}>Sem episódios{filtro === 'ativos' ? ' activos' : ''}</Text>
          </View>
        ) : (
          filtrados
            .slice()
            .sort((a, b) => {
              const ordemCor: Record<string, number> = { vermelho: 0, laranja: 1, amarelo: 2, verde: 3, azul: 4 };
              return (ordemCor[a.triagem] ?? 5) - (ordemCor[b.triagem] ?? 5);
            })
            .map(ep => {
              const t = triagemById[ep.triagem];
              const estadoCor = ESTADO_COR[ep.estadoEpisodio] ?? '#94a3b8';
              const estadoLabel = ESTADO_LABEL[ep.estadoEpisodio] ?? ep.estadoEpisodio;
              const nomePaciente = ep.doente?.nome ?? ep.nomeTemporario ?? 'Doente desconhecido';
              const temAcoes = PROXIMOS_ESTADOS[ep.estadoEpisodio]?.length > 0;
              return (
                <TouchableOpacity
                  key={ep.id}
                  style={[s.cartao, { borderLeftColor: t?.cor ?? '#94a3b8' }]}
                  onPress={() => podeTriar && temAcoes ? setEpisodioSel(ep) : undefined}
                  activeOpacity={podeTriar && temAcoes ? 0.7 : 1}
                >
                  <View style={s.cartaoTopo}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.nomePaciente}>{nomePaciente}</Text>
                      {t && (
                        <View style={s.triagemRow}>
                          <View style={[s.dot, { backgroundColor: t.cor }]} />
                          <Text style={[s.triagemLabel, { color: t.cor }]}>{t.label}</Text>
                          <Text style={s.triagemTempo}>· {t.tempo}</Text>
                        </View>
                      )}
                    </View>
                    <View style={[s.estadoBadge, { backgroundColor: estadoCor + '22' }]}>
                      <Text style={[s.estadoTexto, { color: estadoCor }]}>{estadoLabel}</Text>
                    </View>
                  </View>

                  <Text style={s.queixa}>{ep.queixaPrincipal}</Text>

                  <View style={s.rodape}>
                    <View style={s.infoRow}>
                      <Ionicons name="time-outline" size={13} color="#64748b" />
                      <Text style={s.infoTexto}>{tempoEspera(ep.dataEntrada)}</Text>
                    </View>
                    {ep.medicoResponsavel && (
                      <View style={s.infoRow}>
                        <Ionicons name="person-outline" size={13} color="#64748b" />
                        <Text style={s.infoTexto}>{ep.medicoResponsavel.nome}</Text>
                      </View>
                    )}
                    {podeTriar && temAcoes && (
                      <View style={s.infoRow}>
                        <Ionicons name="chevron-forward-outline" size={13} color="#94a3b8" />
                        <Text style={[s.infoTexto, { color: '#94a3b8' }]}>Acções</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })
        )}
        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Modal: Nova Entrada com Triagem Manchester */}
      <Modal visible={modalEntrada} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitulo}>Nova Entrada — Triagem Manchester</Text>

            {/* Queixa principal */}
            <Text style={s.fieldLabel}>Queixa Principal *</Text>
            <TextInput
              style={s.input}
              placeholder="Descreva a queixa ou sintoma principal..."
              placeholderTextColor="#94a3b8"
              value={formQueixa}
              onChangeText={setFormQueixa}
              multiline
              numberOfLines={2}
            />

            {/* Nome temporário */}
            <Text style={s.fieldLabel}>Nome do Doente <Text style={s.fieldOpcional}>(opcional, se desconhecido)</Text></Text>
            <TextInput
              style={s.input}
              placeholder="Nome ou identificação temporária"
              placeholderTextColor="#94a3b8"
              value={formNome}
              onChangeText={setFormNome}
            />

            {/* Prioridade Manchester */}
            <Text style={s.fieldLabel}>Prioridade de Triagem *</Text>
            <View style={s.triagemGrid}>
              {TRIAGEM.map(t => (
                <TouchableOpacity
                  key={t.id}
                  style={[s.triagemBtn, { borderColor: t.cor, backgroundColor: formTriagem === t.id ? t.cor : t.bg }]}
                  onPress={() => setFormTriagem(t.id)}
                >
                  <Text style={[s.triagemBtnLabel, { color: formTriagem === t.id ? '#fff' : t.cor }]}>{t.label}</Text>
                  <Text style={[s.triagemBtnTempo, { color: formTriagem === t.id ? 'rgba(255,255,255,0.8)' : t.cor + 'aa' }]}>{t.tempo}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Notas */}
            <Text style={s.fieldLabel}>Notas <Text style={s.fieldOpcional}>(opcional)</Text></Text>
            <TextInput
              style={s.input}
              placeholder="Observações adicionais, alergias conhecidas, medicação..."
              placeholderTextColor="#94a3b8"
              value={formNotas}
              onChangeText={setFormNotas}
              multiline
              numberOfLines={2}
            />

            <View style={s.modalBtns}>
              <TouchableOpacity style={s.btnCancelar} onPress={() => { setModalEntrada(false); setFormQueixa(''); setFormTriagem(''); setFormNome(''); setFormNotas(''); }}>
                <Text style={s.btnCancelarTexto}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.btnConfirmar, { backgroundColor: formTriagem ? (triagemById[formTriagem]?.cor ?? '#dc2626') : '#94a3b8' }]}
                onPress={registarEntrada}
                disabled={submitting}
              >
                {submitting
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={s.btnConfirmarTexto}>Registar Entrada</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal: Acções de episódio */}
      <Modal visible={!!episodioSel} animationType="slide" transparent onRequestClose={() => setEpisodioSel(null)}>
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setEpisodioSel(null)}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={s.modalSheet}>
              <View style={s.modalHandle} />
              {episodioSel && (() => {
                const t = triagemById[episodioSel.triagem];
                const proximos = PROXIMOS_ESTADOS[episodioSel.estadoEpisodio] ?? [];
                const nomePaciente = episodioSel.doente?.nome ?? episodioSel.nomeTemporario ?? 'Doente desconhecido';
                return (
                  <>
                    <View style={[s.acaoHeader, { borderLeftColor: t?.cor ?? '#94a3b8' }]}>
                      <Text style={s.acaoNome}>{nomePaciente}</Text>
                      <Text style={s.acaoQueixa}>{episodioSel.queixaPrincipal}</Text>
                      <View style={s.triagemRow}>
                        {t && <><View style={[s.dot, { backgroundColor: t.cor }]} /><Text style={[s.triagemLabel, { color: t.cor }]}>{t.label}</Text></>}
                        <Text style={s.acaoEstado}> · {ESTADO_LABEL[episodioSel.estadoEpisodio] ?? episodioSel.estadoEpisodio}</Text>
                      </View>
                    </View>

                    <Text style={[s.fieldLabel, { marginTop: 20 }]}>Avançar Estado</Text>
                    {proximos.length === 0 ? (
                      <Text style={s.semAcoes}>Episódio encerrado — sem acções disponíveis.</Text>
                    ) : (
                      proximos.map(p => (
                        <TouchableOpacity
                          key={p.estado}
                          style={[s.acaoBtn, { borderColor: ESTADO_COR[p.estado] ?? '#94a3b8' }]}
                          onPress={() => mudarEstado(episodioSel.id, p.estado)}
                          disabled={atualizando}
                        >
                          <View style={[s.dot, { backgroundColor: ESTADO_COR[p.estado] ?? '#94a3b8' }]} />
                          <Text style={[s.acaoBtnTexto, { color: ESTADO_COR[p.estado] ?? '#475569' }]}>{p.label}</Text>
                          {atualizando && <ActivityIndicator size="small" color={ESTADO_COR[p.estado]} style={{ marginLeft: 'auto' as any }} />}
                        </TouchableOpacity>
                      ))
                    )}
                  </>
                );
              })()}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#f1f5f9' },
  centro:          { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header:          { backgroundColor: '#dc2626', paddingTop: 52, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  voltarBtn:       { padding: 4 },
  addBtn:          { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  headerTitulo:    { fontSize: 20, fontWeight: '700', color: '#fff' },
  headerSub:       { fontSize: 12, color: '#fecaca', marginTop: 2 },
  contadoresRow:   { flexDirection: 'row', backgroundColor: '#fff', paddingVertical: 12, paddingHorizontal: 12, gap: 8, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  contadorCard:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 2, borderRadius: 10, paddingVertical: 6 },
  contadorNum:     { fontSize: 17, fontWeight: '800' },
  dot:             { width: 9, height: 9, borderRadius: 5 },
  filtros:         { flexDirection: 'row', padding: 12, gap: 8, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  filtro:          { flex: 1, paddingVertical: 7, borderRadius: 20, backgroundColor: '#f1f5f9', alignItems: 'center' },
  filtroAtivo:     { backgroundColor: '#dc2626' },
  filtroTexto:     { fontSize: 13, fontWeight: '600', color: '#64748b' },
  filtroTextoAtivo:{ color: '#fff' },
  vazio:           { padding: 60, alignItems: 'center', gap: 12 },
  vazioTexto:      { color: '#94a3b8', fontSize: 15 },
  cartao:          { backgroundColor: '#fff', marginHorizontal: 16, marginTop: 12, borderRadius: 14, padding: 14, borderLeftWidth: 4, shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 2 },
  cartaoTopo:      { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
  nomePaciente:    { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  triagemRow:      { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  triagemLabel:    { fontSize: 12, fontWeight: '700' },
  triagemTempo:    { fontSize: 11, color: '#94a3b8' },
  estadoBadge:     { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  estadoTexto:     { fontSize: 12, fontWeight: '600' },
  queixa:          { fontSize: 13, color: '#475569', marginBottom: 8 },
  rodape:          { flexDirection: 'row', gap: 14, flexWrap: 'wrap' },
  infoRow:         { flexDirection: 'row', alignItems: 'center', gap: 4 },
  infoTexto:       { fontSize: 12, color: '#64748b' },
  // Modal
  modalOverlay:    { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet:      { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24 },
  modalHandle:     { width: 40, height: 4, borderRadius: 2, backgroundColor: '#e2e8f0', alignSelf: 'center', marginBottom: 20 },
  modalTitulo:     { fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 20 },
  fieldLabel:      { fontSize: 12, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  fieldOpcional:   { fontSize: 11, fontWeight: '400', color: '#94a3b8', textTransform: 'none', letterSpacing: 0 },
  input:           { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 12, fontSize: 14, color: '#1e293b', backgroundColor: '#f8fafc', marginBottom: 16 },
  triagemGrid:     { gap: 8, marginBottom: 16 },
  triagemBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 2, borderRadius: 12, padding: 12 },
  triagemBtnLabel: { fontSize: 14, fontWeight: '700' },
  triagemBtnTempo: { fontSize: 12, fontWeight: '600' },
  modalBtns:       { flexDirection: 'row', gap: 10, marginTop: 4 },
  btnCancelar:     { flex: 1, paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' },
  btnCancelarTexto:{ fontSize: 14, fontWeight: '600', color: '#64748b' },
  btnConfirmar:    { flex: 2, paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
  btnConfirmarTexto:{ fontSize: 14, fontWeight: '700', color: '#fff' },
  // Ações episódio
  acaoHeader:      { borderLeftWidth: 4, paddingLeft: 12, marginBottom: 4 },
  acaoNome:        { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  acaoQueixa:      { fontSize: 13, color: '#64748b', marginTop: 2 },
  acaoEstado:      { fontSize: 12, color: '#64748b', fontWeight: '600' },
  semAcoes:        { fontSize: 13, color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', marginTop: 8 },
  acaoBtn:         { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderRadius: 12, padding: 14, marginBottom: 8, backgroundColor: '#f8fafc' },
  acaoBtnTexto:    { fontSize: 14, fontWeight: '700' },
});
