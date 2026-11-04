import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * A6: o par do `EmptyState` para quando a lista NÃO chegou a ser lida.
 *
 * Vários ecrãs engoliam a falha de carga num `catch` e mostravam o estado vazio. No MAR, isso
 * era "Todas as medicações administradas" com um visto verde. Este componente ocupa o mesmo
 * lugar e diz o contrário: a lista não foi lida, não está vazia.
 */
interface Props {
  texto?: string;
  onTentarNovamente?: () => void;
}

const TEXTO_OMISSAO = 'A lista não chegou a ser lida — isto não quer dizer que esteja vazia. Verifique a ligação.';

export default function ErroCarregamento({ texto = TEXTO_OMISSAO, onTentarNovamente }: Props) {
  return (
    <View style={s.caixa} accessibilityRole="alert">
      <Ionicons name="cloud-offline-outline" size={40} color="#dc2626" />
      <Text style={s.titulo}>Não foi possível carregar</Text>
      <Text style={s.texto}>{texto}</Text>
      {onTentarNovamente && (
        <TouchableOpacity style={s.botao} onPress={onTentarNovamente} accessibilityRole="button">
          <Text style={s.botaoTexto}>Tentar de novo</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  caixa: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24, gap: 8 },
  titulo: { fontSize: 15, fontWeight: '700', color: '#0f172a', marginTop: 4 },
  texto: { fontSize: 13, color: '#64748b', textAlign: 'center', lineHeight: 19, maxWidth: 320 },
  botao: { marginTop: 12, backgroundColor: '#2563eb', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, minHeight: 44, justifyContent: 'center' },
  botaoTexto: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
