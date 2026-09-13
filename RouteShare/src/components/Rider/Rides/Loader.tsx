import React, { useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

/* ------------------------------------------------------------------ */
/*  Theme — kept in sync with ChooseRide.tsx / Rider.tsx               */
/* ------------------------------------------------------------------ */

const colors = {
  brand: "#FF6659",
  brandDark: "#E9564A",
  brandTint: "#FFEDEC",
  text: "#1A1B1F",
  textMuted: "#6B7280",
  textFaint: "#9CA3AF",
  white: "#FFFFFF",
  border: "#E7E8EC",
  mapBg: "#F3F4F6",
  streetText: "#D9DBE1",
  park: "#DCEEDC",
};

const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
const radius = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 };

/* ------------------------------------------------------------------ */
/*  Decorative background — loosely mirrors the reference screenshot   */
/* ------------------------------------------------------------------ */

const STREET_LABELS: { label: string; top: number; left: number; rotate: string }[] = [
  { label: "Reader St", top: 14, left: 78, rotate: "-16deg" },
  { label: "Broadway", top: 4, left: 246, rotate: "60deg" },
  { label: "Church St", top: 84, left: -14, rotate: "60deg" },
  { label: "Warren St", top: 134, left: 2, rotate: "60deg" },
  { label: "Park Pl", top: 184, left: 12, rotate: "60deg" },
  { label: "Park Row", top: 258, left: 104, rotate: "-10deg" },
  { label: "Spruce St", top: 276, left: 224, rotate: "55deg" },
  { label: "Ann St", top: 336, left: 34, rotate: "-10deg" },
  { label: "William St", top: 352, left: 196, rotate: "60deg" },
  { label: "Gold St", top: 340, left: 276, rotate: "60deg" },
];

/* ------------------------------------------------------------------ */
/*  Animation hooks                                                     */
/* ------------------------------------------------------------------ */

// One "radar ping": scales up + fades out, then loops after `delay`.
function useRingAnimation(delay: number, duration: number) {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(value, {
          toValue: 1,
          duration,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(value, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [value, delay, duration]);
  return value;
}

// A single loader dot pulsing in sequence with its siblings.
function useDotAnimation(delay: number) {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(value, { toValue: 1, duration: 320, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(value, { toValue: 0, duration: 320, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.delay(360),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [value, delay]);
  return value;
}

// Slow "breathing" scale for the center car marker.
function useBreatheAnimation(duration: number) {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, { toValue: 1, duration, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(value, { toValue: 0, duration, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [value, duration]);
  return value;
}

/* ------------------------------------------------------------------ */
/*  Component                                                           */
/* ------------------------------------------------------------------ */

export type LoaderProps = {
  title?: string;
  message?: string;
  subMessage?: string;
  /** Minimum time the loader stays on screen before onComplete fires. */
  minDurationMs?: number;
  /** Called when the user backs out / cancels the search. */
  onCancel: () => void;
  /** Called once, after minDurationMs has elapsed (unless cancelled first). */
  onComplete: () => void;
};

export default function Loader({
  title = "Searching for a car",
  message = "Searching for a car...",
  subMessage = "This may take a few seconds...",
  minDurationMs = 2000,
  onCancel,
  onComplete,
}: LoaderProps) {
  const ring1 = useRingAnimation(0, 1600);
  const ring2 = useRingAnimation(550, 1600);
  const ring3 = useRingAnimation(1100, 1600);

  const dot1 = useDotAnimation(0);
  const dot2 = useDotAnimation(160);
  const dot3 = useDotAnimation(320);

  const carBreathe = useBreatheAnimation(900);

  // Guards against onComplete firing after the user already cancelled,
  // and against double-firing if minDurationMs is very small.
  const completedRef = useRef(false);
const cancelledRef = useRef(false);

useEffect(() => {
  const timer = setTimeout(() => {
    if (!completedRef.current) {
      completedRef.current = true;
      onComplete();
    }
  }, Math.max(minDurationMs, 0));
  return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

const handleCancel = () => {
  if (cancelledRef.current) return;
  cancelledRef.current = true;
  onCancel();
};

  const ringStyle = (v: Animated.Value) => ({
    opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
    transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.5, 2.5] }) }],
  });

  const dotStyle = (v: Animated.Value) => ({
    opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
    transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.3] }) }],
  });

  const carScale = carBreathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={handleCancel} style={styles.iconBtn} accessibilityLabel="Back" hitSlop={10}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.iconBtn} />
      </View>

      <View style={styles.mapArea}>
        <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
          <View style={styles.park} />
          {STREET_LABELS.map((s, i) => (
            <Text
              key={i}
              style={[styles.streetLabel, { top: s.top, left: s.left, transform: [{ rotate: s.rotate }] }]}
            >
              {s.label}
            </Text>
          ))}
        </View>

        <View style={styles.dotsRow}>
          <Animated.View style={[styles.dot, dotStyle(dot1)]} />
          <Animated.View style={[styles.dot, dotStyle(dot2)]} />
          <Animated.View style={[styles.dot, dotStyle(dot3)]} />
        </View>

        <Text style={styles.message}>{message}</Text>
        <Text style={styles.subMessage}>{subMessage}</Text>

        <View style={styles.radarWrap} pointerEvents="none">
          <Animated.View style={[styles.ring, ringStyle(ring3)]} />
          <Animated.View style={[styles.ring, ringStyle(ring2)]} />
          <Animated.View style={[styles.ring, ringStyle(ring1)]} />
          <Animated.View style={[styles.carCircle, { transform: [{ scale: carScale }] }]}>
            <MaterialCommunityIcons name="car" size={26} color={colors.white} />
          </Animated.View>
        </View>
      </View>

      <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel} activeOpacity={0.8}>
        <Ionicons name="close-circle-outline" size={18} color={colors.brand} />
        <Text style={styles.cancelText}>Cancel Search</Text>
      </TouchableOpacity>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Styles                                                              */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.sm },
  iconBtn: { padding: 4, width: 28 },
  title: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "800", color: colors.text },

  mapArea: {
    minHeight: 400,
    borderRadius: radius.lg,
    backgroundColor: colors.mapBg,
    overflow: "hidden",
    alignItems: "center",
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  park: {
    position: "absolute",
    top: -30,
    right: -40,
    width: 160,
    height: 220,
    borderRadius: 70,
    backgroundColor: colors.park,
    opacity: 0.7,
    transform: [{ rotate: "18deg" }],
  },
  streetLabel: {
    position: "absolute",
    fontSize: 11,
    fontWeight: "600",
    color: colors.streetText,
  },

  dotsRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: spacing.md },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand },

  message: { fontSize: 17, fontWeight: "800", color: colors.text, textAlign: "center" },
  subMessage: { fontSize: 12.5, color: colors.textMuted, textAlign: "center", marginTop: 4, marginBottom: spacing.xl },

  radarWrap: { width: 220, height: 220, alignItems: "center", justifyContent: "center" },
  ring: {
    position: "absolute",
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: colors.brand,
  },
  carCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.brandDark,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },

  cancelBtn: {
    marginTop: spacing.lg,
    backgroundColor: colors.brandTint,
    borderRadius: radius.md,
    paddingVertical: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  cancelText: { color: colors.brand, fontWeight: "700", fontSize: 15 },
});
