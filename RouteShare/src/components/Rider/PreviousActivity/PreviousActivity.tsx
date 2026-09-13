import React,{useState, useEffect} from 'react';
import { ImageSourcePropType } from 'react-native'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Linking,
  Alert,
  Platform,  useWindowDimensions,
  ActivityIndicator, 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons'; 
import AsyncStorage from "../../lib/storage";
import { API_URL } from '../../config';          
import { useRouter, useLocalSearchParams } from 'expo-router';   
import { Sidebar } from '../Sidebar';    
// -----------------------------------------------------------------------
// Theme
// -----------------------------------------------------------------------
const CORAL = '#F65E5E';
const CORAL_LIGHT = '#FDEDED';
const DARK = '#111827';
const GRAY = '#6B7280';
const BORDER = '#EEF0F3';
const PAGE_BG = '#F7F8FA';
const CARD_BG = '#FFFFFF';
const GREEN = '#22C55E';

// -----------------------------------------------------------------------
// Types & mock data
// -----------------------------------------------------------------------
type Ride = {
  id: string;
  rideType: string;
  date: string;
  // rideRef: string;
  carImage: ImageSourcePropType;
  pickupTitle: string;
  pickupSubtitle: string;
  destinationTitle: string;
  destinationSubtitle: string;
  fare: string;
  paymentMethod: string;
  driverName: string;
  driverRating: string|null;
  driverImage: string;
  driverPhone: string;
  rideOptions: string[];
  status: string;
};
const OPTION_LABELS: Record<string, string> = {
  shared_ride: 'Shared ride',
  no_shared_ride: 'No shared ride',

};
// DB gives one comma-separated address string; split it into a short title
// (before the first comma) and a subtitle (the rest) to match the card layout.
function splitLabel(label?: string) {
  if (!label) return { title: '', subtitle: '' };
  const idx = label.indexOf(',');
  if (idx === -1) return { title: label, subtitle: '' };
  return { title: label.slice(0, idx), subtitle: label.slice(idx + 1).trim() };
}

