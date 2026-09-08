import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, useWindowDimensions, Platform, ActivityIndicator, TextInput, Alert, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from './config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSocket } from './lib/socket';

// ---------------------------------------------------------------------------
// Theme Colors
// ---------------------------------------------------------------------------
const COLORS = {
  bgApp: "#F4F5F7",
  brand: "#FF6659",
  brandDark: "#E9564A",
  brandTint: "#FFEDEC",
  text: "#1A1B1F",
  textMuted: "#6B7280",
  white: "#FFFFFF",
  border: "#E7E8EC",
  success: "#2ECC71",
  danger: "#FF5A52",
};

const radius = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 };
let MapView: any = null;
let Marker: any = null;
let Polyline: any = null;
let PROVIDER_GOOGLE: any = undefined;
let DateTimePickerNative: any = null;
let Location: any = null;

if (Platform.OS !== "web") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Maps = require("react-native-maps");
    MapView = Maps.default;
    Marker = Maps.Marker;
    Polyline = Maps.Polyline;
    PROVIDER_GOOGLE = Maps.PROVIDER_GOOGLE;
  } catch {
    // react-native-maps not installed — native map falls back to a placeholder
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    DateTimePickerNative = require("@react-native-community/datetimepicker").default;
  } catch {
    // datetimepicker not installed — schedule modal falls back to text buttons
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    Location = require("expo-location");
  } catch {
    // expo-location not installed — live location tracking is skipped on native
  }
}

// Reverse-geocode a lat/lng into a short readable label.
// Mirrors the Nominatim-on-web / reverseGeocodeAsync-on-native pattern used elsewhere in the app.
async function reverseGeocodeCoords(latitude: number, longitude: number): Promise<string> {
  try {
    if (Platform.OS === "web") {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
      );
      const data = await res.json();
      return data?.display_name || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
    }
    if (Location) {
      const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (place) {
        return [place.name, place.street, place.city, place.region].filter(Boolean).join(", ");
      }
    }
  } catch (err) {
    console.error("Reverse geocode failed", err);
  }
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

