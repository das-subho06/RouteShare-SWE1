import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  useWindowDimensions,
  Image,
  Modal,
  Linking,
} from "react-native";
import { Ionicons, MaterialCommunityIcons, FontAwesome } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import AsyncStorage from "../../lib/storage";
import { getSocket } from "../../lib/socket";

/* ------------------------------------------------------------------ */
/*  Theme — Kept in sync with Rider.tsx                               */
/* ------------------------------------------------------------------ */

const colors = {
  bgApp: "#F4F5F7",
  brand: "#FF6659",
  brandDark: "#E9564A",
  brandTint: "#FFEDEC",
  text: "#1A1B1F",
  textMuted: "#6B7280",
  textFaint: "#9CA3AF",
  white: "#FFFFFF",
  border: "#E7E8EC",
  pickupDot: "#2ECC71",
  destDot: "#FF5A52",
  star: "#FFC107",
};

const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
const radius = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 };

/* ------------------------------------------------------------------ */
/*  Map Native Modules (Mirrored from Rider.tsx)[cite: 21]           */
/* ------------------------------------------------------------------ */

let MapView: any = null;
let Marker: any = null;
let Polyline: any = null;
let PROVIDER_GOOGLE: any = undefined;

if (Platform.OS !== "web") {
  try {
    const Maps = require("react-native-maps");
    MapView = Maps.default;
    Marker = Maps.Marker;
    Polyline = Maps.Polyline;
    PROVIDER_GOOGLE = Maps.PROVIDER_GOOGLE;
  } catch {
    // react-native-maps not installed
  }
}

type Place = { label: string;  latitude: number; longitude: number };

