import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { shared } from '../styles';
import EmptyState from '../../../components/EmptyState';

interface Props {
  sinaisVitais: any[];
  loadingVitais: boolean;
  podeRegistarVitais: boolean;
  onRegistar: () => void;
}

export default function TabVitais({ sinaisVitais, loadingVitais, podeRegistarVitais, onRegistar }: Props) {
  return (
    <View style={s.secao}>
      <View style={shared.secaoHeader}>
        <Text style={shared.secaoTitulo}>Sinais Vitais</Text>
        {podeRegistarVitais && (
          <TouchableOpacity onPress={onRegistar} style={[shared.iconBotao, shared.iconBotaoAzul]}>
            <Text style={shared.iconBotaoTextoAzul}>+</Text>
          </TouchableOpacity>
        )}
      </View>
      {loadingVitais ? (
        <ActivityIndicator color="#2563eb" style={{ padding: 20 }} />
      ) : sinaisVitais.length === 0 ? (
        <EmptyState text="Sem registos de sinais vitais" />
      ) : sinaisVitais.map((sv: any) => {
        const taCor = sv.pressaoSistolica == null ? '#94a3b8' : sv.pressaoSistolica >= 160 || sv.pressaoSistolica < 80 ? '#ef4444' : sv.pressaoSistolica >= 140 || sv.pressaoSistolica < 90 ? '#f59e0b' : '#22c55e';
        const pulsoCor = sv.pulso == null ? '#94a3b8' : sv.pulso > 120 || sv.pulso < 50 ? '#ef4444' : sv.pulso > 100 || sv.pulso < 60 ? '#f59e0b' : '#22c55e';
        const tempCor = sv.temperatura == null ? '#94a3b8' : sv.temperatura > 38.5 || sv.temperatura < 35 ? '#ef4444' : sv.temperatura > 37.5 ? '#f59e0b' : '#22c55e';
        const spO2Cor = sv.saturacaoO2 == null ? '#94a3b8' : sv.saturacaoO2 < 90 ? '#ef4444' : sv.saturacaoO2 < 95 ? '#f59e0b' : '#22c55e';

        return (
          <View key={sv.id} style={s.card}>
            <View style={s.cardHeader}>
              <Text style={s.data}>{new Date(sv.data).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</Text>
              <Text style={s.autor}>{sv.registadoPor?.nome}</Text>
            </View>
            <View style={s.grid}>
              {sv.pressaoSistolica != null && <VitalItem label="TA" valor={`${sv.pressaoSistolica}/${sv.pressaoDiastolica}`} unidade="mmHg" cor={taCor} />}
              {sv.pulso != null && <VitalItem label="Pulso" valor={sv.pulso} unidade="bpm" cor={pulsoCor} />}
              {sv.temperatura != null && <VitalItem label="Temp." valor={sv.temperatura.toFixed(1)} unidade="ºC" cor={tempCor} />}
              {sv.saturacaoO2 != null && <VitalItem label="SpO₂" valor={`${sv.saturacaoO2}%`} unidade="O₂" cor={spO2Cor} />}
              {sv.frequenciaRespiratoria != null && <VitalItem label="FR" valor={sv.frequenciaRespiratoria} unidade="rpm" cor="#64748b" />}
              {sv.peso != null && <VitalItem label="Peso" valor={sv.peso} unidade="kg" cor="#64748b" />}
            </View>
            {sv.notas ? <Text style={s.nota}>{sv.notas}</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

function VitalItem({ label, valor, unidade, cor }: { label: string; valor: any; unidade: string; cor: string }) {
  return (
    <View style={[s.vitalItem, { borderLeftColor: cor }]}>
      <Text style={s.vitalLabel}>{label}</Text>
      <Text style={[s.vitalValor, { color: cor }]}>{valor}</Text>
      <Text style={s.vitalUnidade}>{unidade}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  secao: { padding: 16 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  data: { fontSize: 13, fontWeight: '700', color: '#1e293b' },
  autor: { fontSize: 11, color: '#94a3b8' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  vitalItem: { backgroundColor: '#f8fafc', borderRadius: 10, padding: 10, minWidth: 80, alignItems: 'center', borderLeftWidth: 3 },
  vitalLabel: { fontSize: 10, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.4 },
  vitalValor: { fontSize: 18, fontWeight: '800', marginTop: 2 },
  vitalUnidade: { fontSize: 10, color: '#94a3b8', marginTop: 1 },
  nota: { fontSize: 12, color: '#64748b', marginTop: 8, fontStyle: 'italic' },
});
