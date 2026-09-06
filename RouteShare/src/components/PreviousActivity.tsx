import React,{useState} from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';           // NEW — for the mobile menu icon
import { useRouter, useLocalSearchParams } from 'expo-router';   // NEW
import { Sidebar } from './Sidebar';    
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
  rideRef: string;
  carImage: string;
  pickupTitle: string;
  pickupSubtitle: string;
  destinationTitle: string;
  destinationSubtitle: string;
  fare: string;
  paymentMethod: string;
  driverName: string;
  driverRating: string;
  driverImage: string;
  driverPhone: string;
};

const RIDES: Ride[] = [
  {
    id: '1',
    rideType: 'Go Sedan',
    date: 'Mon, 27 May 2024 • 08:45 AM',
    rideRef: '#RTE12873',
    carImage: 'https://images.unsplash.com/photo-1550355291-bbee04a92027?w=200&q=60',
    pickupTitle: 'Salt Lake, Sector V',
    pickupSubtitle: 'Kolkata, West Bengal 700091',
    destinationTitle: 'Park Street',
    destinationSubtitle: 'Kolkata, West Bengal 700016',
    fare: '₹278',
    paymentMethod: 'Cash',
    driverName: 'Amit Kumar',
    driverRating: '4.8',
    driverImage: 'https://randomuser.me/api/portraits/men/32.jpg',
    driverPhone: '+911234567890',
  },
  {
    id: '2',
    rideType: 'Go Mini',
    date: 'Sun, 26 May 2024 • 10:15 AM',
    rideRef: '#RTE12812',
    carImage: 'https://images.unsplash.com/photo-1502877338535-766e1452684a?w=200&q=60',
    pickupTitle: 'New Town, Action Area 1',
    pickupSubtitle: 'Kolkata, West Bengal 700156',
    destinationTitle: 'Howrah Station',
    destinationSubtitle: 'Kolkata, West Bengal 711101',
    fare: '₹198',
    paymentMethod: 'UPI',
    driverName: 'Rahul Das',
    driverRating: '4.7',
    driverImage: 'https://randomuser.me/api/portraits/men/45.jpg',
    driverPhone: '+911234567891',
  },
  {
    id: '3',
    rideType: 'Go SUV',
    date: 'Sat, 25 May 2024 • 07:30 PM',
    rideRef: '#RTE12745',
    carImage: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=200&q=60',
    pickupTitle: 'Ballygunge',
    pickupSubtitle: 'Kolkata, West Bengal 700019',
    destinationTitle: 'Netaji Subhas Airport',
    destinationSubtitle: 'Kolkata, West Bengal 700052',
    fare: '₹412',
    paymentMethod: 'Card',
    driverName: 'Sourav Mondal',
    driverRating: '4.9',
    driverImage: 'https://randomuser.me/api/portraits/men/52.jpg',
    driverPhone: '+911234567892',
  },
];

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

  const handleRefPress = () => {
    Alert.alert('Ride reference', `Reference ID ${ride.rideRef} copied to clipboard.`);
  };

  return (
    <View style={styles.card}>
      {/* Card header */}
      <TouchableOpacity activeOpacity={0.8} onPress={() => Alert.alert(ride.rideType, `${ride.date}\n${ride.rideRef}`)}>
        <View style={styles.cardHeader}>
          <Image source={{ uri: ride.carImage }} style={styles.carImage} />
          <View style={{ flex: 1 }}>
            <Text style={styles.rideType}>{ride.rideType}</Text>
            <View style={styles.dateRow}>
              <Text style={styles.dateText}>{ride.date}</Text>
              <Text style={styles.dot}> • </Text>
              <TouchableOpacity onPress={handleRefPress}>
                <Text style={styles.refText}>{ride.rideRef}</Text>
              </TouchableOpacity>
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
        <TouchableOpacity
          style={styles.driverInfo}
          activeOpacity={0.8}
          onPress={() => Alert.alert(ride.driverName, `Rating: ${ride.driverRating} ★`)}
        >
          {/* <Image source={{ uri: ride.driverImage }} style={styles.driverAvatar} /> */}
          <View>
            <Text style={styles.driverName}>{ride.driverName}</Text>
            <View style={styles.ratingRow}>
              <Text style={styles.ratingText}>{ride.driverRating} </Text>
              <Text style={styles.star}>★</Text>
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

  const goTo = (key: string) => {
    if (key === 'ride') {
      router.push({ pathname: '/rider', params: { name: riderName, username: riderName } });
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

        <View style={styles.cardsRow}>
          {RIDES.map((ride) => (
            <RideCard key={ride.id} ride={ride} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

// -----------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------
const CARD_WIDTH = '32%';

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
    justifyContent: 'space-between',
  },
  card: {
    width: CARD_WIDTH,
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
});
