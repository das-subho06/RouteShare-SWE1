import React, { useCallback, useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import AsyncStorage from "../../lib/storage";
const colors = {
  brand: "#FF6659",
  text: "#1A1B1F",
  textMuted: "#6B7280",
  textFaint: "#9CA3AF",
  white: "#FFFFFF",
  border: "#E7E8EC",
};

const spacing = { md: 12, lg: 16 };
const radius = { lg: 16 };

const STORAGE_KEY = "activeRideSummary";
const AUTO_DISMISS_MS = 10000;

type RideSummary = {
  pickup: string;
  destination: string;
  price: string;
  vehicleNumber: string;
  driverName: string;
 [key: string]: string;
};

export default function RideToast() {
  const router = useRouter();
  const [rideToast, setRideToast] = useState<RideSummary | null>(null);

  // Re-check storage every time this screen comes back into focus.
  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const raw = await AsyncStorage.getItem(STORAGE_KEY);
          setRideToast(raw ? JSON.parse(raw) : null);
        } catch {
          setRideToast(null);
        }
      })();
    }, [])
  );

  // Auto-hide the toast after a few seconds. This only hides the UI —
  // it doesn't touch storage, so the toast reappears if the rider
  // refocuses this screen while the ride is still active.
  useEffect(() => {
    if (!rideToast) return;
    const t = setTimeout(() => setRideToast(null), AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [rideToast]);

  if (!rideToast) return null;

  const handlePress = () => {
    // Re-open the confirm page with the same details it was showing before
    // the rider navigated away. Adjust the pathname below if your app's
    // route to confirmpage.tsx is named differently.
    router.push({ pathname: "/confirmPage", params: rideToast });
  };

  return (
    <View style={styles.rideToast} pointerEvents="box-none">
      <TouchableOpacity style={styles.rideToastCard} activeOpacity={0.85} onPress={handlePress}>
        <View style={styles.rideToastHeader}>
          <Ionicons name="car-sport" size={18} color={colors.brand} />
          <Text style={styles.rideToastTitle}>Ride in progress</Text>
          <TouchableOpacity onPress={() => setRideToast(null)} style={{ marginLeft: "auto" }} hitSlop={8}>
            <Ionicons name="close" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
        <Text style={styles.rideToastRoute} numberOfLines={1}>
          {rideToast.pickup} → {rideToast.destination}
        </Text>
        <View style={styles.rideToastMetaRow}>
          <Text style={styles.rideToastMeta}>₹{rideToast.price}</Text>
          <Text style={styles.rideToastDot}>•</Text>
          <Text style={styles.rideToastMeta}>{rideToast.vehicleNumber}</Text>
          <Text style={styles.rideToastDot}>•</Text>
          <Text style={styles.rideToastMeta}>{rideToast.driverName}</Text>
        </View>
        <Text style={styles.rideToastHint}>Tap to view trip</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  rideToast: {
    position: "absolute",
    top: Platform.OS === "ios" ? 54 : 16,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 50,
    paddingHorizontal: spacing.lg,
  },
  rideToastCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    width: "100%",
    maxWidth: 420,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  rideToastHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  rideToastTitle: { fontSize: 13, fontWeight: "800", color: colors.text },
  rideToastRoute: { fontSize: 13.5, fontWeight: "700", color: colors.text, marginBottom: 4 },
  rideToastMetaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  rideToastMeta: { fontSize: 12, color: colors.textMuted, fontWeight: "600" },
  rideToastDot: { fontSize: 12, color: colors.textFaint },
  rideToastHint: { fontSize: 10.5, color: colors.textFaint, marginTop: 6, fontWeight: "600" },
});
