import React, { useRef, useState, useEffect } from 'react';
import { Video, ResizeMode } from 'expo-av';
import { useRouter } from 'expo-router';
import Toast from '@/components/Toast';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  Modal,
  TextInput,
  Linking,
  Platform,
  useWindowDimensions,
  Animated,
} from 'react-native';
import Signup from './Signup';
import Login from './Login';
import DriverDetails from './Driver';
import DriverMessage from './Toast';
import { API_URL } from './config';
import Svg, { Path } from 'react-native-svg';
import CardBgSvg from '../../assets/images/cardPhoto1.svg';
import CardBgSvg2 from '../../assets/images/cardPhoto2.svg';
import CardBgSvg3 from '../../assets/images/cardPhoto3.svg';
import CardBgSvg4 from '../../assets/images/cardPhoto4.svg';
import CardBgSvg5 from '../../assets/images/cardPhoto5.svg';
import CardBgSvg6 from '../../assets/images/cardPhoto6.svg';
import CardBgSvg7 from '../../assets/images/cardPhoto7.svg';
// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------
const COLORS = {
  bg: '#ffffff',
  ink: '#141414',
  inkSoft: '#2a2a2a',
  coral: '#fb6f6a',
  coralDeep: '#f4534c',
  cardGray: '#ececec',
  textMuted: '#5b5b5b',
  white: '#ffffff',
};
//API 
const PHONE_NUMBER = '+91 7439548661';
const PLAN_CARD_WIDTH = 260;
const PLAN_CARD_GAP = 20;

// Local asset — bundled by Metro at full resolution, no network re-compression.
// Source file is 711x790, transparent background.
const HERO_TAXI_IMG = require('../../assets/images/hero-taxi-phone.png');
const HERO_TAXI_ASPECT_RATIO = 711 / 790;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type ModalKind = 'login' | 'signup' | 'contact' | 'booking' | null;

interface Plan {
  id: string;
  title: string;
  body: string;
  more: string;
  highlighted?: boolean;
}

const PLANS: Plan[] = [
  {
    id: 'city',
    title: 'Within the City',
    body: 'We run services within the city to any destination you want to go.',
    more:
      'Rides typically arrive in under 8 minutes, with flat pricing across all city zones.',
    highlighted: true,
  },
  {
    id: 'state',
    title: 'Within the State',
    body: 'We run services within the state to any destination you want to go.',
    more:
      'Book ahead for intercity trips — drivers are matched a day in advance for comfort stops.',
  },
  {
    id: 'country',
    title: 'Within the Country',
    body: 'We run services within the country to any destination you want to go.',
    more:
      'Long-haul trips include a rest-stop planner and a second driver option for overnight routes.',
  },
  {
    id: 'airport',
    title: 'Airport Transfers',
    body: 'We run services to and from the airport, timed around your flight.',
    more:
      'Flight tracking is built in, so pickup times shift automatically if your flight is delayed.',
  },
  {
    id: 'corporate',
    title: 'Corporate Travel',
    body: 'We run services for teams and businesses that need reliable daily rides.',
    more:
      'Monthly invoicing and a dedicated dispatcher are included for accounts with 10+ riders.',
  },
  {
    id: 'events',
    title: 'Events & Occasions',
    body: 'We run services for weddings, parties, and other special occasions.',
    more:
      'Decorated vehicles and multi-stop routes are available for wedding parties.',
  },
  {
    id: 'night',
    title: 'Late Night Rides',
    body: 'We run services through the night for anyone heading home late.',
    more:
      'Extra driver vetting and live trip-sharing with a contact are on by default after 11pm.',
  },
];

interface Benefit {
  id: string;
  icon: string;
  title: string;
  body: string;
}

