import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  StatusBar,Pressable,
  ActivityIndicator,
  Alert, useWindowDimensions,
  Platform, Modal, FlatList
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import {Sidebar} from "../Sidebar";

// -----------------------------------------------------------------------------
// Optional native map module, loaded defensively (same pattern as Rider.tsx)
// -----------------------------------------------------------------------------
const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
const radius = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 };
let MapView: any = null;
let Marker: any = null;
let Polyline: any = null;
let PROVIDER_GOOGLE: any = undefined;

if (Platform.OS !== 'web') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Maps = require('react-native-maps');
    MapView = Maps.default;
    Marker = Maps.Marker;
    Polyline = Maps.Polyline;
    PROVIDER_GOOGLE = Maps.PROVIDER_GOOGLE;
  } catch {
    // react-native-maps not installed — native map falls back to a placeholder
  }
}

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type Place = { label: string; sublabel: string; latitude: number; longitude: number };
type PlaceSuggestion = Place;

type SeatInfo = {
  filled: number;
  total: number;
};

type RideMatch = {
  id: string;
  routeFrom: string;
  routeTo: string;
  leavingInMinutes: number;
  carName: string;
  ac: boolean;
  driverName: string;
  driverRating: number;
  seats: SeatInfo;
  pricePerRider: number;
  etaToNearestStopMinutes?: number;
  stops: RideStop[];
  occupants: Occupant[];
};

type RideStop = {
  id: string;
  label: string;
  sublabel: string;
  kind: 'pickup' | 'dropoff' | 'active';
  // position on the mock map, in percent (0-100) of the map box
  x: number;
  y: number;
};

type Occupant = {
  id: string;
  name: string;
  role: 'Driver' | 'Passenger';
};
const colors = {
  bgApp: "#F4F5F7",
  sidebarBg: "#181A20",
  sidebarActiveBg: "#2A2D36",
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
};
// -----------------------------------------------------------------------------
// Mock data — in a real app this would come from an API call filtered by
// pickup / destination. Here we simulate "rides that match this route".
// -----------------------------------------------------------------------------

const MOCK_RIDES: RideMatch[] = [
  {
    id: 'ride-1',
    routeFrom: 'Newtown',
    routeTo: 'Dum Dum',
    leavingInMinutes: 12,
    carName: 'Go Sedan',
    ac: true,
    driverName: 'Priya S.',
    driverRating: 4.8,
    seats: { filled: 2, total: 4 },
    pricePerRider: 85,
    stops: [
      { id: 's1', label: 'Newtown', sublabel: 'Arjun getting down (7 seats)', kind: 'dropoff', x: 78, y: 78 },
      { id: 's2', label: 'Saltlake', sublabel: 'Sneha (Will board)', kind: 'pickup', x: 62, y: 60 },
      { id: 's3', label: 'Karunamoyee', sublabel: 'Arjun M. (Passenger)', kind: 'active', x: 68, y: 32 },
      { id: 's4', label: 'Paikpara', sublabel: 'Sneha (Will drop off)', kind: 'dropoff', x: 55, y: 22 },
      { id: 's5', label: 'Dum Dum', sublabel: 'Riya (Driver)', kind: 'active', x: 82, y: 8 },
    ],
    occupants: [
      { id: 'o1', name: 'Priya S.', role: 'Driver' },
      { id: 'o2', name: 'Arjun M.', role: 'Passenger' },
    ],
  },
  {
    id: 'ride-2',
    routeFrom: 'Newtown',
    routeTo: 'Dum Dum',
    leavingInMinutes: 13,
    carName: 'Go Sedan',
    ac: true,
    driverName: 'Priya S.',
    driverRating: 4.8,
    seats: { filled: 2, total: 4 },
    pricePerRider: 85,
    stops: [
      { id: 's1', label: 'Newtown', sublabel: 'Route start', kind: 'pickup', x: 78, y: 78 },
      { id: 's2', label: 'Saltlake', sublabel: 'On the way', kind: 'active', x: 62, y: 60 },
      { id: 's3', label: 'Dum Dum', sublabel: 'Route end', kind: 'dropoff', x: 82, y: 8 },
    ],
    occupants: [
      { id: 'o1', name: 'Priya S.', role: 'Driver' },
      { id: 'o2', name: 'Rahul K.', role: 'Passenger' },
    ],
  },
  {
    id: 'ride-3',
    routeFrom: 'Newtown',
    routeTo: 'Dum Dum',
    leavingInMinutes: 18,
    carName: 'Go Sedan',
    ac: true,
    driverName: 'Priya S.',
    driverRating: 4.8,
    seats: { filled: 2, total: 4 },
    pricePerRider: 85,
    etaToNearestStopMinutes: 8,
    stops: [
      { id: 's1', label: 'Newtown', sublabel: 'Route start', kind: 'pickup', x: 78, y: 78 },
      { id: 's2', label: 'Karunamoyee', sublabel: 'Reaches in ~8 min', kind: 'active', x: 68, y: 32 },
      { id: 's3', label: 'Dum Dum', sublabel: 'Route end', kind: 'dropoff', x: 82, y: 8 },
    ],
    occupants: [
      { id: 'o1', name: 'Priya S.', role: 'Driver' },
      { id: 'o2', name: 'Meera D.', role: 'Passenger' },
    ],
  },
];

// -----------------------------------------------------------------------------
// Colors
// -----------------------------------------------------------------------------

