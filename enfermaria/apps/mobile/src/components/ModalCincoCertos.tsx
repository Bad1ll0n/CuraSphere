import React, { useEffect, useState } from 'react';
import { Modal, View, Text, Switch, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CINCO_CERTOS, todosConfirmados, type Certo } from '../lib/administracao';
import { estilosTematicos } from '../lib/tema';

export interface MedicacaoAConfirmar {
  id: string;
  nome: string;
  dose: string;
  via: string;
  frequencia?: string;
}

interface Props {
  medicacao: MedicacaoAConfirmar | null;
  doente: { nome: string; numeroProcesso?: string | null };
  offline?: boolean;
  onConfirmar: (medicacao: MedicacaoAConfirmar) => void;
  onCancelar: () => void;
}

/**
 * PROD-16 — a lista dos 5 certos percorrida à cabeceira antes de registar uma administração sem
 * leitura de código. É uma ATESTAÇÃO (o enfermeiro confirma; o sistema não comparou nada) e fica
 * registada como tal. Igual online e offline: a via offline deixou de saltar a verificação.
 */
export default function ModalCincoCertos({ medicacao, doente, offline, onConfirmar, onCancelar }: Props) {
  const { t } = useTranslation();
  const [marcados, setMarcados] = useState<Partial<Record<Certo, boolean>>>({});
  useEffect(() => setMarcados({}), [medicacao?.id]);
  if (!medicacao) return null;

  const detalhe: Record<Certo, string> = {
    doente: `${doente.nome}${doente.numeroProcesso ? ` · ${doente.numeroProcesso}` : ''}`,
    medicamento: medicacao.nome,
    dose: medicacao.dose,
    via: medicacao.via,
    hora: medicacao.frequencia ?? '',
  };
  const pronto = todosConfirmados(marcados);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onCancelar}>
      <View style={s.overlay}>
        <View style={s.folha}>
          <Text style={s.titulo}>{t('administer.fiveRights.title')}</Text>
          <Text style={s.ajuda}>{t('administer.fiveRights.hint')}</Text>
          {CINCO_CERTOS.map((c) => (
            <View key={c} style={s.linha}>
              <View style={{ flex: 1 }}>
                <Text style={s.certo}>{t(`administer.fiveRights.${c}`)}</Text>
                <Text style={s.detalhe}>{detalhe[c]}</Text>
              </View>
              <Switch
                accessibilityLabel={t(`administer.fiveRights.${c}`)}
                value={marcados[c] === true}
                onValueChange={(v) => setMarcados((m) => ({ ...m, [c]: v }))}
              />
            </View>
          ))}
          {offline && <Text style={s.offline}>{t('administer.fiveRights.offline')}</Text>}
          <View style={s.botoes}>
            <TouchableOpacity accessibilityRole="button" style={s.cancelar} onPress={onCancelar}>
              <Text style={s.cancelarTexto}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button"
              style={[s.confirmar, !pronto && s.desativado]}
              disabled={!pronto}
              accessibilityState={{ disabled: !pronto }}
              onPress={() => onConfirmar(medicacao)}
            >
              <Text style={s.confirmarTexto}>{t('administer.fiveRights.confirm')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = estilosTematicos((c) => ({
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  folha: { backgroundColor: c.superficie, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 10 },
  titulo: { fontSize: 17, fontWeight: '700', color: c.texto },
  ajuda: { fontSize: 13, color: c.textoSecundario },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: c.borda },
  certo: { fontSize: 14, fontWeight: '600', color: c.texto },
  detalhe: { fontSize: 13, color: c.textoSecundario },
  offline: { fontSize: 13, color: '#92400e', backgroundColor: '#fef3c7', padding: 8, borderRadius: 8 },
  botoes: { flexDirection: 'row', gap: 10, marginTop: 6 },
  cancelar: { flex: 1, borderWidth: 1, borderColor: c.borda, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  cancelarTexto: { color: c.textoSecundario, fontWeight: '600' },
  confirmar: { flex: 1, backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  confirmarTexto: { color: '#fff', fontWeight: '700' },
  desativado: { opacity: 0.45 },
}));