const BENEFITS: Benefit[] = [
  {
    id: 'pickup',
    icon: '🏠',
    title: 'Home Pickup',
    body: 'We run a job every pickup to serve you better and to your convenience.',
  },
  {
    id: 'bonus',
    icon: '🎁',
    title: 'Bonuses for Ride',
    body: 'When you book a rideshare we give you a chance because that can put a smile on your face.',
  },
  {
    id: 'booking',
    icon: '👆',
    title: 'Fast Booking',
    body: 'Our best methods are very fast and easy. It won\u2019t stress you.',
  },
  {
    id: 'gps',
    icon: '📍',
    title: 'GPS Searching',
    body: 'We run GPS searching in case you aren\u2019t sure of your destination. So you don\u2019t have to worry.',
  },
];

// ---------------------------------------------------------------------------
// Reusable pieces
// ---------------------------------------------------------------------------
function PillButton({
  label,
  onPress,
  variant = 'coral',
  small = false,
}: {
  label: string;
  onPress: () => void;
  variant?: 'coral' | 'dark' | 'outline';
  small?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed, hovered }: any) => [
        styles.pillBase,
        small && styles.pillSmall,
        variant === 'coral' && styles.pillCoral,
        variant === 'dark' && styles.pillDark,
        variant === 'outline' && styles.pillOutline,
        pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
        hovered && Platform.OS === 'web' && { opacity: 0.92 },
      ]}
    >
      <Text
        style={[
          styles.pillLabel,
          variant === 'outline' && { color: COLORS.ink },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  secure,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  secure?: boolean;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9a9a9a"
        secureTextEntry={secure}
        style={styles.fieldInput}
        autoCapitalize="none"
      />
    </View>
  );
}
function PlanCard({
  plan,
  expanded,
  onToggle,
  cardWidth,
}: {
  plan: Plan;
  expanded: boolean;
  onToggle: () => void;
  cardWidth?: number;
}) {
  const [hovered, setHovered] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    Animated.timing(scale, {
      toValue: hovered ? 1.06 : 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [hovered]);

  return (
    <Pressable
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={[styles.planCardOuter, cardWidth ? { width: cardWidth } : null]}
    >
      <Animated.View
        style={[
          styles.planCard,
          cardWidth ? { width: cardWidth } : null,
          plan.highlighted && styles.planCardHighlighted,
          { transform: [{ scale }] },
        ]}
      >
        {plan.highlighted && (
  <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 315, overflow: 'hidden', opacity: 0.8 }}>
  <CardBgSvg
    width="100%"
    height="100%"
    preserveAspectRatio="xMidYMax slice"
  />
</View>
  )}
          {plan.id === 'state' && (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 315, overflow: 'hidden', opacity: 0.5 }}>
            <CardBgSvg2
              width="100%"
              height="100%"
              preserveAspectRatio="xMidYMax slice"
            />
          </View>
        )}
        {plan.id === 'country' && (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 315, overflow: 'hidden', opacity: 0.5 }}>
            <CardBgSvg3
              width="100%"
              height="100%"
              preserveAspectRatio="xMidYMax slice"
            />
          </View>
        )}
         {plan.id === 'airport' && (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 315, overflow: 'hidden', opacity: 0.5 }}>
            <CardBgSvg4
              width="100%"
              height="100%"
              preserveAspectRatio="xMidYMax slice"
            />
          </View>
        )}
         {plan.id === 'corporate' && (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 315, overflow: 'hidden', opacity: 0.5 }}>
            <CardBgSvg5
              width="100%"
              height="100%"
              preserveAspectRatio="xMidYMax slice"
            />
          </View>
        )}
         {plan.id === 'events' && (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 315, overflow: 'hidden', opacity: 0.5 }}>
            <CardBgSvg6
              width="100%"
              height="100%"
              preserveAspectRatio="xMidYMax slice"
            />
          </View>
        )}
         {plan.id === 'night' && (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 315, overflow: 'hidden', opacity: 0.5 }}>
            <CardBgSvg7
              width="100%"
              height="100%"
              preserveAspectRatio="xMidYMax slice"
            />
          </View>
        )}
        <Text style={styles.planTitle}>{plan.title.toUpperCase()}</Text>
        <Text style={styles.planBody}>{plan.body}</Text>
        {expanded && <Text style={styles.planMore}>{plan.more}</Text>}

        <Pressable
          onPress={onToggle}
          style={({ pressed }) => [
            styles.readMoreBtn,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={styles.readMoreLabel}>
            {expanded ? 'Show less' : '..Read More'}
          </Text>
        </Pressable>

        <Image
          
          resizeMode="contain"
        />
      </Animated.View>
    </Pressable>
  );
}
// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function RouteShareLanding() {
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  const scrollRef = useRef<ScrollView>(null);
  const sectionY = useRef<{ [key: string]: number }>({});
  const [heroSize, setHeroSize] = useState({ width: 0, height: 0 });
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalKind>(null);
  // form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginMsg, setLoginMsg] = useState('');
  const [cQuery, setCQuery] = useState('');
  const [suName, setSuName] = useState('');
  const [suEmail, setSuEmail] = useState('');
  const [suMsg, setSuMsg] = useState('');

  const [cName, setCName] = useState('');
  const [cMsg, setCMsg] = useState('');
  const [cSent, setCSent] = useState(false);
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [bookingConfirmed, setBookingConfirmed] = useState(false);
  const [showDriverDetails, setShowDriverDetails] = useState(false); 
  const [driverOnboardingDone, setDriverOnboardingDone] = useState(false);
