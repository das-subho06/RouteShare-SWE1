import React, { useCallback, useMemo, useState,useEffect, useRef } from "react";
import { TextInput } from "react-native";
import { Video, ResizeMode } from 'expo-av';
import OngoingRidesPhotoSvg from "@/assets/images/ridePhoto.svg";
import ChatPhotoSvg from "@/assets/images/chat-photo.svg";
import ActivityPhotoSvg from "@/assets/images/photo2.svg";
import RidesPhotoSvg from "@/assets/images/photo1.svg";
import {
  View,
  Text, Image,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  FlatList,
  Modal,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
  useWindowDimensions,
} from "react-native";
import { Ionicons, MaterialIcons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useLocalSearchParams } from "expo-router";
import Svg, { Path, Circle, Line } from "react-native-svg";
export type SidebarNavItem = { key: string; label: string; icon: keyof typeof Ionicons.glyphMap };
export type SidebarUser = { name: string; initials?: string; profileLabel?: string };
const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
const radius = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 };

export type SidebarProps = {
  brandName?: string;
  items?: SidebarNavItem[];
  activeKey?: string;
  onSelectItem?: (key: string) => void;
  showPromo?: boolean;
  onPromoPress?: () => void;
  user?: SidebarUser;
  onUserPress?: () => void;
  width?: number;
};

const DEFAULT_NAV_ITEMS: SidebarNavItem[] = [
  { key: "ride", label: "Ride", icon: "car" },
  { key: "activity", label: "Previous activity", icon: "time-outline" },
  { key: "chat", label: "Chat", icon: "chatbubble-ellipses-outline" },
  { key: "ongoing_rides", label: "Ongoing rides", icon: "car-outline" },
];

// Swap the promo illustration to match whichever nav item is active.
// Add/replace entries here as you add more svgs to assets/images.
const PROMO_IMAGE_BY_KEY: Record<string, React.ComponentType<any>> = {
  ride: RidesPhotoSvg,
  chat: ChatPhotoSvg,
  activity: ActivityPhotoSvg,
  ongoing_rides: OngoingRidesPhotoSvg,
};

function RidePhoto({ width = 176, height = 68 }: { width?: number; height?: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 200 76">
      <Line x1="28" y1="52" x2="172" y2="52" stroke="#3A3D46" strokeWidth={2} strokeDasharray="4,7" strokeLinecap="round" />
      <Path d="M28 6c-8.3 0-15 6.7-15 15 0 11 15 29.5 15 29.5s15-18.5 15-29.5c0-8.3-6.7-15-15-15z" fill="#2ECC71" />
      <Circle cx="28" cy="21" r="5.6" fill="#20222A" />
      <Path d="M172 6c-8.3 0-15 6.7-15 15 0 11 15 29.5 15 29.5s15-18.5 15-29.5c0-8.3-6.7-15-15-15z" fill="#FF5A52" />
      <Circle cx="172" cy="21" r="5.6" fill="#20222A" />
      <Path
        d="M58 61c0-2.3 1.9-4.2 4.2-4.2h3.8l4.6-8.9c.9-1.7 2.7-2.8 4.6-2.8h33.6c1.9 0 3.7 1.1 4.6 2.8l4.6 8.9h3.8c2.3 0 4.2 1.9 4.2 4.2v5c0 1.2-1 2.2-2.2 2.2h-2.5a5.6 5.6 0 1 1-11.2 0H73.9a5.6 5.6 0 1 1-11.2 0h-2.5c-1.2 0-2.2-1-2.2-2.2v-5z"
        fill="#FF6659"
      />
      <Path
        d="M72 49.2l3.4-6.5c.4-.7 1.2-1.2 2-1.2h24.2c.8 0 1.6.5 2 1.2l3.4 6.5H72z"
        fill="#20222A"
        opacity={0.35}
      />
      <Circle cx="75.4" cy="68.5" r="3.4" fill="#20222A" />
      <Circle cx="75.4" cy="68.5" r="1.5" fill="#C7C9D1" />
      <Circle cx="124.6" cy="68.5" r="3.4" fill="#20222A" />
      <Circle cx="124.6" cy="68.5" r="1.5" fill="#C7C9D1" />
    </Svg>
  );
}

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

