import React from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { shared } from '../styles';
import EmptyState from '../../../components/EmptyState';

interface Props {
  medicacoesAtivas: any[];
  podePrescreveMed: boolean;
  podeRegistarMed: boolean;
  onHistorico: () => void;
  onPrescrever: () => void;
  onRegistar: (id: string) => void;
  onConcluir: (id: string) => void;
}

export default function TabMedicacao({ medicacoesAtivas, podePrescreveMed, podeRegistarMed, onHistorico, onPrescrever, onRegistar, onConcluir }: Props) {
  return (
    <View style={s.secao}>
      <View style={shared.secaoHeader}>
        <Text style={shared.secaoTitulo}>Medicação Ativa</Text>
        <View style={shared.secaoAcoes}>
          <TouchableOpacity onPress={onHistorico} style={shared.iconBotao}>
            <Text style={shared.iconBotaoTexto}>⏱</Text>
          </TouchableOpacity>
          {podePrescreveMed && (
            <TouchableOpacity onPress={onPrescrever} style={[shared.iconBotao, shared.iconBotaoAzul]}>
              <Text style={shared.iconBotaoTextoAzul}>+</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      {medicacoesAtivas.length === 0 ? <EmptyState text="Sem medicação ativa" /> : medicacoesAtivas.map((m: any) => (
        <View key={m.id} style={s.card}>
          <View style={s.info}>
            <Text style={s.nome}>{m.nome} {m.dose}</Text>
            <Text style={s.detalhe}>{m.via} · {m.frequencia}</Text>
            {m.prescritoPor && <Text style={s.detalhe}>Prescrito por {m.prescritoPor.nome}</Text>}
          </View>
          <View style={s.botoes}>
            {podeRegistarMed && (
              <TouchableOpacity style={s.administrarBotao} onPress={() => onRegistar(m.id)}>
                <Text style={s.administrarTexto}>Registar</Text>
              </TouchableOpacity>
            )}
            {podePrescreveMed && (
              <TouchableOpacity style={s.descontinuarBotao} onPress={() => Alert.alert('Confirmar', 'Concluir esta medicação?', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Concluir', style: 'destructive', onPress: () => onConcluir(m.id) }])}>
                <Text style={s.descontinuarTexto}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  secao: { padding: 16 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center' },
  info: { flex: 1 },
  nome: { fontSize: 15, fontWeight: '600', color: '#1e293b' },
  detalhe: { fontSize: 13, color: '#64748b', marginTop: 2 },
  botoes: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  administrarBotao: { backgroundColor: '#dbeafe', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 },
  administrarTexto: { color: '#1d4ed8', fontWeight: '600', fontSize: 13 },
  descontinuarBotao: { backgroundColor: '#fee2e2', width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  descontinuarTexto: { color: '#dc2626', fontWeight: '700', fontSize: 14 },
});