// Helper to handle search params
function single(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

/* ------------------------------------------------------------------ */
/*  RouteMap Component (Exact match from Rider.tsx)[cite: 21]        */
/* ------------------------------------------------------------------ */

function RouteMap({
  pickup,
  destination,
  durationMinutes,
  distanceKm,
}: {
  pickup: Place;
  destination: Place | null;
  durationMinutes: number | string;
  distanceKm: number | string;
}) {
  const nativeMapRef = useRef<any>(null);
  const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);
  useEffect(() => {
    if (!destination) {
      setRouteCoords([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const url =
          `https://router.project-osrm.org/route/v1/driving/` +
          `${pickup.longitude},${pickup.latitude};${destination.longitude},${destination.latitude}` +
          `?overview=full&geometries=geojson`;
        const res = await fetch(url);
        const data = await res.json();
        const coords = data?.routes?.[0]?.geometry?.coordinates;
        if (!cancelled && Array.isArray(coords) && coords.length > 0) {
          setRouteCoords(coords.map(([lng, lat]: [number, number]) => ({ latitude: lat, longitude: lng })));
        } else if (!cancelled) {
          setRouteCoords([]); // fall back to the straight line below
        }
      } catch (err) {
        console.error("Failed to fetch route geometry, falling back to straight line", err);
        if (!cancelled) setRouteCoords([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pickup.latitude, pickup.longitude, destination?.latitude, destination?.longitude]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    if (!nativeMapRef.current) return;
    nativeMapRef.current.animateToRegion(
      // { latitude: pickup.latitude, longitude: pickup.longitude, latitudeDelta: 0.08, longitudeDelta: 0.08 },
      // 500
    );
  }, []);

  if (Platform.OS === "web") {
    const centerLat = destination ? (pickup.latitude + destination.latitude) / 2 : pickup.latitude;
    const centerLng = destination ? (pickup.longitude + destination.longitude) / 2 : pickup.longitude;
     const html = `
      <!DOCTYPE html><html><head>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
      <style>html,body,#map{height:100%;margin:0;}</style>
      </head><body>
      <div id="map"></div>
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <script>
        const map = L.map('map').setView([${centerLat}, ${centerLng}], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
        const pin = (color) => L.divIcon({className:'',html:'<div style="width:14px;height:14px;border-radius:7px;background:'+color+';border:2px solid white;box-shadow: 0 0 4px rgba(0,0,0,0.3);"></div>'});
        
        // Pickup Marker
        L.marker([${pickup.latitude}, ${pickup.longitude}], {icon: pin('${colors.pickupDot}')})
         .bindTooltip("Pickup<br/><b>${pickup.label}</b>", {permanent: true, direction: 'right', className: 'map-tooltip'})
         .addTo(map);
         
        ${destination ? `
        // Destination Marker
        L.marker([${destination.latitude}, ${destination.longitude}], {icon: pin('${colors.destDot}')})
         .bindTooltip("Destination<br/><b>${destination.label}</b>", {permanent: true, direction: 'bottom', className: 'map-tooltip dest-tooltip'})
         .addTo(map);
         
        // Route Line
        L.polyline(${JSON.stringify(
          routeCoords.length > 0
            ? routeCoords.map((c) => [c.latitude, c.longitude])
            : [[pickup.latitude, pickup.longitude], [destination.latitude, destination.longitude]]
        )}, {color:'${colors.brand}', weight:4, opacity: 0.8}).addTo(map);
        ` : ""}
      </script>
      <style>
        .map-tooltip { background: white; border: none; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); padding: 8px 12px; font-family: sans-serif; font-size: 12px; color: #6B7280; }
        .map-tooltip b { color: #1A1B1F; font-size: 13px; }
        .dest-tooltip { margin-top: 10px; }
      </style>
      </body></html>
    `;
    return (
      <View style={mapStyles.container}>
        {/* @ts-ignore */}
        <iframe title="interactive-map" srcDoc={html} style={{ border: 0, width: "100%", height: "100%" }} />
      </View>
    );
  }

  if (!MapView) {
    return (
      <View style={[mapStyles.container, mapStyles.mapEmpty]}>
        <Ionicons name="map-outline" size={28} color={colors.textFaint} />
        <Text style={{ color: colors.textFaint, marginTop: 8 }}>Install react-native-maps</Text>
      </View>
    );
  }

  return (
    <View style={mapStyles.container}>
      <MapView
        ref={nativeMapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_GOOGLE}
        initialRegion={{ latitude: pickup.latitude, longitude: pickup.longitude, latitudeDelta: 0.08, longitudeDelta: 0.08 }}
      >
        <Marker coordinate={pickup} title="Pickup" description={pickup.label}>
          <View style={[mapStyles.pin, { backgroundColor: colors.pickupDot }]} />
        </Marker>
        {destination && (
          <>
            <Marker coordinate={destination} title="Destination" description={destination.label}>
              <View style={[mapStyles.pin, { backgroundColor: colors.destDot }]} />
            </Marker>
            <Polyline  coordinates={routeCoords.length > 0 ? routeCoords : [pickup, destination]} strokeColor={colors.brand} strokeWidth={4} />
          </>
        )}
      </MapView>
    </View>
  );
}

const mapStyles = StyleSheet.create({
  container: { flex: 1, borderRadius: radius.xl, overflow: "hidden", position: "relative", borderWidth: 1, borderColor: colors.border },
  mapEmpty: { alignItems: "center", justifyContent: "center", backgroundColor: "#EEF0F3" },
  pin: { width: 16, height: 16, borderRadius: 8, borderWidth: 3, borderColor: "#fff" },
});

/* ------------------------------------------------------------------ */
/*  Main Component                                                      */
/* ------------------------------------------------------------------ */

export default function ConfirmPage() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWide = width >= 980;

  const params = useLocalSearchParams();
  
  // Fallback to mock data (matching the image) if params are missing for easy testing
  const rideName = single(params.rideName) || "Go Mini";
  const price = single(params.price) || "278";
  const distanceKm = single(params.distanceKm) || "12.6";
  const durationMinutes = single(params.durationMinutes) || "24";
  const seats = single(params.seats) || "4"; // This is the No of Riders
  const driverName = single(params.driverName);
  const vehicleModel = single(params.vehicleModel);
  const vehicleNumber = single(params.vehicleNumber) ;
  const driverSeats = single(params.driverSeats) || "4"
  const pickupLabel = single(params.pickup) || "Salt Lake, Sector V";
  const destLabel = single(params.destination) || "Park Street";
  const riderName = single(params.riderName);
  const pickupLat = parseFloat(single(params.pickupLat) || "22.5726");
const pickupLng = parseFloat(single(params.pickupLng) || "88.4312");
const destLat = parseFloat(single(params.destLat) || "22.5527");
const destLng = parseFloat(single(params.destLng) || "88.3529");
  const rideCode = single(params.rideCode) || "ROUTE78"
  // Passed in when this page is opened so the app can match this ride's
  // "ride_completed" socket event and, if the rider navigates back early,
  // let Rider.tsx know a ride is still active.
  const requestId = single(params.requestId);
  const driverId = single(params.driverId);  
// Mock coordinates for the route
  const pickupCoords: Place = {
  label: pickupLabel,
  latitude: pickupLat,
  longitude: pickupLng,
};

const destCoords: Place = {
  label: destLabel,
  latitude: destLat,
  longitude: destLng,
};

  // Chat State
  const [chatVisible, setChatVisible] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ id: string; text: string; sender: "rider" | "driver" }[]>([]);
  const chatPresets = ["Where are you?", "I am waiting", "I'm at the pickup location", "Okay, coming"];

  const sendChatMessage = (text: string) => {
  const trimmed = text.trim();
  if (!trimmed) return;
  setChatMessages((prev) => [...prev, { id: `${Date.now()}_local`, text: trimmed, sender: "rider" }]);
  getSocket().emit('send_message', {
    requestId,
    riderId: myUserId,
    driverId,
    sender: 'rider',
    text: trimmed,
  });
};
  useEffect(() => {
  const socket = getSocket();
  const handleReceive = (message: any) => {
    if (message.sender !== 'driver') return;
    if (String(message.requestId) !== String(requestId)) return;
    setChatMessages((prev) => [...prev, { id: message.id, text: message.text, sender: 'driver' }]);
  };
  socket.on('receive_message', handleReceive);
  return () => {
    socket.off('receive_message', handleReceive);
  };
}, [requestId]);
  // While this ride is active, keep a lightweight summary in storage so that
  // if the rider navigates back to Rider.tsx before the driver completes the
  // drop-off, Rider.tsx can show a "ride in progress" toast.
  const [myUserId, setMyUserId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const uid = await AsyncStorage.getItem("userId");
      setMyUserId(uid);
      const summary = {
        pickup: pickupLabel,
        destination: destLabel,
        price,
        vehicleNumber,
        driverName,
        rideName,
  distanceKm,
  durationMinutes,
  seats,
  vehicleModel,
  driverSeats,
  pickupLat: String(pickupLat),
  pickupLng: String(pickupLng),
  destLat: String(destLat),
  destLng: String(destLng),
  rideCode,
  requestId: requestId ?? "",

      };
      try {
        await AsyncStorage.setItem("activeRideSummary", JSON.stringify(summary));
      } catch (err) {
        console.error("Failed to store active ride summary", err);
      }
    })();
  }, []);

  // When the driver taps "Complete Drop-off", clear the stored summary and
  // route back to Rider.tsx automatically.
  useEffect(() => {
  const socket = getSocket();
   const join = () => myUserId && socket.emit("rider_online", { riderId: myUserId });
  if (socket.connected) join();
  else socket.once("connect", join);
  const handleRideCancelled = (payload: any) => {
    const matches = requestId ? String(payload?.requestId) === String(requestId) : true;
    if (!matches) return;
    AsyncStorage.removeItem("activeRideSummary").finally(() => router.back());
  };
  const handleRideCompleted = (payload: any) => {
  const matches = requestId ? String(payload?.requestId) === String(requestId) : true;
  if (!matches) return;
  AsyncStorage.removeItem("activeRideSummary").finally(() => {
    router.replace({
      pathname: "/feedbackForm",   // adjust if your file/route is registered under a different path
      params: {
        requestId,
        driverName,
        rideCode, driverId,
        riderId: myUserId,
        riderName
      },
    });
  });
};
socket.on("ride_cancelled", handleRideCancelled);
socket.on("ride_completed", handleRideCompleted);
return () => {
  socket.off("ride_cancelled", handleRideCancelled);
  socket.off("ride_completed", handleRideCompleted);
};
}, [requestId, myUserId]);

  return (
    <View style={styles.root}>
      {/* Back button layer */}
      <View style={styles.topNav}>
         <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
         </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={[styles.content, isWide && styles.contentWide]} showsVerticalScrollIndicator={false}>
        
        {/* Left Side: Ride Details Card */}
        <View style={[styles.card, isWide && styles.cardWide]}>
          
          {/* Header */}
          <View style={styles.cardHeader}>
            <Text style={styles.title}>Ride accepted! 🎉</Text>
            <Text style={styles.subtitle}>Your driver is on the way</Text>
          </View>

          {/* ETA Alert */}
          <View style={styles.etaBox}>
            <Ionicons name="car" size={24} color={colors.brand} />
            <View style={{ marginLeft: spacing.md }}>
              <Text style={styles.etaSub}>Car arriving in</Text>
              <Text style={styles.etaText}>5 min away</Text>
            </View>
          </View>

          {/* Driver Info */}
          <View style={styles.driverRow}>
            
            <View style={styles.driverDetails}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={styles.driverName}>{driverName}</Text>
                <View style={styles.ratingBadge}>
                  <Ionicons name="star" size={10} color={colors.star} />
                  <Text style={styles.ratingText}>4.8</Text>
                </View>
              </View>
              <Text style={styles.driverRole}>Driver</Text>
            </View>

            <View style={styles.actionButtons}>
              <TouchableOpacity style={styles.circleBtn} onPress={() => Linking.openURL('tel:+919876543210')}>
                <Ionicons name="call" size={18} color={colors.brand} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.circleBtn} onPress={() => setChatVisible(true)}>
                <Ionicons name="chatbubble-ellipses" size={18} color={colors.brand} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Car Info */}
          <View style={styles.carRow}>
            <MaterialCommunityIcons name="car-hatchback" size={48} color={colors.text} />
            <View style={styles.carDetails}>
              <Text style={styles.plateNumber}>{vehicleNumber}</Text>
              <Text style={styles.carDesc}>White • {vehicleModel} <Text style={styles.acBadge}> AC </Text></Text>
            </View>
            <View style={styles.seatsWrap}>
              <Ionicons name="person-outline" size={18} color={colors.text} />
              <Text style={styles.seatsText}>{driverSeats} Seats • {seats} Riders</Text> {/* <--- UPDATE THIS LINE */}
            </View>
          </View>

          <View style={styles.divider} />

          {/* Trip Meta Grid */}
          <View style={styles.metaRow}>
            <View style={styles.metaCol}>
              <Text style={styles.metaValueRed}>₹{price}</Text>
              <Text style={styles.metaLabel}>Est. Price</Text>
            </View>
            <View style={[styles.metaCol, styles.metaBorder]}>
              <Text style={styles.metaValueRed}>{rideCode}</Text>
              <Text style={styles.metaLabel}>Ride Code</Text>
            </View>
            <View style={styles.metaCol}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="shield-checkmark-outline" size={16} color={colors.text} />
                <Text style={styles.metaValue}>Secure Ride</Text>
              </View>
              <Text style={styles.metaLabel}>Verified</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Route Section */}
          <View style={styles.routeSection}>
            <View style={styles.routeItem}>
              <View style={[styles.routeDot, { backgroundColor: colors.pickupDot }]} />
              <View style={styles.routeTexts}>
                <Text style={styles.routeLabel}>Pickup</Text>
                <Text style={styles.routeMain}>{pickupLabel}</Text>
              </View>
              <View style={styles.routeRight}>
                <Text style={styles.routeStat}>{distanceKm} km</Text>
              </View>
            </View>

            <View style={styles.routeLine} />

            <View style={styles.routeItem}>
              <View style={[styles.routeDot, { backgroundColor: colors.destDot }]} />
              <View style={styles.routeTexts}>
                <Text style={styles.routeLabel}>Destination</Text>
                <Text style={styles.routeMain}>{destLabel}</Text>
              </View>
              <View style={styles.routeRight}>
                <Text style={styles.routeStat}>{durationMinutes} min</Text>
              </View>
            </View>
          </View>

          <View style={styles.divider} />
          {/* Chat Button */}
          <TouchableOpacity style={styles.chatButton} onPress={() => setChatVisible(true)}>
            <Ionicons name="chatbubbles-outline" size={20} color="#fff" />
            <Text style={styles.chatButtonText}>Chat with driver</Text>
          </TouchableOpacity>

        </View>

        {/* Right Side: Map */}
        <View style={[styles.mapWrap, isWide && styles.mapWrapWide]}>
          <RouteMap
            pickup={pickupCoords}
            destination={destCoords}
            distanceKm={distanceKm}
            durationMinutes={durationMinutes}
          />
        </View>

      </ScrollView>

      {/* Chat Modal */}
      <Modal visible={chatVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.chatSheet}>
            
            <View style={styles.chatHeader}>
              <Text style={styles.chatTitle}>Chat with {driverName || "your driver"}</Text>
              <TouchableOpacity onPress={() => setChatVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.chatScroll}>
              {chatMessages.length === 0 ? (
                <Text style={styles.emptyChat}>No messages yet. Send a quick reply below.</Text>
              ) : (
                chatMessages.map((msg) => (
                  <View key={msg.id} style={[styles.messageBubble, msg.sender === "rider" ? styles.msgRider : styles.msgDriver]}>
                    <Text style={[styles.messageText, msg.sender === "rider" && { color: "#fff" }]}>{msg.text}</Text>
                  </View>
                ))
              )}
            </ScrollView>

            <View style={styles.quickReplyScrollWrap}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickReplyRow}>
                {chatPresets.map((preset, index) => (
                  <TouchableOpacity key={index} style={styles.quickReplyBtn} onPress={() => sendChatMessage(preset)}>
                    <Text style={styles.quickReplyText}>{preset}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

          </View>
        </View>
      </Modal>

    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Styles                                                              */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgApp },
  topNav: { paddingHorizontal: spacing.xl, paddingTop: Platform.OS === 'ios' ? 60 : spacing.xl },
  backBtn: { padding: spacing.xs, alignSelf: 'flex-start' },
  
  content: { padding: spacing.xl, gap: spacing.xl, flexGrow: 1 },
  contentWide: { flexDirection: "row", alignItems: "stretch" },

  card: { backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.xl, borderWidth: 1, borderColor: colors.border, width: "100%" },
  cardWide: { width: 420 },

  cardHeader: { marginBottom: spacing.lg },
  title: { fontSize: 22, fontWeight: "800", color: colors.brand, marginBottom: 4 },
  subtitle: { fontSize: 13.5, color: colors.textMuted },

  etaBox: { flexDirection: "row", alignItems: "center", backgroundColor: colors.brandTint, padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.xl },
  etaSub: { fontSize: 12, color: colors.textMuted },
  etaText: { fontSize: 16, fontWeight: "800", color: colors.brandDark, marginTop: 2 },

  driverRow: { flexDirection: "row", alignItems: "center" },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: "#E9EAEE" },
  driverDetails: { flex: 1, marginLeft: spacing.md },
  driverName: { fontSize: 15, fontWeight: "700", color: colors.text },
  ratingBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFF8E1", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  ratingText: { fontSize: 11, fontWeight: "700", color: "#F57F17", marginLeft: 2 },
  driverRole: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  actionButtons: { flexDirection: "row", gap: 10 },
  circleBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandTint, alignItems: "center", justifyContent: "center" },

  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.lg },

  carRow: { flexDirection: "row", alignItems: "center" },
  carDetails: { flex: 1, marginLeft: spacing.md },
  plateNumber: { fontSize: 15, fontWeight: "800", color: colors.text, marginBottom: 4 },
  carDesc: { fontSize: 12, color: colors.textMuted },
  acBadge: { borderWidth: 1, borderColor: colors.border, borderRadius: 4, fontSize: 10, paddingHorizontal: 4 },
  seatsWrap: { alignItems: "center" },
  seatsText: { fontSize: 11, color: colors.textMuted, marginTop: 4 },

  metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  metaCol: { flex: 1, alignItems: "center" },
  metaBorder: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.border },
  metaValueRed: { fontSize: 14.5, fontWeight: "800", color: colors.brand, marginBottom: 4 },
  metaValue: { fontSize: 14.5, fontWeight: "800", color: colors.text, marginBottom: 4 },
  metaLabel: { fontSize: 11, color: colors.textMuted },

  routeSection: { paddingVertical: spacing.sm },
  routeItem: { flexDirection: "row", alignItems: "flex-start" },
  routeDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  routeTexts: { flex: 1, marginLeft: spacing.md },
  routeLabel: { fontSize: 11.5, color: colors.textMuted, marginBottom: 2 },
  routeMain: { fontSize: 14, fontWeight: "700", color: colors.text },
  routeRight: { alignItems: "flex-end", justifyContent: "center" },
  routeStat: { fontSize: 13, fontWeight: "600", color: colors.text },
  routeLine: { width: 1, height: 30, backgroundColor: colors.border, marginLeft: 4, marginVertical: 4 },

  ratingSection: { alignItems: "center", marginBottom: spacing.xl },
  ratingLabel: { fontSize: 13, color: colors.textMuted, marginBottom: spacing.sm },
  starsRow: { flexDirection: "row", gap: spacing.md },

  chatButton: { backgroundColor: colors.brand, borderRadius: radius.md, paddingVertical: 15, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  chatButtonText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  mapWrap: { height: 400, width: "100%" },
  mapWrapWide: { flex: 1, height: "100%", minHeight: 600 },

  // Chat Modal Styles
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  chatSheet: { backgroundColor: colors.white, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, height: "70%", paddingBottom: spacing.xl },
  chatHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: spacing.xl, borderBottomWidth: 1, borderColor: colors.border },
  chatTitle: { fontSize: 18, fontWeight: "800", color: colors.text },
  chatScroll: { padding: spacing.lg, flexGrow: 1 },
  emptyChat: { textAlign: "center", color: colors.textMuted, marginTop: spacing.xl },
  
  messageBubble: { maxWidth: "80%", padding: spacing.md, borderRadius: radius.lg, marginBottom: spacing.sm },
  msgRider: { alignSelf: "flex-end", backgroundColor: colors.brand, borderBottomRightRadius: 2 },
  msgDriver: { alignSelf: "flex-start", backgroundColor: colors.bgApp, borderBottomLeftRadius: 2 },
  messageText: { fontSize: 14, color: colors.text },

  quickReplyScrollWrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderColor: colors.border },
  quickReplyRow: { gap: spacing.sm },
  quickReplyBtn: { backgroundColor: colors.brandTint, paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.brandTint },
  quickReplyText: { color: colors.brandDark, fontWeight: "600", fontSize: 13 },
});