import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useNetworkStatus } from '../lib/network';
import { aoMudarFila, estadoSincronizacao, limparDescartadas, type Descartada, type QueuedOp } from '../lib/mutation-queue';
import { estilosTematicos, LETRA } from '../lib/tema';

/** O que é cada operação, em palavras do enfermeiro (não o URL). */
function tipoDeOperacao(o: { method: string; url: string }): string {
  if (/\/medicacao\/[^/]+\/administrar/.test(o.url)) return 'administer';
  if (/\/sinais-vitais/.test(o.url)) return 'vitals';
  if (/\/tarefas/.test(o.url)) return 'task';
  return 'other';
}
const hora = (t: number) => new Date(t).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });

/**
 * UX-24 — aviso persistente da sincronização: "Sem ligação · 3 registos por enviar · última
 * sincronização 14:02", com a lista do que está por enviar e do que foi DESCARTADO (o servidor
 * recusou) — para o enfermeiro saber se a administração feita sem rede já ficou registada.
 * Mostra-se em toda a app (no topo), não só na ficha do doente.
 */
export function SyncStatusBanner({ global = false }: { global?: boolean }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const isOnline = useNetworkStatus();
  const [pendentes, setPendentes] = useState<QueuedOp[]>([]);
  const [descartadas, setDescartadas] = useState<Descartada[]>([]);
  const [ultima, setUltima] = useState<number | null>(null);
  const [aberto, setAberto] = useState(false);

  const atualizar = useCallback(() => {
    estadoSincronizacao().then((e) => { setPendentes(e.pendentes); setDescartadas(e.descartadas); setUltima(e.ultimaSincronizacao); }).catch(() => undefined);
  }, []);
  useEffect(() => { atualizar(); return aoMudarFila(atualizar); }, [atualizar, isOnline]);

  if (isOnline && pendentes.length === 0 && descartadas.length === 0) return null;

  const cor = descartadas.length ? s.erro : !isOnline ? s.offline : s.aSincronizar;
  const partes = [
    !isOnline ? t('sync.offline') : null,
    pendentes.length ? t('sync.pending', { count: pendentes.length }) : null,
    descartadas.length ? t('sync.discarded', { count: descartadas.length }) : null,
    ultima ? t('sync.last', { hora: hora(ultima) }) : null,
  ].filter(Boolean).join(' · ');

  return (
    <View style={[s.banner, cor, global && { paddingTop: insets.top + 6 }]}>
      <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded: aberto }} accessibilityHint={t('sync.hint')} onPress={() => setAberto((a) => !a)}>
        <Text style={s.texto}>{partes}</Text>
      </TouchableOpacity>
      {aberto && (
        <View style={s.lista}>
          {pendentes.map((o) => (
            <Text key={o.id} style={s.item}>{t('sync.itemPending', { tipo: t(`sync.type.${tipoDeOperacao(o)}`), hora: hora(o.timestamp) })}</Text>
          ))}
          {descartadas.map((d) => (
            <Text key={d.id} style={[s.item, s.itemErro]}>{t('sync.itemDiscarded', { tipo: t(`sync.type.${tipoDeOperacao(d)}`), hora: hora(d.timestamp), motivo: d.motivo })}</Text>
          ))}
          {descartadas.length > 0 && (
            <TouchableOpacity accessibilityRole="button" onPress={() => { void limparDescartadas(); }}>
              <Text style={s.limpar}>{t('sync.clearDiscarded')}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const s = estilosTematicos((c) => ({
  banner: { paddingVertical: 8, paddingHorizontal: 16 },
  offline: { backgroundColor: '#fef3c7' },
  aSincronizar: { backgroundColor: '#dbeafe' },
  erro: { backgroundColor: '#fee2e2' },
  texto: { fontSize: LETRA.corpo, fontWeight: '600', textAlign: 'center', color: c.texto },
  lista: { marginTop: 6, gap: 4 },
  item: { fontSize: 13, color: c.textoSecundario },
  itemErro: { color: '#991b1b', fontWeight: '600' },
  limpar: { fontSize: 13, color: '#1d4ed8', fontWeight: '600', textDecorationLine: 'underline', marginTop: 4 },
}));
