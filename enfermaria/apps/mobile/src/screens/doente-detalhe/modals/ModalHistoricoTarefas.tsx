import React from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, ActivityIndicator } from 'react-native';
import { shared } from '../styles';

const grupoLabel: Record<string, string> = { medico: 'Médico', enfermeiro: 'Enfermeiro', auxiliar: 'Auxiliar' };

interface Props { visible: boolean; tarefas: any[]; loading: boolean; onClose: () => void }

export default function ModalHistoricoTarefas({ visible, tarefas, loading, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={shared.overlay}>
        <View style={[shared.modalSheet, shared.modalSheetTall]}>
          <View style={shared.sheetCabecalho}>
            <Text style={shared.sheetTitulo}>Tarefas Concluídas</Text>
            <TouchableOpacity onPress={onClose}><Text style={shared.fecharTexto}>✕</Text></TouchableOpacity>
          </View>
          {loading ? (
            <ActivityIndicator color="#2563eb" style={{ padding: 20 }} />
          ) : tarefas.length === 0 ? (
            <Text style={shared.vazioTexto}>Sem tarefas concluídas</Text>
          ) : (
            <ScrollView>
              {tarefas.map((t) => (
                <View key={t.id} style={shared.historicoItem}>
                  <Text style={shared.historicoDescricao}>{t.descricao}</Text>
                  <Text style={shared.historicoMeta}>
                    {t.responsavel ? t.responsavel.nome : grupoLabel[t.grupoResponsavel] ?? ''}
                    {t.concluidaEm ? `  · ${new Date(t.concluidaEm).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : ''}
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
