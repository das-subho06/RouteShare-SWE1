import React, { useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Loader from "./Loader";
import AsyncStorage from "../../lib/storage";
import { getSocket } from '../../lib/socket';
/* ------------------------------------------------------------------ */
/*  Theme — kept in sync with Rider.tsx so the card feels native to    */
/*  the rest of the app, but this file has zero import dependency on   */
/*  Rider.tsx so it can be dropped in anywhere.                        */
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
  rowBg: "#F7F7F9",
  etaBg: "#FFEDEC",
  etaText: "#E9564A",
};

const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
const radius = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 };

/* ------------------------------------------------------------------ */
/*  Ride catalogue                                                      */
/* ------------------------------------------------------------------ */

export type RideOption = {
  id: string;
  name: string;
  tagline: string;
  no_ac:boolean;
  ac: boolean;
  seats: number;
  minutesAway: number;
  minFare: number;
  baseFare: number;
  perKm: number;
  perMinute: number;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
};

export const RIDE_OPTIONS: RideOption[] = [
  {
    id: "mini",
    name: "Go Mini",
    tagline: "Affordable everyday rides",
    no_ac:true,
    ac: false,
    seats: 4,
    minutesAway: 3,
    baseFare: 40,
    perKm: 12.54,
     minFare: 60,
     perMinute: 1.5,
    icon: "car-hatchback",
  },
  {
    id: "sedan",
    name: "Go Sedan",
    tagline: "Comfortable sedans for daily travel",
    no_ac:false,
    ac: true,
    seats: 4,
    minutesAway: 5,
    baseFare: 60,
    perKm: 17.3,
    minFare: 85,
    perMinute: 2,
    icon: "car",
  },
  {
    id: "suv",
    name: "Go SUV",
    tagline: "More space for you and your group",
    no_ac:false,
    ac: true,
    seats: 6,
    minutesAway: 7,
    baseFare: 90,
    perKm: 25.56,
    minFare: 130,
    perMinute: 2.5,
    icon: "car-estate",
  },
  {
    id: "xl",
    name: "Go XL",
    tagline: "Extra room for bigger groups",
    no_ac:false,
    ac: true,
    seats: 6,
    minutesAway: 9,
    baseFare: 120,
    perKm: 31.1,
    perMinute: 3,
    minFare: 170,
    icon: "car-side",
  },
  // {
  //   id: "premier",
  //   name: "Go Premier",
  //   tagline: "Premium rides for a luxury experience",
  //   ac: true,
  //   seats: 4,
  //   minutesAway: 11,
  //   baseFare: 150,
  //   perMinute: 3.5,
  //   minFare: 220,
  //   perKm: 36.67,
  //   icon: "car-sports",
  // },
];

/* ------------------------------------------------------------------ */
/*  Component                                                           */
/* ------------------------------------------------------------------ */

export type ChooseRideProps = {
  pickupLabel?: string;
  destinationLabel?: string;
  pickupCoords: { latitude: number; longitude: number };
  destinationCoords: { latitude: number; longitude: number };
  distanceKm: number;
  durationMinutes: number;
  riderCount: number; 
   paymentMethod: string;          // NEW
  rideOptions: string[];           // NEW — comes from Rider.tsx's RiderCountModal
  riderName?: string;
  rides?: RideOption[];
  initialSelectedId?: string;
   autoSearch?: boolean;
  excludeDriverId?: string | null;   // NEW — set when auto-retrying after a driver cancelled
  onClose: () => void;
  onConfirm: (ride: RideOption, price: number) => void;

};

export default function ChooseRide({
  pickupLabel,
  destinationLabel,
  pickupCoords,
  destinationCoords,
  distanceKm,
  durationMinutes,
  riderCount,
  paymentMethod,      // NEW
  rideOptions,        // NEW
  rides = RIDE_OPTIONS,
  riderName,
  initialSelectedId,
  autoSearch,
  excludeDriverId,
  onClose,
  onConfirm,  
}: ChooseRideProps) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string>(initialSelectedId ?? rides[0]?.id ?? "");
  // When true, the ride list is swapped out for the inline "searching" loader.
  const [confirming, setConfirming] = useState(autoSearch);
  const [noDriver, setNoDriver] = useState(false);
