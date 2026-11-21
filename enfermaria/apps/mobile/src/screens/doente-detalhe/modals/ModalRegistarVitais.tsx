import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, Alert, ScrollView, StyleSheet } from 'react-native';
import { shared } from '../styles';
import api from '../../../lib/api';
import { useNetworkStatus } from '../../../lib/network';
import { enqueue } from '../../../lib/mutation-queue';
import { avaliarCoerenciaVitais } from '@org/shared';

interface Props { visible: boolean; doenteId: string; onClose: () => void; onSaved: () => void }

export default function ModalRegistarVitais({ visible, doenteId, onClose, onSaved }: Props) {
  const isOnline = useNetworkStatus();
  const [pS, setPS] = useState('');
  const [pD, setPD] = useState('');
  const [pulso, setPulso] = useState('');
  const [temp, setTemp] = useState('');
  const [spo2, setSpo2] = useState('');
  const [fr, setFr] = useState('');
  const [peso, setPeso] = useState('');
  const [notas, setNotas] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (visible) { setPS(''); setPD(''); setPulso(''); setTemp(''); setSpo2(''); setFr(''); setPeso(''); setNotas(''); }
  }, [visible]);

  const submeter = async () => {
    const body = {
      pressaoSistolica: pS ? parseInt(pS) : undefined,
      pressaoDiastolica: pD ? parseInt(pD) : undefined,
      pulso: pulso ? parseInt(pulso) : undefined,
      temperatura: temp ? parseFloat(temp) : undefined,
      saturacaoO2: spo2 ? parseInt(spo2) : undefined,
      frequenciaRespiratoria: fr ? parseInt(fr) : undefined,
      peso: peso ? parseFloat(peso) : undefined,
      notas: notas || undefined,
      // MB-05: a hora em que o enfermeiro MEDIU, capturada aqui e não inferida pelo
      // servidor. Um registo feito sem rede podia sincronizar horas depois e ficava
      // datado da sincronização — a tendência do NEWS2 lia os valores no momento errado.
      medidoEm: new Date().toISOString(),
    };
    // QA-16: a mesma regra da API (libs/shared). Avaliada aqui, antes da fila offline: um 4xx na
    // sincronização perdia o registo.
    const { erro, criticos } = avaliarCoerenciaVitais(body);
    if (erro) { Alert.alert('Registo incoerente', erro); return; }
    if (criticos.length) {
      Alert.alert(
        'Valores críticos',
        `Estes valores são incompatíveis com a vida ou extremos: ${criticos.join(', ')}. Confirme que estão certos (se for uma emergência, ative o protocolo).`,
        [{ text: 'Corrigir', style: 'cancel' }, { text: 'Os valores estão certos', style: 'destructive', onPress: () => void enviar({ ...body, confirmarValorCritico: true }) }],
      );
      return;
    }
    await enviar(body);
  };

  const enviar = async (body: object) => {
    setSalvando(true);
    try {
      if (!isOnline) {
        await enqueue({ method: 'POST', url: `/sinais-vitais/${doenteId}`, body });
        Alert.alert('Guardado localmente', 'Será enviado quando houver ligação.');
        onClose();
        return;
      }
      await api.post(`/sinais-vitais/${doenteId}`, body);
      onClose(); onSaved();
    } catch (e: any) {
      Alert.alert('Erro', e.response?.data?.message ?? 'Erro ao registar sinais vitais');
    } finally { setSalvando(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={shared.overlay}>
        <View style={[shared.modalSheet, shared.modalSheetTall]}>
          <View style={shared.sheetCabecalho}>
            <Text style={shared.sheetTitulo}>Registar Sinais Vitais</Text>
            <TouchableOpacity accessibilityRole="button" onPress={onClose}><Text style={shared.fecharTexto}>✕</Text></TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={s.row}>
              <View style={s.col}><Text style={shared.formLabel}>TA Sistólica (mmHg)</Text><TextInput style={shared.formInput} value={pS} onChangeText={setPS} keyboardType="numeric" placeholder="120" /></View>
              <View style={s.col}><Text style={shared.formLabel}>TA Diastólica (mmHg)</Text><TextInput style={shared.formInput} value={pD} onChangeText={setPD} keyboardType="numeric" placeholder="80" /></View>
            </View>
            <View style={s.row}>
              <View style={s.col}><Text style={shared.formLabel}>Pulso (bpm)</Text><TextInput style={shared.formInput} value={pulso} onChangeText={setPulso} keyboardType="numeric" placeholder="72" /></View>
              <View style={s.col}><Text style={shared.formLabel}>Temperatura (ºC)</Text><TextInput style={shared.formInput} value={temp} onChangeText={setTemp} keyboardType="decimal-pad" placeholder="36.5" /></View>
            </View>
            <View style={s.row}>
              <View style={s.col}><Text style={shared.formLabel}>SpO₂ (%)</Text><TextInput style={shared.formInput} value={spo2} onChangeText={setSpo2} keyboardType="numeric" placeholder="98" /></View>
              <View style={s.col}><Text style={shared.formLabel}>Freq. Resp. (rpm)</Text><TextInput style={shared.formInput} value={fr} onChangeText={setFr} keyboardType="numeric" placeholder="16" /></View>
            </View>
            <Text style={shared.formLabel}>Peso (kg)</Text>
            <TextInput style={shared.formInput} value={peso} onChangeText={setPeso} keyboardType="decimal-pad" placeholder="70.5" />
            <Text style={shared.formLabel}>Notas</Text>
            <TextInput style={[shared.formInput, { minHeight: 50, textAlignVertical: 'top' }]} value={notas} onChangeText={setNotas} placeholder="Observações adicionais..." multiline />
          </ScrollView>
          <View style={shared.modalBotoes}>
            <TouchableOpacity accessibilityRole="button" style={shared.cancelarBotao} onPress={onClose}><Text style={shared.cancelarTexto}>Cancelar</Text></TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" style={[shared.submeterBotao, salvando && shared.submeterDesativado]} onPress={submeter} disabled={salvando}>
              <Text style={shared.submeterTexto}>{salvando ? 'A guardar...' : 'Guardar'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({ row: { flexDirection: 'row', gap: 10 }, col: { flex: 1 } });
