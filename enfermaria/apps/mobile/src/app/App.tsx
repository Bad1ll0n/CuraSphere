import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { getUtilizador, Utilizador } from '../lib/auth';
import LoginScreen from '../screens/LoginScreen';
import TurnoScreen from '../screens/TurnoScreen';
import TarefasScreen from '../screens/TarefasScreen';
import DoentesScreen from '../screens/DoentesScreen';
import PerfilScreen from '../screens/PerfilScreen';

const Tab = createBottomTabNavigator();

function TabIcon({ label, ativo }: { label: string; ativo: boolean }) {
  const icones: Record<string, string> = {
    Turno: '🔄', Tarefas: '✅', Doentes: '🏥', Perfil: '👤',
  };
  return (
    <View style={[estilos.tabIcon, ativo && estilos.tabIconAtivo]}>
      <Text style={estilos.tabEmoji}>{icones[label]}</Text>
      <Text style={[estilos.tabLabel, ativo && estilos.tabLabelAtivo]}>{label}</Text>
    </View>
  );
}

export default function App() {
  const [utilizador, setUtilizador] = useState<Utilizador | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getUtilizador().then(setUtilizador).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <View style={estilos.loading}>
      <ActivityIndicator size="large" color="#2563eb" />
    </View>
  );

  if (!utilizador) return (
    <LoginScreen onLogin={async () => {
      const u = await getUtilizador();
      setUtilizador(u);
    }} />
  );

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={{ headerShown: false, tabBarShowLabel: false, tabBarStyle: estilos.tabBar }}
        >
          <Tab.Screen
            name="Turno"
            options={{ tabBarIcon: ({ focused }) => <TabIcon label="Turno" ativo={focused} /> }}
          >
            {() => <TurnoScreen utilizador={utilizador} />}
          </Tab.Screen>

          <Tab.Screen
            name="Tarefas"
            component={TarefasScreen}
            options={{ tabBarIcon: ({ focused }) => <TabIcon label="Tarefas" ativo={focused} /> }}
          />

          <Tab.Screen
            name="Doentes"
            options={{ tabBarIcon: ({ focused }) => <TabIcon label="Doentes" ativo={focused} /> }}
          >
            {() => <DoentesScreen utilizador={utilizador} />}
          </Tab.Screen>

          <Tab.Screen
            name="Perfil"
            options={{ tabBarIcon: ({ focused }) => <TabIcon label="Perfil" ativo={focused} /> }}
          >
            {() => <PerfilScreen utilizador={utilizador} onLogout={() => setUtilizador(null)} />}
          </Tab.Screen>
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const estilos = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9' },
  tabBar: { height: 70, paddingBottom: 8, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  tabIcon: { alignItems: 'center', justifyContent: 'center', paddingTop: 8 },
  tabIconAtivo: {},
  tabEmoji: { fontSize: 22 },
  tabLabel: { fontSize: 11, color: '#94a3b8', marginTop: 2, fontWeight: '500' },
  tabLabelAtivo: { color: '#2563eb', fontWeight: '700' },
});