export function Sidebar({
  brandName = "routeshare",
  items = DEFAULT_NAV_ITEMS,
  activeKey,
  onSelectItem,
  showPromo = true,
  onPromoPress,
  user = { name: "Rider", profileLabel: "View profile" },
  onUserPress,
  width = 248,
}: SidebarProps) {
  const [internalActive, setInternalActive] = useState(items[0]?.key);
  
  const { name: nameParam } = useLocalSearchParams<{ name?: string | string[]; username?: string | string[] }>();
    const riderName = (Array.isArray(nameParam) ? nameParam[0] : nameParam)?.trim() || "Rider";
const [cardWidth, setCardWidth] = useState(0);   // ← add this
  const currentActive = activeKey ?? internalActive;
  // Sidebar is presentational only — navigation is owned by whichever screen
  // renders it (ChatApp, Rider, PreviousActivity each implement their own
  // handleSidebarSelect and pass it in as onSelectItem). Sidebar must not
  // also call router.push itself, or every tap fires two pushes to the same
  // route back-to-back, which is what was breaking navigation.
  const handleSelect = (key: string) => {
    setInternalActive(key);
    onSelectItem?.(key);
  };
  function PromoCard({ onPromoPress }: { onPromoPress?: () => void }) {
  const [cardWidth, setCardWidth] = useState(0);
    const aspectRatio=200/76
  return (
    // <TouchableOpacity
    //   style={sidebarStyles.promoCard}
    //   activeOpacity={0.85}
    //   onPress={onPromoPress}
    //   onLayout={(e) => setCardWidth(e.nativeEvent.layout.width)}
    // >
    //   <View style={sidebarStyles.promoIllustrationRow}>
    //     {cardWidth > 0 && (
    //       <RidePhoto width={100}/>
    //       // height ratio: match your svg's own aspect ratio (height/width of its viewBox)
    //     )}
    //   </View>
    //   {/* <Text style={sidebarStyles.promoTitle}>Share your ride,</Text>
     <Text style={sidebarStyles.promoTitleAccent}>save more</Text>
    //   <Text style={sidebarStyles.promoBody}>Carpool and split fares with fellow riders.</Text>
    //  */}
    // </TouchableOpacity>
  );
}
 
  return (
    <View style={[sidebarStyles.container, { width }]}>
      <View style={sidebarStyles.brandRow}>
         <View style={sidebarStyles.logoBox}>
          <Image
            source={require('../../../assets/images/logoSidebar.png')}
            style={sidebarStyles.logoImage}
            resizeMode="contain"
          />
        </View>
        {/* <Ionicons name="car-sport" size={18} color={colors.brand} style={{ marginLeft: 6 }} /> */}
      </View>

      <ScrollView style={{ flexGrow: 0 }} showsVerticalScrollIndicator={false}>
        {items.map((item) => {
          const isActive = item.key === currentActive;
          return (
            <TouchableOpacity
              key={item.key}
              activeOpacity={0.75}
              onPress={() => handleSelect(item.key)}
              style={[sidebarStyles.navItem, isActive && sidebarStyles.navItemActive]}
            >
              <Ionicons name={item.icon} size={18} color={isActive ? colors.brand : "#C7C9D1"} style={{ width: 22 }} />
              <Text style={[sidebarStyles.navLabel, isActive && sidebarStyles.navLabelActive]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={{ flex: 1 }} />

      {showPromo && (() => {
        const PromoImage = PROMO_IMAGE_BY_KEY[currentActive] ?? RidesPhotoSvg;
        return (
          <TouchableOpacity
            style={sidebarStyles.promoCard}
            activeOpacity={0.85}
            onPress={onPromoPress}
            onLayout={(e) => setCardWidth(e.nativeEvent.layout.width)}
          >
            <View style={sidebarStyles.promoTextBlock} />

            {cardWidth > 0 && (
              <View style={sidebarStyles.promoIllustrationRow}>
                <PromoImage width={200} height={200} style={{ paddingBottom: 10, paddingLeft: 8, paddingTop: -10 }} />
                <Text style={sidebarStyles.promoTitle}>Share your ride,</Text>
                <Text style={sidebarStyles.promoTitleAccent}>save more</Text>
                <Text style={sidebarStyles.promoBody}>Carpool and split fares with fellow riders.</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })()}

      <TouchableOpacity style={sidebarStyles.userRow} activeOpacity={0.7} onPress={onUserPress}>
        <View style={sidebarStyles.avatar}>
          <Text style={sidebarStyles.avatarText}>{(user.initials ?? user.name[0] ?? "?").toUpperCase()}</Text>
        </View>
        <View>
          <Text style={sidebarStyles.userName}>{user.name}</Text>
          {!!user.profileLabel && <Text style={sidebarStyles.userSub}>{user.profileLabel}</Text>}
        </View>
      </TouchableOpacity>
    </View>
  );
}

const sidebarStyles = StyleSheet.create({
  promoCard: {
  backgroundColor: "#20222A",
  borderRadius: radius.lg,
  paddingTop: 5,
  marginBottom: spacing.lg,
  overflow: "hidden", // clips the image to the card's rounded corners
},
promoTextBlock: {
  paddingHorizontal: spacing.lg,
  marginBottom: spacing.md,
},
promoIllustrationRow: {
  width: "100%", // touches left/right edges, no gap
},
  container: {
    backgroundColor: colors.sidebarBg,
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    height: "100%",
  },
  brandRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.xl, paddingHorizontal: spacing.xs },
  brandText: { color: colors.brand, fontSize: 19, fontWeight: "800" },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.xs,
  },
  logoBox: {
  width: 40,          // keep this matching the ORIGINAL footprint you already have
  height: 40,
  justifyContent: 'flex-start',
  alignItems: 'flex-start',
  overflow: 'visible',  // <-- key: lets the image spill outside the box
},
logoImage: {
  top:-80,
  left:-5,
  width: 210,           // <-- crank this as big as you want
  height: 200,
  position: 'absolute', // <-- pulled out of flex flow, so it can't push siblings
},
  navItemActive: { backgroundColor: colors.sidebarActiveBg },
  navLabel: { color: "#B7B9C2", fontSize: 14.5, fontWeight: "500", marginLeft: spacing.sm },
  navLabelActive: { color: colors.white, fontWeight: "700" },
  promoTitle: { color: colors.white, fontSize: 15, fontWeight: "700", paddingHorizontal: spacing.lg },
promoTitleAccent: { color: colors.brand, fontSize: 15, fontWeight: "700", marginBottom: 6, paddingHorizontal: spacing.lg },
promoBody: { color: "#9A9CA6", fontSize: 12.5, lineHeight: 17, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },  
userRow: { flexDirection: "row", alignItems: "center", paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: "#2A2D36" },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.white, alignItems: "center", justifyContent: "center", marginRight: spacing.sm },
  avatarText: { fontWeight: "700", color: colors.text },
  userName: { color: colors.white, fontWeight: "600", fontSize: 13.5 },
  userSub: { color: colors.brand, fontSize: 12 },
});