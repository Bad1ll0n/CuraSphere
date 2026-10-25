import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, TextInput, ScrollView,
} from 'react-native';
import { BarCodeScanner } from 'expo-barcode-scanner';
import { Ionicons } from '@expo/vector-icons';
import api from '../lib/api';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
type EstadoCerto = 'ok' | 'falha' | 'nao_verificado';

interface CertoVerificado {
  certo: string;
  estado: EstadoCerto;
  motivo?: string;
}

interface Resultado5Certos {
  /** Os cinco, sempre, cada um com o seu estado. */
  certos: CertoVerificado[];
  valido: boolean;
  falhas: { certo: string; motivo: string }[];
  porVerificar: string[];
  erroEtiqueta?: string;
  medicacao: { id: string; nome: string; dose: string; via: string; frequencia: string } | null;
}

interface Props {
  onScan: (doenteId: string) => void;
  onFechar: () => void;
  doenteIdEsperado?: string;
  /** Recebe a etiqueta lida: é dela que o servidor extrai dose e via para verificar. */
  onAdministrar?: (medicacaoId: string, qrPayload: string, justificacao?: string) => void;
}


export default function QRScannerScreen({ onScan, onFechar, doenteIdEsperado, onAdministrar }: Props) {
  // MB-10: o botão de fechar estava em `top: 52` fixo. Num iPhone com notch o inset
  // superior chega a 59 — o botão ficava POR BAIXO da câmara, inalcançável, num ecrã de
  // uso clínico constante e do qual não havia outra forma de sair.
  const insets = useSafeAreaInsets();

  const [permissao, setPermissao] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [validando, setValidando] = useState(false);
  const [erro, setErro] = useState('');
  const [resultado, setResultado] = useState<Resultado5Certos | null>(null);
  const [justificacao, setJustificacao] = useState('');
  // Certos que o servidor não conseguiu verificar e que o enfermeiro confirmou à mão.
  const [confirmados, setConfirmados] = useState<Record<string, boolean>>({});
  // A etiqueta em bruto tem de sobreviver ao ecrã de resultado: é ela que vai com a
  // administração, para o servidor reconferir dose e via contra a prescrição.
  const [qrLido, setQrLido] = useState<string | null>(null);

  useEffect(() => {
    BarCodeScanner.requestPermissionsAsync().then(({ status }) => {
      setPermissao(status === 'granted');
    });
  }, []);

  const handleScan = async ({ data }: { type: string; data: string }) => {
    if (scanned || validando) return;
    setScanned(true);
    setValidando(true);
    setErro('');
    setResultado(null);

    try {
      let parsed: any = null;
      try { parsed = JSON.parse(data); } catch { /* não é JSON */ }

      if (parsed?.medicacaoId && parsed?.doenteId) {
        // Modo 5 Certos
        const idEsperado = doenteIdEsperado ?? parsed.doenteId;
        const res = await api.post('/medicacao/verificar-5-certos', {
          qrPayload: data,
          doenteIdEsperado: idEsperado,
        });
        setResultado(res.data);
        setQrLido(data);
      } else {
        // Modo doente (comportamento original — validar doente via GET)
        await api.get(`/doentes/${data}`);
        onScan(data);
      }
    } catch {
      setErro('QR code inválido ou dados não encontrados.');
      setTimeout(() => setScanned(false), 2000);
    } finally {
      setValidando(false);
    }
  };

  const handleAdministrar = () => {
    if (!resultado?.medicacao || !onAdministrar || !qrLido) return;
    onAdministrar(resultado.medicacao.id, qrLido, resultado.valido ? undefined : justificacao.trim());
  };

  const porConfirmar = (resultado?.certos ?? []).filter((c) => c.estado === 'nao_verificado');
  const temFalhas = (resultado?.falhas.length ?? 0) > 0;

  // MB-04: o que o servidor não verificou tem de ser confirmado explicitamente pelo
  // enfermeiro contra a prescrição. Antes, um certo não verificado aparecia a verde e
  // o botão de administrar ficava activo à mesma.
  const todosConfirmados = porConfirmar.every((c) => confirmados[c.certo]);

  const podeAdministrar = Boolean(
    resultado?.medicacao &&
      todosConfirmados &&
      (!temFalhas || justificacao.trim().length >= 10),
  );

  return (
    <View style={[s.container, { paddingTop: insets.top + 8 }]}>
      <TouchableOpacity
        style={[s.fechar, { top: insets.top + 8 }]}
        onPress={onFechar}
        accessibilityRole="button"
        accessibilityLabel="Fechar leitor de código"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="close" size={28} color="#fff" />
      </TouchableOpacity>

      <Text style={s.titulo}>{resultado ? '5 Certos' : 'Ler QR de Medicação'}</Text>
      <Text style={s.subtitulo}>
        {resultado
          ? resultado.valido
            ? 'Os cinco certos foram verificados'
            : temFalhas
              ? 'Atenção — existem falhas na verificação'
              : 'Faltam certos por confirmar'
          : doenteIdEsperado
            ? 'Aponta para o QR code na carta de medicação'
            : 'Aponta a câmara para o QR code na cama ou pulseira'}
      </Text>

      {/* ── Câmara ── (visível apenas antes de ter resultado) */}
      {!resultado && (
        <>
          {permissao === null && (
            <View style={s.centro}>
              <ActivityIndicator color="#fff" size="large" />
              <Text style={s.textoInfo}>A pedir acesso à câmara…</Text>
            </View>
          )}

          {permissao === false && (
            <View style={s.centro}>
              <Ionicons name="videocam-off-outline" size={56} color="#94a3b8" />
              <Text style={s.textoInfo}>Sem acesso à câmara.{'\n'}Activa a permissão nas definições.</Text>
            </View>
          )}

          {permissao === true && (
            <>
              <View style={s.cameraBox}>
                <BarCodeScanner
                  onBarCodeScanned={scanned ? undefined : handleScan}
                  style={StyleSheet.absoluteFillObject}
                  barCodeTypes={[BarCodeScanner.Constants.BarCodeType.qr]}
                />
                <View style={s.frame}>
                  <View style={[s.canto, s.cantoTL]} />
                  <View style={[s.canto, s.cantoTR]} />
                  <View style={[s.canto, s.cantoBL]} />
                  <View style={[s.canto, s.cantoBR]} />
                </View>
              </View>

              {validando && (
                <View style={s.statusBox}>
                  <ActivityIndicator color="#fff" />
                  <Text style={s.statusTexto}>A verificar 5 Certos…</Text>
                </View>
              )}

              {!!erro && (
                <View style={s.erroBox}>
                  <Ionicons name="warning-outline" size={18} color="#fca5a5" />
                  <Text style={s.erroTexto}>{erro}</Text>
                </View>
              )}

              {!validando && !erro && (
                <Text style={s.dica}>Posiciona o QR code dentro do quadrado</Text>
              )}
            </>
          )}
        </>
      )}

      {/* ── Resultado 5 Certos ── */}
      {resultado && (
        <ScrollView style={s.resultadoScroll} contentContainerStyle={{ paddingBottom: 40 }}>
          {/* Banner resultado */}
          <View style={[s.bannerResultado, resultado.valido ? s.bannerOk : s.bannerFalha]}>
            <Ionicons
              name={resultado.valido ? 'checkmark-circle' : 'alert-circle'}
              size={28}
              color={resultado.valido ? '#22c55e' : '#ef4444'}
            />
            <Text style={[s.bannerTexto, !resultado.valido && { color: '#fca5a5' }]}>
              {resultado.valido
                ? 'Verificação completa — pode administrar'
                : temFalhas
                  ? `${resultado.falhas.length} falha(s) detectada(s)`
                  : `${porConfirmar.length} certo(s) por confirmar`}
            </Text>
          </View>

          {/* Info da medicação — ausente quando a etiqueta não foi legível */}
          {resultado.medicacao && (
            <View style={s.medCard}>
              <Text style={s.medNome}>{resultado.medicacao.nome}</Text>
              <Text style={s.medDetalhe}>
                {resultado.medicacao.dose} · {resultado.medicacao.via} · {resultado.medicacao.frequencia}
              </Text>
            </View>
          )}

          {/* Checklist 5 certos */}
          {resultado.certos.map((c) => {
            const ok = c.estado === 'ok';
            const falhou = c.estado === 'falha';
            const confirmado = !!confirmados[c.certo];
            const cor = ok ? '#22c55e' : falhou ? '#ef4444' : confirmado ? '#22c55e' : '#f59e0b';
            const icone = ok
              ? 'checkmark-circle'
              : falhou
                ? 'close-circle'
                : confirmado
                  ? 'checkmark-circle-outline'
                  : 'help-circle';

            return (
              <View
                key={c.certo}
                style={[s.certoRow, ok ? s.certoOk : falhou ? s.certoFalha : s.certoPorVerificar]}
              >
                <Ionicons name={icone as any} size={22} color={cor} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[s.certoNome, falhou && { color: '#fca5a5' }]}>{c.certo}</Text>
                  {!!c.motivo && <Text style={s.certoMotivo}>{c.motivo}</Text>}

                  {/* Um certo que o servidor não verificou nunca aparece confirmado sozinho:
                      exige um gesto do enfermeiro contra a prescrição. */}
                  {c.estado === 'nao_verificado' && (
                    <TouchableOpacity
                      style={[s.confirmarBtn, confirmado && s.confirmarBtnFeito]}
                      onPress={() =>
                        setConfirmados((prev) => ({ ...prev, [c.certo]: !prev[c.certo] }))
                      }
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: confirmado }}
                      accessibilityLabel={`Confirmar ${c.certo} contra a prescrição`}
                    >
                      <Ionicons
                        name={confirmado ? 'checkbox' : 'square-outline'}
                        size={18}
                        color={confirmado ? '#22c55e' : '#f59e0b'}
                      />
                      <Text style={[s.confirmarTexto, confirmado && { color: '#22c55e' }]}>
                        {confirmado ? 'Confirmado contra a prescrição' : 'Confirmo contra a prescrição'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}

          {/* Override com justificação */}
          {temFalhas && (
            <View style={s.overrideBox}>
              <Text style={s.overrideTitulo}>Justificação para override obrigatória</Text>
              <TextInput
                style={s.overrideInput}
                placeholder="Descreve o motivo para administrar mesmo assim (mín. 10 caracteres)…"
                placeholderTextColor="#475569"
                multiline
                numberOfLines={3}
                value={justificacao}
                onChangeText={setJustificacao}
              />
            </View>
          )}

          {/* Botões de acção */}
          <View style={s.botoesRow}>
            <TouchableOpacity
              style={s.btnNovo}
              onPress={() => { setResultado(null); setScanned(false); setJustificacao(''); setConfirmados({}); setQrLido(null); }}
            >
              <Ionicons name="scan-outline" size={16} color="#94a3b8" />
              <Text style={s.btnNovoText}>Ler novo QR</Text>
            </TouchableOpacity>

            {onAdministrar && (
              <TouchableOpacity
                style={[s.btnAdministrar, !podeAdministrar && s.btnDisabled]}
                onPress={handleAdministrar}
                disabled={!podeAdministrar}
              >
                <Ionicons name="checkmark-done-outline" size={16} color="#fff" />
                <Text style={s.btnAdministrarText}>Administrar</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const CANTO = 22;
const BORDA = 3;

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0f1e',
    alignItems: 'center',
  },
  fechar: {
    position: 'absolute',
    // `top` é definido em runtime a partir do inset seguro do dispositivo.
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  titulo: { fontSize: 20, fontWeight: '800', color: '#fff', marginTop: 8 },
  subtitulo: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 6,
    marginBottom: 24,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  textoInfo: { color: '#94a3b8', fontSize: 14, textAlign: 'center', marginTop: 8 },
  cameraBox: {
    width: 260,
    height: 260,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1e293b',
  },
  frame: { ...StyleSheet.absoluteFillObject },
  canto: { position: 'absolute', width: CANTO, height: CANTO, borderColor: '#2563eb' },
  cantoTL: { top: 12, left: 12, borderTopWidth: BORDA, borderLeftWidth: BORDA, borderTopLeftRadius: 6 },
  cantoTR: { top: 12, right: 12, borderTopWidth: BORDA, borderRightWidth: BORDA, borderTopRightRadius: 6 },
  cantoBL: { bottom: 12, left: 12, borderBottomWidth: BORDA, borderLeftWidth: BORDA, borderBottomLeftRadius: 6 },
  cantoBR: { bottom: 12, right: 12, borderBottomWidth: BORDA, borderRightWidth: BORDA, borderBottomRightRadius: 6 },
  statusBox: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 24 },
  statusTexto: { color: '#fff', fontSize: 15, fontWeight: '600' },
  erroBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
    backgroundColor: 'rgba(239,68,68,0.15)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  erroTexto: { color: '#fca5a5', fontSize: 13, fontWeight: '500' },
  dica: { color: '#475569', fontSize: 12, marginTop: 20 },
  // ── Resultado ────────────────────────────────────────────────────────────────
  resultadoScroll: { width: '100%', paddingHorizontal: 16 },
  bannerResultado: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    marginBottom: 16,
  },
  bannerOk:   { backgroundColor: 'rgba(34,197,94,0.12)' },
  bannerFalha: { backgroundColor: 'rgba(239,68,68,0.12)' },
  bannerTexto: { color: '#86efac', fontSize: 14, fontWeight: '600', flex: 1 },
  medCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  medNome:    { color: '#f1f5f9', fontSize: 16, fontWeight: '700' },
  medDetalhe: { color: '#64748b', fontSize: 13, marginTop: 4 },
  certoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 10,
    marginBottom: 6,
  },
  certoPorVerificar: { backgroundColor: '#78350f22', borderColor: '#f59e0b55' },
  confirmarBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8,
    paddingVertical: 10, paddingHorizontal: 8, minHeight: 44,
  },
  confirmarBtnFeito: { opacity: 0.9 },
  confirmarTexto: { fontSize: 13, color: '#f59e0b', fontWeight: '600' },
  certoOk:    { backgroundColor: 'rgba(34,197,94,0.08)' },
  certoFalha: { backgroundColor: 'rgba(239,68,68,0.08)' },
  certoNome:  { color: '#e2e8f0', fontSize: 14, fontWeight: '600' },
  certoMotivo: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  overrideBox: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
  },
  overrideTitulo: { color: '#f59e0b', fontSize: 13, fontWeight: '600', marginBottom: 8 },
  overrideInput: {
    backgroundColor: '#0f172a',
    color: '#f1f5f9',
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    minHeight: 72,
    textAlignVertical: 'top',
  },
  botoesRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  btnNovo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#1e293b',
    paddingVertical: 14,
    borderRadius: 12,
  },
  btnNovoText: { color: '#94a3b8', fontSize: 14, fontWeight: '600' },
  btnAdministrar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 12,
  },
  btnAdministrarText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  btnDisabled: { opacity: 0.4 },
});