const [driverName, setDriverName] = useState('');
  const [signedUpUserId, setSignedUpUserId] = useState<number | null>(null);
  const [showVerifiedToast, setShowVerifiedToast] = useState(false);

  const router = useRouter();
useEffect(() => {
  if (modal === 'signup' && showDriverDetails && driverOnboardingDone) {
    setModal(null);           // close the signup modal
    setShowVerifiedToast(true);
  }
}, [driverOnboardingDone]);

const handleToastHide = () => {
  setShowVerifiedToast(false);
  router.replace('/driverDashboard'); // must match actual route path — see below
};
  const registerSection = (key: string) => (e: any) => {
    sectionY.current[key] = e.nativeEvent.layout.y;
  };

  const scrollToSection = (key: string) => {
    const y = sectionY.current[key] ?? 0;
    scrollRef.current?.scrollTo({ y: Math.max(y - 10, 0), animated: true });
  };

  const handleCall = async () => {
    const url = `tel:${PHONE_NUMBER}`;
    try {
      const supported = Platform.OS === 'web' ? true : await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        setModal('contact');
        setCMsg(`Give us a call anytime at ${PHONE_NUMBER}`);
      }
    } catch {
      setModal('contact');
      setCMsg(`Give us a call anytime at ${PHONE_NUMBER}`);
    }
  };

  const closeModal = () => {
    setModal(null);
    setLoginMsg('');
    setSuMsg('');
    setCSent(false);
    setBookingConfirmed(false);
    setShowDriverDetails(false);
    setDriverOnboardingDone(false);
  };

  const submitLogin = () => {
    if (!loginEmail || !loginPass) {
      setLoginMsg('Enter your email and password to continue.');
      return;
    }
    setLoginMsg(`Welcome back, ${loginEmail}! You're logged in.`);
  };

  // const submitSignup = () => {
  //   if (!suName || !suEmail) {
  //     setSuMsg('Fill in your name and email to create an account.');
  //     return;
  //   }
  //   setSuMsg(`You're all set, ${suName}. A confirmation was sent to ${suEmail}.`);
  // };

  const submitContact = () => {
    if (!cName) {
      setCMsg('Add your name so we know who to reply to.');
      return;
    }
    setCSent(true);
  };

  const submitBooking = () => {
    if (!pickup || !dropoff) {
      return;
    }
    setBookingConfirmed(true);
  };
  const plansScrollRef = useRef<ScrollView>(null);
const [plansScrollX, setPlansScrollX] = useState(0);
const SECTION_H_PADDING = 24; // matches styles.section paddingHorizontal
const mobileCardWidth = Math.min(340, width - SECTION_H_PADDING * 2);
const activeCardWidth = isWide ? PLAN_CARD_WIDTH : mobileCardWidth;
const plansMaxScrollX = isWide
  ? Math.max(0, PLANS.length * (PLAN_CARD_WIDTH + PLAN_CARD_GAP) - PLAN_CARD_GAP - 600)
  : Math.max(
      0,
      PLANS.length * (mobileCardWidth + PLAN_CARD_GAP) - PLAN_CARD_GAP - mobileCardWidth
    );

