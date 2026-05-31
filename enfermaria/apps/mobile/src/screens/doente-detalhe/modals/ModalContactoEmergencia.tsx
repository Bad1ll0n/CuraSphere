import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, Alert, StyleSheet } from 'react-native';
import { shared } from '../styles';
import SelectPicker from '../../../components/SelectPicker';
import api from '../../../lib/api';

interface Props { visible: boolean; doenteId: string; onClose: () => void; onSaved: () => void }

export default function ModalContactoEmergencia({ visible, doenteId, onClose, onSaved }: Props) {
  const [nome, setNome] = useState('');
  const [relacao, setRelacao] = useState('outro');
  const [tel, setTel] = useState('');
  const [principal, setPrincipal] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => { if (visible) { setNome(''); setRelacao('outro'); setTel(''); setPrincipal(false); } }, [visible]);

  const submeter = async () => {
    if (!nome.trim() || !tel.trim()) return;
    setSalvando(true);
    try {
      await api.post(`/contactos/${doenteId}`, { nome, relacao, telefone: tel, principal });
      onClose(); onSaved();
    } catch (e: any) {
      Alert.alert('Erro', e.response?.data?.message ?? 'Erro ao guardar contacto');
    } finally { setSalvando(false); }
  };

  const disabled = !nome.trim() || !tel.trim() || salvando;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={shared.overlay}>
        <View style={shared.modalSheet}>
          <View style={shared.sheetCabecalho}>
            <Text style={shared.sheetTitulo}>Contacto de Emergência</Text>
            <TouchableOpacity onPress={onClose}><Text style={shared.fecharTexto}>✕</Text></TouchableOpacity>
          </View>
          <Text style={shared.formLabel}>Nome *</Text>
          <TextInput style={shared.formInput} value={nome} onChangeText={setNome} placeholder="Nome completo" />
          <Text style={shared.formLabel}>Relação</Text>
          <SelectPicker options={[{ value: 'cônjuge', label: 'Cônjuge' }, { value: 'filho/a', label: 'Filho/a' }, { value: 'pai/mãe', label: 'Pai/Mãe' }, { value: 'outro', label: 'Outro' }]} value={relacao} onChange={setRelacao} />
          <Text style={shared.formLabel}>Telefone *</Text>
          <TextInput style={shared.formInput} value={tel} onChangeText={setTel} placeholder="9xx xxx xxx" keyboardType="phone-pad" />
          <TouchableOpacity style={s.checkRow} onPress={() => setPrincipal(!principal)}>
            <View style={[s.check, { backgroundColor: principal ? '#2563eb' : 'transparent' }]}>
              {principal && <Text style={s.checkMark}>✓</Text>}
            </View>
            <Text style={s.checkLabel}>Contacto principal</Text>
          </TouchableOpacity>
          <View style={shared.modalBotoes}>
            <TouchableOpacity style={shared.cancelarBotao} onPress={onClose}><Text style={shared.cancelarTexto}>Cancelar</Text></TouchableOpacity>
            <TouchableOpacity style={[shared.submeterBotao, disabled && shared.submeterDesativado]} onPress={submeter} disabled={disabled}>
              <Text style={shared.submeterTexto}>{salvando ? 'A guardar...' : 'Guardar'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, marginTop: 8 },
  check: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: '#2563eb', alignItems: 'center', justifyContent: 'center' },
  checkMark: { color: '#fff', fontSize: 12, fontWeight: '700' },
  checkLabel: { fontSize: 14, color: '#1e293b' },
});