const COLORS = {
  bg: '#FDF1EF',
  card: '#FFFFFF',
  coral: '#F0685A',
  coralDark: '#E14F41',
  coralSoft: '#FCE3E0',
  green: '#3CB878',
  greenSoft: '#E4F7EC',
  text: '#25262B',
  textMuted: '#8B8D97',
  border: '#F0E4E1',
  purple: '#8B5CF6',
  blue: '#3B82F6',
};

// -----------------------------------------------------------------------------
// Location search / geocoding helpers (mirrors Rider.tsx so pickup and
// destination behave the same way in both screens)
// -----------------------------------------------------------------------------
function SheetModal({
  visible,
  title,
  onClose,
  children,
  width = 340,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={modalStyles.backdrop} onPress={onClose}>
        <Pressable style={[modalStyles.sheet, { width }]} onPress={(e) => e.stopPropagation()}>
          <View style={modalStyles.header}>
            <Text style={modalStyles.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(15,17,21,0.45)", alignItems: "center", justifyContent: "center", padding: spacing.lg },
  sheet: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg, maxWidth: "100%" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  title: { fontSize: 16, fontWeight: "700", color: colors.text },
});
// Alert.alert renders nothing on web — fall back to window.alert there.
function notify(title: string, message: string) {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

function useLocationSearch() {
  const [results, setResults] = useState<PlaceSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const timeoutRef = useRef<any>(null);

  const search = useCallback((query: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (query.trim().length < 3) {
      setResults([]);
      return;
    }
    timeoutRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=6&addressdetails=1`
        );
        const json = await res.json();
        setResults(
          json.map((item: any) => ({
            label: item.display_name.split(',')[0],
            sublabel: item.display_name,
            latitude: parseFloat(item.lat),
            longitude: parseFloat(item.lon),
          }))
        );
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);
  }, []);

  const clear = () => setResults([]);
  return { results, loading, search, clear };
}

async function reverseGeocodeWeb(lat: number, lon: number) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`
    );
    const json = await res.json();
    const addr = json?.address || {};
    const shortLabel =
      json?.name ||
      addr.road ||
      addr.neighbourhood ||
      addr.suburb ||
      addr.village ||
      addr.town ||
      json?.display_name?.split(',')[0] ||
      `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
    const label = json?.display_name || shortLabel;
    const sublabel = shortLabel;
    return { label, sublabel };
  } catch {
    return { label: `${lat.toFixed(4)}, ${lon.toFixed(4)}`, sublabel: '' };
  }
}

// Joins whatever fields expo-location's reverseGeocodeAsync gave us into one
// full address string, deduping consecutive repeats.
function buildFullAddress(place: Location.LocationGeocodedAddress | undefined | null): string {
  if (!place) return '';
  const parts = [
    place.name,
    place.streetNumber,
    place.street,
    place.district,
    place.subregion,
    place.city,
    place.region,
    place.postalCode,
    place.country,
  ]
    .filter((part, idx, arr) => !!part && arr.indexOf(part) === idx)
    .filter(Boolean);
  return parts.join(', ');
}

async function resolvePlaceFromCoords(lat: number, lng: number): Promise<Place> {
  if (Platform.OS === 'web') {
    const { label, sublabel } = await reverseGeocodeWeb(lat, lng);
    return { label, sublabel, latitude: lat, longitude: lng };
  }
  try {
    const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    const place = results?.[0];
    const label = buildFullAddress(place) || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    const sublabel = [place?.city, place?.region, place?.postalCode].filter(Boolean).join(', ');
    return { label, sublabel, latitude: lat, longitude: lng };
  } catch {
    return { label: `${lat.toFixed(4)}, ${lng.toFixed(4)}`, sublabel: '', latitude: lat, longitude: lng };
  }
}
const CITIES = ["Kolkata", "Mumbai", "Delhi", "Bengaluru", "Chennai", "Hyderabad", "Pune"];
function CityPickerModal({
  visible,
  currentCity,
  onClose,
  onSelect,
}: {
  visible: boolean;
  currentCity: string;
  onClose: () => void;
  onSelect: (city: string) => void;
}) {
  return (
    <SheetModal visible={visible} title="Change city" onClose={onClose} width={300}>
      <FlatList
        data={CITIES}
        keyExtractor={(c) => c}
        renderItem={({ item }) => {
          const active = item === currentCity;
          return (
            <TouchableOpacity
              style={[pickerStyles.row, active && pickerStyles.rowActive]}
              onPress={() => {
                onSelect(item);
                onClose();
              }}
            >
              <Ionicons name="location-outline" size={16} color={active ? colors.brand : colors.textMuted} />
              <Text style={[pickerStyles.label, active && pickerStyles.labelActive]}>{item}</Text>
              {active && <Ionicons name="checkmark" size={16} color={colors.brand} style={{ marginLeft: "auto" }} />}
            </TouchableOpacity>
          );
        }}
      />
    </SheetModal>
  );
}
const pickerStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: spacing.sm, borderRadius: radius.sm },
  rowActive: { backgroundColor: colors.brandTint },
  label: { marginLeft: spacing.sm, fontSize: 14.5, color: colors.text },
  labelActive: { color: colors.brandDark, fontWeight: "700" },
});
function useCurrentLocation() {
  const [loading, setLoading] = useState(false);

  const getCurrentLocation = useCallback(async (): Promise<Place | null> => {
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return null;

      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = position.coords;

      if (Platform.OS === 'web') {
        const { label, sublabel } = await reverseGeocodeWeb(latitude, longitude);
        return { label, sublabel, latitude, longitude };
      }

      const results = await Location.reverseGeocodeAsync({ latitude, longitude });
      const place = results?.[0];
      const label = buildFullAddress(place) || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
      const sublabel = [place?.city, place?.region, place?.postalCode].filter(Boolean).join(', ');
      return { label, sublabel, latitude, longitude };
    } catch {
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { getCurrentLocation, loading };
}

// -----------------------------------------------------------------------------
// Screen
// -----------------------------------------------------------------------------

type ViewState = 'search' | 'results' | 'detail';

const EMPTY_PLACE: Place = { label: '', sublabel: '', latitude: 0, longitude: 0 };

export default function FindRideScreen() {
  const router = useRouter();
  // Pickup and destination are structured Places (label + coords) so either
  // one can be set by typing, tapping a suggestion, tapping the map, or (for
  // pickup) the device's current location — mirrors Rider.tsx.
  const [pickup, setPickup] = useState<Place>(EMPTY_PLACE);
  const [destination, setDestination] = useState<Place | null>(null);
  // Which field a map tap should fill: null means the map isn't in picking mode.
  const [activeField, setActiveField] = useState<'pickup' | 'destination' | null>(null);
  const [view, setView] = useState<ViewState>('search');
  const [selectedRideId, setSelectedRideId] = useState<string | null>(null);
  const [requestStatus, setRequestStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const { width } = useWindowDimensions();
    const isWide = width >= 980;
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const { name: nameParam } = useLocalSearchParams<{ name?: string | string[]; username?: string | string[] }>();
      const riderName = (Array.isArray(nameParam) ? nameParam[0] : nameParam)?.trim() || "Rider";
  const rides = useMemo(() => MOCK_RIDES, []);
  const { getCurrentLocation, loading: locLoading } = useCurrentLocation();
  const selectedRide = useMemo(
    () => rides.find((r) => r.id === selectedRideId) ?? null,
    [rides, selectedRideId]
  );
  const handleSidebarSelect = (key: string) => {
    if (key === "activity") {
      router.push({
        pathname: "/previousActivity",   // adjust if your file/route is registered under a different path
        params: { name: riderName, username: riderName },
      });
    }
    if (key === "chat") {
      router.push({
        pathname: "/chat",   // adjust if your file/route is registered under a different path
        params: { name: riderName, username: riderName },
      });
    }
    if (key === "ride") {
      router.push({
        pathname: "/rider",   // adjust if your file/route is registered under a different path
        params: { name: riderName, username: riderName },
      });
    }
    
  };
  const handleSearch = () => {
    if (!pickup.label.trim() || !destination?.label?.trim()) {
      Alert.alert('Missing info', 'Please enter both a pickup and a destination.');
      return;
    }
    setView('results');
  };

  const handleSelectSuggestion = (field: 'pickup' | 'destination', place: PlaceSuggestion) => {
    if (field === 'pickup') {
      setPickup(place);
    } else {
      setDestination(place);
    }
    setActiveField(null);
  };

  const handleMapPick = async (lat: number, lng: number) => {
    const place = await resolvePlaceFromCoords(lat, lng);
    if (activeField === 'pickup') {
      setPickup(place);
    } else if (activeField === 'destination') {
      setDestination(place);
    }
    setActiveField(null);
  };

  const handleUseCurrentLocation = async () => {
    const loc = await getCurrentLocation();
    if (loc) {
      setPickup(loc);
    } else {
      notify('Location unavailable', "We couldn't access your current location.");
    }
  };

  const handleSelectRide = (rideId: string) => {
    setSelectedRideId(rideId);
    setRequestStatus('idle');
    setView('detail');
  };

  const handleBackToResults = () => {
    setView('results');
    setSelectedRideId(null);
    setRequestStatus('idle');
  };

  const handleBackToSearch = () => {
    setView('search');
  };

  const handleSendRequest = () => {
    if (!selectedRide) return;
    setRequestStatus('sending');
    setTimeout(() => {
      setRequestStatus('sent');
      Alert.alert(
        'Request sent',
        `Your request to board at ${pickup.label} and drop off at ${destination?.label} was sent to ${selectedRide.driverName} and all passengers for approval.`
      );
    }, 700);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      
      <StatusBar barStyle="dark-content" />
      {isWide ? (
              <Sidebar 
              activeKey="ongoing_rides"
              onSelectItem={handleSidebarSelect}
              user={{ name: riderName, profileLabel: "View profile" }} />
            ) : (
              sidebarOpen && (
                <View style={screenStyles.mobileSidebarOverlay}>
                  <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setSidebarOpen(false)} />
                  <View style={screenStyles.mobileSidebarPanel}>
                    <Sidebar 
                    activeKey="ride"
                onSelectItem={(key) => { setSidebarOpen(false); handleSidebarSelect(key); }}
                    user={{ name: riderName, profileLabel: "View profile" }} />
                  </View>
                </View>
              )
            )}
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.screenContent}
        keyboardShouldPersistTaps="handled"
      >
        <Header
          view={view}
          onBack={view === 'detail' ? handleBackToResults : view === 'results' ? handleBackToSearch : undefined}
        />

        {view !== 'detail' && (
          <SearchCard
            pickup={pickup}
            destination={destination}
            activeField={activeField}
            onFocusField={setActiveField}
            onSelectSuggestion={handleSelectSuggestion}
            onMapPick={handleMapPick}
            onClearPickup={() => setPickup(EMPTY_PLACE)}
            onClearDestination={() => setDestination(null)}
            onLocatePress={handleUseCurrentLocation}
            locating={locLoading}
            onSearch={handleSearch}
          />
        )}

        {view === 'results' && (
          <ResultsList
            pickup={pickup.label}
            destination={destination?.label ?? ''}
            rides={rides}
            onSelectRide={handleSelectRide}
          />
        )}

        {view === 'detail' && selectedRide && (
          <RideDetail
            ride={selectedRide}
            pickup={pickup.label}
            destination={destination?.label ?? ''}
            requestStatus={requestStatus}
            onSendRequest={handleSendRequest}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// -----------------------------------------------------------------------------
// Header
// -----------------------------------------------------------------------------

function Header({ view, onBack }: { view: ViewState; onBack?: () => void }) {
  const title =
    view === 'search' ? 'Find a Ride' : view === 'results' ? 'Rides on this route' : 'Ride Details';
  const subtitle =
    view === 'search'
      ? 'Enter your pickup and destination to see rides that match your route.'
      : view === 'results'
      ? 'Tap a ride to see the full route and request to join.'
      : 'Review the route and everyone on board before you request to join.';

  return (
    <View style={styles.headerRow}>
      {onBack ? (
        <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.7}>
          <Text style={styles.backButtonText}>{'‹'}</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.logoBadge}>
          <Text style={styles.logoBadgeEmoji}>🚗</Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={styles.headerTitle}>{title}</Text>
        <Text style={styles.headerSubtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

// -----------------------------------------------------------------------------
// Search card
// -----------------------------------------------------------------------------
function SearchCard({
  pickup,
  destination,
  activeField,
  onFocusField,
  onSelectSuggestion,
  onMapPick,
  onClearPickup,
  onClearDestination,
  onLocatePress,
  locating,
  onSearch,
}: {
  pickup: Place;
  destination: Place | null;
  activeField: 'pickup' | 'destination' | null;
  onFocusField: (field: 'pickup' | 'destination' | null) => void;
  onSelectSuggestion: (field: 'pickup' | 'destination', place: PlaceSuggestion) => void;
  onMapPick: (lat: number, lng: number) => void;
  onClearPickup: () => void;
  onClearDestination: () => void;
  onLocatePress: () => void;
  locating: boolean;
  onSearch: () => void;
}) {
  const [city, setCity] = useState('Kolkata');
  const [cityModal, setCityModal] = useState(false);

  return (
    <View style={styles.sideBySideRow}>
      {/* Left Column: Form Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Request a ride</Text>

        <TouchableOpacity style={styles.cityRow} onPress={() => setCityModal(true)}>
          <Ionicons name="location" size={16} color={colors.text} />
          <Text style={styles.cityText}>{city}</Text>
          <View style={{ flex: 1 }} />
          <Text style={styles.changeCity}>Change city</Text>
          <Ionicons name="chevron-down" size={14} color={colors.brand} />
        </TouchableOpacity>

        <View style={styles.searchInputsCol}>
          <LocationSearchField
            placeholder="Enter pickup location"
            value={pickup.label}
            dotColor={PICKUP_COLOR}
            active={activeField === 'pickup'}
            onFocusField={() => onFocusField('pickup')}
            onSelect={(p) => onSelectSuggestion('pickup', p)}
            onPinPress={() => onFocusField(activeField === 'pickup' ? null : 'pickup')}
            onLocatePress={onLocatePress}
            locating={locating}
            onClear={onClearPickup}
          />
          <LocationSearchField
            placeholder="Enter destination"
            value={destination?.label ?? ''}
            dotColor={DEST_COLOR}
            active={activeField === 'destination'}
            onFocusField={() => onFocusField('destination')}
            onSelect={(p) => onSelectSuggestion('destination', p)}
            onPinPress={() => onFocusField(activeField === 'destination' ? null : 'destination')}
            onClear={onClearDestination}
          />
          <TouchableOpacity style={styles.searchButton} onPress={onSearch} activeOpacity={0.85}>
            <Text style={styles.searchButtonText}>🔍 Search</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Right Column: Interactive Map */}
      <View style={styles.pickMapWrap}>
        <PickMapCard
          pickup={pickup}
          destination={destination}
          pickMode={activeField}
          onMapPick={onMapPick}
        />
      </View>

      {/* City Picker Modal */}
      <CityPickerModal
        visible={cityModal}
        currentCity={city}
        onClose={() => setCityModal(false)}
        onSelect={(newCity) => setCity(newCity)}
      />
    </View>
  );
}

const hitSlop = { top: 10, bottom: 10, left: 10, right: 10 };

// -----------------------------------------------------------------------------
// Location search field — text input with autocomplete suggestions, a
// "use current location" button (pickup only) and a "pick on map" pin toggle.
// -----------------------------------------------------------------------------

function LocationSearchField({
  placeholder,
  value,
  dotColor,
  active,
  onFocusField,
  onSelect,
  onPinPress,
  onClear,
  onLocatePress,
  locating,
}: {
  placeholder: string;
  value: string;
  dotColor: string;
  active: boolean;
  onFocusField: () => void;
  onSelect: (place: PlaceSuggestion) => void;
  onPinPress: () => void;
  onClear?: () => void;
  onLocatePress?: () => void;
  locating?: boolean;
}) {
  const [text, setText] = useState(value);
  const { results, loading, search, clear } = useLocationSearch();

  useEffect(() => setText(value), [value]);

  return (
    <View>
      <View style={[fieldStyles.inputRow, active && fieldStyles.inputRowActive]}>
        <View style={[fieldStyles.dot, { backgroundColor: dotColor }]} />
        <TextInput
          value={text}
          onChangeText={(t) => {
            setText(t);
            search(t);
          }}
          onFocus={onFocusField}
          placeholder={placeholder}
          style={fieldStyles.input}
          placeholderTextColor={COLORS.textMuted}
        />
        {(loading || locating) && <ActivityIndicator size="small" color={COLORS.coral} />}
        {!!onLocatePress && (
          <TouchableOpacity
            onPress={onLocatePress}
            style={fieldStyles.pinBtn}
            accessibilityLabel="Use current location"
            disabled={locating}
            hitSlop={hitSlop}
          >
            <Ionicons name="locate" size={16} color={COLORS.coral} />
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={onPinPress} style={fieldStyles.pinBtn} accessibilityLabel="Pin on map" hitSlop={hitSlop}>
          <Ionicons name="navigate-outline" size={16} color={active ? COLORS.coral : COLORS.textMuted} />
        </TouchableOpacity>
        {!!text && !!onClear && (
          <TouchableOpacity
            onPress={() => {
              setText('');
              clear();
              onClear();
            }}
            style={fieldStyles.pinBtn}
            hitSlop={hitSlop}
          >
            <Ionicons name="close" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {results.length > 0 && (
        <View style={fieldStyles.dropdown}>
          {results.map((r, i) => (
            <TouchableOpacity
              key={i}
              style={fieldStyles.suggestionRow}
              onPress={() => {
                const fullAddressPlace: PlaceSuggestion = { ...r, label: r.sublabel || r.label };
                onSelect(fullAddressPlace);
                setText(fullAddressPlace.label);
                clear();
              }}
            >
              <Ionicons name="location-outline" size={15} color={COLORS.textMuted} />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={fieldStyles.suggestionTitle} numberOfLines={1}>{r.label}</Text>
                <Text style={fieldStyles.suggestionSub} numberOfLines={1}>{r.sublabel}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 10,
    gap: 8,
  },
  inputRowActive: { borderColor: COLORS.coral, backgroundColor: COLORS.coralSoft },
  dot: { width: 9, height: 9, borderRadius: 5 },
  input: { flex: 1, paddingVertical: 12, fontSize: 14, color: COLORS.text },
  pinBtn: { padding: 4 },
  dropdown: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    marginTop: 4,
    backgroundColor: COLORS.card,
    overflow: 'hidden',
  },
  suggestionRow: { flexDirection: 'row', alignItems: 'center', padding: 10 },
  suggestionTitle: { fontSize: 13.5, fontWeight: '600', color: COLORS.text },
  suggestionSub: { fontSize: 11, color: COLORS.textMuted },
});

// -----------------------------------------------------------------------------
// Pick-on-map card — tap anywhere on the map to set whichever field
// (pickup/destination) is currently active. Mirrors Rider.tsx's RouteMap.
// -----------------------------------------------------------------------------

const PICKUP_COLOR = colors.pickupDot; // green
const DEST_COLOR = colors.destDot; // red

function PickMapCard({
  pickup,
  destination,
  pickMode,
  onMapPick,
}: {
  pickup: Place;
  destination: Place | null;
  pickMode: 'pickup' | 'destination' | null;
  onMapPick: (lat: number, lng: number) => void;
}) {
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'map-click' && pickMode) onMapPick(e.data.lat, e.data.lng);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [pickMode, onMapPick]);

  const nativeMapRef = useRef<any>(null);
  const centerLat = pickup.latitude || destination?.latitude || 22.5677;
  const centerLng = pickup.longitude || destination?.longitude || 88.3572;
  const hasBothPoints = !!pickup.latitude && !!destination;

  // Once both pickup and destination are set, fetch a road-following route
  // between them (OSRM's free demo server — fine for dev/testing, swap for a
  // production directions provider for real traffic). Falls back to a
  // straight line if the request fails.
  const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);
  useEffect(() => {
    if (!hasBothPoints || !destination) {
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
          setRouteCoords([]);
        }
      } catch {
        if (!cancelled) setRouteCoords([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hasBothPoints, pickup.latitude, pickup.longitude, destination?.latitude, destination?.longitude]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (!nativeMapRef.current) return;
    nativeMapRef.current.animateToRegion(
      { latitude: centerLat, longitude: centerLng, latitudeDelta: 0.08, longitudeDelta: 0.08 },
      500
    );
  }, [centerLat, centerLng]);

  if (Platform.OS === 'web') {
    const lineCoords =
      hasBothPoints && destination
        ? routeCoords.length > 0
          ? routeCoords.map((c) => [c.latitude, c.longitude])
          : [[pickup.latitude, pickup.longitude], [destination.latitude, destination.longitude]]
        : [];
    const html = `
      <!DOCTYPE html><html><head>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
      <style>html,body,#map{height:100%;margin:0;}</style>
      </head><body>
      <div id="map"></div>
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <script>
        const map = L.map('map').setView([${centerLat}, ${centerLng}], 12);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
        const pin = (color) => L.divIcon({className:'',html:'<div style="width:14px;height:14px;border-radius:7px;background:'+color+';border:2px solid white;"></div>'});
        ${pickup.latitude ? `L.marker([${pickup.latitude}, ${pickup.longitude}], {icon: pin('${PICKUP_COLOR}')}).addTo(map);` : ''}
        ${destination ? `L.marker([${destination.latitude}, ${destination.longitude}], {icon: pin('${DEST_COLOR}')}).addTo(map);` : ''}
        ${lineCoords.length > 0 ? `L.polyline(${JSON.stringify(lineCoords)}, {color:'${colors.brand}', weight:4}).addTo(map);` : ''}
        map.on('click', function(e) {
          window.parent.postMessage({ type: 'map-click', lat: e.latlng.lat, lng: e.latlng.lng }, '*');
        });
      </script>
      </body></html>
    `;
    return (
      <View style={pickMapStyles.container}>
        {/* @ts-ignore */}
        <iframe title="pick-location-map" srcDoc={html} style={{ border: 0, width: '100%', height: '100%' }} />
        {pickMode && (
          <View style={pickMapStyles.pickBanner} pointerEvents="none">
            <Text style={pickMapStyles.pickBannerText}>Tap the map to set {pickMode}</Text>
          </View>
        )}
      </View>
    );
  }

  if (!MapView) {
    return (
      <View style={[pickMapStyles.container, pickMapStyles.mapEmpty]}>
        <Ionicons name="map-outline" size={24} color={COLORS.textMuted} />
        <Text style={{ color: COLORS.textMuted, marginTop: 6, fontSize: 12 }}>
          Install react-native-maps to render the native map
        </Text>
      </View>
    );
  }

  return (
    <View style={pickMapStyles.container}>
      <MapView
        ref={nativeMapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_GOOGLE}
        initialRegion={{ latitude: centerLat, longitude: centerLng, latitudeDelta: 0.08, longitudeDelta: 0.08 }}
        onPress={(e: any) => {
          if (pickMode) onMapPick(e.nativeEvent.coordinate.latitude, e.nativeEvent.coordinate.longitude);
        }}
      >
        {!!pickup.latitude && (
          <Marker coordinate={pickup} title={pickup.label}>
            <View style={[pickMapStyles.pin, { backgroundColor: PICKUP_COLOR }]} />
          </Marker>
        )}
        {destination && (
          <Marker coordinate={destination} title={destination.label}>
            <View style={[pickMapStyles.pin, { backgroundColor: DEST_COLOR }]} />
          </Marker>
        )}
        {hasBothPoints && destination && (
          <Polyline
            coordinates={routeCoords.length > 0 ? routeCoords : [pickup, destination]}
            strokeColor={colors.brand}
            strokeWidth={4}
          />
        )}
      </MapView>
      {pickMode && (
        <View style={pickMapStyles.pickBanner} pointerEvents="none">
          <Text style={pickMapStyles.pickBannerText}>Tap the map to set {pickMode}</Text>
        </View>
      )}
    </View>
  );
}

const pickMapStyles = StyleSheet.create({
  container: { flex: 1, minHeight: 180, borderRadius: 14, overflow: 'hidden', position: 'relative', backgroundColor: '#EEF0F3' },
  mapEmpty: { alignItems: 'center', justifyContent: 'center' },
  pin: { width: 16, height: 16, borderRadius: 8, borderWidth: 3, borderColor: '#fff' },
  pickBanner: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: COLORS.coral,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  pickBannerText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});

// -----------------------------------------------------------------------------
// Results list
// -----------------------------------------------------------------------------

function ResultsList({
  pickup,
  destination,
  rides,
  onSelectRide,
}: {
  pickup: string;
  destination: string;
  rides: RideMatch[];
  onSelectRide: (id: string) => void;
}) {
  return (
    <View style={{ marginTop: 20 }}>
      <View style={styles.resultsHeaderRow}>
        <Text style={styles.sectionTitle}>Rides on this route</Text>
        <View style={styles.countPill}>
          <Text style={styles.countPillText}>{rides.length} rides found</Text>
        </View>
      </View>

      {rides.map((ride) => (
        <RideCard key={ride.id} ride={ride} onPress={() => onSelectRide(ride.id)} />
      ))}

      {rides.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>
            No rides found from {pickup} to {destination} right now. Try again in a few minutes.
          </Text>
        </View>
      )}
    </View>
  );
}

function RideCard({ ride, onPress }: { ride: RideMatch; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.rideCard} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.rideCardTopRow}>
        <View style={styles.availableBadge}>
          <View style={styles.availableDot} />
          <Text style={styles.availableBadgeText}>AVAILABLE</Text>
        </View>
        <Text style={styles.leavingText}>Leaving {ride.leavingInMinutes}m</Text>
      </View>

      <View style={styles.routeRow}>
        <Text style={styles.routeText}>{ride.routeFrom}</Text>
        <Text style={styles.routeArrow}>{'  ────────➤  '}</Text>
        <Text style={styles.routeText}>{ride.routeTo}</Text>
      </View>

      <View style={styles.routeNoteRow}>
        <Text style={styles.pinSmall}>📍</Text>
        <Text style={styles.routeNoteText}>Your destination is on the route</Text>
      </View>

      {ride.etaToNearestStopMinutes != null && (
        <View style={styles.routeNoteRow}>
          <Text style={styles.pinSmall}>🕒</Text>
          <Text style={styles.routeNoteText}>
            Reaches nearest stop in ~{ride.etaToNearestStopMinutes} min
          </Text>
        </View>
      )}

      <View style={styles.metaRow}>
        <Text style={styles.metaItem}>🚗 {ride.carName}</Text>
        <Text style={styles.metaItem}>
          👥 {ride.seats.filled} of {ride.seats.total} available
        </Text>
      </View>
      <View style={styles.metaRow}>
        {ride.ac && <Text style={styles.metaItem}>❄️ AC</Text>}
        <Text style={styles.metaItem}>🪑 {ride.seats.total} seats</Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.driverRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{ride.driverName.charAt(0)}</Text>
        </View>
        <Text style={styles.driverName}>{ride.driverName}</Text>
        <Text style={styles.driverRating}>⭐ {ride.driverRating}</Text>
        <View style={{ flex: 1 }} />
        <Text style={styles.priceText}>₹{ride.pricePerRider} / rider</Text>
      </View>
    </TouchableOpacity>
  );
}

// -----------------------------------------------------------------------------
// Ride detail (map + occupants + request)
// -----------------------------------------------------------------------------

function RideDetail({
  ride,
  pickup,
  destination,
  requestStatus,
  onSendRequest,
}: {
  ride: RideMatch;
  pickup: string;
  destination: string;
  requestStatus: 'idle' | 'sending' | 'sent';
  onSendRequest: () => void;
}) {
  return (
    <View style={{ marginTop: 16 }}>
      <View style={styles.summaryCard}>
        <View style={styles.routeRow}>
          <Text style={styles.routeText}>{ride.routeFrom}</Text>
          <Text style={styles.routeArrow}>{'  ────────➤  '}</Text>
          <Text style={styles.routeText}>{ride.routeTo}</Text>
        </View>
        <View style={styles.driverRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{ride.driverName.charAt(0)}</Text>
          </View>
          <Text style={styles.driverName}>{ride.driverName}</Text>
          <Text style={styles.driverRating}>⭐ {ride.driverRating}</Text>
          <View style={{ flex: 1 }} />
          <Text style={styles.priceText}>₹{ride.pricePerRider} / rider</Text>
        </View>
      </View>

      <MockRouteMap stops={ride.stops} />

      <View style={styles.cabCard}>
        <Text style={styles.cabCardTitle}>Current Inside the Cab</Text>
        {ride.occupants.map((o, i) => (
          <Text key={o.id} style={styles.cabOccupant}>
            {i + 1}. {o.name} ({o.role})
          </Text>
        ))}
        <Text style={styles.cabCountText}>
          🪑 {ride.seats.filled} of {ride.seats.total} seats filled — Currently{' '}
          {ride.occupants.length} people on board
        </Text>

        <TouchableOpacity
          style={[
            styles.requestButton,
            requestStatus === 'sent' && styles.requestButtonSent,
            requestStatus === 'sending' && styles.requestButtonSending,
          ]}
          onPress={onSendRequest}
          activeOpacity={0.85}
          disabled={requestStatus !== 'idle'}
        >
          <Text style={styles.requestButtonText}>
            {requestStatus === 'idle'
              ? 'Send Join Request'
              : requestStatus === 'sending'
              ? 'Sending…'
              : 'Request Sent ✓'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.requestHint}>
          Your request to board at {pickup || '—'} and drop off at {destination || '—'} will be
          sent to the driver and all passengers for approval.
        </Text>
      </View>
    </View>
  );
}

// A lightweight, dependency-free "map" built from Views rather than a real
// map SDK (react-native-maps needs native linking + API keys, which won't
// run in a single-file preview). It plots the ride's stops on a card and
// connects them with a route line, mirroring the reference design.
function MockRouteMap({ stops }: { stops: RideStop[] }) {
  return (
    <View style={styles.mapCard}>
      <View style={styles.mapLegendRow}>
        <LegendDot color={COLORS.coral} label="Active Ride" />
        <LegendDot color={COLORS.purple} label="On Route" />
        <LegendDot color={COLORS.blue} label="Request" />
      </View>

      <View style={styles.mapCanvas}>
        {/* connecting line segments between consecutive stops */}
        {stops.slice(0, -1).map((stop, i) => {
          const next = stops[i + 1];
          return <RouteSegment key={`seg-${stop.id}`} from={stop} to={next} />;
        })}

        {/* stop markers */}
        {stops.map((stop) => (
          <View
            key={stop.id}
            style={[
              styles.mapMarkerWrap,
              { left: `${stop.x}%`, top: `${stop.y}%` },
            ]}
          >
            <View
              style={[
                styles.mapDot,
                {
                  backgroundColor:
                    stop.kind === 'active'
                      ? COLORS.coral
                      : stop.kind === 'pickup'
                      ? COLORS.blue
                      : COLORS.purple,
                },
              ]}
            />
            <View style={styles.mapLabelBubble}>
              <Text style={styles.mapLabelTitle}>{stop.label}</Text>
              <Text style={styles.mapLabelSub}>{stop.sublabel}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

function RouteSegment({ from, to }: { from: RideStop; to: RideStop }) {
  // Compute a rotated bar between two percentage-based points so the
  // segments look like connected roads without any map SDK.
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const lengthPercent = Math.sqrt(dx * dx + dy * dy);
  const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;

  return (
    <View
      style={{
        position: 'absolute',
        left: `${from.x}%`,
        top: `${from.y}%`,
        width: `${lengthPercent}%`,
        height: 4,
        backgroundColor: COLORS.coral,
        borderRadius: 2,
        transform: [{ translateY: -2 }, { rotate: `${angleDeg}deg` }],
        transformOrigin: '0% 50%',
        opacity: 0.85,
      }}
    />
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: COLORS.bg,
  },
  screen: {
    flex: 1,
    minWidth: 0,
  },
  screenContent: {
    padding: 18,
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  backButtonText: {
    fontSize: 22,
    color: COLORS.coral,
    fontWeight: '700',
    marginTop: -2,
  },
  logoBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.coral,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  logoBadgeEmoji: {
    fontSize: 18,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 2,
  },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  pin: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  inputTextWrap: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginBottom: 2,
  },
  input: {
    fontSize: 15,
    color: COLORS.text,
    fontWeight: '600',
    padding: 0,
  },
  clearX: {
    color: COLORS.textMuted,
    fontSize: 14,
    paddingHorizontal: 4,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 10,
  },
  searchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  searchRowWithMap: {
    alignItems: 'stretch',
  },
  searchInputsCol: {
    flexGrow: 1,
    flexBasis: 240,
    gap: 10,
    marginTop:150,
    justifyContent: 'center',
  },
  searchButton: {
    backgroundColor: COLORS.coral,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  searchButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  resultsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.text,
  },
  countPill: {
    backgroundColor: COLORS.coralSoft,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  countPillText: {
    color: COLORS.coralDark,
    fontSize: 12,
    fontWeight: '700',
  },
  emptyState: {
    padding: 20,
    alignItems: 'center',
  },
  emptyStateText: {
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  rideCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  rideCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  availableBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.greenSoft,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  availableDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.green,
    marginRight: 6,
  },
  availableBadgeText: {
    color: COLORS.green,
    fontSize: 11,
    fontWeight: '800',
  },
  leavingText: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  routeText: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.text,
  },
  routeArrow: {
    color: COLORS.coral,
    fontWeight: '700',
  },
  routeNoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  pinSmall: {
    marginRight: 6,
    fontSize: 12,
  },
  routeNoteText: {
    color: COLORS.textMuted,
    fontSize: 12.5,
  },
  metaRow: {
    flexDirection: 'row',
    marginTop: 6,
  },
  metaItem: {
    fontSize: 13,
    color: COLORS.text,
    marginRight: 18,
    fontWeight: '600',
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.purple,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  avatarText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  driverName: {
    fontWeight: '700',
    color: COLORS.text,
    marginRight: 8,
    fontSize: 14,
  },
  driverRating: {
    color: '#E0A32D',
    fontSize: 13,
    fontWeight: '600',
  },
  priceText: {
    color: COLORS.coralDark,
    fontWeight: '800',
    fontSize: 15,
  },
  summaryCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  mapCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  mapLegendRow: {
    flexDirection: 'row',
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 5,
  },
  legendLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  mapCanvas: {
    height: 340,
    borderRadius: 14,
    backgroundColor: '#F4F1EE',
    overflow: 'hidden',
    position: 'relative',
  },
  mapMarkerWrap: {
    position: 'absolute',
    alignItems: 'flex-start',
    transform: [{ translateX: -6 }, { translateY: -6 }],
  },
  mapDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#fff',
  },
  mapLabelBubble: {
    marginTop: 4,
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    maxWidth: 140,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  mapLabelTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.text,
  },
  mapLabelSub: {
    fontSize: 9.5,
    color: COLORS.textMuted,
  },
  cabCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  cabCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 8,
  },
  cabOccupant: {
    fontSize: 14,
    color: COLORS.text,
    marginBottom: 4,
    fontWeight: '600',
  },
  cabCountText: {
    fontSize: 12.5,
    color: COLORS.textMuted,
    marginTop: 6,
    marginBottom: 14,
  },
  requestButton: {
    backgroundColor: COLORS.coral,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  requestButtonSending: {
    backgroundColor: COLORS.coralDark,
    opacity: 0.8,
  },
  requestButtonSent: {
    backgroundColor: COLORS.green,
  },
  requestButtonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
  },
  requestHint: {
    fontSize: 11.5,
    color: COLORS.textMuted,
    marginTop: 10,
    lineHeight: 16,
  },
  // New container that aligns the card and the map side-by-side
  sideBySideRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    alignItems: 'stretch',
    marginTop: 14,
  },

  // Adjusted card styling for a side-by-side column
  card: {
  backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 20,
    width: 360,           // Fixed width that matches reference design
    flexShrink: 0,        // Prevents shrinking
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    borderWidth: 1,
    borderColor: COLORS.border,
    height: 350,          // Fixed height that matches reference design
},

  // Adjusted map wrapper to stretch across the remaining width
  pickMapWrap: {
    flexGrow: 1,
    flexBasis: 400,
    minHeight: 480,       // Ensures the map has a solid height next to the card
    borderRadius: 18,
    overflow: 'hidden',
  },

   cards: { backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.xl, borderWidth: 1, borderColor: colors.border },
  cardWide: { width: 460 },
  cardWideCollapsed: { width: 360 },
  cardTitle: { fontSize: 18, fontWeight: "800", color: colors.text, marginBottom:12 },

  cityRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: -170 },
  cityText: { fontSize: 14.5, fontWeight: "700", color: colors.text },
  changeCity: { fontSize: 13, color: colors.brand, fontWeight: "600", marginRight: 2 },

});
const screenStyles = StyleSheet.create({
  root: { flex: 1, flexDirection: "row", backgroundColor: colors.bgApp },
  mobileSidebarOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 20, flexDirection: "row" },
  mobileSidebarPanel: { width: 248, height: "100%" },
  cards: { backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.xl, borderWidth: 1, borderColor: colors.border },
  cardWide: { width: 460 },
  cardWideCollapsed: { width: 360 },
  cardTitle: { fontSize: 19, fontWeight: "800", color: colors.text, marginBottom: spacing.lg },

  cityRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.lg },
  cityText: { fontSize: 14.5, fontWeight: "700", color: colors.text },
  changeCity: { fontSize: 13, color: colors.brand, fontWeight: "600", marginRight: 2 },

})