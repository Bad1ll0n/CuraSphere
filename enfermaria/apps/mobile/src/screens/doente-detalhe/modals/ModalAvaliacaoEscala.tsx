import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, Alert, ScrollView, StyleSheet } from 'react-native';
import { shared } from '../styles';
import api from '../../../lib/api';

const BRADEN_ITEMS = [
  { key: 'percepcaoSensorial', label: 'Percepção Sensorial', opts: [[1,'Completamente limitada'],[2,'Muito limitada'],[3,'Ligeiramente limitada'],[4,'Sem limitação']] },
  { key: 'humidade', label: 'Humidade', opts: [[1,'Permanentemente húmido'],[2,'Muito húmido'],[3,'Ocasionalmente húmido'],[4,'Raramente húmido']] },
  { key: 'atividade', label: 'Atividade', opts: [[1,'Acamado'],[2,'Sentado'],[3,'Anda ocasionalmente'],[4,'Anda frequentemente']] },
  { key: 'mobilidade', label: 'Mobilidade', opts: [[1,'Imóvel'],[2,'Muito limitada'],[3,'Ligeiramente limitada'],[4,'Sem limitação']] },
  { key: 'nutricao', label: 'Nutrição', opts: [[1,'Muito pobre'],[2,'Provavelmente inadequada'],[3,'Adequada'],[4,'Excelente']] },
  { key: 'friccaoCisalhamento', label: 'Fricção e Cisalhamento', opts: [[1,'Problema'],[2,'Problema potencial'],[3,'Sem problema aparente']] },
] as { key: string; label: string; opts: [number, string][] }[];

const MORSE_ITEMS = [
  { key: 'historiaQueda', label: 'Histórico de Quedas (últimos 3 meses)', opts: [[0,'Não (0)'],[25,'Sim (25)']] },
  { key: 'diagnosticoSecundario', label: 'Diagnóstico Secundário', opts: [[0,'Não (0)'],[15,'Sim (15)']] },
  { key: 'ajudaMarcha', label: 'Ajuda na Marcha', opts: [[0,'Nenhuma / Acamado (0)'],[15,'Canadiana / Andarilho (15)'],[30,'Segura em móveis (30)']] },
  { key: 'heparinaIV', label: 'Terapia Intravenosa / Heparina', opts: [[0,'Não (0)'],[20,'Sim (20)']] },
  { key: 'marchaTransferencia', label: 'Marcha / Transferência', opts: [[0,'Normal / Acamado (0)'],[10,'Debilitado (10)'],[20,'Comprometido (20)']] },
  { key: 'estadoMental', label: 'Estado Mental', opts: [[0,'Orientado (0)'],[15,'Confuso / Esquece limitações (15)']] },
] as { key: string; label: string; opts: [number, string][] }[];

interface Props {
  visible: boolean;
  tipo: 'braden' | 'morse' | null;
  doenteId: string;
  onClose: () => void;
  onSaved: () => void;
}

export default function ModalAvaliacaoEscala({ visible, tipo, doenteId, onClose, onSaved }: Props) {
  const [itens, setItens] = useState<Record<string, number>>({});
  const [salvando, setSalvando] = useState(false);

  useEffect(() => { if (visible) setItens({}); }, [visible]);

  const submeter = async () => {
    if (!tipo) return;
    setSalvando(true);
    try {
      await api.post(`/escalas/${doenteId}`, { tipo, itens });
      onClose(); onSaved();
    } catch (e: any) {
      Alert.alert('Erro', e.response?.data?.message ?? 'Erro ao registar escala');
    } finally { setSalvando(false); }
  };

  const items = tipo === 'braden' ? BRADEN_ITEMS : MORSE_ITEMS;
  const total = Object.values(itens).reduce((a, b) => a + b, 0);
  const max = tipo === 'braden' ? 23 : 125;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={shared.overlay}>
        <View style={[shared.modalSheet, shared.modalSheetTall]}>
          <View style={shared.sheetCabecalho}>
            <Text style={shared.sheetTitulo}>{tipo === 'braden' ? 'Escala de Braden' : 'Escala de Morse'}</Text>
            <TouchableOpacity onPress={onClose}><Text style={shared.fecharTexto}>✕</Text></TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {items.map((item) => (
              <View key={item.key} style={{ marginBottom: 14 }}>
                <Text style={shared.formLabel}>{item.label}</Text>
                {tipo === 'braden' ? (
                  <View style={{ gap: 4 }}>
                    {item.opts.map(([val, desc]) => (
                      <TouchableOpacity key={val} style={[s.opcao, itens[item.key] === val && s.opcaoAtiva]} onPress={() => setItens((p) => ({ ...p, [item.key]: val }))}>
                        <Text style={[s.opcaoNum, itens[item.key] === val && { color: '#fff' }]}>{val}</Text>
                        <Text style={[s.opcaoDesc, itens[item.key] === val && { color: '#fff' }]}>{desc}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {item.opts.map(([val, desc]) => (
                      <TouchableOpacity key={val} style={[s.pill, itens[item.key] === val && s.pillAtivo]} onPress={() => setItens((p) => ({ ...p, [item.key]: val }))}>
                        <Text style={[s.pillTexto, itens[item.key] === val && { color: '#fff' }]}>{desc}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            ))}
            <View style={s.pontuacaoRow}>
              <Text style={s.pontuacaoLabel}>Pontuação total:</Text>
              <Text style={s.pontuacaoValor}>{total} / {max}</Text>
            </View>
            <View style={shared.modalBotoes}>
              <TouchableOpacity style={shared.cancelarBotao} onPress={onClose}><Text style={shared.cancelarTexto}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity style={[shared.submeterBotao, salvando && shared.submeterDesativado]} onPress={submeter} disabled={salvando}>
                <Text style={shared.submeterTexto}>{salvando ? 'A registar...' : 'Registar'}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  opcao: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 10, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
  opcaoAtiva: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  opcaoNum: { fontSize: 14, fontWeight: '800', color: '#2563eb', width: 20, textAlign: 'center' },
  opcaoDesc: { fontSize: 13, color: '#334155', flex: 1 },
  pill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: '#e2e8f0' },
  pillAtivo: { backgroundColor: '#2563eb' },
  pillTexto: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  pontuacaoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#e2e8f0', marginTop: 8 },
  pontuacaoLabel: { fontSize: 13, fontWeight: '600', color: '#475569' },
  pontuacaoValor: { fontSize: 20, fontWeight: '800', color: '#2563eb' },
});
