import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

const colors = {
  brand: '#FF6659',
  brandDark: '#E9564A',
  bg: '#181A20',
  bg2: '#0F1014',
  carBody: '#FFC72C',
  carBodyDark: '#F2A900',
  carGlass: '#BFE0E8',
  carDark: '#22262E',
  carWheelHub: '#D9D9D9',
};

export default function RouteTransitionOverlay({ active }: { active: boolean }) {
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const wheelSpin = useRef(new Animated.Value(0)).current; // 0..1, loops
  const scanY = useRef(new Animated.Value(0)).current; // 0..1
  const dashX = useRef(new Animated.Value(0)).current; // 0..1
  const glow = useRef(new Animated.Value(0)).current; // 0..1
  const brandFlicker = useRef(new Animated.Value(1)).current;

  const loopsRef = useRef<Animated.CompositeAnimation[]>([]);

  useEffect(() => {
    if (active) {
      // Fade the overlay in. The car itself stays put — only its wheels
      // spin — while the road/streaks/scan bar keep implying motion.
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start();

      const wheelLoop = Animated.loop(
        Animated.timing(wheelSpin, {
          toValue: 1,
          duration: 500,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      const scanLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(scanY, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(scanY, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      );
      const dashLoop = Animated.loop(
        Animated.timing(dashX, { toValue: 1, duration: 400, easing: Easing.linear, useNativeDriver: true })
      );
      const glowLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(glow, { toValue: 1, duration: 300, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(glow, { toValue: 0, duration: 300, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ])
      );
      const flickerLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(brandFlicker, { toValue: 0.4, duration: 220, useNativeDriver: true }),
          Animated.timing(brandFlicker, { toValue: 1, duration: 280, useNativeDriver: true }),
        ])
      );

      loopsRef.current = [wheelLoop, scanLoop, dashLoop, glowLoop, flickerLoop];
      loopsRef.current.forEach((l) => l.start());
    } else {
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start(() => {
        loopsRef.current.forEach((l) => l.stop());
        loopsRef.current = [];
      });
    }

    return () => {
      loopsRef.current.forEach((l) => l.stop());
      loopsRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const wheelRotate = wheelSpin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const scanTranslate = scanY.interpolate({ inputRange: [0, 1], outputRange: [-60, 60] });
  const dashTranslate = dashX.interpolate({ inputRange: [0, 1], outputRange: [0, -40] });
  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0.85] });
  const glowScale = glow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] });

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.overlay, { opacity: overlayOpacity }]}
    >
      {/* faint techy grid */}
      <View style={styles.grid}>
        {Array.from({ length: 14 }).map((_, i) => (
          <View key={`v-${i}`} style={[styles.gridLineV, { left: `${(i / 13) * 100}%` }]} />
        ))}
        {Array.from({ length: 8 }).map((_, i) => (
          <View key={`h-${i}`} style={[styles.gridLineH, { top: `${(i / 7) * 100}%` }]} />
        ))}
      </View>

      {/* scanning light bar */}
      <Animated.View
        style={[styles.scanBar, { transform: [{ translateY: scanTranslate }] }]}
      />

      {/* dashed road */}
      <View style={styles.road}>
        <View style={styles.roadLineClip}>
          <Animated.View style={[styles.roadDashRow, { transform: [{ translateX: dashTranslate }] }]}>
            {Array.from({ length: 40 }).map((_, i) => (
              <View key={i} style={styles.dash} />
            ))}
          </Animated.View>
        </View>

        {/* the runner: streaks + glow + car, all sweeping together */}
        <View style={styles.runner}>
          <View style={styles.streaks}>
            <View style={[styles.streak, { opacity: 0.7, width: 30 }]} />
            <View style={[styles.streak, { opacity: 0.5, width: 22 }]} />
            <View style={[styles.streak, { opacity: 0.3, width: 14 }]} />
          </View>

          <Animated.View
            style={[
              styles.glow,
              { opacity: glowOpacity, transform: [{ scale: glowScale }] },
            ]}
          />

          <View style={styles.car}>
            {/* cabin/roof */}
            <View style={styles.carRoof} />
            {/* window band */}
            <View style={styles.carWindowBand}>
              <View style={styles.carWindow} />
              <View style={[styles.carWindow, { left: 62 }]} />
            </View>
            {/* main body */}
            <View style={styles.carBody} />
            {/* door seam + handle for a bit of detail */}
            <View style={styles.carDoorSeam} />
            <View style={styles.carHandle} />
            {/* headlight + taillight */}
            <View style={styles.carHeadlight} />
            <View style={styles.carTaillight} />
            {/* wheels */}
            <Animated.View style={[styles.carWheel, styles.carWheelBack, { transform: [{ rotate: wheelRotate }] }]}>
              <View style={styles.carWheelHub} />
            </Animated.View>
            <Animated.View style={[styles.carWheel, styles.carWheelFront, { transform: [{ rotate: wheelRotate }] }]}>
              <View style={styles.carWheelHub} />
            </Animated.View>
          </View>
        </View>
      </View>

      <Animated.Text style={[styles.brand, { opacity: brandFlicker }]}>
        route<Text style={styles.brandAccent}>share</Text>
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9998,
    backgroundColor: colors.bg2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  grid: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.35,
  },
  gridLineV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(255,102,89,0.12)',
  },
  gridLineH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,102,89,0.12)',
  },
  scanBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: colors.brand,
    shadowColor: colors.brand,
    shadowOpacity: 0.9,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  road: {
    width: '100%',
    height: 160,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  roadLineClip: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 40,
    height: 3,
    overflow: 'hidden',
  },
  roadDashRow: {
    flexDirection: 'row',
  },
  dash: {
    width: 20,
    height: 3,
    marginRight: 20,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  runner: {
    width: 200,
    height: 140,
  },
  streaks: {
    position: 'absolute',
    right: '100%',
    bottom: 44,
    alignItems: 'flex-end',
  },
  streak: {
    height: 3,
    marginBottom: 5,
    borderRadius: 2,
    backgroundColor: colors.brand,
  },
  glow: {
    position: 'absolute',
    bottom: 4,
    left: 16,
    width: 150,
    height: 50,
    borderRadius: 60,
    backgroundColor: colors.brand,
  },
  car: {
    width: '100%',
    height: 90,
    position: 'relative',
  },
  carBody: {
    position: 'absolute',
    left: 0,
    bottom: 20,
    width: 168,
    height: 34,
    backgroundColor: colors.carBody,
    borderRadius: 16,
  },
  carRoof: {
    position: 'absolute',
    left: 30,
    bottom: 42,
    width: 96,
    height: 26,
    backgroundColor: colors.carBody,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 14,
  },
  carWindowBand: {
    position: 'absolute',
    left: 36,
    bottom: 44,
    width: 84,
    height: 18,
    flexDirection: 'row',
  },
  carWindow: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 40,
    height: 18,
    borderRadius: 4,
    backgroundColor: colors.carGlass,
  },
  carDoorSeam: {
    position: 'absolute',
    left: 90,
    bottom: 20,
    width: 2,
    height: 34,
    backgroundColor: colors.carBodyDark,
  },
  carHandle: {
    position: 'absolute',
    left: 66,
    bottom: 40,
    width: 14,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.carBodyDark,
  },
  carHeadlight: {
    position: 'absolute',
    right: 2,
    bottom: 30,
    width: 12,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFF3C4',
  },
  carTaillight: {
    position: 'absolute',
    left: 2,
    bottom: 30,
    width: 8,
    height: 10,
    borderRadius: 4,
    backgroundColor: colors.brand,
  },
  carWheel: {
    position: 'absolute',
    bottom: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.carDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  carWheelBack: {
    left: 18,
  },
  carWheelFront: {
    left: 116,
  },
  carWheelHub: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.carWheelHub,
  },
  brand: {
    position: 'absolute',
    bottom: 24,
    fontSize: 13,
    letterSpacing: 4,
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#fff',
  },
  brandAccent: {
    color: colors.brand,
  },
});
