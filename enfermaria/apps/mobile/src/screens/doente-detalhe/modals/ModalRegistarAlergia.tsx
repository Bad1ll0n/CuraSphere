import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, Alert } from 'react-native';
import { shared } from '../styles';
import SelectPicker from '../../../components/SelectPicker';
import api from '../../../lib/api';

interface Props { visible: boolean; doenteId: string; onClose: () => void; onSaved: () => void }

export default function ModalRegistarAlergia({ visible, doenteId, onClose, onSaved }: Props) {
  const [alergenio, setAlergenio] = useState('');
  const [tipo, setTipo] = useState('medicamento');
  const [sev, setSev] = useState('moderada');
  const [notas, setNotas] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => { if (visible) { setAlergenio(''); setTipo('medicamento'); setSev('moderada'); setNotas(''); } }, [visible]);

  const submeter = async () => {
    if (!alergenio.trim()) return;
    setSalvando(true);
    try {
      await api.post(`/alergias/${doenteId}`, { alergenio, tipo, severidade: sev, notas: notas || undefined });
      onClose(); onSaved();
    } catch (e: any) {
      Alert.alert('Erro', e.response?.data?.message ?? 'Erro ao registar alergia');
    } finally { setSalvando(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={shared.overlay}>
        <View style={shared.modalSheet}>
          <View style={shared.sheetCabecalho}>
            <Text style={shared.sheetTitulo}>Registar Alergia</Text>
            <TouchableOpacity onPress={onClose}><Text style={shared.fecharTexto}>✕</Text></TouchableOpacity>
          </View>
          <Text style={shared.formLabel}>Agente alérgeno *</Text>
          <TextInput style={shared.formInput} value={alergenio} onChangeText={setAlergenio} placeholder="Ex: Penicilina, Ibuprofeno..." />
          <Text style={shared.formLabel}>Tipo</Text>
          <SelectPicker options={[{ value: 'medicamento', label: 'Med.' }, { value: 'alimento', label: 'Alim.' }, { value: 'ambiental', label: 'Amb.' }, { value: 'outro', label: 'Outro' }]} value={tipo} onChange={setTipo} />
          <Text style={shared.formLabel}>Severidade</Text>
          <SelectPicker options={[{ value: 'ligeira', label: 'Ligeira' }, { value: 'moderada', label: 'Moder.' }, { value: 'grave', label: 'Grave' }, { value: 'anafilaxia', label: 'Anafilax.' }]} value={sev} onChange={setSev} />
          <Text style={shared.formLabel}>Notas</Text>
          <TextInput style={shared.formInput} value={notas} onChangeText={setNotas} placeholder="Observações..." />
          <View style={shared.modalBotoes}>
            <TouchableOpacity style={shared.cancelarBotao} onPress={onClose}><Text style={shared.cancelarTexto}>Cancelar</Text></TouchableOpacity>
            <TouchableOpacity style={[shared.submeterBotao, (!alergenio.trim() || salvando) && shared.submeterDesativado]} onPress={submeter} disabled={!alergenio.trim() || salvando}>
              <Text style={shared.submeterTexto}>{salvando ? 'A guardar...' : 'Registar'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
