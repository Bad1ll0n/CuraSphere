import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, TextInput, Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../lib/api';
import { Utilizador } from '../lib/auth';

interface Props { utilizador: Utilizador; onVoltar: () => void }

const estadoCor: Record<string, string> = {
  livre: '#22c55e', ocupada: '#ef4444', em_limpeza: '#f59e0b', reservada: '#3b82f6',
};
const estadoLabel: Record<string, string> = {
  livre: 'Livre', ocupada: 'Ocupada', em_limpeza: 'Em Limpeza', reservada: 'Reservada',
};
const estadoDoenteLabel: Record<string, string> = {
  estavel: 'Estável', grave: 'Grave', critico: 'Crítico', alta_prevista: 'Alta Prevista',
};
const estadoDoenteCor: Record<string, string> = {
  estavel: '#22c55e', grave: '#f97316', critico: '#ef4444', alta_prevista: '#3b82f6',
};

export default function CamasScreen({ utilizador, onVoltar }: Props) {
  const [camas, setCamas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal nova cama
  const [modalCama, setModalCama] = useState(false);
  const [novaCamaNumero, setNovaCamaNumero] = useState('');
  const [novaCamaQuarto, setNovaCamaQuarto] = useState('');
  const [salvandoCama, setSalvandoCama] = useState(false);

  // Modal alterar estado da cama
  const [camaEditando, setCamaEditando] = useState<any>(null);

  const podeGerir = ['administrativo', 'chefe_enfermeiros', 'chefe_turno'].includes(utilizador.role);
  const podeCriar = ['administrativo', 'chefe_enfermeiros'].includes(utilizador.role);

  const carregar = async () => {
    try {
      const { data } = await api.get('/camas');
      setCamas(data);
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { carregar(); }, []));

  const alterarEstado = async (id: string, estado: string) => {
    try {
      await api.patch(`/camas/${id}/estado`, { estado });
      setCamaEditando(null);
      await carregar();
    } catch {
      Alert.alert('Erro', 'Não foi possível alterar o estado');
    }
  };

  const criarCama = async () => {
    if (!novaCamaNumero.trim() || !novaCamaQuarto.trim()) return;
    setSalvandoCama(true);
    try {
      await api.post('/camas', { numero: novaCamaNumero.trim(), quarto: novaCamaQuarto.trim() });
      setModalCama(false);
      setNovaCamaNumero('');
      setNovaCamaQuarto('');
      await carregar();
    } catch (e: any) {
      Alert.alert('Erro', e.response?.data?.message ?? 'Erro ao criar cama');
    } finally {
      setSalvandoCama(false);
    }
  };

  const quartos = [...new Set(camas.map((c) => c.quarto))].sort();
  const ocupadas = camas.filter((c) => c.estado === 'ocupada').length;

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onVoltar} style={s.voltarBotao}>
          <Text style={s.voltarTexto}>← Voltar</Text>
        </TouchableOpacity>
        <View style={s.headerRow}>
          <View>
            <Text style={s.titulo}>Mapa de Camas</Text>
            <Text style={s.subtitulo}>{ocupadas} de {camas.length} ocupadas</Text>
          </View>
          {podeCriar && (
            <TouchableOpacity style={s.addBotao} onPress={() => setModalCama(true)}>
              <Text style={s.addTexto}>+ Cama</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Legenda */}
      <View style={s.legenda}>
        {Object.entries(estadoLabel).map(([k, v]) => (
          <View key={k} style={s.legendaItem}>
            <View style={[s.legendaDot, { backgroundColor: estadoCor[k] }]} />
            <Text style={s.legendaTexto}>{v}</Text>
          </View>
        ))}
      </View>

      {loading ? (
        <View style={s.centro}><ActivityIndicator size="large" color="#2563eb" /></View>
      ) : (
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); carregar(); }} />}
        >
          {quartos.map((quarto) => (
            <View key={quarto} style={s.quartoSecao}>
              <Text style={s.quartoTitulo}>Quarto {quarto}</Text>
              <View style={s.camasGrid}>
                {camas.filter((c) => c.quarto === quarto).map((cama) => (
                  <TouchableOpacity
                    key={cama.id}
                    style={[s.camaCard, { borderColor: estadoCor[cama.estado] + '60', backgroundColor: estadoCor[cama.estado] + '10' }]}
                    onPress={() => podeGerir && cama.estado !== 'ocupada' && setCamaEditando(cama)}
                    activeOpacity={podeGerir && cama.estado !== 'ocupada' ? 0.7 : 1}
                  >
                    <View style={s.camaCabecalho}>
                      <View style={[s.camaDot, { backgroundColor: estadoCor[cama.estado] }]} />
                      <Text style={s.camaNumero}>Cama {cama.numero}</Text>
                    </View>
                    <View style={[s.camaEstadoBadge, { backgroundColor: estadoCor[cama.estado] + '20' }]}>
                      <Text style={[s.camaEstadoTexto, { color: estadoCor[cama.estado] }]}>{estadoLabel[cama.estado]}</Text>
                    </View>
                    {cama.doente ? (
                      <View style={s.doenteMini}>
                        <Text style={s.doenteMiniNome} numberOfLines={1}>{cama.doente.nome}</Text>
                        <Text style={[s.doenteMiniEstado, { color: estadoDoenteCor[cama.doente.estado] }]}>
                          {estadoDoenteLabel[cama.doente.estado]}
                        </Text>
                      </View>
                    ) : (
                      <Text style={s.semDoente}>Sem doente</Text>
                    )}
                    {podeGerir && cama.estado !== 'ocupada' && (
                      <Text style={s.editarTexto}>Toque para alterar</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}

      {/* Modal: Alterar Estado Cama */}
      <Modal visible={!!camaEditando} transparent animationType="fade" onRequestClose={() => setCamaEditando(null)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setCamaEditando(null)}>
          <View onStartShouldSetResponder={() => true} style={s.sheet}>
            <Text style={s.sheetTitulo}>Cama {camaEditando?.numero} — Alterar Estado</Text>
            {(['livre', 'em_limpeza', 'reservada'] as const).map((estado) => (
              <TouchableOpacity
                key={estado}
                style={[s.estadoOpcao, camaEditando?.estado === estado && s.estadoOpcaoAtiva]}
                onPress={() => alterarEstado(camaEditando.id, estado)}
              >
                <View style={[s.estadoOpcaoDot, { backgroundColor: estadoCor[estado] }]} />
                <Text style={s.estadoOpcaoTexto}>{estadoLabel[estado]}</Text>
                {camaEditando?.estado === estado && <Text style={s.checkmark}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Modal: Nova Cama */}
      <Modal visible={modalCama} transparent animationType="slide" onRequestClose={() => setModalCama(false)}>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <View style={s.sheetCabecalho}>
              <Text style={s.sheetTitulo}>Nova Cama</Text>
              <TouchableOpacity onPress={() => setModalCama(false)}>
                <Text style={s.fechar}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={s.formLabel}>Quarto</Text>
            <TextInput style={s.formInput} value={novaCamaQuarto} onChangeText={setNovaCamaQuarto} placeholder="Ex: A, 1, 101" />
            <Text style={s.formLabel}>Número da Cama</Text>
            <TextInput style={s.formInput} value={novaCamaNumero} onChangeText={setNovaCamaNumero} placeholder="Ex: 1, 2A" />
            <View style={s.botoes}>
              <TouchableOpacity style={s.cancelar} onPress={() => setModalCama(false)}>
                <Text style={s.cancelarTexto}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.submeter, (!novaCamaNumero.trim() || !novaCamaQuarto.trim() || salvandoCama) && s.submeterDes]}
                onPress={criarCama}
                disabled={!novaCamaNumero.trim() || !novaCamaQuarto.trim() || salvandoCama}
              >
                <Text style={s.submeterTexto}>{salvandoCama ? 'A criar...' : 'Criar'}</Text>
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
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { backgroundColor: '#1e293b', padding: 20, paddingTop: 16 },
  voltarBotao: { marginBottom: 10 },
  voltarTexto: { color: '#94a3b8', fontSize: 14 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  titulo: { fontSize: 20, fontWeight: '700', color: '#fff' },
  subtitulo: { fontSize: 13, color: '#94a3b8', marginTop: 2 },
  addBotao: { backgroundColor: '#2563eb', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  addTexto: { color: '#fff', fontWeight: '700', fontSize: 13 },
  legenda: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, padding: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  legendaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendaDot: { width: 8, height: 8, borderRadius: 4 },
  legendaTexto: { fontSize: 12, color: '#64748b' },
  quartoSecao: { padding: 16, paddingBottom: 8 },
  quartoTitulo: { fontSize: 13, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  camasGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  camaCard: { width: '47%', borderWidth: 1.5, borderRadius: 14, padding: 12 },
  camaCabecalho: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  camaDot: { width: 8, height: 8, borderRadius: 4 },
  camaNumero: { fontSize: 13, fontWeight: '700', color: '#334155' },
  camaEstadoBadge: { alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 20, marginBottom: 6 },
  camaEstadoTexto: { fontSize: 11, fontWeight: '600' },
  doenteMini: { marginTop: 4 },
  doenteMiniNome: { fontSize: 12, fontWeight: '600', color: '#1e293b' },
  doenteMiniEstado: { fontSize: 11, marginTop: 1 },
  semDoente: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  editarTexto: { fontSize: 10, color: '#94a3b8', marginTop: 6, fontStyle: 'italic' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  sheetCabecalho: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sheetTitulo: { fontSize: 17, fontWeight: '700', color: '#1e293b', marginBottom: 16 },
  fechar: { fontSize: 18, color: '#94a3b8', fontWeight: '700' },
  estadoOpcao: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  estadoOpcaoAtiva: { backgroundColor: '#f8fafc' },
  estadoOpcaoDot: { width: 10, height: 10, borderRadius: 5 },
  estadoOpcaoTexto: { flex: 1, fontSize: 15, color: '#1e293b', fontWeight: '500' },
  checkmark: { color: '#2563eb', fontWeight: '700', fontSize: 16 },
  formLabel: { fontSize: 13, fontWeight: '600', color: '#475569', marginTop: 12, marginBottom: 6 },
  formInput: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 10, fontSize: 14, color: '#334155', backgroundColor: '#f8fafc' },
  botoes: { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancelar: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#e2e8f0', alignItems: 'center' },
  cancelarTexto: { fontWeight: '600', color: '#64748b', fontSize: 14 },
  submeter: { flex: 2, paddingVertical: 12, borderRadius: 10, backgroundColor: '#2563eb', alignItems: 'center' },
  submeterDes: { backgroundColor: '#93c5fd' },
  submeterTexto: { fontWeight: '700', color: '#fff', fontSize: 14 },
});
