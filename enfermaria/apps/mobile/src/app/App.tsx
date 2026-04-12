import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { getUtilizador, logout, Utilizador } from '../lib/auth';
import api, { setUnauthorizedCallback } from '../lib/api';
import LoginScreen from '../screens/LoginScreen';
import DashboardScreen from '../screens/DashboardScreen';
import TurnoScreen from '../screens/TurnoScreen';
import TarefasScreen from '../screens/TarefasScreen';
import DoentesScreen from '../screens/DoentesScreen';
import MaisScreen from '../screens/MaisScreen';

const Tab = createBottomTabNavigator();

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_ICONS: Record<string, { ativo: IoniconName; inativo: IoniconName }> = {
  Dashboard: { ativo: 'grid',          inativo: 'grid-outline' },
  Doentes:   { ativo: 'medkit',        inativo: 'medkit-outline' },
  Turno:     { ativo: 'time',          inativo: 'time-outline' },
  Tarefas:   { ativo: 'checkbox',      inativo: 'checkbox-outline' },
  Mais:      { ativo: 'menu',          inativo: 'menu-outline' },
};

function TabIcon({ label, ativo }: { label: string; ativo: boolean }) {
  const icons = TAB_ICONS[label];
  const cor = ativo ? '#2563eb' : '#94a3b8';
  return (
    <View style={estilos.tabIcon}>
      <Ionicons name={ativo ? icons.ativo : icons.inativo} size={24} color={cor} />
      <Text style={[estilos.tabLabel, { color: cor }]}>{label}</Text>
    </View>
  );
}

export default function App() {
  const [utilizador, setUtilizador] = useState<Utilizador | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUnauthorizedCallback(() => setUtilizador(null));

    const iniciar = async () => {
      const u = await getUtilizador();
      if (!u) { setLoading(false); return; }

      // Valida o token contra a API — se falhar, força novo login
      try {
        await api.get('/auth/me');
        setUtilizador(u);
      } catch {
        await logout();
        setUtilizador(null);
      } finally {
        setLoading(false);
      }
    };

    iniciar();
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
          screenOptions={{
            headerShown: false,
            tabBarShowLabel: false,
            tabBarStyle: estilos.tabBar,
            tabBarItemStyle: estilos.tabItem,
          }}
        >
          <Tab.Screen
            name="Dashboard"
            options={{ tabBarIcon: ({ focused }) => <TabIcon label="Dashboard" ativo={focused} /> }}
          >
            {() => <DashboardScreen utilizador={utilizador} />}
          </Tab.Screen>

          <Tab.Screen
            name="Doentes"
            options={{ tabBarIcon: ({ focused }) => <TabIcon label="Doentes" ativo={focused} /> }}
          >
            {() => <DoentesScreen utilizador={utilizador} />}
          </Tab.Screen>

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
            name="Mais"
            options={{ tabBarIcon: ({ focused }) => <TabIcon label="Mais" ativo={focused} /> }}
          >
            {() => <MaisScreen utilizador={utilizador} onLogout={() => setUtilizador(null)} />}
          </Tab.Screen>
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const estilos = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9' },
  tabBar: { height: 72, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  tabItem: { justifyContent: 'center', alignItems: 'center', paddingTop: 10, paddingBottom: 10 },
  tabIcon: { alignItems: 'center', justifyContent: 'center', gap: 3 },
  tabLabel: { fontSize: 10, fontWeight: '500' },
});
