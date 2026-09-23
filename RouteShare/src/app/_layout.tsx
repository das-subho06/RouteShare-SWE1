import { DarkTheme, DefaultTheme, ThemeProvider } from "expo-router/react-navigation";
import { Slot, Stack, usePathname } from 'expo-router';
import { useColorScheme } from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import { useEffect, useRef, useState } from 'react';
import RouteTransitionOverlay from '../components/RouteTransitionOverlay';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  const pathname = usePathname();
  const [transitioning, setTransitioning] = useState(false);
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setTransitioning(true);
    const t = setTimeout(() => setTransitioning(false), 1300);
    return () => clearTimeout(t);
  }, [pathname]);

  return (
    
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <SafeAreaProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="rider" />
          <Stack.Screen name="driverDashboard" />
          <Stack.Screen name="confirmPage" />
          <Stack.Screen name="chat" />
          <Stack.Screen name="shareRide" />
        </Stack>
        <RouteTransitionOverlay active={transitioning} />
        </SafeAreaProvider>
      </ThemeProvider>
    
  );
}
