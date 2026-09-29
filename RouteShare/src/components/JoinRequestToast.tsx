import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import AsyncStorage from "./lib/storage";
import { getSocket } from "./lib/socket";

type JoinRequest = {
  joinRequestId: number | string;
  rideId: number | string;
  requesterName: string;
  pickup: string;
  destination: string;
  seatsRequested: number;
};

export default function JoinRequestToast() {
  const [request, setRequest] = useState<JoinRequest | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // --------------------------------------------------
  // 1. Get logged-in user ID
  // --------------------------------------------------
  useEffect(() => {
    let mounted = true;

    const loadUserId = async () => {
      try {
        const id = await AsyncStorage.getItem("userId");

        console.log("🌐 JoinRequestToast userId:", id);

        if (mounted && id) {
          setMyUserId(String(id));
        }
      } catch (error) {
        console.error(
          "❌ JoinRequestToast: failed to get userId:",
          error
        );
      }
    };

    loadUserId();

    return () => {
      mounted = false;
    };
  }, []);

  // --------------------------------------------------
  // 2. Setup GLOBAL socket listener
  // --------------------------------------------------
  useEffect(() => {
    if (!myUserId) {
      console.log(
        "⏳ JoinRequestToast: waiting for userId..."
      );
      return;
    }

    const socket = getSocket();

    console.log("🟢 JoinRequestToast mounted");
    console.log("👤 Rider ID:", myUserId);
    console.log("🔌 Socket ID:", socket.id);
    console.log("🔌 Socket connected:", socket.connected);

    // ------------------------------------------------
    // Join this rider's personal socket room
    // ------------------------------------------------
    const joinRiderRoom = () => {
      console.log(
        "🚪 Joining rider room:",
        `rider_${myUserId}`
      );

      socket.emit("rider_online", {
        riderId: Number(myUserId),
      });
    };

    // If already connected
    if (socket.connected) {
      joinRiderRoom();
    } else {
      // Otherwise wait until connection happens
      console.log(
        "⏳ Socket not connected. Waiting for connect..."
      );

      socket.once("connect", joinRiderRoom);
    }

    // ------------------------------------------------
    // Receive new join request
    // ------------------------------------------------
    const handleJoinRequest = (payload: any) => {
      console.log(
        "🔥🔥🔥 GLOBAL JOIN REQUEST RECEIVED:",
        payload
      );

      if (!payload?.joinRequestId) {
        console.warn(
          "⚠️ Join request received without joinRequestId"
        );
        return;
      }

      setRequest({
        joinRequestId: payload.joinRequestId,
        rideId: payload.rideId,
        requesterName:
          payload.requesterName ?? "A rider",
        pickup:
          payload.pickup ?? "Pickup location",
        destination:
          payload.destination ?? "Destination",
        seatsRequested:
          Number(payload.seatsRequested) || 1,
      });
    };

    // ------------------------------------------------
    // Request was closed/handled elsewhere
    // ------------------------------------------------
    const handleJoinRequestClosed = (payload: any) => {
      console.log(
        "🔕 GLOBAL JOIN REQUEST CLOSED:",
        payload
      );

      setRequest((current) => {
        if (
          current &&
          String(current.joinRequestId) ===
            String(payload?.joinRequestId)
        ) {
          return null;
        }

        return current;
      });
    };

    socket.on(
      "join_request_pending",
      handleJoinRequest
    );

    socket.on(
      "join_request_closed",
      handleJoinRequestClosed
    );

    // ------------------------------------------------
    // Cleanup
    // ------------------------------------------------
    return () => {
      console.log(
        "🧹 JoinRequestToast: removing listeners"
      );

      socket.off(
        "join_request_pending",
        handleJoinRequest
      );

      socket.off(
        "join_request_closed",
        handleJoinRequestClosed
      );

      socket.off("connect", joinRiderRoom);
    };
  }, [myUserId]);

  // --------------------------------------------------
  // 3. Allow / Deny
  // --------------------------------------------------
  const handleDecision = (
    decision: "allow" | "deny"
  ) => {
    if (!request) {
      console.warn(
        "⚠️ No join request available"
      );
      return;
    }

    if (!myUserId) {
      console.warn(
        "⚠️ No user ID available"
      );
      return;
    }

    if (loading) {
      return;
    }

    const socket = getSocket();

    console.log(
      "📤 Sending rider decision:",
      {
        joinRequestId: request.joinRequestId,
        riderId: myUserId,
        decision,
      }
    );

    setLoading(true);

    socket.emit(
      "join_request_rider_decision",
      {
        joinRequestId: request.joinRequestId,
        riderId: Number(myUserId),
        decision,
      },
      (response: any) => {
        console.log(
          "📥 Rider decision response:",
          response
        );

        setLoading(false);

        if (!response?.ok) {
          console.error(
            "❌ Join request decision failed:",
            response?.error
          );
          return;
        }

        console.log(
          `✅ Join request ${decision}ed`
        );

        // Remove popup after successful decision
        setRequest(null);
      }
    );
  };

  // --------------------------------------------------
  // 4. Nothing to display
  // --------------------------------------------------
  if (!request) {
    return null;
  }

  // --------------------------------------------------
  // 5. Global popup
  // --------------------------------------------------
  return (
    <View
      pointerEvents="box-none"
      style={styles.container}
    >
      <View style={styles.card}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Ionicons
              name="person-add-outline"
              size={18}
              color="#FF6659"
            />
          </View>

          <View style={styles.headerText}>
            <Text style={styles.title}>
              New rider wants to join
            </Text>

            <Text style={styles.subtitle}>
              {request.requesterName}
            </Text>
          </View>
        </View>

        {/* Route */}
        <View style={styles.routeContainer}>
          <Text
            style={styles.route}
            numberOfLines={1}
          >
            {request.pickup}
          </Text>

          <Ionicons
            name="arrow-forward"
            size={14}
            color="#9CA3AF"
          />

          <Text
            style={styles.route}
            numberOfLines={1}
          >
            {request.destination}
          </Text>
        </View>

        {/* Seats */}
        <Text style={styles.seats}>
          {request.seatsRequested}{" "}
          {request.seatsRequested === 1
            ? "seat"
            : "seats"}{" "}
          requested
        </Text>

        {/* Buttons */}
        <View style={styles.buttons}>
          <TouchableOpacity
            style={styles.denyButton}
            disabled={loading}
            onPress={() =>
              handleDecision("deny")
            }
          >
            <Text style={styles.denyText}>
              Deny
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.allowButton,
              loading && styles.disabledButton,
            ]}
            disabled={loading}
            onPress={() =>
              handleDecision("allow")
            }
          >
            <Text style={styles.allowText}>
              {loading ? "..." : "Allow"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ==================================================
// STYLES
// ==================================================

const styles = StyleSheet.create({
  container: {
    position: "absolute",

    top:
      Platform.OS === "ios"
        ? 54
        : 18,

    left: 0,
    right: 0,

    alignItems: "center",

    zIndex: 999999,
    elevation: 999999,

    paddingHorizontal: 16,
  },

  card: {
    width: "100%",
    maxWidth: 420,

    backgroundColor: "#FFFFFF",

    borderRadius: 16,

    padding: 16,

    borderWidth: 1,
    borderColor: "#E7E8EC",

    shadowColor: "#000",
    shadowOpacity: 0.14,
    shadowRadius: 14,

    shadowOffset: {
      width: 0,
      height: 5,
    },

    elevation: 10,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
  },

  iconContainer: {
    width: 36,
    height: 36,

    borderRadius: 18,

    backgroundColor: "#FFF1EF",

    alignItems: "center",
    justifyContent: "center",

    marginRight: 10,
  },

  headerText: {
    flex: 1,
  },

  title: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1A1B1F",
  },

  subtitle: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },

  routeContainer: {
    flexDirection: "row",
    alignItems: "center",

    gap: 7,

    marginTop: 14,
  },

  route: {
    flex: 1,

    fontSize: 12,
    fontWeight: "600",

    color: "#1A1B1F",
  },

  seats: {
    fontSize: 11,
    color: "#9CA3AF",

    marginTop: 7,
  },

  buttons: {
    flexDirection: "row",

    gap: 10,

    marginTop: 14,
  },

  denyButton: {
    flex: 1,

    height: 40,

    borderRadius: 10,

    borderWidth: 1,
    borderColor: "#E7E8EC",

    alignItems: "center",
    justifyContent: "center",
  },

  denyText: {
    fontSize: 13,
    fontWeight: "700",

    color: "#6B7280",
  },

  allowButton: {
    flex: 1,

    height: 40,

    borderRadius: 10,

    backgroundColor: "#FF6659",

    alignItems: "center",
    justifyContent: "center",
  },

  disabledButton: {
    opacity: 0.6,
  },

  allowText: {
    fontSize: 13,
    fontWeight: "700",

    color: "#FFFFFF",
  },
});