const requestSentRef = useRef(false);
const activeRequestIdRef = useRef<string | null>(null);   // NEW — tracks the row we created, if any
  const priceFor = (ride: RideOption) => Math.max(0, Math.round(ride.baseFare + ride.perKm * distanceKm));
  const selected = rides.find((r) => r.id === selectedId) ?? rides[0];
  const selectedPrice = selected ? priceFor(selected) : 0;
  useEffect(() => {
    if (autoSearch && selected) {
      setConfirming(true);
    }
    // Only meant to fire once, right when this instance mounts after a cancel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

if (confirming && selected) {
  return (
     <Loader 
  onCancel={() => { 
    setConfirming(false); 
    requestSentRef.current = false; 
    if (activeRequestIdRef.current) {
      getSocket().emit('cancel_ride_request', { requestId: activeRequestIdRef.current });
      activeRequestIdRef.current = null;
    }
    onClose(); 
  }} 
  onComplete={async () => {
          if (requestSentRef.current) return;
          requestSentRef.current = true;
          const riderId = await AsyncStorage.getItem('userId');
          
          const socket = getSocket();
          socket.emit('rider_online', { riderId });   // keep this — server needs it to route ride_accepted back

          socket.emit('request_ride', {
            riderId,
            riderName,
            pickup: { label: pickupLabel, ...pickupCoords },
            destination: { label: destinationLabel, ...destinationCoords },
            distanceKm,
            durationMinutes,
            price: selectedPrice,
            rideName: selected.name,
            carSeats: selected.seats,
            riderCount, paymentMethod,     // NEW
            rideOptions,   
            excludeDriverId,   // NEW — server won't re-offer this trip to the driver who just cancelled it
          });
            const onSent = ({ requestId,notifiedDrivers }: any) => {
               if (requestId) activeRequestIdRef.current = requestId;
              if (notifiedDrivers === 0) setNoDriver(true);
          };
        const onAccepted = ({ requestId,driver, rideCode }: any) => {
             activeRequestIdRef.current = null;
            onConfirm(selected, selectedPrice);
            router.push({
              pathname: "/confirmPage",
              params: {
                rideId: selected.id,
                requestId: requestId ?? "",
                rideName: selected.name,
                price: String(selectedPrice),
                pickup: pickupLabel ?? "",
                destination: destinationLabel ?? "",
                distanceKm: String(distanceKm),
                durationMinutes: String(durationMinutes),
                pickupLat: String(pickupCoords.latitude),
    pickupLng: String(pickupCoords.longitude),
    destLat: String(destinationCoords.latitude),
    destLng: String(destinationCoords.longitude),
                seats: String(riderCount),
                driverName: driver?.name,
                driverId: String(driver?.user_id ?? ""),
                vehicleModel: driver?.vehicle_model,
                vehicleNumber: driver?.vehicle_number,
                driverSeats: String(driver?.seats),
                rideCode: rideCode ?? "",
                riderName: riderName ?? "",
              },
            });
            socket.off('request_sent', onSent);
            socket.off('ride_accepted', onAccepted);
          };
   socket.on('request_sent', onSent);
          socket.on('ride_accepted', onAccepted);
        }}
      />
      );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={onClose} style={styles.iconBtn} accessibilityLabel="Back" hitSlop={10}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Choose a ride</Text>
        <TouchableOpacity onPress={onClose} style={styles.iconBtn} accessibilityLabel="Close" hitSlop={10}>
          <Ionicons name="close" size={20} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {!!pickupLabel && !!destinationLabel && (
        <Text style={styles.routeSub} numberOfLines={5}>
          {pickupLabel} → {destinationLabel} · {distanceKm} km · {durationMinutes} min
        </Text>
      )}

      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {rides.map((ride) => {
          const price = priceFor(ride);
          const active = ride.id === selectedId;
          return (
            <TouchableOpacity
              key={ride.id}
              style={[styles.row, active && styles.rowActive]}
              onPress={() => setSelectedId(ride.id)}
              activeOpacity={0.8}
            >
              <View style={styles.iconWrap}>
                <MaterialCommunityIcons name={ride.icon} size={34} color={colors.text} />
              </View>

              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.rideName} numberOfLines={1}>{ride.name}</Text>
                <View style={styles.badgeRow}>
                  {ride.no_ac && (
                    <View style={styles.badge}>
                      <Ionicons name="snow-outline" size={11} color={colors.textMuted} />
                      <Text style={styles.badgeText}>No AC</Text>
                    </View>
                  )}
                  {ride.ac && (
                    <View style={styles.badge}>
                      <Ionicons name="snow-outline" size={11} color={colors.textMuted} />
                      <Text style={styles.badgeText}>AC</Text>
                    </View>
                  )}
                  <View style={styles.badge}>
                    <Ionicons name="person-outline" size={11} color={colors.textMuted} />
                    <Text style={styles.badgeText}>{ride.seats} Seats</Text>
                  </View>
                </View>
                <Text style={styles.tagline} numberOfLines={1}>{ride.tagline}</Text>
              </View>

              <View style={styles.rightCol}>
                <Text style={styles.price}>₹{price}</Text>
                <View style={styles.etaPill}>
                  <Text style={styles.etaPillText}>{ride.minutesAway} min away</Text>
                </View>
              </View>

              <Ionicons name="chevron-forward" size={16} color={colors.textFaint} style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <TouchableOpacity
        style={[styles.confirmBtn, !selected && styles.confirmBtnDisabled]}
        onPress={() => selected && setConfirming(true)}
        disabled={!selected}
      >
        <Text style={styles.confirmText}>
          {selected ? `Confirm ${selected.name} · ₹${selectedPrice}` : "Choose a ride"}
        </Text>
        <Ionicons name="arrow-forward" size={17} color="#fff" />
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
    maxHeight: 520,
  },
  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.sm },
  iconBtn: { padding: 4 },
  title: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "800", color: colors.text },
  routeSub: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.lg, textAlign: "center",},

  list: { marginBottom: spacing.md },

  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.rowBg,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1.5,
    borderColor: "transparent",
    gap: spacing.sm,
  },
  rowActive: { borderColor: colors.brand, backgroundColor: colors.brandTint },

  iconWrap: { width: 56, height: 44, alignItems: "center", justifyContent: "center" },

  rideName: { fontSize: 14.5, fontWeight: "800", color: colors.text },
  badgeRow: { flexDirection: "row", gap: 6, marginTop: 4, marginBottom: 3 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#ECEDF1",
    borderRadius: radius.sm,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  badgeText: { fontSize: 10.5, color: colors.textMuted, fontWeight: "600" },
  tagline: { fontSize: 10, color: colors.textMuted },

  rightCol: { alignItems: "flex-end", marginLeft: spacing.xs },
  price: { fontSize: 16, fontWeight: "800", color: colors.text, marginBottom: 4 },
  etaPill: { backgroundColor: colors.etaBg, borderRadius: radius.pill, paddingVertical: 3, paddingHorizontal: 8 },
  etaPillText: { fontSize: 10.5, fontWeight: "700", color: colors.etaText },

  confirmBtn: {
    backgroundColor: colors.brand,
    borderRadius: radius.md,
    paddingVertical: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  confirmBtnDisabled: { backgroundColor: colors.textFaint },
  confirmText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});