type Place = { label: string;  latitude: number; longitude: number };
type PlaceSuggestion = { label: string;  latitude: number; longitude: number };
function RouteMap({
  pickup,
  destination,
  driverLocation,
  showDriverRoute,
}: {
  pickup: Place;
  destination: Place;
  driverLocation?: Place | null;
  showDriverRoute?: boolean;
}) {
  const showDriver = !!driverLocation && !!showDriverRoute;

  if (Platform.OS === "web") {
    const centerLat = (pickup.latitude + destination.latitude) / 2;
    const centerLng = (pickup.longitude + destination.longitude) / 2;
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
        const pin = (color) => L.divIcon({className:'',html:'<div style="width:14px;height:14px;border-radius:7px;background:'+color+';border:2px solid white;"></div>'});
        L.marker([${pickup.latitude}, ${pickup.longitude}], {icon: pin('#2ECC71')}).addTo(map);
        L.marker([${destination.latitude}, ${destination.longitude}], {icon: pin('#FF5A52')}).addTo(map);
        L.polyline([[${pickup.latitude},${pickup.longitude}],[${destination.latitude},${destination.longitude}]], {color:'#FF6659', weight:4}).addTo(map);
        ${showDriver ? `
        L.marker([${driverLocation!.latitude}, ${driverLocation!.longitude}], {icon: pin('#3B82F6')}).addTo(map);
        L.polyline([[${driverLocation!.latitude},${driverLocation!.longitude}],[${pickup.latitude},${pickup.longitude}]], {color:'#3B82F6', weight:3, dashArray: '6,6'}).addTo(map);
        ` : ""}
      </script>
      </body></html>
    `;
    return <iframe title="map" srcDoc={html} style={{ border: 0, width: "100%", height: "100%" }} />;
  }

  if (!MapView) return <View style={{flex: 1, backgroundColor: '#eee', alignItems: 'center', justifyContent: 'center'}}><Text>Install react-native-maps</Text></View>;

  return (
    <MapView
      style={StyleSheet.absoluteFill}
      provider={PROVIDER_GOOGLE}
      initialRegion={{ latitude: pickup.latitude, longitude: pickup.longitude, latitudeDelta: 0.08, longitudeDelta: 0.08 }}
    >
      <Marker coordinate={pickup}><View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: '#2ECC71', borderWidth: 3, borderColor: '#fff' }} /></Marker>
      <Marker coordinate={destination}><View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: '#FF5A52', borderWidth: 3, borderColor: '#fff' }} /></Marker>
      <Polyline coordinates={[pickup, destination]} strokeColor="#FF6659" strokeWidth={4} />
      {showDriver && (
        <>
          <Marker coordinate={driverLocation as Place}>
            <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: '#3B82F6', borderWidth: 3, borderColor: '#fff' }} />
          </Marker>
          <Polyline coordinates={[driverLocation as Place, pickup]} strokeColor="#3B82F6" strokeWidth={3} lineDashPattern={[6, 6]} />
        </>
      )}
    </MapView>
  );
}
export default function DriverDashboard() {
  const { width } = useWindowDimensions();
  const isWide = width >= 980;

  const [profile, setProfile] = useState<any | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [requests, setRequests] = useState<any[]>([]);
  const [activeRide, setActiveRide] = useState<any | null>(null);

  // Driver's own live location — tracked continuously while the dashboard is
  // open (mirrors "Online & Searching"), shown in the sidebar and, once a
  // ride is accepted, as a blue dot + dashed route to pickup on the map.
  const [driverCoords, setDriverCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [driverLocationLabel, setDriverLocationLabel] = useState<string>('Fetching location...');

  // Pickup / drop-off handshake for the active ride.
  const [reachedPickup, setReachedPickup] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [codeError, setCodeError] = useState('');
  const [codeVerified, setCodeVerified] = useState(false);
   const [userId, setUserId] = useState<string | null>(null);
  // Fetch real driver profile + go online on the socket
  const [chatVisible, setChatVisible] = useState(false);
const [chatMessages, setChatMessages] = useState<{ id: string; text: string; sender: 'rider' | 'driver' }[]>([]);
const chatPresets = ["I'm on my way", "I've arrived", "Running a few minutes late", "Okay, thanks"];

const sendChatMessage = (text: string) => {
  const trimmed = text.trim();
  if (!trimmed || !activeRide) return;
  setChatMessages((prev) => [...prev, { id: `${Date.now()}_local`, text: trimmed, sender: 'driver' }]);
  getSocket().emit('send_message', {
    requestId: activeRide.id,
    riderId: activeRide.riderId,
    driverId: userId,
    sender: 'driver',
    text: trimmed,
  });
};

// Listen for the rider's messages for whichever ride is currently active.
useEffect(() => {
  const socket = getSocket();
  const handleReceive = (message: any) => {
    if (message.sender !== 'rider') return;
    if (!activeRide || String(message.requestId) !== String(activeRide.id)) return;
    setChatMessages((prev) => [...prev, { id: message.id, text: message.text, sender: 'rider' }]);
  };
  socket.on('receive_message', handleReceive);
  return () => {
    socket.off('receive_message', handleReceive);
  };
}, [activeRide?.id]); 

// Start with a clean thread each time a new ride becomes active.
useEffect(() => {
  setChatMessages([]);
}, [activeRide?.id]);
  useEffect(() => {
    let socket: ReturnType<typeof getSocket>;

    (async () => {
      const uid = await AsyncStorage.getItem('userId');
      if (!uid) {
        setLoadingProfile(false);   // stop the spinner even with no session
        return;
      }
      setUserId(uid);
      try {
        const res = await fetch(`${API_URL}/driver/driver-details/${uid}`);
        const data = await res.json();
        if (res.ok) setProfile(data);
      } catch (err) {
        console.error('Failed to load driver profile', err);
      } finally {
        setLoadingProfile(false);
      }

      socket = getSocket();
      const registerOnline = () => {
  socket.emit('driver_online', { userId: uid });
  console.log('🟢 driver_online emitted for userId:', uid, 'connected:', socket.connected);
};
if (socket.connected) {
  registerOnline();
} else {
  socket.once('connect', registerOnline);
}
     socket.on('incoming_request', (req) => {
        console.log('📩 incoming_request received:', req);
        setRequests((prev) => [req, ...prev]);
      });
      socket.on('ride_unavailable', ({ requestId }: any) => {
        console.log('⚠️ ride_unavailable:', requestId);
        setActiveRide((prev) => (prev && String(prev.id) === String(requestId) ? null : prev));
        setReachedPickup(false);
        setCodeInput('');
        setCodeError('');
        setCodeVerified(false);
      });
      socket.on('request_taken', ({ id }: any) => {   // NEW
  console.log('🚫 request_taken, removing from list:', id);
  setRequests((prev) => prev.filter((r) => String(r.id) !== String(id)));
});
    })();

    return () => {
      socket?.off('incoming_request');
      socket?.off('ride_unavailable');
      socket?.off('request_taken'); 
    };
  }, []);

  // Track the driver's live location the whole time they're online.
  useEffect(() => {
    let cancelled = false;
    let webWatchId: number | null = null;
    let nativeSub: { remove: () => void } | null = null;

    const handlePosition = (latitude: number, longitude: number) => {
      if (cancelled) return;
      setDriverCoords({ latitude, longitude });
      reverseGeocodeCoords(latitude, longitude).then((label) => {
        if (!cancelled) setDriverLocationLabel(label);
      });
    };

    const start = async () => {
      if (Platform.OS === 'web') {
        if (!navigator.geolocation) {
          setDriverLocationLabel('Location unavailable');
          return;
                }
        webWatchId = navigator.geolocation.watchPosition(
          (pos) => handlePosition(pos.coords.latitude, pos.coords.longitude),
          (err) => {
            console.error('watchPosition error', err);
            setDriverLocationLabel('Location unavailable');
          },
          { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
        );
      } else if (Location) {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setDriverLocationLabel('Location permission denied');
          return;
        }
        nativeSub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 4000, distanceInterval: 10 },
          (pos: any) => handlePosition(pos.coords.latitude, pos.coords.longitude)
        );
      } else {
        setDriverLocationLabel('Location unavailable');
      }
    };

    start();

    return () => {
      cancelled = true;
      if (webWatchId != null && Platform.OS === 'web') navigator.geolocation.clearWatch(webWatchId);
      nativeSub?.remove();
    };
  }, []);

  const handleAccept = (ride: any) => {
    if (!userId) {
    Alert.alert('Not ready yet', 'Your driver session is still loading — please wait a moment and try again.');
    return;
  }
  getSocket().emit(
    'accept_ride',
    { requestId: ride.id, riderId: ride.riderId, driverUserId: userId, driver: profile },
    (res: any) => {
      if (res?.ok) {
        setActiveRide(ride);
        setReachedPickup(false);
        setCodeInput('');
        setCodeError('');
        setCodeVerified(false);
        setRequests((prev) => prev.filter((r) => r.id !== ride.id));
      } else {
        Alert.alert('Could not accept ride', res?.error ?? 'Please try again.');
        setRequests((prev) => prev.filter((r) => r.id !== ride.id));
      }
    }
  );
};

  const handleDecline = (rideId: string) => {
    setRequests((prev) => prev.filter((r) => r.id !== rideId));
  };
   const performCancelRide = () => {
  if (!activeRide) return;
  if (!userId) {
    Alert.alert('Not ready yet', 'Your driver session is still loading — please wait a moment and try again.');
    return;
  }
  getSocket().emit(
    'cancel_ride',
    { requestId: activeRide.id, driverUserId: userId, riderId: activeRide.riderId },
    (res: any) => {
      if (res?.ok) {
        setActiveRide(null);
        setReachedPickup(false);
        setCodeInput('');
        setCodeError('');
        setCodeVerified(false);
      } else {
        Alert.alert('Could not cancel ride', res?.error ?? 'Please try again.');
      }
    }
  );
};
  const handleCancelRide = () => {
  if (!activeRide) return;

  if (Platform.OS === 'web') {
    if (window.confirm('Cancel this ride? The rider will be notified that you canceled.')) {
      performCancelRide();
    }
    return;
  }

  Alert.alert(
    'Cancel this ride?',
    'The rider will be notified that you canceled.',
    [
      { text: 'Keep ride', style: 'cancel' },
      { text: 'Cancel ride', style: 'destructive', onPress: performCancelRide },
    ]
  );
};
  // No client-side seat filtering needed — the server only ever sends
  // requests that already fit this driver's seats.
  const eligibleRequests = requests;

  // ---------------------------------------------------------------------------
  // Sidebar Component
  // ---------------------------------------------------------------------------
  const Sidebar = () => {
    if (loadingProfile) {
      return (
        <View style={[styles.sidebar, !isWide && styles.sidebarMobile, { alignItems: 'center', justifyContent: 'center' }]}>
          <ActivityIndicator color={COLORS.brand} />
        </View>
      );
    }
    if (!profile) {
      return (
        <View style={[styles.sidebar, !isWide && styles.sidebarMobile]}>
          <Text style={styles.detailValue}>No vehicle details found. Please complete your driver registration.</Text>
        </View>
      );
    }
    return (
      <View style={[styles.sidebar, !isWide && styles.sidebarMobile]}>
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={32} color={COLORS.textMuted} />
          </View>
          <Text style={styles.driverName}>{profile.name}</Text>
        </View>

        <View style={styles.statusToggle}>
          <View style={[styles.statusDot, { backgroundColor: COLORS.success }]} />
          <Text style={styles.statusText}>Online & Searching</Text>
        </View>

        <View style={styles.locationBlock}>
          <Ionicons name="navigate-outline" size={16} color={COLORS.brand} />
          <Text style={styles.locationBlockText} numberOfLines={3}>{driverLocationLabel}</Text>
        </View>

        <View style={styles.sidebarSection}>
          <Text style={styles.sectionTitle}>Vehicle Details</Text>

          <View style={styles.detailRow}>
            <Ionicons name="car-outline" size={18} color={COLORS.textMuted} />
            <View style={styles.detailTexts}>
              <Text style={styles.detailLabel}>Model</Text>
              <Text style={styles.detailValue}>{profile.vehicle_model}</Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="card-outline" size={18} color={COLORS.textMuted} />
            <View style={styles.detailTexts}>
              <Text style={styles.detailLabel}>Plate Number</Text>
              <Text style={styles.detailValue}>{profile.vehicle_number}</Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="people-outline" size={18} color={COLORS.textMuted} />
            <View style={styles.detailTexts}>
              <Text style={styles.detailLabel}>Available Seats</Text>
              <Text style={styles.detailValue}>{profile.seats} Seats</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------
  return (
    <View style={styles.root}>
      {isWide && <Sidebar />}

      <ScrollView contentContainerStyle={styles.mainContent} showsVerticalScrollIndicator={false}>
        {!isWide && <Sidebar />}

        {activeRide ? (
          <View style={styles.activeRideCard}>
            <View style={styles.activeHeader}>
  <Text style={styles.activeTitle}>Current Trip</Text>
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
    <View style={styles.badge}>
      <Text style={styles.badgeText}>En route to pickup</Text>
    </View>
    <Pressable style={styles.chatIconBtn} onPress={() => setChatVisible(true)}>
      <Ionicons name="chatbubble-ellipses" size={18} color={COLORS.brand} />
    </Pressable>
  </View>
</View>
<Modal visible={chatVisible} animationType="slide" transparent>
  <View style={styles.modalOverlay}>
    <View style={styles.chatSheet}>
      <View style={styles.chatHeader}>
        <Text style={styles.chatTitle}>Chat with rider</Text>
        <Pressable onPress={() => setChatVisible(false)}>
          <Ionicons name="close" size={24} color={COLORS.text} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.chatScroll}>
        {chatMessages.length === 0 ? (
          <Text style={styles.emptyChat}>No messages yet. Send a quick reply below.</Text>
        ) : (
          chatMessages.map((msg) => (
            <View key={msg.id} style={[styles.messageBubble, msg.sender === 'driver' ? styles.msgDriverSelf : styles.msgRiderIncoming]}>
              <Text style={[styles.messageText, msg.sender === 'driver' && { color: '#fff' }]}>{msg.text}</Text>
            </View>
          ))
        )}
      </ScrollView>

      <View style={styles.quickReplyScrollWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickReplyRow}>
          {chatPresets.map((preset, index) => (
            <Pressable key={index} style={styles.quickReplyBtn} onPress={() => sendChatMessage(preset)}>
              <Text style={styles.quickReplyText}>{preset}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </View>
  </View>
</Modal>
            <View style={{ height: 300, borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
              <RouteMap
  pickup={{
    label: activeRide.pickup.label,
    latitude: activeRide.pickupCoords.latitude,
    longitude: activeRide.pickupCoords.longitude,
  }}
  destination={{
    label: activeRide.destination.label,
    latitude: activeRide.destinationCoords.latitude,
    longitude: activeRide.destinationCoords.longitude,
  }}
  driverLocation={driverCoords}
  showDriverRoute={!reachedPickup}
/>
               </View>
            <View style={styles.routeBox}>
              <View style={styles.locationRow}>
                <View style={[styles.dot, { backgroundColor: COLORS.success }]} />
                <Text style={styles.locationText}>{activeRide.pickup}</Text>
              </View>
              <View style={styles.dashedLine} />
              <View style={styles.locationRow}>
                <View style={[styles.dot, { backgroundColor: COLORS.danger }]} />
                <Text style={styles.locationText}>{activeRide.destination}</Text>
              </View>
            </View>

                        {!reachedPickup ? (
              <View style={styles.actionRow}>
                <Pressable style={[styles.cancelBtn, styles.actionRowBtn]} onPress={handleCancelRide}>
                  <Text style={styles.cancelText}>Cancel Ride</Text>
                </Pressable>
                <Pressable
                  style={[styles.completeBtn, styles.actionRowBtn]}
                  onPress={() => {
                    setReachedPickup(true);
                    getSocket().emit(
                      'ride_reached_pickup', 
                      { requestId: activeRide.id, driverUserId: userId },
                    (res: any) => {
          if (res?.ok) {
            setReachedPickup(true);
          } else {
            Alert.alert('Could not update ride', res?.error ?? 'Please try again.');
          }
        }
                    );
                  }}
                >
                  <Text style={styles.completeText}>Reached Pickup Location</Text>
                </Pressable>
              </View> 
            ) : !codeVerified ? (
              <View style={styles.codeBox}>
                <Text style={styles.codeLabel}>Ask the rider for their ride code</Text>
                <TextInput
                  style={styles.codeInput}
                  placeholder="Enter ride code"
                  placeholderTextColor={COLORS.textMuted}
                  autoCapitalize="characters"
                  value={codeInput}
                  onChangeText={(t) => { setCodeInput(t); setCodeError(''); }}
                />
                {!!codeError && <Text style={styles.codeError}>{codeError}</Text>}
                <Pressable
                  style={styles.completeBtn}
                 onPress={() => {
  const expected = String(activeRide?.rideCode || '').trim().toUpperCase();
  const entered = codeInput.trim().toUpperCase();
  if (expected.length > 0 && entered === expected) {
    getSocket().emit(
      'ride_code_verified',
      { requestId: activeRide.id, driverUserId: userId },
      (res: any) => {
        if (res?.ok) {
          setCodeVerified(true);
          setCodeError('');
        } else {
          setCodeError(res?.error ?? 'Could not verify — try again.');
        }
      }
    );
  } else {
    setCodeError("That code doesn't match. Ask the rider to double-check.");
  }
}}
                >
                  <Text style={styles.completeText}>Verify Code</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                style={styles.completeBtn}
                onPress={() => {
  getSocket().emit(
    'ride_completed',
    { requestId: activeRide.id, driverUserId: userId, riderId: activeRide.riderId },
    (res: any) => {
      if (res?.ok) {
        setActiveRide(null);
        setReachedPickup(false);
        setCodeInput('');
        setCodeVerified(false);
      } else {
        Alert.alert('Could not complete ride', res?.error ?? 'Please try again.');
      }
    }
  );
}}
              >
                <Text style={styles.completeText}>Complete Drop-off</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <>
            <View style={styles.feedHeader}>
              <Text style={styles.feedTitle}>Incoming Requests</Text>
              <Text style={styles.feedSubtitle}>
                Showing rides for up to {profile?.seats ?? '—'} passengers
              </Text>
            </View>

            {eligibleRequests.length === 0 ? (
              <View style={styles.emptyState}>
                <ActivityIndicator size="large" color={COLORS.brand} style={{ marginBottom: 16 }} />
                <Text style={styles.emptyTitle}>Finding nearby riders...</Text>
                <Text style={styles.emptySub}>Make sure your vehicle is parked in a safe location.</Text>
              </View>
            ) : (
              eligibleRequests.map((req) => (
                <View key={req.id} style={styles.requestCard}>
                  <View style={styles.priceRow}>
                    <View>
                      <Text style={styles.newRequestText}>New Request · {req.carType}</Text>
                      <Text style={styles.seatsAlert}>{req.requestedSeats} Riders</Text>
                    </View>
                    <Text style={styles.priceText}>₹{req.price}</Text>
                  </View>

                  <View style={styles.routeBox}>
                    <View style={styles.locationRow}>
                      <View style={[styles.dot, { backgroundColor: COLORS.success }]} />
                      <Text style={styles.locationText} numberOfLines={1}>{req.pickup}</Text>
                    </View>
                    <View style={styles.dashedLine} />
                    <View style={styles.locationRow}>
                      <View style={[styles.dot, { backgroundColor: COLORS.danger }]} />
                      <Text style={styles.locationText} numberOfLines={1}>{req.destination}</Text>
                    </View>
                  </View>

                  <View style={styles.statsRow}>
                    <Text style={styles.statsText}>Distance: <Text style={{ fontWeight: '700' }}>{req.distance}</Text></Text>
                    <Text style={styles.statsText}>Est. Time: <Text style={{ fontWeight: '700' }}>{req.time}</Text></Text>
                  </View>

                  <View style={styles.actionRow}>
                    <Pressable style={styles.declineBtn} onPress={() => handleDecline(req.id)}>
                      <Text style={styles.declineText}>Decline</Text>
                    </Pressable>
                    <Pressable style={styles.acceptBtn} onPress={() => handleAccept(req)}>
                      <Text style={styles.acceptText}>Accept Ride</Text>
                    </Pressable>
                  </View>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', backgroundColor: COLORS.bgApp },

  sidebar: { width: 280, backgroundColor: COLORS.white, borderRightWidth: 1, borderColor: COLORS.border, padding: 24 },
  sidebarMobile: { width: '100%', borderRightWidth: 0, borderBottomWidth: 1, marginBottom: 16 },

  profileHeader: { alignItems: 'center', marginBottom: 24, paddingTop: Platform.OS === 'ios' ? 40 : 10 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#E9EAEE', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  driverName: { fontSize: 18, fontWeight: '800', color: COLORS.text, marginBottom: 4 },

  statusToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8F9EF', paddingVertical: 10, borderRadius: radius.md, marginBottom: 32 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  statusText: { fontSize: 14, fontWeight: '700', color: COLORS.success },

  locationBlock: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#F7F7F9', padding: 12, borderRadius: radius.md, marginBottom: 24 },
  locationBlockText: { flex: 1, fontSize: 12.5, color: COLORS.textMuted, lineHeight: 17 },

  sidebarSection: { borderTopWidth: 1, borderColor: COLORS.border, paddingTop: 20 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 16 },
  detailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  detailTexts: { marginLeft: 12 },
  detailLabel: { fontSize: 11, color: COLORS.textMuted, marginBottom: 2 },
  detailValue: { fontSize: 14, fontWeight: '600', color: COLORS.text },

  mainContent: { flexGrow: 1, padding: 24, paddingTop: Platform.OS === 'ios' ? 60 : 24 },
  feedHeader: { marginBottom: 20 },
  feedTitle: { fontSize: 24, fontWeight: '800', color: COLORS.text },
  feedSubtitle: { fontSize: 14, color: COLORS.textMuted, marginTop: 4 },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 80 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  emptySub: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center' },

  requestCard: { backgroundColor: COLORS.white, borderRadius: radius.lg, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  newRequestText: { fontSize: 13, fontWeight: '700', color: COLORS.brand },
  seatsAlert: { fontSize: 12, fontWeight: '600', color: COLORS.textMuted, marginTop: 4 },
  priceText: { fontSize: 24, fontWeight: '800', color: COLORS.text },

  routeBox: { backgroundColor: '#F7F7F9', padding: 12, borderRadius: radius.md, marginBottom: 16 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dashedLine: { height: 16, width: 1, borderStyle: 'dashed', borderWidth: 1, borderColor: '#ccc', marginLeft: 4, marginVertical: 2 },
  locationText: { fontSize: 14, color: COLORS.text, flex: 1 },

  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, paddingHorizontal: 4 },
  statsText: { fontSize: 13, color: COLORS.textMuted },
  
  actionRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
actionRowBtn: { flex: 1, marginTop: 0 },
cancelBtn: { backgroundColor: COLORS.white, paddingVertical: 16, borderRadius: radius.md, alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.danger },
cancelText: { color: COLORS.danger, fontWeight: '700', fontSize: 16 },
  declineBtn: { flex: 1, paddingVertical: 14, borderRadius: radius.md, backgroundColor: '#ececec', alignItems: 'center' },
  declineText: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  acceptBtn: { flex: 1, paddingVertical: 14, borderRadius: radius.md, backgroundColor: COLORS.success, alignItems: 'center' },
  acceptText: { fontSize: 15, fontWeight: '700', color: COLORS.white },

  activeRideCard: { backgroundColor: COLORS.white, borderRadius: radius.lg, padding: 24, borderWidth: 2, borderColor: COLORS.success },
  activeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  activeTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  badge: { backgroundColor: '#E8F9EF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill },
  badgeText: { color: COLORS.success, fontWeight: '700', fontSize: 12 },
  completeBtn: { backgroundColor: COLORS.text, paddingVertical: 16, borderRadius: radius.md, alignItems: 'center', marginTop: 16 },
  completeText: { color: COLORS.white, fontWeight: '700', fontSize: 16 },

  codeBox: { marginTop: 16, backgroundColor: '#F7F7F9', borderRadius: radius.md, padding: 16 },
  codeLabel: { fontSize: 13, fontWeight: '600', color: COLORS.text, marginBottom: 10 },
  codeInput: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 1,
    color: COLORS.text,
  },
  chatIconBtn: {
  width: 34, height: 34, borderRadius: 17,
  backgroundColor: COLORS.brandTint,
  alignItems: 'center', justifyContent: 'center',
},
modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
chatSheet: { backgroundColor: COLORS.white, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, height: '70%', paddingBottom: 24 },
chatHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, borderBottomWidth: 1, borderColor: COLORS.border },
chatTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text },
chatScroll: { padding: 16, flexGrow: 1 },
emptyChat: { textAlign: 'center', color: COLORS.textMuted, marginTop: 24 },
messageBubble: { maxWidth: '80%', padding: 12, borderRadius: 16, marginBottom: 8 },
msgDriverSelf: { backgroundColor: COLORS.brand, alignSelf: 'flex-end' },
msgRiderIncoming: { backgroundColor: '#ECEDF1', alignSelf: 'flex-start' },
messageText: { fontSize: 14, color: COLORS.text },
quickReplyScrollWrap: { paddingHorizontal: 16, paddingTop: 8 },
quickReplyRow: { gap: 8, paddingRight: 16 },
quickReplyBtn: { backgroundColor: COLORS.brandTint, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
quickReplyText: { color: COLORS.brandDark, fontWeight: '600', fontSize: 13 },
  codeError: { color: COLORS.danger, fontSize: 12.5, marginTop: 8 },
});