import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { shared } from '../styles';
import EmptyState from '../../../components/EmptyState';

const prioridadeCor: Record<string, string> = { urgente: '#ef4444', alta: '#f97316', media: '#eab308', baixa: '#22c55e' };
const grupoLabel: Record<string, string> = { medico: 'Médico', enfermeiro: 'Enfermeiro', auxiliar: 'Auxiliar' };

interface Props {
  tarefas: any[];
  emTurno: boolean;
  utilizadorId: string;
  meuGrupoChave: string;
  podeCriarTarefa: boolean;
  onHistorico: () => void;
  onCriarTarefa: () => void;
  onConcluirTarefa: (id: string) => void;
}

export default function TabTarefas({ tarefas, emTurno, utilizadorId, meuGrupoChave, podeCriarTarefa, onHistorico, onCriarTarefa, onConcluirTarefa }: Props) {
  return (
    <View style={s.secao}>
      <View style={shared.secaoHeader}>
        <Text style={shared.secaoTitulo}>Tarefas Pendentes</Text>
        <View style={shared.secaoAcoes}>
          <TouchableOpacity onPress={onHistorico} style={shared.iconBotao}>
            <Text style={shared.iconBotaoTexto}>⏱</Text>
          </TouchableOpacity>
          {podeCriarTarefa && (
            <TouchableOpacity onPress={onCriarTarefa} style={[shared.iconBotao, shared.iconBotaoAzul]}>
              <Text style={shared.iconBotaoTextoAzul}>+</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      {tarefas.length === 0 ? <EmptyState text="Sem tarefas pendentes" /> : tarefas.map((t: any) => {
        const podeConcluir = emTurno && (t.responsavel?.id === utilizadorId || (t.grupoResponsavel === meuGrupoChave && !t.responsavel));
        return (
          <View key={t.id} style={s.card}>
            <View style={[s.dot, { backgroundColor: prioridadeCor[t.prioridade] ?? '#94a3b8' }]} />
            <View style={s.conteudo}>
              <Text style={s.descricao}>{t.descricao}</Text>
              <Text style={s.meta}>
                {t.responsavel ? `A cargo: ${t.responsavel.nome}` : t.grupoResponsavel ? `Para: ${grupoLabel[t.grupoResponsavel] ?? t.grupoResponsavel}` : ''}
                {t.criadoPor ? `  · Por ${t.criadoPor.nome}` : ''}
              </Text>
            </View>
            {podeConcluir && (
              <TouchableOpacity style={s.concluirBotao} onPress={() => onConcluirTarefa(t.id)}>
                <Text style={s.concluirTexto}>✓</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  secao: { padding: 16 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  conteudo: { flex: 1 },
  descricao: { fontSize: 14, color: '#334155', fontWeight: '500' },
  meta: { fontSize: 12, color: '#94a3b8', marginTop: 3 },
  concluirBotao: { backgroundColor: '#dcfce7', width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  concluirTexto: { color: '#16a34a', fontWeight: '700', fontSize: 16 },
});
