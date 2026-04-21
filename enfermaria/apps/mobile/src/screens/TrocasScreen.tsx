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
const estadoConfig: Record<string, { label: string; cor: string; bg: string }> = {
  pendente_destinatario: { label: 'Aguarda resposta',  cor: '#92400e', bg: '#fef3c7' },
  pendente_chefe:        { label: 'Aguarda aprovação', cor: '#1e40af', bg: '#dbeafe' },
  aprovado:              { label: 'Aprovado',          cor: '#166534', bg: '#dcfce7' },
  rejeitado:             { label: 'Rejeitado',         cor: '#991b1b', bg: '#fee2e2' },
};

export default function TrocasScreen({ utilizador, onVoltar }: Props) {
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal novo pedido
  const [modalAberto, setModalAberto] = useState(false);
  const [meusTurnos, setMeusTurnos] = useState<any[]>([]);
  const [turnoSelecionado, setTurnoSelecionado] = useState<any>(null);
  const [colegas, setColegas] = useState<any[]>([]);
  const [colegaSelecionado, setColegaSelecionado] = useState<any>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const isChefe = utilizador.role === 'chefe_enfermeiros';

  const carregar = async () => {
    try {
      const { data } = await api.get('/trocas');
      setPedidos(data);
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { carregar(); }, []));

  const abrirModal = async () => {
    const hoje = new Date();
    try {
      const r = await api.get(`/horarios/meu?mes=${hoje.getMonth() + 1}&ano=${hoje.getFullYear()}`);
      const futuros = r.data
        .map((h: any) => h.horarioTurno)
        .filter((t: any) => new Date(t.data) >= hoje);
      setMeusTurnos(futuros);
    } catch { setMeusTurnos([]); }
    setTurnoSelecionado(null);
    setColegas([]);
    setColegaSelecionado(null);
    setErro('');
    setModalAberto(true);
  };

  const selecionarTurno = async (turno: any) => {
    setTurnoSelecionado(turno);
    setColegaSelecionado(null);
    setColegas([]);
    try {
      const r = await api.get(`/trocas/colegas?turnoId=${turno.id}`);
      setColegas(r.data);
    } catch (e: any) {
      setErro(e.response?.data?.message ?? 'Erro ao carregar colegas');
    }
  };

  const submeter = async () => {
    if (!turnoSelecionado || !colegaSelecionado) return;
    setSalvando(true);
    setErro('');
    try {
      await api.post('/trocas', { turnoId: turnoSelecionado.id, destinatarioId: colegaSelecionado.id });
      setModalAberto(false);
      await carregar();
    } catch (e: any) {
      setErro(e.response?.data?.message ?? 'Erro ao enviar pedido');
    } finally { setSalvando(false); }
  };

  const responder = async (id: string, aceitar: boolean) => {
    try {
      await api.patch(`/trocas/${id}/responder`, { aceitar });
      await carregar();
    } catch { Alert.alert('Erro', 'Não foi possível responder'); }
  };

  const aprovar = async (id: string, aprovar: boolean) => {
    try {
      await api.patch(`/trocas/${id}/aprovar`, { aprovar });
      await carregar();
    } catch { Alert.alert('Erro', 'Não foi possível processar'); }
  };

  const cancelar = async (id: string) => {
    Alert.alert('Cancelar', 'Tem a certeza que quer cancelar este pedido?', [
      { text: 'Não', style: 'cancel' },
      { text: 'Sim', style: 'destructive', onPress: async () => {
        try { await api.delete(`/trocas/${id}`); await carregar(); } catch {}
      }},
    ]);
  };

  const pendentesResposta = pedidos.filter((p) => p.estado === 'pendente_destinatario' && p.destinatario.id === utilizador.id);
  const meusEnviados = pedidos.filter((p) => p.solicitante.id === utilizador.id && ['pendente_destinatario', 'pendente_chefe'].includes(p.estado));
  const pendentesAprovacao = pedidos.filter((p) => p.estado === 'pendente_chefe');
  const historico = pedidos.filter((p) => p.solicitante.id === utilizador.id && ['aprovado', 'rejeitado'].includes(p.estado));

  const PedidoCard = ({ p }: { p: any }) => {
    const cfg = estadoConfig[p.estado] ?? estadoConfig.rejeitado;
    const euSolicitei = p.solicitante.id === utilizador.id;
    return (
      <View style={s.pedidoCard}>
        <View style={s.pedidoTopo}>
          <View style={[s.turnoBadge, { backgroundColor: tipoCor[p.turno.tipo] + '20' }]}>
            <Text style={[s.turnoBadgeTexto, { color: tipoCor[p.turno.tipo] }]}>
              {tipoLabel[p.turno.tipo]} · {new Date(p.turno.data).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })}
            </Text>
          </View>
          <View style={[s.estadoBadge, { backgroundColor: cfg.bg }]}>
            <Text style={[s.estadoBadgeTexto, { color: cfg.cor }]}>{cfg.label}</Text>
          </View>
        </View>
        <Text style={s.pedidoDesc}>
          {euSolicitei
            ? `Tu → ${p.destinatario.nome}`
            : `${p.solicitante.nome} pediu-te cobertura`}
        </Text>
        <Text style={s.pedidoData}>{new Date(p.criadoEm).toLocaleDateString('pt-PT')}</Text>

        {/* Ações */}
        {!isChefe && p.destinatario.id === utilizador.id && p.estado === 'pendente_destinatario' && (
          <View style={s.acoes}>
            <TouchableOpacity style={s.recusarBotao} onPress={() => responder(p.id, false)}>
              <Text style={s.recusarTexto}>Recusar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.aceitarBotao} onPress={() => responder(p.id, true)}>
              <Text style={s.aceitarTexto}>Aceitar</Text>
            </TouchableOpacity>
          </View>
        )}
        {!isChefe && euSolicitei && p.estado === 'pendente_destinatario' && (
          <TouchableOpacity style={s.cancelarBotao} onPress={() => cancelar(p.id)}>
            <Text style={s.cancelarTexto}>Cancelar pedido</Text>
          </TouchableOpacity>
        )}
        {isChefe && p.estado === 'pendente_chefe' && (
          <View style={s.acoes}>
            <TouchableOpacity style={s.recusarBotao} onPress={() => aprovar(p.id, false)}>
              <Text style={s.recusarTexto}>Rejeitar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.aceitarBotao} onPress={() => aprovar(p.id, true)}>
              <Text style={s.aceitarTexto}>Aprovar</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onVoltar} style={s.voltarBotao}>
          <Text style={s.voltarTexto}>‹  Voltar</Text>
        </TouchableOpacity>
        <View style={s.headerRow}>
          <View>
            <Text style={s.titulo}>Trocas de Turno</Text>
            <Text style={s.subtituloH}>{isChefe ? 'Pedidos de aprovação' : 'Pede cobertura a um colega'}</Text>
          </View>
          {!isChefe && (
            <TouchableOpacity style={s.addBotao} onPress={abrirModal}>
              <Text style={s.addTexto}>+ Pedido</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <View style={s.centro}><ActivityIndicator size="large" color="#2563eb" /></View>
      ) : (
        <ScrollView
          style={s.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); carregar(); }} />}
        >
          {/* Chefe: pendentes aprovação */}
          {isChefe && pendentesAprovacao.length > 0 && (
            <View style={s.secao}>
              <Text style={s.secaoTitulo}>Pendentes de Aprovação · {pendentesAprovacao.length}</Text>
              {pendentesAprovacao.map((p) => <PedidoCard key={p.id} p={p} />)}
            </View>
          )}

          {/* Pedidos recebidos (para mim) */}
          {!isChefe && pendentesResposta.length > 0 && (
            <View style={s.secao}>
              <Text style={s.secaoTitulo}>Pedidos Recebidos · {pendentesResposta.length}</Text>
              {pendentesResposta.map((p) => <PedidoCard key={p.id} p={p} />)}
            </View>
          )}

          {/* Meus pedidos enviados */}
          {!isChefe && (
            <View style={s.secao}>
              <Text style={s.secaoTitulo}>Meus Pedidos · {meusEnviados.length}</Text>
              {meusEnviados.length === 0
                ? <Text style={s.vazioTexto}>Sem pedidos enviados</Text>
                : meusEnviados.map((p) => <PedidoCard key={p.id} p={p} />)
              }
            </View>
          )}

          {/* Histórico */}
          {historico.length > 0 && (
            <View style={[s.secao, { marginBottom: 32 }]}>
              <Text style={s.secaoTitulo}>Histórico · {historico.length}</Text>
              {historico.map((p) => <PedidoCard key={p.id} p={p} />)}
            </View>
          )}

          {pedidos.length === 0 && !isChefe && (
            <View style={s.centro}>
              <Text style={s.vazioTexto}>Sem pedidos. Toque em "+ Pedido" para pedir cobertura.</Text>
            </View>
          )}
          {pedidos.length === 0 && isChefe && (
            <View style={s.centro}>
              <Text style={s.vazioTexto}>Sem pedidos pendentes.</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Modal: Novo Pedido */}
      <Modal visible={modalAberto} transparent animationType="slide" onRequestClose={() => setModalAberto(false)}>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <View style={s.sheetCabecalho}>
              <Text style={s.sheetTitulo}>Pedir Cobertura</Text>
              <TouchableOpacity onPress={() => setModalAberto(false)}>
                <Text style={s.fechar}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={s.stepLabel}>1. O teu turno</Text>
            {meusTurnos.length === 0
              ? <Text style={s.vazioTexto}>Sem turnos futuros disponíveis</Text>
              : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {meusTurnos.map((t) => (
                      <TouchableOpacity
                        key={t.id}
                        style={[s.turnoPill, turnoSelecionado?.id === t.id && s.turnoPillAtivo]}
                        onPress={() => selecionarTurno(t)}
                      >
                        <Text style={[s.turnoPillTexto, turnoSelecionado?.id === t.id && s.turnoPillTextoAtivo]}>
                          {tipoLabel[t.tipo]} · {new Date(t.data).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              )}

            {turnoSelecionado && (
              <>
                <Text style={s.stepLabel}>2. Quem te vai cobrir</Text>
                {colegas.length === 0
                  ? <Text style={s.vazioTexto}>Sem colegas disponíveis</Text>
                  : (
                    <ScrollView style={{ maxHeight: 200 }}>
                      {colegas.map((c) => (
                        <TouchableOpacity
                          key={c.id}
                          style={[s.colegaRow, colegaSelecionado?.id === c.id && s.colegaRowAtivo]}
                          onPress={() => setColegaSelecionado(c)}
                        >
                          <Text style={s.colegaNome}>{c.nome}</Text>
                          {colegaSelecionado?.id === c.id && <Text style={{ color: '#2563eb', fontWeight: '700' }}>✓</Text>}
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  )}
              </>
            )}

            {erro ? <Text style={s.erroTexto}>{erro}</Text> : null}

            <View style={s.botoes}>
              <TouchableOpacity style={s.cancelarBtn} onPress={() => setModalAberto(false)}>
                <Text style={s.cancelarBtnTexto}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.submeterBtn, (!turnoSelecionado || !colegaSelecionado || salvando) && s.submeterBtnDes]}
                onPress={submeter}
                disabled={!turnoSelecionado || !colegaSelecionado || salvando}
              >
                <Text style={s.submeterBtnTexto}>{salvando ? 'A enviar...' : 'Enviar Pedido'}</Text>
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
  voltarBotao: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, marginBottom: 10 },
  voltarTexto: { color: '#fff', fontSize: 12, fontWeight: '600' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  titulo: { fontSize: 20, fontWeight: '700', color: '#fff' },
  subtituloH: { fontSize: 13, color: '#94a3b8', marginTop: 2 },
  addBotao: { backgroundColor: '#2563eb', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  addTexto: { color: '#fff', fontWeight: '700', fontSize: 13 },
  scroll: { flex: 1 },
  secao: { padding: 16 },
  secaoTitulo: { fontSize: 13, fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  pedidoCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 1 }, shadowRadius: 4, elevation: 1 },
  pedidoTopo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  turnoBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  turnoBadgeTexto: { fontSize: 12, fontWeight: '600' },
  estadoBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  estadoBadgeTexto: { fontSize: 11, fontWeight: '600' },
  pedidoDesc: { fontSize: 14, fontWeight: '600', color: '#1e293b', marginBottom: 4 },
  pedidoData: { fontSize: 12, color: '#94a3b8' },
  acoes: { flexDirection: 'row', gap: 8, marginTop: 12 },
  recusarBotao: { flex: 1, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: '#fecaca', alignItems: 'center' },
  recusarTexto: { color: '#dc2626', fontWeight: '600', fontSize: 13 },
  aceitarBotao: { flex: 1, paddingVertical: 9, borderRadius: 10, backgroundColor: '#2563eb', alignItems: 'center' },
  aceitarTexto: { color: '#fff', fontWeight: '700', fontSize: 13 },
  cancelarBotao: { marginTop: 10, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' },
  cancelarTexto: { color: '#64748b', fontWeight: '600', fontSize: 13 },
  vazioTexto: { color: '#94a3b8', fontSize: 14, textAlign: 'center', paddingVertical: 12 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '85%' },
  sheetCabecalho: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sheetTitulo: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  fechar: { fontSize: 18, color: '#94a3b8', fontWeight: '700' },
  stepLabel: { fontSize: 12, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  turnoPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#e2e8f0' },
  turnoPillAtivo: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  turnoPillTexto: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  turnoPillTextoAtivo: { color: '#2563eb' },
  colegaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  colegaRowAtivo: { backgroundColor: '#eff6ff', borderRadius: 8, paddingHorizontal: 8 },
  colegaNome: { fontSize: 14, color: '#1e293b', fontWeight: '500' },
  erroTexto: { color: '#dc2626', fontSize: 13, marginTop: 8 },
  botoes: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelarBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#e2e8f0', alignItems: 'center' },
  cancelarBtnTexto: { fontWeight: '600', color: '#64748b', fontSize: 14 },
  submeterBtn: { flex: 2, paddingVertical: 12, borderRadius: 10, backgroundColor: '#2563eb', alignItems: 'center' },
  submeterBtnDes: { backgroundColor: '#93c5fd' },
  submeterBtnTexto: { fontWeight: '700', color: '#fff', fontSize: 14 },
});