function formatRideDate(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  const day = d.toLocaleDateString('en-US', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  return `${day} • ${time}`;
}

// The DB has no car-photo column — this is purely decorative, keyed off
// ride_class, same placeholder images the mock data used.
const CAR_IMAGES: Record<string, ImageSourcePropType> = {
  'Go Mini': require('../../../../assets/images/mini.png'),
  'Go Sedan': require('../../../../assets/images/sedan.png'),
  'Go SUV': require('../../../../assets/images/suv.png'),
  'Go XL': require('../../../../assets/images/xl.png'),
};
function mapRowToRide(row: any): Ride {
  const pickup = splitLabel(row.pickup_label);
  const destination = splitLabel(row.destination_label);
  return {
    id: String(row.id),
    rideType: row.ride_class ?? 'Ride',
    date: formatRideDate(row.requested_at),
    // rideRef: row.ride_code ?? `#${row.id}`,
    carImage: CAR_IMAGES[row.ride_class] ?? CAR_IMAGES['Go Mini'],
    pickupTitle: pickup.title,
    pickupSubtitle: pickup.subtitle,
    destinationTitle: destination.title,
    destinationSubtitle: destination.subtitle,
        fare: `₹${row.price ?? 0}`,
    paymentMethod: row.payment_method
      ? row.payment_method.charAt(0).toUpperCase() + row.payment_method.slice(1)
      : 'Cash',
    driverName: row.driver_name ?? 'Driver',
    driverRating: row.rider_given_rating != null ? `${row.rider_given_rating}` : null,
    status: row.status,
    driverImage: '',   // no photo column in your schema — RideCard already has this <Image> commented out
    driverPhone: '',   // no phone column in your rides/users query — call button is already commented out too
    rideOptions: Array.isArray(row.ride_options) ? row.ride_options : [],
  };
}
// -----------------------------------------------------------------------
// Ride card
// -----------------------------------------------------------------------
function RideCard({ ride }: { ride: Ride }) {
  const handleCall = () => {
    const phoneUrl = Platform.select({
      ios: `telprompt:${ride.driverPhone}`,
      android: `tel:${ride.driverPhone}`,
      default: `tel:${ride.driverPhone}`,
    }) as string;

    Linking.canOpenURL(phoneUrl)
      .then((supported) => {
        if (supported) {
          Linking.openURL(phoneUrl);
        } else {
          Alert.alert('Call driver', `${ride.driverName}: ${ride.driverPhone}`);
        }
      })
      .catch(() => {
        Alert.alert('Call driver', `${ride.driverName}: ${ride.driverPhone}`);
      });
  };

  // const handleRefPress = () => {
  //   Alert.alert('Ride reference', `Reference ID ${ride.rideRef} copied to clipboard.`);
  // };

  return (
    <View style={styles.card}>
      {/* Card header */}
      <TouchableOpacity activeOpacity={0.8} onPress={() => Alert.alert(ride.rideType, `${ride.date}\n`)}>
        <View style={styles.cardHeader}>
          <Image source={ ride.carImage } style={styles.carImage} />
          <View style={{ flex: 1 }}>
            <Text style={styles.rideType}>{ride.rideType}</Text>
            <View style={styles.dateRow}>
              <Text style={styles.dateText}>{ride.date}</Text>
              <Text style={styles.dot}> • </Text>
              {/* <TouchableOpacity onPress={handleRefPress}>
                <Text style={styles.refText}>{ride.rideRef}</Text>
              </TouchableOpacity> */}
            </View>
          </View>
        </View>
      </TouchableOpacity>

      <View style={styles.divider} />

      {/* Route */}
      <View style={styles.routeSection}>
        <View style={styles.routeRow}>
          <View style={styles.routeMarkers}>
            <View style={[styles.dotMarker, { backgroundColor: GREEN }]} />
            <View style={styles.connectorLine} />
            <View style={[styles.dotMarker, { backgroundColor: CORAL }]} />
          </View>
          <View style={styles.routeTextCol}>
            <View style={styles.routeBlock}>
              <Text style={styles.routeLabel}>Pickup</Text>
              <Text style={styles.routeTitle}>{ride.pickupTitle}</Text>
              <Text style={styles.routeSubtitle}>{ride.pickupSubtitle}</Text>
            </View>
            <View style={[styles.routeBlock, { marginTop: 18 }]}>
              <Text style={styles.routeLabel}>Destination</Text>
              <Text style={styles.routeTitle}>{ride.destinationTitle}</Text>
              <Text style={styles.routeSubtitle}>{ride.destinationSubtitle}</Text>
            </View>
          </View>
        </View>
      </View>
        {/* Ride options */}
      {ride.rideOptions.length > 0 && (
        <View style={styles.optionsRow}>
          {ride.rideOptions.map((key) => (
            <View key={key} style={styles.optionPill}>
              <Text style={styles.optionPillText}>{OPTION_LABELS[key] ?? key}</Text>
            </View>
          ))}
        </View>
      )}
      {/* Fare */}
      <TouchableOpacity
        activeOpacity={0.85}
        style={styles.fareBox}
        onPress={() =>
          Alert.alert('Payment details', `Total paid: ${ride.fare}\nMethod: ${ride.paymentMethod}`)
        }
      >
        <View>
          <Text style={styles.fareAmount}>{ride.fare}</Text>
          <Text style={styles.fareLabel}>Total Paid</Text>
        </View>
        <View style={{ alignItems: 'flex-start' }}>
          <Text style={styles.paymentMethod}>{ride.paymentMethod}</Text>
          <Text style={styles.fareLabel}>Payment method</Text>
        </View>
      </TouchableOpacity>

      <View style={styles.divider} />

      {/* Driver */}
      <View style={styles.driverRow}>
             {/* Driver */}
     
        <TouchableOpacity
          style={styles.driverInfo}
          activeOpacity={0.8}
          onPress={() =>
            Alert.alert(
              ride.driverName,
              ride.status === 'cancelled'
                ? 'This ride was cancelled.'
                : ride.driverRating
                ? `Rating: ${ride.driverRating} ★`
                : 'Not yet rated.'
            )
          }
        >
          {/* <Image source={{ uri: ride.driverImage }} style={styles.driverAvatar} /> */}
          <View>
            <Text style={styles.driverName}>{ride.driverName}</Text>
            <View style={styles.ratingRow}>
              {ride.status === 'cancelled' ? (
                <Text style={[styles.ratingText, { color: '#d13b3b', fontWeight: '700' }]}>Cancelled</Text>
              ) : ride.driverRating ? (
                <>
                  <Text style={styles.ratingText}>{ride.driverRating} </Text>
                  <Text style={styles.star}>★</Text>
                </>
              ) : (
                <Text style={[styles.ratingText, { color: GRAY }]}>Not yet rated</Text>
              )}
            </View>
          </View>
        </TouchableOpacity>

        {/* <TouchableOpacity
          style={styles.callButton}
          activeOpacity={0.7}
          onPress={handleCall}
          accessibilityRole="button"
          accessibilityLabel={`Call ${ride.driverName}`}
        >
          <Text style={styles.callIcon}>📞</Text>
        </TouchableOpacity> */}
      </View>
    </View>
  );
}

// -----------------------------------------------------------------------
// Screen
// -----------------------------------------------------------------------
export default function PreviousActivity() {
   const router = useRouter();
  const { width } = useWindowDimensions();
  const isWide = width >= 980;
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Same param convention Rider.tsx uses, so the name carries across screens.
  const { name: nameParam } = useLocalSearchParams<{ name?: string | string[] }>();
  const riderName = (Array.isArray(nameParam) ? nameParam[0] : nameParam)?.trim() || 'Rider';
  const [rides, setRides] = useState<Ride[]>([]);
const [loadingRides, setLoadingRides] = useState(true);
const [ridesError, setRidesError] = useState<string | null>(null);

useEffect(() => {
  let cancelled = false;
  (async () => {
    try {
      const userId = await AsyncStorage.getItem('userId');
      if (!userId) {
        if (!cancelled) { setRides([]); setLoadingRides(false); }
        return;
      }
      const res = await fetch(`${API_URL}/rides/history/${userId}`);
      if (!res.ok) throw new Error('Failed to load ride history');
      const rows = await res.json();
      if (!cancelled) setRides(rows.map(mapRowToRide));
    } catch (err) {
      console.error('Could not load ride history:', err);
      if (!cancelled) setRidesError('Could not load your ride history.');
    } finally {
      if (!cancelled) setLoadingRides(false);
    }
  })();
  return () => { cancelled = true; };
}, []);
  const goTo = (key: string) => {
    if (key === 'ride') {
      router.push({ pathname: '/rider', params: { name: riderName, username: riderName } });
    }
    if (key === 'chat') {
      router.push({ pathname: '/chat', params: { name: riderName, username: riderName } });
    }
    if (key === 'ongoing_rides') {
      router.push({ pathname: '/shareRide', params: { name: riderName, username: riderName } });
    }
    // 'activity' is this screen — nothing to do.
    // 'chat' has no standalone screen yet (chat currently only lives inside
    // confirmPage's modal during an active ride) — wire this up once/if you
    // build a dedicated chat-history screen.
  };
  return (
    <View style={styles.root}>
      {isWide ? (
        <Sidebar
          activeKey="activity"
          onSelectItem={goTo}
          user={{ name: riderName, profileLabel: 'View profile' }}
        />
      ) : (
        sidebarOpen && (
          <View style={styles.mobileSidebarOverlay}>
            <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setSidebarOpen(false)} />
            <View style={styles.mobileSidebarPanel}>
              <Sidebar
                activeKey="activity"
                onSelectItem={(key) => { setSidebarOpen(false); goTo(key); }}
                user={{ name: riderName, profileLabel: 'View profile' }}
              />
            </View>
          </View>
        )
      )}

      <ScrollView style={styles.page} contentContainerStyle={styles.pageContent}>
        {!isWide && (
          <TouchableOpacity onPress={() => setSidebarOpen(true)} style={{ marginBottom: 12 }}>
            <Ionicons name="menu" size={24} color={DARK} />
          </TouchableOpacity>
        )}

        <Text style={styles.pageTitle}>Previous activity</Text>
        <Text style={styles.pageSubtitle}>Here's a summary of your past rides.</Text>

       {loadingRides ? (
  <ActivityIndicator color={CORAL} style={{ marginTop: 40 }} />
) : ridesError ? (
  <Text style={styles.pageSubtitle}>{ridesError}</Text>
) : rides.length === 0 ? (
  <Text style={styles.pageSubtitle}>No past rides yet — once you complete a trip, it'll show up here.</Text>
) : (
  <View style={styles.cardsRow}>
    {rides.map((ride) => (
      <RideCard key={ride.id} ride={ride} />
    ))}
  </View>
)}

      </ScrollView>
    </View>
  );
}

