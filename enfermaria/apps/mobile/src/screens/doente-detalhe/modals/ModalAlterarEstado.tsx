import React from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { shared } from '../styles';
import { estilosTematicos, useEsquema } from '../../../lib/tema';

const estadoCor: Record<string, string> = {
  estavel: '#22c55e', grave: '#f97316', critico: '#ef4444', alta_prevista: '#3b82f6',
};
const estadoLabel: Record<string, string> = {
  estavel: 'Estável', grave: 'Grave', critico: 'Crítico', alta_prevista: 'Alta Prevista',
};

interface Props {
  visible: boolean;
  estadoAtual: string;
  onClose: () => void;
  onSelect: (estado: string) => void;
}

export default function ModalAlterarEstado({ visible, estadoAtual, onClose, onSelect }: Props) {
  useEsquema(); // UX-24: volta a desenhar quando o telemóvel muda de claro para escuro
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity accessibilityRole="button" style={shared.overlay} activeOpacity={1} onPress={onClose}>
        <View onStartShouldSetResponder={() => true} style={s.sheet}>
          <Text style={shared.sheetTitulo}>Alterar Estado</Text>
          {Object.entries(estadoLabel)
            .filter(([k]) => k !== estadoAtual)
            .map(([k, label]) => (
              <TouchableOpacity accessibilityRole="button" key={k} style={s.opcao} onPress={() => onSelect(k)}>
                <View style={[s.dot, { backgroundColor: estadoCor[k] }]} />
                <Text style={s.opcaoTexto}>{label}</Text>
              </TouchableOpacity>
            ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const s = estilosTematicos((c) => ({
  sheet: { backgroundColor: c.superficie, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  opcao: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.borda },
  opcaoTexto: { fontSize: 16, color: c.texto, fontWeight: '500' },
  dot: { width: 10, height: 10, borderRadius: 5 },
}));
