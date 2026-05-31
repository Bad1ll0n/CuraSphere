import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, Alert } from 'react-native';
import { shared } from '../styles';
import api from '../../../lib/api';

interface Props { visible: boolean; doenteId: string; onClose: () => void; onSaved: () => void }

export default function ModalPrescreverMedicacao({ visible, doenteId, onClose, onSaved }: Props) {
  const [nome, setNome] = useState('');
  const [dose, setDose] = useState('');
  const [via, setVia] = useState('');
  const [freq, setFreq] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => { if (visible) { setNome(''); setDose(''); setVia(''); setFreq(''); } }, [visible]);

  const submeter = async () => {
    if (!nome.trim() || !dose.trim() || !via.trim() || !freq.trim()) return;
    setSalvando(true);
    try {
      await api.post('/medicacao/prescrever', { doenteId, nome, dose, via, frequencia: freq });
      onClose(); onSaved();
    } catch (e: any) {
      Alert.alert('Erro', e.response?.data?.message ?? 'Erro ao prescrever medicação');
    } finally { setSalvando(false); }
  };

  const disabled = !nome.trim() || !dose.trim() || !via.trim() || !freq.trim() || salvando;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={shared.overlay}>
        <View style={shared.modalSheet}>
          <View style={shared.sheetCabecalho}>
            <Text style={shared.sheetTitulo}>Prescrever Medicação</Text>
            <TouchableOpacity onPress={onClose}><Text style={shared.fecharTexto}>✕</Text></TouchableOpacity>
          </View>
          <Text style={shared.formLabel}>Medicamento *</Text>
          <TextInput style={shared.formInput} value={nome} onChangeText={setNome} placeholder="Nome do medicamento" />
          <Text style={shared.formLabel}>Dose *</Text>
          <TextInput style={shared.formInput} value={dose} onChangeText={setDose} placeholder="Ex: 500mg" />
          <Text style={shared.formLabel}>Via *</Text>
          <TextInput style={shared.formInput} value={via} onChangeText={setVia} placeholder="Ex: Oral, IV, IM" />
          <Text style={shared.formLabel}>Frequência *</Text>
          <TextInput style={shared.formInput} value={freq} onChangeText={setFreq} placeholder="Ex: 8 em 8 horas" />
          <View style={shared.modalBotoes}>
            <TouchableOpacity style={shared.cancelarBotao} onPress={onClose}><Text style={shared.cancelarTexto}>Cancelar</Text></TouchableOpacity>
            <TouchableOpacity style={[shared.submeterBotao, disabled && shared.submeterDesativado]} onPress={submeter} disabled={disabled}>
              <Text style={shared.submeterTexto}>{salvando ? 'A guardar...' : 'Prescrever'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
