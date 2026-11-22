import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, ScrollView, Alert,
} from 'react-native';
import Svg, { Circle, Ellipse, Rect, Defs, RadialGradient, Stop } from 'react-native-svg';
import { ativarEntradaBiometrica, entrarComBiometria, login, logout, verificarMfa, type ResultadoLogin } from '../lib/auth';
import { autenticarComBiometria, biometriaDisponivel, temSessaoBiometrica } from '../lib/biometric';

const PAPEIS_CLINICOS = ['medico', 'enfermeiro', 'farmaceutico', 'chefe_enfermeiros'];

interface Props { onLogin: () => void }

function LogoCuraSphere({ size = 72 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Defs>
        <RadialGradient id="sg" cx="40%" cy="35%" r="60%">
          <Stop offset="0%" stopColor="#60c8f5" />
          <Stop offset="50%" stopColor="#2196f3" />
          <Stop offset="100%" stopColor="#1565c0" />
        </RadialGradient>
      </Defs>
      <Circle cx="60" cy="60" r="44" fill="url(#sg)" />
      <Ellipse
        cx="60" cy="60" rx="58" ry="18"
        fill="none" stroke="#26d9c8" strokeWidth="7" strokeLinecap="round"
        rotation="-30" originX="60" originY="60"
        opacity={0.9}
      />
      <Rect x="53" y="38" width="14" height="44" rx="4" fill="white" opacity={0.95} />
      <Rect x="38" y="53" width="44" height="14" rx="4" fill="white" opacity={0.95} />
      <Circle cx="48" cy="46" r="8" fill="white" opacity={0.25} />
    </Svg>
  );
}

