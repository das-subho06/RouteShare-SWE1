// import React, { useCallback, useEffect, useState } from "react";
// import { View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
// import { Ionicons } from "@expo/vector-icons";
// import { useFocusEffect } from "expo-router/react-navigation";
// import { useRouter } from "expo-router";
// import AsyncStorage from "../../lib/storage";
// const colors = {
//   brand: "#FF6659",
//   text: "#1A1B1F",
//   textMuted: "#6B7280",
//   textFaint: "#9CA3AF",
//   white: "#FFFFFF",
//   border: "#E7E8EC",
// };

// const spacing = { md: 12, lg: 16 };
// const radius = { lg: 16 };

// const STORAGE_KEY = "activeRideSummary";
// const AUTO_DISMISS_MS = 10000;

// type RideSummary = {
//   pickup: string;
//   destination: string;
//   price: string;
//   vehicleNumber: string;
//   driverName: string;
//  [key: string]: string;
// };

// export default function RideToast() {
//   const router = useRouter();
//   const [rideToast, setRideToast] = useState<RideSummary | null>(null);

//   // Re-check storage every time this screen comes back into focus.
//   useFocusEffect(
//     useCallback(() => {
//       (async () => {
//         try {
//           const raw = await AsyncStorage.getItem(STORAGE_KEY);
//           setRideToast(raw ? JSON.parse(raw) : null);
//         } catch {
//           setRideToast(null);
//         }
//       })();
//     }, [])
//   );

//   // Auto-hide the toast after a few seconds. This only hides the UI —
//   // it doesn't touch storage, so the toast reappears if the rider
//   // refocuses this screen while the ride is still active.
//   useEffect(() => {
//     if (!rideToast) return;
//     const t = setTimeout(() => setRideToast(null), AUTO_DISMISS_MS);
//     return () => clearTimeout(t);
//   }, [rideToast]);

//   if (!rideToast) return null;

//   const handlePress = () => {
//     // Re-open the confirm page with the same details it was showing before
//     // the rider navigated away. Adjust the pathname below if your app's
//     // route to confirmpage.tsx is named differently.
//     router.push({ pathname: "/confirmPage", params: rideToast });
//   };

