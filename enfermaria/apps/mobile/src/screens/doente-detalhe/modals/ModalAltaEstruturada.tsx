import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, Alert, ScrollView } from 'react-native';
import { shared } from '../styles';
import SelectPicker from '../../../components/SelectPicker';
import api from '../../../lib/api';

interface Props { visible: boolean; doenteId: string; onClose: () => void; onDone: () => void }

export default function ModalAltaEstruturada({ visible, doenteId, onClose, onDone }: Props) {
  const [motivo, setMotivo] = useState('melhoria');
  const [destino, setDestino] = useState('domicilio');
  const [resumo, setResumo] = useState('');
  const [prescricao, setPrescricao] = useState('');
  const [medFamilia, setMedFamilia] = useState('');
  const [salvando, setSalvando] = useState(false);

  const submeter = async () => {
    if (!resumo.trim()) { Alert.alert('Atenção', 'O resumo clínico é obrigatório'); return; }
    setSalvando(true);
    try {
      await api.post(`/doentes/${doenteId}/alta-estruturada`, {
        motivoAlta: motivo,
        destino: motivo !== 'obito' ? destino : undefined,
        resumoClinical: resumo,
        prescricaoSaida: prescricao || undefined,
        medicoFamilia: medFamilia || undefined,
      });
      onClose(); onDone();
    } catch (e: any) {
      Alert.alert('Erro', e.response?.data?.message ?? 'Erro ao dar alta');
    } finally { setSalvando(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={shared.overlay}>
        <View style={[shared.modalSheet, shared.modalSheetTall]}>
          <View style={shared.sheetCabecalho}>
            <Text style={shared.sheetTitulo}>Alta do Doente</Text>
            <TouchableOpacity onPress={onClose}><Text style={shared.fecharTexto}>✕</Text></TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={shared.formLabel}>Motivo de Alta *</Text>
            <SelectPicker
              options={[{ value: 'melhoria', label: 'Melhoria Clínica' }, { value: 'transferencia', label: 'Transferência' }, { value: 'pedido_proprio', label: 'Pedido Próprio' }, { value: 'obito', label: 'Óbito' }]}
              value={motivo} onChange={setMotivo}
            />
            {motivo !== 'obito' && (
              <>
                <Text style={shared.formLabel}>Destino</Text>
                <SelectPicker
                  options={[{ value: 'domicilio', label: 'Domicílio' }, { value: 'outro_hospital', label: 'Outro Hospital' }, { value: 'lar', label: 'Lar' }, { value: 'outro', label: 'Outro' }]}
                  value={destino} onChange={setDestino}
                />
              </>
            )}
            <Text style={shared.formLabel}>Resumo Clínico *</Text>
            <TextInput style={[shared.formInput, { minHeight: 90, textAlignVertical: 'top' }]} value={resumo} onChangeText={setResumo} placeholder="Descrever evolução clínica e estado à saída..." multiline />
            <Text style={shared.formLabel}>Prescrição de Saída</Text>
            <TextInput style={[shared.formInput, { minHeight: 70, textAlignVertical: 'top' }]} value={prescricao} onChangeText={setPrescricao} placeholder="Medicação prescrita para o domicílio (opcional)" multiline />
            <Text style={shared.formLabel}>Médico de Família / Referenciação</Text>
            <TextInput style={shared.formInput} value={medFamilia} onChangeText={setMedFamilia} placeholder="Nome ou contacto (opcional)" />
            <View style={shared.modalBotoes}>
              <TouchableOpacity style={shared.cancelarBotao} onPress={onClose}><Text style={shared.cancelarTexto}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity style={[shared.submeterBotao, { backgroundColor: '#dc2626' }, (salvando || !resumo.trim()) && shared.submeterDesativado]} onPress={submeter} disabled={salvando || !resumo.trim()}>
                <Text style={shared.submeterTexto}>{salvando ? 'A processar...' : 'Confirmar Alta'}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