const scrollPlans = (direction: 1 | -1) => {
  const step = activeCardWidth + PLAN_CARD_GAP;
  const nextX = Math.min(Math.max(0, plansScrollX + direction * step), plansMaxScrollX);
  plansScrollRef.current?.scrollTo({ x: nextX, animated: true });
  setPlansScrollX(nextX);
};
  return (
    <View style={styles.root}>
      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={true} contentContainerStyle={{ flexGrow: 0 }}>
        {/* -------------------------------------------------------------- */}
        {/* HERO                                                          */}
        {/* -------------------------------------------------------------- */}
        <View
          style={styles.hero}
          onLayout={(e) => {
            registerSection('home')(e);
            const { width, height } = e.nativeEvent.layout;
            setHeroSize({ width, height });
          }}
        >
           {heroSize.width > 0 && (
            <Video
              source={require('../../assets/videos/hero-bg.mp4')}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: heroSize.width,
                height: heroSize.height,
                zIndex:0
              }}
              resizeMode={ResizeMode.COVER}
              isLooping
              shouldPlay
              isMuted
              volume={0}
              useNativeControls={false}
              pointerEvents="none"
            />
          )}

          {/* Nav */}
          <View style={[styles.navRow, isWide && styles.navRowWide]}>
            <Text style={styles.logo}>
              route<Text style={{ color: COLORS.coral }}>share</Text>
            </Text>
            {isWide && (
              <View style={styles.navLinks}>
                <NavLink label="Home" active onPress={() => scrollToSection('home')} />
                <NavLink label="About" onPress={() => scrollToSection('subscriptions')} />
                <NavLink label="Login" onPress={() => setModal('login')} />
                <NavLink label="Sign up" onPress={() => setModal('signup')} />
                <NavLink label="Contact" onPress={() => setModal('contact')} />
              </View>
            )}
          </View>
          {!isWide && (
            <View style={styles.navLinksMobile}>
              <NavLink label="Home" active onPress={() => scrollToSection('home')} />
              <NavLink label="About" onPress={() => scrollToSection('subscriptions')} />
              <NavLink label="Login" onPress={() => setModal('login')} />
              <NavLink label="Sign up" onPress={() => setModal('signup')} />
              <NavLink label="Contact" onPress={() => setModal('contact')} />
            </View>
          )}

          <View style={[styles.heroBody, isWide && styles.heroBodyWide]}>
            <View style={styles.heroText}>
              <Text style={styles.heroHeadline}>Need a{'\n'}Ride</Text>
              <View style={styles.heroButtons}>
                <PillButton label="Book now" onPress={() => setModal('login')} />
                <PillButton label="Call" variant="dark" onPress={handleCall} />
              </View>
            </View>
            {/* <Image
              source={HERO_TAXI_IMG}
              style={[
                styles.heroImage,
                { aspectRatio: HERO_TAXI_ASPECT_RATIO },
                isWide && styles.heroImageWide,
              ]}
              resizeMode="contain"
            /> */}
          </View>

          <WaveDivider />
          {isWide ? (
            <Image
              source={HERO_TAXI_IMG}
              style={[
                styles.heroImage,
                { aspectRatio: HERO_TAXI_ASPECT_RATIO },
                styles.heroImageWide,
              ]}
              resizeMode="contain"
              pointerEvents="none"
            />
          ) : (
            <View style={mobileStyles.heroImageWrap} pointerEvents="none">
              <Image
                source={HERO_TAXI_IMG}
                style={mobileStyles.heroImage}
                resizeMode="contain"
              />
            </View>
          )}
          
        </View>
        {/* -------------------------------------------------------------- */}
{/* SUBSCRIPTIONS                                                 */}
{/* -------------------------------------------------------------- */}
<View
  style={[
    styles.section,
    isWide ? { paddingRight: 260 } : mobileStyles.subscriptionsSection,
  ]}
  onLayout={registerSection('subscriptions')}