export default function LoginScreen({ onLogin }: Props) {
  const [numeroFuncionario, setNumeroFuncionario] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [temBiometria, setTemBiometria] = useState(false);
  const [oferecerBiometria, setOferecerBiometria] = useState(false);
  // SEC-23: passo do código MFA (papéis clínicos têm MFA obrigatório).
  const [desafioMfa, setDesafioMfa] = useState<string | null>(null);
  const [codigoMfa, setCodigoMfa] = useState('');

  const entrarPorBiometria = async () => {
    setLoading(true);
    setErro('');
    try {
      // O sistema pede Face ID / impressão digital para libertar a sessão guardada.
      const u = await entrarComBiometria();
      if (u) onLogin();
      else { setTemBiometria(false); setErro('A sessão guardada expirou. Entre com a password.'); }
    } finally { setLoading(false); }
  };

  useEffect(() => {
    (async () => {
      if (!(await biometriaDisponivel()) || !(await temSessaoBiometrica())) return;
      setTemBiometria(true);
      await entrarPorBiometria();
    })();
  }, []);

  /** Depois de autenticado (com ou sem MFA): biometria obrigatória para papéis clínicos. */
  const concluir = async (r: ResultadoLogin) => {
    if (r.tipo === 'mfa') { setDesafioMfa(r.desafio); setCodigoMfa(''); return; }
    if (r.tipo === 'mfa_setup') {
      setErro('Este perfil exige autenticação de dois fatores. Configure-a primeiro na aplicação web e volte a entrar.');
      return;
    }
    if (r.tipo === 'password_expirada') {
      setErro('A sua password expirou. Altere-a na aplicação web e volte a entrar.');
      return;
    }
    setDesafioMfa(null);
    const disponivel = await biometriaDisponivel();
    if (PAPEIS_CLINICOS.includes(r.utilizador.role)) {
      if (disponivel) {
        const ok = await autenticarComBiometria();
        if (!ok) {
          await logout();
          Alert.alert(
            'Biometria necessária',
            'A biometria é obrigatória para acesso clínico. Tente novamente e confirme com Face ID / Touch ID.',
          );
          return;
        }
      } else {
        Alert.alert(
          '⚠️ Recomendação de segurança',
          'Active biometria (Face ID/Touch ID) nas definições do dispositivo para proteger o acesso aos dados dos doentes.',
          [{ text: 'OK' }],
        );
      }
    }
    if (disponivel && !temBiometria) setOferecerBiometria(true);
    else onLogin();
  };

  const handleLogin = async () => {
    if (!numeroFuncionario || !password) return;
    setLoading(true);
    setErro('');
    try {
      await concluir(await login(numeroFuncionario, password));
    } catch {
      setErro('Número de funcionário ou password incorretos.');
    } finally {
      setPassword(''); // SEC-23: a password não fica em memória depois de usada
      setLoading(false);
    }
  };

  const handleMfa = async () => {
    if (!desafioMfa || codigoMfa.length !== 6) return;
    setLoading(true);
    setErro('');
    try {
      await concluir(await verificarMfa(desafioMfa, codigoMfa));
    } catch {
      setCodigoMfa('');
      setErro('Código inválido ou expirado. Tente o código seguinte da sua aplicação.');
    } finally { setLoading(false); }
  };

  const activarBiometria = async () => {
    // SEC-23: guarda a sessão (refresh token) protegida por biometria — nunca a password.
    await ativarEntradaBiometrica();
    setTemBiometria(true);
    setOferecerBiometria(false);
    onLogin();
  };

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Topo escuro — branding */}
      <View style={s.topo}>
        <LogoCuraSphere size={80} />
        <Text style={s.marca}>CuraSphere</Text>
        <Text style={s.slogan}>Gestão Hospitalar</Text>

        {/* Badge */}
        <View style={s.badge}>
          <View style={s.badgeDot} />
          <Text style={s.badgeTexto}>Sistema em tempo real</Text>
        </View>
      </View>

      {/* Fundo branco — formulário */}
      <ScrollView
        style={s.sheet}
        contentContainerStyle={s.sheetContent}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        <Text style={s.bemVindo}>Bem-vindo de volta</Text>
        <Text style={s.instrucao}>Introduza as suas credenciais para continuar</Text>

        <View style={s.campo}>
          <Text style={s.label}>Número de Funcionário</Text>
          <TextInput
            style={s.input}
            value={numeroFuncionario}
            onChangeText={setNumeroFuncionario}
            placeholder="Ex: 00001"
            placeholderTextColor="#94a3b8"
            keyboardType="numeric"
            autoCapitalize="none"
            autoComplete="username"
          />
        </View>

        <View style={s.campo}>
          <Text style={s.label}>Password</Text>
          <TextInput
            style={s.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor="#94a3b8"
            secureTextEntry
            autoComplete="current-password"
          />
        </View>

        {erro ? (
          <View style={s.erroBox}>
            <Text style={s.erroTexto}>⚠ {erro}</Text>
          </View>
        ) : null}

        {desafioMfa ? (
          <View style={s.campo}>
            <Text style={s.label}>Código de autenticação (6 dígitos)</Text>
            <TextInput
              style={s.input}
              value={codigoMfa}
              onChangeText={(v) => setCodigoMfa(v.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              placeholderTextColor="#94a3b8"
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              accessibilityLabel="Código de autenticação de dois fatores"
              autoFocus
            />
          </View>
        ) : null}

        <TouchableOpacity accessibilityRole="button"
          style={[s.botao, (desafioMfa ? codigoMfa.length !== 6 : (!numeroFuncionario || !password)) || loading ? s.botaoDesativado : null]}
          onPress={desafioMfa ? handleMfa : handleLogin}
          disabled={(desafioMfa ? codigoMfa.length !== 6 : (!numeroFuncionario || !password)) || loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.botaoTexto}>{desafioMfa ? 'Confirmar código' : 'Entrar'}</Text>
          }
        </TouchableOpacity>

        {temBiometria && !oferecerBiometria && (
          <TouchableOpacity accessibilityRole="button" style={s.botaoBio} onPress={entrarPorBiometria} activeOpacity={0.8}>
            <Text style={s.botaoBioTexto}>🔒 Entrar com biometria</Text>
          </TouchableOpacity>
        )}

        {oferecerBiometria && (
          <View style={s.bioOferta}>
            <Text style={s.bioOfertaTitulo}>Activar autenticação biométrica?</Text>
            <Text style={s.bioOfertaDesc}>Utilize Face ID / Touch ID nos próximos acessos</Text>
            <View style={s.bioOfertaBotoes}>
              <TouchableOpacity accessibilityRole="button" style={s.bioNao} onPress={() => { setOferecerBiometria(false); onLogin(); }}>
                <Text style={s.bioNaoTexto}>Agora não</Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" style={s.bioSim} onPress={activarBiometria}>
                <Text style={s.bioSimTexto}>Activar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <Text style={s.rodape}>Acesso restrito a profissionais autorizados</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0f1e' },

  // Topo
  topo: { alignItems: 'center', paddingTop: 64, paddingBottom: 40, gap: 8 },
  marca: { fontSize: 26, fontWeight: '800', color: '#fff', letterSpacing: -0.5, marginTop: 4 },
  slogan: { fontSize: 13, color: '#64748b', fontWeight: '500' },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(59,130,246,0.12)', borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.2)', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 6, marginTop: 12,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#60a5fa' },
  badgeTexto: { fontSize: 13, fontWeight: '700', color: '#93c5fd', textTransform: 'uppercase', letterSpacing: 0.8 },

  // Formulário
  sheet: {
    flex: 1, backgroundColor: '#fff',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
  },
  sheetContent: { padding: 28, paddingTop: 32, paddingBottom: 40 },
  bemVindo: { fontSize: 22, fontWeight: '800', color: '#0f172a', marginBottom: 4 },
  instrucao: { fontSize: 13, color: '#64748b', marginBottom: 28 },

  campo: { marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 8 },
  input: {
    borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, color: '#0f172a', backgroundColor: '#f8fafc',
  },

  erroBox: {
    backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca',
    borderRadius: 10, padding: 12, marginBottom: 16,
  },
  erroTexto: { color: '#dc2626', fontSize: 13, fontWeight: '500' },

  botao: {
    backgroundColor: '#2563eb', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginTop: 4,
    shadowColor: '#2563eb', shadowOpacity: 0.35, shadowOffset: { width: 0, height: 6 }, shadowRadius: 12,
    elevation: 6,
  },
  botaoDesativado: { backgroundColor: '#93c5fd', shadowOpacity: 0 },
  botaoTexto: { color: '#fff', fontWeight: '700', fontSize: 16 },

  rodape: { textAlign: 'center', fontSize: 13, color: '#94a3b8', marginTop: 24 },

  botaoBio: {
    marginTop: 12, borderWidth: 1.5, borderColor: '#2563eb',
    borderRadius: 14, paddingVertical: 14, alignItems: 'center',
  },
  botaoBioTexto: { color: '#2563eb', fontWeight: '700', fontSize: 15 },

  bioOferta: {
    marginTop: 20, backgroundColor: '#eff6ff', borderWidth: 1,
    borderColor: '#bfdbfe', borderRadius: 14, padding: 18,
  },
  bioOfertaTitulo: { fontSize: 15, fontWeight: '700', color: '#1e40af', marginBottom: 4 },
  bioOfertaDesc: { fontSize: 13, color: '#3b82f6', marginBottom: 14 },
  bioOfertaBotoes: { flexDirection: 'row', gap: 10 },
  bioNao: { flex: 1, borderWidth: 1, borderColor: '#93c5fd', borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  bioNaoTexto: { color: '#3b82f6', fontSize: 13, fontWeight: '600' },
  bioSim: { flex: 1, backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  bioSimTexto: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
