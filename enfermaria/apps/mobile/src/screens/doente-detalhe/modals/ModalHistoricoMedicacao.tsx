import React from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, ActivityIndicator } from 'react-native';
import { shared } from '../styles';

interface Props { visible: boolean; medicacao: any[]; loading: boolean; onClose: () => void }

export default function ModalHistoricoMedicacao({ visible, medicacao, loading, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={shared.overlay}>
        <View style={[shared.modalSheet, shared.modalSheetTall]}>
          <View style={shared.sheetCabecalho}>
            <Text style={shared.sheetTitulo}>Medicação Terminada</Text>
            <TouchableOpacity onPress={onClose}><Text style={shared.fecharTexto}>✕</Text></TouchableOpacity>
          </View>
          {loading ? (
            <ActivityIndicator color="#2563eb" style={{ padding: 20 }} />
          ) : medicacao.length === 0 ? (
            <Text style={shared.vazioTexto}>Sem medicação terminada</Text>
          ) : (
            <ScrollView>
              {medicacao.map((m) => (
                <View key={m.id} style={shared.historicoItem}>
                  <Text style={shared.historicoDescricao}>{m.nome} {m.dose}</Text>
                  <Text style={shared.historicoMeta}>
                    {m.via} · {m.frequencia}
                    {m.terminadoEm ? `  · Terminado ${new Date(m.terminadoEm).toLocaleDateString('pt-PT')}` : ''}
                  </Text>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}
