import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useColorScheme } from "react-native";

export default function RootLayout() {
  const dark = useColorScheme() !== "light";
  return (
    <SafeAreaProvider>
      <StatusBar style={dark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#09090b" },
        }}
      />
    </SafeAreaProvider>
  );
}