//   return (
//     <View style={styles.rideToast} pointerEvents="box-none">
//       <TouchableOpacity style={styles.rideToastCard} activeOpacity={0.85} onPress={handlePress}>
//         <View style={styles.rideToastHeader}>
//           <Ionicons name="car-sport" size={18} color={colors.brand} />
//           <Text style={styles.rideToastTitle}>Ride in progress</Text>
//           <TouchableOpacity onPress={() => setRideToast(null)} style={{ marginLeft: "auto" }} hitSlop={8}>
//             <Ionicons name="close" size={16} color={colors.textMuted} />
//           </TouchableOpacity>
//         </View>
//         <Text style={styles.rideToastRoute} numberOfLines={1}>
//           {rideToast.pickup} → {rideToast.destination}
//         </Text>
//         <View style={styles.rideToastMetaRow}>
//           <Text style={styles.rideToastMeta}>₹{rideToast.price}</Text>
//           <Text style={styles.rideToastDot}>•</Text>
//           <Text style={styles.rideToastMeta}>{rideToast.vehicleNumber}</Text>
//           <Text style={styles.rideToastDot}>•</Text>
//           <Text style={styles.rideToastMeta}>{rideToast.driverName}</Text>
//         </View>
//         <Text style={styles.rideToastHint}>Tap to view trip</Text>
//       </TouchableOpacity>
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   rideToast: {
//     position: "absolute",
//     top: Platform.OS === "ios" ? 54 : 16,
//     left: 0,
//     right: 0,
//     alignItems: "center",
//     zIndex: 50,
//     paddingHorizontal: spacing.lg,
//   },
//   rideToastCard: {
//     backgroundColor: colors.white,
//     borderRadius: radius.lg,
//     padding: spacing.md,
//     borderWidth: 1,
//     borderColor: colors.border,
//     width: "100%",
//     maxWidth: 420,
//     shadowColor: "#000",
//     shadowOpacity: 0.12,
//     shadowRadius: 12,
//     shadowOffset: { width: 0, height: 4 },
//     elevation: 6,
//   },
//   rideToastHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
//   rideToastTitle: { fontSize: 13, fontWeight: "800", color: colors.text },
//   rideToastRoute: { fontSize: 13.5, fontWeight: "700", color: colors.text, marginBottom: 4 },
//   rideToastMetaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
//   rideToastMeta: { fontSize: 12, color: colors.textMuted, fontWeight: "600" },
//   rideToastDot: { fontSize: 12, color: colors.textFaint },
//   rideToastHint: { fontSize: 10.5, color: colors.textFaint, marginTop: 6, fontWeight: "600" },
// });


import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router/react-navigation";
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

const USER_ID_KEY = "userId";

// How often we check the DB while this component is mounted.
const POLL_INTERVAL_MS = 5000;

// How long the toast stays visible after a successful DB check.
const AUTO_DISMISS_MS = 10000;

type Ride = {
  id: number;
  rider_id: number;
  driver_id: number | null;

  pickup_label: string;
  destination_label: string;

  price: number | string;
  ride_class: string;
  ride_code: string;

  status: "accepted" | "driver_arrived" | "in_progress" | string;

  [key: string]: any;
};

type RideSummary = {
  rideId: string;
  pickup: string;
  destination: string;
  price: string;
  vehicleNumber: string;
  driverName: string;
};

export default function RideToast() {
  const router = useRouter();

  const [rideToast, setRideToast] = useState<RideSummary | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  /**
   * Get logged-in user ID.
   */
  useEffect(() => {
    const loadUserId = async () => {
      try {
        const storedUserId = await AsyncStorage.getItem(USER_ID_KEY);

        if (storedUserId) {
          setUserId(String(storedUserId));
        } else {
          setUserId(null);
        }
      } catch (error) {
        console.error("Could not get user ID:", error);
        setUserId(null);
      }
    };

    loadUserId();
  }, []);

  /**
   * Fetch active ride directly from the backend.
   *
   * Backend:
   * GET /api/rides/active/:userId
   *
   * The backend checks PostgreSQL for:
   * accepted
   * driver_arrived
   * in_progress
   */
  const fetchActiveRide = useCallback(async () => {
    if (!userId) {
      setRideToast(null);
      return;
    }

    try {
      const API_URL = process.env.EXPO_PUBLIC_API_URL;

      if (!API_URL) {
        console.error("EXPO_PUBLIC_API_URL is not configured.");
        return;
      }

      const response = await fetch(
        `${API_URL}/api/rides/active/${userId}`
      );

      /**
       * 404 means there is currently no active ride.
       */
      if (response.status === 404) {
        setRideToast(null);
        return;
      }

      if (!response.ok) {
        console.error(
          "Failed to fetch active ride:",
          response.status
        );
        return;
      }

      const ride: Ride = await response.json();

      /**
       * Convert DB response into the format
       * required by the existing toast UI.
       */
      const summary: RideSummary = {
        rideId: String(ride.id),

        pickup: ride.pickup_label || "Pickup",

        destination:
          ride.destination_label || "Destination",

        price: String(ride.price ?? 0),

        /**
         * Your current rides API returns ride_class,
         * not vehicle_number.
         *
         * So we use ride_class here for now.
         *
         * If your DB has a vehicle number column,
         * we can add it to the backend response later.
         */
        vehicleNumber:
          ride.ride_class || "Vehicle",

        /**
         * The current /active endpoint uses SELECT *
         * and therefore does not return driver_name.
         *
         * For now use a fallback.
         *
         * If you want the actual driver name, I recommend
         * modifying the backend query to JOIN users.
         */
        driverName: "Driver",
      };

      setRideToast(summary);
    } catch (error) {
      console.error("Error fetching active ride:", error);
    }
  }, [userId]);

  /**
   * Check DB whenever the screen comes into focus.
   */
  useFocusEffect(
    useCallback(() => {
      if (!userId) return;

      fetchActiveRide();
    }, [userId, fetchActiveRide])
  );

  /**
   * Poll the backend periodically.
   *
   * NO SOCKET.IO.
   * NO WEBSOCKET.
   *
   * This simply asks the backend:
   *
   * "Does this user currently have an active ride?"
   */
  useEffect(() => {
    if (!userId) return;

    const interval = setInterval(() => {
      fetchActiveRide();
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [userId, fetchActiveRide]);

  /**
   * Automatically hide the toast.
   *
   * IMPORTANT:
   * This does NOT change the database.
   *
   * The next DB check can show it again if the ride
   * is still active.
   */
  useEffect(() => {
    if (!rideToast) return;

    const timeout = setTimeout(() => {
      setRideToast(null);
    }, AUTO_DISMISS_MS);

    return () => clearTimeout(timeout);
  }, [rideToast]);

  if (!rideToast) {
    return null;
  }

  /**
   * Open confirm page.
   *
   * We pass the ride ID as well, so confirmPage can
   * fetch the latest ride information from the DB too.
   */
  const handlePress = () => {
    router.push({
      pathname: "/confirmPage",
      params: {
        rideId: rideToast.rideId,
        pickup: rideToast.pickup,
        destination: rideToast.destination,
        price: rideToast.price,
        vehicleNumber: rideToast.vehicleNumber,
        driverName: rideToast.driverName,
      },
    });
  };

  return (
    <View style={styles.rideToast} pointerEvents="box-none">
      <TouchableOpacity
        style={styles.rideToastCard}
        activeOpacity={0.85}
        onPress={handlePress}
      >
        <View style={styles.rideToastHeader}>
          <Ionicons
            name="car-sport"
            size={18}
            color={colors.brand}
          />

          <Text style={styles.rideToastTitle}>
            Ride in progress
          </Text>

          <TouchableOpacity
            onPress={() => setRideToast(null)}
            style={{ marginLeft: "auto" }}
            hitSlop={8}
          >
            <Ionicons
              name="close"
              size={16}
              color={colors.textMuted}
            />
          </TouchableOpacity>
        </View>

        <Text
          style={styles.rideToastRoute}
          numberOfLines={1}
        >
          {rideToast.pickup} → {rideToast.destination}
        </Text>

        <View style={styles.rideToastMetaRow}>
          <Text style={styles.rideToastMeta}>
            ₹{rideToast.price}
          </Text>

          <Text style={styles.rideToastDot}>
            •
          </Text>

          <Text style={styles.rideToastMeta}>
            {rideToast.vehicleNumber}
          </Text>

          <Text style={styles.rideToastDot}>
            •
          </Text>

          <Text style={styles.rideToastMeta}>
            {rideToast.driverName}
          </Text>
        </View>

        <Text style={styles.rideToastHint}>
          Tap to view trip
        </Text>
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
    shadowOffset: {
      width: 0,
      height: 4,
    },

    elevation: 6,
  },

  rideToastHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },

  rideToastTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.text,
  },

  rideToastRoute: {
    fontSize: 13.5,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 4,
  },

  rideToastMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  rideToastMeta: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: "600",
  },

  rideToastDot: {
    fontSize: 12,
    color: colors.textFaint,
  },

  rideToastHint: {
    fontSize: 10.5,
    color: colors.textFaint,
    marginTop: 6,
    fontWeight: "600",
  },
});