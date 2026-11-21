import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { shared } from '../styles';

/**
 * Pede um texto obrigatório (motivo, justificação). O `Alert.prompt` do React Native só existe
 * em iOS — este modal funciona nas duas plataformas.
 *  - QA-14: motivo para descontinuar uma prescrição.
 *  - QA-15: justificação da 1.ª dose antes da validação farmacêutica.
 */
interface Props {
  visible: boolean;
  titulo: string;
  descricao: string;
  rotulo: string;
  botao: string;
  minimo?: number;
  onCancelar: () => void;
  onConfirmar: (texto: string) => void;
}

export default function ModalMotivo({ visible, titulo, descricao, rotulo, botao, minimo = 5, onCancelar, onConfirmar }: Props) {
  const [texto, setTexto] = useState('');
  useEffect(() => { if (visible) setTexto(''); }, [visible]);
  const valido = texto.trim().length >= minimo;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancelar}>
      <View style={shared.overlay}>
        <View style={s.sheet}>
          <Text style={shared.sheetTitulo} accessibilityRole="header">{titulo}</Text>
          <Text style={s.descricao}>{descricao}</Text>
          <Text style={s.rotulo}>{rotulo} *</Text>
          <TextInput
            accessibilityLabel={rotulo}
            style={s.input}
            value={texto}
            onChangeText={setTexto}
            multiline
            maxLength={500}
            autoFocus
          />
          <Text style={s.ajuda}>Mínimo {minimo} caracteres.</Text>
          <View style={s.botoes}>
            <TouchableOpacity accessibilityRole="button" style={s.cancelar} onPress={onCancelar}>
              <Text style={s.cancelarTexto}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ disabled: !valido }}
              disabled={!valido}
              style={[s.confirmar, !valido && s.desativado]}
              onPress={() => onConfirmar(texto.trim())}
            >
              <Text style={s.confirmarTexto}>{botao}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 8 },
  descricao: { fontSize: 15, color: '#334155' },
  rotulo: { fontSize: 13, fontWeight: '600', color: '#475569', marginTop: 4 },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, padding: 12, minHeight: 80, fontSize: 15, textAlignVertical: 'top' },
  ajuda: { fontSize: 13, color: '#64748b' },
  botoes: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelar: { flex: 1, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, padding: 14, alignItems: 'center' },
  cancelarTexto: { fontSize: 15, color: '#334155', fontWeight: '500' },
  confirmar: { flex: 1, backgroundColor: '#dc2626', borderRadius: 12, padding: 14, alignItems: 'center' },
  confirmarTexto: { fontSize: 15, color: '#fff', fontWeight: '600' },
  desativado: { opacity: 0.4 },
});
