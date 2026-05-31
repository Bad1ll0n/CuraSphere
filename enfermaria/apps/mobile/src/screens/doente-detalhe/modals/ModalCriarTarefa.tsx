import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, Alert } from 'react-native';
import { shared } from '../styles';
import SelectPicker from '../../../components/SelectPicker';
import api from '../../../lib/api';

const grupoLabel: Record<string, string> = { medico: 'Médico', enfermeiro: 'Enfermeiro', auxiliar: 'Auxiliar' };

interface Props {
  visible: boolean;
  doenteId: string;
  gruposDisponiveis: string[];
  onClose: () => void;
  onSaved: () => void;
}

export default function ModalCriarTarefa({ visible, doenteId, gruposDisponiveis, onClose, onSaved }: Props) {
  const [desc, setDesc] = useState('');
  const [tipo, setTipo] = useState<'clinica' | 'logistica'>('clinica');
  const [prioridade, setPrioridade] = useState('media');
  const [grupo, setGrupo] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (visible) { setDesc(''); setTipo('clinica'); setPrioridade('media'); setGrupo(gruposDisponiveis[0] ?? ''); }
  }, [visible]);

  const submeter = async () => {
    if (!desc.trim() || !grupo) return;
    setSalvando(true);
    try {
      await api.post(`/doentes/${doenteId}/tarefa`, { descricao: desc, tipo, prioridade, grupoResponsavel: grupo });
      onClose(); onSaved();
    } catch (e: any) {
      Alert.alert('Erro', e.response?.data?.message ?? 'Erro ao criar tarefa');
    } finally { setSalvando(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={shared.overlay}>
        <View style={shared.modalSheet}>
          <View style={shared.sheetCabecalho}>
            <Text style={shared.sheetTitulo}>Nova Tarefa</Text>
            <TouchableOpacity onPress={onClose}><Text style={shared.fecharTexto}>✕</Text></TouchableOpacity>
          </View>
          <Text style={shared.formLabel}>Descrição *</Text>
          <TextInput style={[shared.formInput, { minHeight: 60, textAlignVertical: 'top' }]} value={desc} onChangeText={setDesc} placeholder="Descrever a tarefa..." multiline />
          <Text style={shared.formLabel}>Tipo</Text>
          <SelectPicker options={[{ value: 'clinica', label: 'Clínica' }, { value: 'logistica', label: 'Logística' }]} value={tipo} onChange={(v) => setTipo(v as 'clinica' | 'logistica')} />
          <Text style={shared.formLabel}>Prioridade</Text>
          <SelectPicker options={[{ value: 'baixa', label: 'Baixa' }, { value: 'media', label: 'Média' }, { value: 'alta', label: 'Alta' }, { value: 'urgente', label: 'Urgente' }]} value={prioridade} onChange={setPrioridade} />
          <Text style={shared.formLabel}>Para</Text>
          <SelectPicker options={gruposDisponiveis.map((g) => ({ value: g, label: grupoLabel[g] ?? g }))} value={grupo} onChange={setGrupo} />
          <View style={shared.modalBotoes}>
            <TouchableOpacity style={shared.cancelarBotao} onPress={onClose}><Text style={shared.cancelarTexto}>Cancelar</Text></TouchableOpacity>
            <TouchableOpacity style={[shared.submeterBotao, (!desc.trim() || !grupo || salvando) && shared.submeterDesativado]} onPress={submeter} disabled={!desc.trim() || !grupo || salvando}>
              <Text style={shared.submeterTexto}>{salvando ? 'A guardar...' : 'Criar Tarefa'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