// -----------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------
// const CARD_WIDTH = '32%';

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row' },   // NEW — sidebar + content side by side on wide screens
  mobileSidebarOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 20, flexDirection: 'row' },   // NEW
  mobileSidebarPanel: { width: 248, height: '100%' },   // NEW

  page: {
    flex: 1,
    backgroundColor: PAGE_BG,
  },
  pageContent: {
    padding: 28,
    paddingBottom: 48,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: DARK,
  },
  pageSubtitle: {
    fontSize: 14,
    color: GRAY,
    marginTop: 4,
    marginBottom: 22,
  },
  cardsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap:20,
  },
  card: {
    width: 380,
    maxWidth:'100%',
    minWidth: 260,
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: BORDER,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 10,
      },
      android: { elevation: 1 },
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  carImage: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: CORAL_LIGHT,
    marginRight: 12,
  },
  rideType: {
    fontSize: 16,
    fontWeight: '700',
    color: DARK,
    marginBottom: 3,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  dateText: {
    fontSize: 12.5,
    color: GRAY,
  },
  dot: {
    fontSize: 12.5,
    color: GRAY,
  },
  refText: {
    fontSize: 12.5,
    color: CORAL,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: BORDER,
    marginVertical: 16,
  },
  routeSection: {
    marginBottom: 4,
  },
  routeRow: {
    flexDirection: 'row',
  },
  routeMarkers: {
    alignItems: 'center',
    width: 14,
    marginRight: 12,
    paddingTop: 4,
  },
  dotMarker: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  connectorLine: {
    width: 1,
    flex: 1,
    minHeight: 46,
    backgroundColor: BORDER,
    marginVertical: 4,
  },
  routeTextCol: {
    flex: 1,
  },
  routeBlock: {},
  routeLabel: {
    fontSize: 12.5,
    color: GRAY,
    marginBottom: 3,
  },
  routeTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: DARK,
    marginBottom: 2,
  },
  routeSubtitle: {
    fontSize: 12.5,
    color: GRAY,
  },
  fareBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: CORAL_LIGHT,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 18,
    marginBottom: 4,
  },
  fareAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: CORAL,
    marginBottom: 2,
  },
  paymentMethod: {
    fontSize: 15,
    fontWeight: '700',
    color: DARK,
    marginBottom: 2,
  },
  fareLabel: {
    fontSize: 11.5,
    color: GRAY,
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  driverAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 10,
  },
  driverName: {
    fontSize: 14.5,
    fontWeight: '700',
    color: DARK,
    marginBottom: 3,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 13,
    color: GRAY,
  },
  star: {
    fontSize: 13,
    color: CORAL,
  },
  callButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: CORAL_LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callIcon: {
    fontSize: 18,
  },
  optionsRow: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: 6,
  marginTop: 14,
},
optionPill: {
  backgroundColor: CORAL_LIGHT,
  borderRadius: 999,
  paddingVertical: 4,
  paddingHorizontal: 10,
},
optionPillText: {
  fontSize: 11.5,
  color: CORAL,
  fontWeight: '600',
},
});