>
  <Text style={styles.sectionTitle}>Our Subscriptions</Text>
  <Text style={styles.sectionCaret}>▾</Text>

  <View style={[styles.carouselWrap, !isWide && mobileStyles.carouselWrap]}>
    {isWide && (
      <Pressable onPress={() => scrollPlans(-1)} style={styles.carouselArrow}>
        <Text style={styles.carouselArrowText}>‹</Text>
      </Pressable>
    )}
    <ScrollView
      ref={plansScrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      onScroll={(e) => setPlansScrollX(e.nativeEvent.contentOffset.x)}
      scrollEventThrottle={16}
      style={styles.carouselScroll}
      contentContainerStyle={[
        styles.plansRow,
        !isWide && { paddingHorizontal: 0 },
      ]}
      snapToInterval={!isWide ? mobileCardWidth + PLAN_CARD_GAP : undefined}
      decelerationRate={!isWide ? 'fast' : 'normal'}
      snapToAlignment="start"
    >
      {PLANS.map((plan) => (
        <PlanCard
          key={plan.id}
          plan={plan}
          expanded={expandedPlan === plan.id}
          onToggle={() => setExpandedPlan(expandedPlan === plan.id ? null : plan.id)}
          cardWidth={!isWide ? mobileCardWidth : undefined}
        />
      ))}
    </ScrollView>
    {isWide && (
      <Pressable onPress={() => scrollPlans(1)} style={styles.carouselArrow}>
        <Text style={styles.carouselArrowText}>›</Text>
      </Pressable>
    )}
  </View>
</View>
        
        {/* BENEFITS                                                      */}
        {/* -------------------------------------------------------------- */}
        <View style={styles.benefitsSection} onLayout={registerSection('benefits')}>
          <Text style={[styles.sectionTitle, { color: COLORS.ink }]}>
            Some Benefits
          </Text>
          <Text style={[styles.sectionCaret, { color: COLORS.white }]}>▾</Text>

          <View style={[styles.benefitsGrid, isWide && styles.benefitsGridWide]}>
            {BENEFITS.map((b) => (
              <View
                key={b.id}
                style={[styles.benefitItem, isWide && styles.benefitItemWide]}
              >
                <View style={styles.benefitIconCircle}>
                  <Text style={styles.benefitIconText}>{b.icon}</Text>
                </View>
                <View style={styles.benefitTextWrap}>
                  <Text style={styles.benefitTitle}>{b.title}</Text>
                  <Text style={styles.benefitBody}>{b.body}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* -------------------------------------------------------------- */}
        {/* FOOTER / CONTACT STRIP                                        */}
        {/* -------------------------------------------------------------- */}
        <View style={styles.footer} onLayout={registerSection('contact')}>
          <Text style={styles.footerLogo}>
            route<Text style={{ color: COLORS.coral }}>share</Text>
          </Text>
          <Text style={styles.footerText}>
            Ready to move? Book a ride or reach out — we reply fast.
          </Text>
          <View style={styles.heroButtons}>
            <PillButton label="Sign up" onPress={() => setModal('signup')} />
            <PillButton
              label="Contact us"
              variant="outline"
              onPress={() => setModal('contact')}
            />
          </View>
          <Text style={styles.footerCopyright}>
            © {new Date().getFullYear()} routeshare. All rights reserved.
          </Text>
        </View>
      </ScrollView>
            <Toast
  message="Your account verified"
  visible={showVerifiedToast}
  onHide={handleToastHide}
  duration={1800}
/>
      {/* ------------------------------------------------------------------ */}
      {/* MODALS                                                            */}
      {/* ------------------------------------------------------------------ */}
      <Modal
        visible={modal !== null}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Pressable style={styles.modalClose} onPress={closeModal}>
              <Text style={styles.modalCloseText}>✕</Text>
            </Pressable>
            <ScrollView
      style={styles.modalScroll}
      contentContainerStyle={styles.modalScrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
            {modal === 'login' && (
  <Login
    onLogin={(data) => {
      console.log('login data', data);
      // call your auth API here with data.username / data.password / data.designation
      setModal('booking'); // proceed straight to booking after login
    }}
    onPasswordReset={(data) => {
      console.log('password reset', data);
      // call your password-reset API here
    }}
  />
)}
{modal === 'signup' && !showDriverDetails && (
  <Signup
    onSubmit={async (data) => {
      try {
        const res = await fetch(`${API_URL}/signup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Signup failed');

        setSignedUpUserId(result.userId);
        setDriverName(data.name);

        if (data.designation === 'driver') {
          setShowDriverDetails(true);
        }
        // Riders are routed to the full /rider page from inside Signup
        // itself (via router.push), so there's nothing to do here for them.
      } catch (err) {
        console.error(err);
      }
    }}
    onClose={closeModal}
  />
)}
{modal === 'signup' && showDriverDetails && !driverOnboardingDone && (
  <DriverDetails
    onSubmit={async (vehicleData) => {
      try {
        const res = await fetch(`${API_URL}/driver-details`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: signedUpUserId, ...vehicleData }),
        });
        if (!res.ok) throw new Error('Could not save vehicle details');
        setDriverOnboardingDone(true);
      } catch (err) {
        console.error(err);
      }
    }}
  />
)}
{/* {modal === 'signup' && showDriverDetails && driverOnboardingDone && (
  <DriverMessage name={driverName} verificationStatus="pending" />
)} */}
            
      {modal === 'contact' && (
  <>
    <Text style={styles.modalTitle}>Contact us</Text>
    {cSent ? (
      <Text style={styles.modalMsg}>
        Thanks, {cName}! We will get back to you shortly.
      </Text>
    ) : (
      <>
        <FormField
          label="Your name"
          value={cName}
          onChangeText={setCName}
          placeholder="Jane Doe"
        />
        <View style={styles.fieldWrap}>
          <Text style={styles.fieldLabel}>Your query</Text>
          <TextInput
            value={cQuery}
            onChangeText={setCQuery}
            placeholder="What can we help you with?"
            placeholderTextColor="#9a9a9a"
            multiline
            numberOfLines={4}
            style={[styles.fieldInput, styles.fieldTextarea]}
          />
        </View>
        {!!cMsg && <Text style={styles.modalMsg}>{cMsg}</Text>}
        <PillButton label="Send message" onPress={submitContact} />
      </>
    )}
  </>
)}
            {modal === 'booking' && (
              <>
                <Text style={styles.modalTitle}>Book your ride</Text>
                {bookingConfirmed ? (
                  <Text style={styles.modalMsg}>
                    You\u2019re booked! A driver from {pickup || 'your pickup point'} to{' '}
                    {dropoff || 'your destination'} is on the way.
                  </Text>
                ) : (
                  <>
                    <FormField
                      label="Pickup location"
                      value={pickup}
                      onChangeText={setPickup}
                      placeholder="123 Main St"
                    />
                    <FormField
                      label="Destination"
                      value={dropoff}
                      onChangeText={setDropoff}
                      placeholder="Where to?"
                    />
                    <PillButton label="Confirm booking" onPress={submitBooking} />
                  </>
                )}
              </>
            )}
    </ScrollView>

          </View>
        </View>
      </Modal>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Wave divider — sits at the bottom of the hero, cutting a white curve
// into the dark background so it blends into the section below.
// ---------------------------------------------------------------------------
function WaveDivider() {
  return (
    <Svg
      viewBox="0 0 1440 320"
      style={styles.wave}
      preserveAspectRatio="none"
      pointerEvents="none"
    >
      <Path
        fill={COLORS.bg}
        d="M0,120 C160,220 320,220 480,150 C640,80 800,40 960,70 C1120,100 1280,140 1440,90 L1440,320 L0,320 Z"
      />
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// Nav link
// ---------------------------------------------------------------------------
const NAV_LINK_LINE_HEIGHT = 20;

function NavLink({
  label,
  onPress,
  active,
}: {
  label: string;
  onPress: () => void;
  active?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const translateY = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(translateY, {
      toValue: hovered ? -NAV_LINK_LINE_HEIGHT : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [hovered]);
  const playTapCycle = () => {
    Animated.sequence([
      Animated.timing(translateY, {
        toValue: -NAV_LINK_LINE_HEIGHT,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handlePress = () => {
    if (Platform.OS !== 'web') {
      playTapCycle();
    }
    onPress();
  };
return (
    <Pressable
      onPress={handlePress}
      onHoverIn={() => {
        console.log('hover in:', label); // TEMP — check your browser console
        setHovered(true);
      }}
      onHoverOut={() => {
        console.log('hover out:', label); // TEMP — check your browser console
        setHovered(false);
      }}
      style={[styles.navLinkWrap, hovered && { backgroundColor: COLORS.coral, borderRadius: 8, padding: 8, alignItems: 'center', opacity: 0.8 }]} // TEMP — obvious visual proof
    
    >
      <View style={styles.navLinkMask}>
        <Animated.View style={{ transform: [{ translateY }] }}>
          <Text style={[styles.navLinkText, active && { color: COLORS.white }]}>
            {label}
          </Text>
          <Text style={[styles.navLinkText, active && { color: COLORS.white }]}>
            {label}
          </Text>
        </Animated.View>
      </View>
      {active && <View style={styles.navLinkUnderline} />}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const mobileStyles = StyleSheet.create({
  heroImageWrap: {
    position: 'absolute',
    right: -30,
    top: 150,
    width: 260,
    height: 290,
    overflow: 'hidden',
    zIndex: 3,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  subscriptionsSection: {
    marginTop: 24,
    paddingTop: 32,
  },
  carouselWrap: {
    width: '100%',
    maxWidth: '100%',
    alignSelf: 'center',
    gap: 0,
  },
});

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: COLORS.bg },

  // Hero -----------------------------------------------------------------
  hero: {
    backgroundColor: COLORS.ink,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 30,
    position: 'relative',
    overflow:'visible'
  },
  wave: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    width: '100%',
    height: 100,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex:2,
    elevation: 10,
  },
  navRowWide: {},
  logo: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: 0.5,
  },
  navLinks: {
    flexDirection: 'row',
    gap: 28,
  },
  navLinksMobile: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 18,
    marginTop: 16,
  },
  navLinkWrap: { alignItems: 'center' },
  navLinkMask: {
    height: 20,
    overflow: 'hidden',
  },
  navLinkText: {
    color: '#c9c9c9',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  navLinkUnderline: {
    // marginTop: 6,
    height: 2,
    width: '100%',
    backgroundColor: COLORS.coral,
  },
  fieldTextarea: {
  minHeight: 90,
  textAlignVertical: 'top',
  paddingTop: 10,
},
carouselWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    maxWidth: 1000,
    alignSelf: 'center',
    gap: 12,
  },
  carouselArrow: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.ink,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  carouselArrowText: {
    color: COLORS.white,
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 22,
  },
  carouselScroll: {
    flex: 1,
    minWidth: 0,
  },
  plansRow: {
    gap: PLAN_CARD_GAP,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  planCardOuter: {
    width: PLAN_CARD_WIDTH,
  },
  planCard: {
    backgroundColor: COLORS.cardGray,
    borderRadius: 18,
    padding: 26,
    width: PLAN_CARD_WIDTH,
    minHeight: 300,
    overflow: 'hidden',
  },
  planCardHighlighted: { backgroundColor: COLORS.coral },
  heroBody: {
    marginTop: 20,
    zIndex: 2,
    elevation: 10
  },
 heroBodyWide: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'flex-end',
  maxWidth: 1100,
  width: '100%',
  alignSelf: 'center',
  marginRight: 520,
},
  heroText: { maxWidth: 480 },
  heroHeadline: {
    fontSize: 64,
    lineHeight: 62,
    fontWeight: '900',
    color: COLORS.white,
    paddingBottom: 28,
    marginTop: 20
  },
  heroButtons: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 70,
    zIndex: 2,
    elevation: 10
  },
      heroImage: {
    position: 'absolute',
    right: -30,
    top:-70,
    width: 480,
    zIndex: 3,
  },
  heroImageWide: {
    right: -20,
  top: -70,
  width: 480,
  marginBottom: -40,
  },

  // Buttons ----------------------------------------------------------------
  pillBase: {
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 30,
  },
  pillSmall: { paddingVertical: 10, paddingHorizontal: 20 },
  pillCoral: { backgroundColor: COLORS.coral },
  pillDark: { backgroundColor: '#3a3a3a' },
  pillOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: COLORS.ink,
  },
  pillLabel: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 15,
    textAlign: 'center',
  },

  // Sections -----------------------------------------------------------
  section: {
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: -10,
    marginTop:-50,
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.ink,
    letterSpacing: 0.5,
    marginBottom: -50,
  },
  sectionCaret: {
    color: COLORS.coral,
    fontSize: 18,
    marginTop: 40,
    marginBottom: -10,
  },

  modalCard: {
  width: '100%',
  maxWidth: 380,
  maxHeight: '85%',        // ← new: cap the card so it never exceeds the viewport
  backgroundColor: COLORS.white,
  borderRadius: 20,
  padding: 26,
},
modalScroll: {
  maxHeight: '100%',       // ← new
},
modalScrollContent: {
  paddingBottom: 8,        // ← new: a little breathing room at the bottom
},

  planTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.ink,
    marginBottom: 14,
    letterSpacing: 0.3,
  },
  planBody: {
    fontSize: 14,
    color: COLORS.inkSoft,
    lineHeight: 21,
    marginBottom: 14,
  },
  planMore: {
    fontSize: 13,
    color: COLORS.inkSoft,
    lineHeight: 20,
    fontStyle: 'italic',
    marginBottom: 14,
  },
  readMoreBtn: {
    backgroundColor: COLORS.ink,
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
    marginBottom: 22,
  },
  readMoreLabel: { color: COLORS.white, fontWeight: '700', fontSize: 13 },
  planCarImage: {
    width: '100%',
    height: 90,
  },

  // Benefits --------------------------------------------------------------
  benefitsSection: {
    backgroundColor: COLORS.coral,
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 56,
    alignItems: 'center',
  },
  benefitsGrid: { width: '100%', marginTop: 12, gap: 28 },
  benefitsGridWide: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    maxWidth: 1000,
    alignSelf: 'center',
    justifyContent: 'space-between',
  },
  benefitItem: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'flex-start',
  },
  benefitItemWide: { width: '46%' },
  benefitIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitIconText: { fontSize: 24 },
  benefitTextWrap: { flex: 1 },
  benefitTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.ink,
    marginBottom: 6,
  },
  benefitBody: { fontSize: 13.5, color: '#3a1a19', lineHeight: 20 },

  // Footer ------------------------------------------------------------------
  footer: {
    backgroundColor: COLORS.ink,
    paddingHorizontal: 24,
    paddingVertical: 48,
    alignItems: 'center',
  },
  footerLogo: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.white,
    marginBottom: 10,
  },
  footerText: {
    color: '#c9c9c9',
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
  },
  footerCopyright: {
    color: '#7a7a7a',
    fontSize: 12,
    marginTop: 24,
  },

  // Modal --------------------------------------------------------------
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  
  modalClose: {
    alignSelf: 'flex-end',
    marginBottom: 6,
  },
  modalCloseText: { fontSize: 16, color: COLORS.textMuted },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.ink,
    marginBottom: 18,
  },
  modalMsg: {
    fontSize: 13.5,
    color: COLORS.coralDeep,
    marginBottom: 14,
    lineHeight: 19,
  },
  fieldWrap: { marginBottom: 16 },
  fieldLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: COLORS.textMuted,
    marginBottom: 6,
  },
  fieldInput: {
    borderWidth: 1,
    borderColor: '#dcdcdc',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 14,
    color: COLORS.ink,
  },
});



