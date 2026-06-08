import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet, Modal } from 'react-native';
import { BarCodeScanner } from 'expo-barcode-scanner';
import { shared } from '../styles';
import EmptyState from '../../../components/EmptyState';
import api from '../../../lib/api';

interface Props {
  doenteId: string;
  medicacoesAtivas: any[];
  podePrescreveMed: boolean;
  podeRegistarMed: boolean;
  onHistorico: () => void;
  onPrescrever: () => void;
  onRegistar: (id: string) => void;
  onConcluir: (id: string) => void;
}

export default function TabMedicacao({ doenteId, medicacoesAtivas, podePrescreveMed, podeRegistarMed, onHistorico, onPrescrever, onRegistar, onConcluir }: Props) {
  const [scanAtivo, setScanAtivo] = useState(false);
  const [scanFeito, setScanFeito] = useState(false);

  const abrirScanner = async () => {
    const { status } = await BarCodeScanner.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissão necessária', 'Active o acesso à câmara para usar o scanner.');
      return;
    }
    setScanFeito(false);
    setScanAtivo(true);
  };

  const onScan = async ({ data }: { data: string }) => {
    if (scanFeito) return;
    setScanFeito(true);
    setScanAtivo(false);
    try {
      const res = await api.post('/medicacao/verificar-5-certos', {
        qrPayload: data,
        doenteIdEsperado: doenteId,
      });
      const r = res.data;
      if (r.valido) {
        Alert.alert(
          '✅ 5 Certos confirmados',
          `${r.medicacao?.nome ?? ''} ${r.medicacao?.dose ?? ''}\nVia: ${r.medicacao?.via ?? ''}\n\nSeguro administrar.`,
        );
      } else {
        const falhas = (r.falhas ?? []).map((f: any) => `• ${f.certo}: ${f.motivo}`).join('\n');
        Alert.alert('❌ Verificação falhou', falhas || 'Erro desconhecido.', [{ text: 'OK', style: 'destructive' }]);
      }
    } catch {
      Alert.alert('Erro', 'Não foi possível verificar o código.');
    }
  };

  return (
    <View style={s.secao}>
      <View style={shared.secaoHeader}>
        <Text style={shared.secaoTitulo}>Medicação Ativa</Text>
        <View style={shared.secaoAcoes}>
          {podeRegistarMed && (
            <TouchableOpacity onPress={abrirScanner} style={[shared.iconBotao, s.scanBotao]}>
              <Text style={s.scanTexto}>📷</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={onHistorico} style={shared.iconBotao}>
            <Text style={shared.iconBotaoTexto}>⏱</Text>
          </TouchableOpacity>
          {podePrescreveMed && (
            <TouchableOpacity onPress={onPrescrever} style={[shared.iconBotao, shared.iconBotaoAzul]}>
              <Text style={shared.iconBotaoTextoAzul}>+</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {medicacoesAtivas.length === 0 ? <EmptyState text="Sem medicação ativa" /> : medicacoesAtivas.map((m: any) => (
        <View key={m.id} style={s.card}>
          <View style={s.info}>
            <Text style={s.nome}>{m.nome} {m.dose}</Text>
            <Text style={s.detalhe}>{m.via} · {m.frequencia}</Text>
            {m.prescritoPor && <Text style={s.detalhe}>Prescrito por {m.prescritoPor.nome}</Text>}
          </View>
          <View style={s.botoes}>
            {podeRegistarMed && (
              <TouchableOpacity style={s.administrarBotao} onPress={() => onRegistar(m.id)}>
                <Text style={s.administrarTexto}>Registar</Text>
              </TouchableOpacity>
            )}
            {podePrescreveMed && (
              <TouchableOpacity style={s.descontinuarBotao} onPress={() => Alert.alert('Confirmar', 'Concluir esta medicação?', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Concluir', style: 'destructive', onPress: () => onConcluir(m.id) }])}>
                <Text style={s.descontinuarTexto}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      ))}

      {/* Modal scanner de barcode */}
      <Modal visible={scanAtivo} animationType="slide" onRequestClose={() => setScanAtivo(false)}>
        <View style={s.scanContainer}>
          <BarCodeScanner
            onBarCodeScanned={onScan}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={s.scanOverlay}>
            <View style={s.scanFrame} />
            <Text style={s.scanDica}>Aponte para o QR / código de barras do medicamento</Text>
          </View>
          <TouchableOpacity style={s.fecharScan} onPress={() => setScanAtivo(false)}>
            <Text style={s.fecharScanTexto}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  secao: { padding: 16 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center' },
  info: { flex: 1 },
  nome: { fontSize: 15, fontWeight: '600', color: '#1e293b' },
  detalhe: { fontSize: 13, color: '#64748b', marginTop: 2 },
  botoes: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  administrarBotao: { backgroundColor: '#dbeafe', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 },
  administrarTexto: { color: '#1d4ed8', fontWeight: '600', fontSize: 13 },
  descontinuarBotao: { backgroundColor: '#fee2e2', width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  descontinuarTexto: { color: '#dc2626', fontWeight: '700', fontSize: 14 },
  scanBotao: { backgroundColor: '#f0fdf4' },
  scanTexto: { fontSize: 16 },
  scanContainer: { flex: 1, backgroundColor: '#000' },
  scanOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  scanFrame: { width: 240, height: 240, borderWidth: 2, borderColor: '#22c55e', borderRadius: 16 },
  scanDica: { color: '#fff', fontSize: 13, marginTop: 20, textAlign: 'center', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  fecharScan: { position: 'absolute', bottom: 48, alignSelf: 'center', backgroundColor: '#1e293b', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 24 },
  fecharScanTexto: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
