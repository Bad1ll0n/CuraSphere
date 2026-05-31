import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, Alert } from 'react-native';
import { shared } from '../styles';
import api from '../../../lib/api';

interface Props {
  visible: boolean;
  doenteId: string;
  diagnosticoInicial: string;
  altaPrevistaInicial: string;
  onClose: () => void;
  onSaved: () => void;
}

export default function ModalEditarDoente({ visible, doenteId, diagnosticoInicial, altaPrevistaInicial, onClose, onSaved }: Props) {
  const [diagnostico, setDiagnostico] = useState(diagnosticoInicial);
  const [altaPrevista, setAltaPrevista] = useState(altaPrevistaInicial);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (visible) { setDiagnostico(diagnosticoInicial); setAltaPrevista(altaPrevistaInicial); }
  }, [visible, diagnosticoInicial, altaPrevistaInicial]);

  const submeter = async () => {
    setSalvando(true);
    try {
      await api.patch(`/doentes/${doenteId}`, {
        diagnosticoPrincipal: diagnostico || undefined,
        dataAltaPrevista: altaPrevista ? new Date(altaPrevista) : null,
      });
      onClose(); onSaved();
    } catch (e: any) {
      Alert.alert('Erro', e.response?.data?.message ?? 'Erro ao editar doente');
    } finally { setSalvando(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={shared.overlay}>
        <View style={shared.modalSheet}>
          <View style={shared.sheetCabecalho}>
            <Text style={shared.sheetTitulo}>Editar Dados Clínicos</Text>
            <TouchableOpacity onPress={onClose}><Text style={shared.fecharTexto}>✕</Text></TouchableOpacity>
          </View>
          <Text style={shared.formLabel}>Diagnóstico Principal</Text>
          <TextInput style={[shared.formInput, { minHeight: 60, textAlignVertical: 'top' }]} value={diagnostico} onChangeText={setDiagnostico} placeholder="Diagnóstico principal..." multiline />
          <Text style={shared.formLabel}>Alta Prevista (AAAA-MM-DD)</Text>
          <TextInput style={shared.formInput} value={altaPrevista} onChangeText={setAltaPrevista} placeholder="Ex: 2026-04-20" keyboardType="numeric" />
          <View style={shared.modalBotoes}>
            <TouchableOpacity style={shared.cancelarBotao} onPress={onClose}><Text style={shared.cancelarTexto}>Cancelar</Text></TouchableOpacity>
            <TouchableOpacity style={[shared.submeterBotao, salvando && shared.submeterDesativado]} onPress={submeter} disabled={salvando}>
              <Text style={shared.submeterTexto}>{salvando ? 'A guardar...' : 'Guardar'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
