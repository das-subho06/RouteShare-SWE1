import React, { useCallback, useMemo, useState,useEffect, useRef } from "react";
import { TextInput } from "react-native";
import {
  View,
  Text,
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
import { useLocalSearchParams, useRouter } from "expo-router";
import ChooseRide, { RideOption } from "./ChooseRide";
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
];

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
  const router = useRouter();
  const [internalActive, setInternalActive] = useState(items[0]?.key);
  const currentActive = activeKey ?? internalActive;
  const { name: nameParam } = useLocalSearchParams<{ name?: string | string[]; username?: string | string[] }>();
    const riderName = (Array.isArray(nameParam) ? nameParam[0] : nameParam)?.trim() || "Rider";
  const handleSelect = (key: string) => {
    if (onSelectItem) onSelectItem(key);
    else setInternalActive(key);
  };
  const handleSidebarSelect = (key: string) => {
  if (key === "activity") {
    router.push({
      pathname: "/previousActivity",   // adjust if your file/route is registered under a different path
      params: { name: riderName, username: riderName },
    });
  }
  // "ride" is this screen — nothing to do.
  // "chat" has no standalone screen yet.
};
  return (
    <View style={[sidebarStyles.container, { width }]}>
      <View style={sidebarStyles.brandRow}>
        <Text style={sidebarStyles.brandText}>{brandName}</Text>
        <Ionicons name="car-sport" size={18} color={colors.brand} style={{ marginLeft: 6 }} />
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

      {showPromo && (
        <TouchableOpacity style={sidebarStyles.promoCard} activeOpacity={0.85} onPress={onPromoPress}>
          <View style={sidebarStyles.promoIconRow}>
            <MaterialCommunityIcons name="leaf" size={18} color="#3a3d46" />
            <MaterialCommunityIcons name="car-sports" size={30} color={colors.brand} style={{ marginHorizontal: 6 }} />
            <Ionicons name="location" size={18} color={colors.brand} />
          </View>
          <Text style={sidebarStyles.promoTitle}>Share your ride,</Text>
          <Text style={sidebarStyles.promoTitleAccent}>save more</Text>
          <Text style={sidebarStyles.promoBody}>Carpool and split fares with fellow riders.</Text>
        </TouchableOpacity>
      )}

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
  navItemActive: { backgroundColor: colors.sidebarActiveBg },
  navLabel: { color: "#B7B9C2", fontSize: 14.5, fontWeight: "500", marginLeft: spacing.sm },
  navLabelActive: { color: colors.white, fontWeight: "700" },
  promoCard: { backgroundColor: "#20222A", borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.lg },
  promoIconRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.md },
  promoTitle: { color: colors.white, fontSize: 15, fontWeight: "700" },
  promoTitleAccent: { color: colors.brand, fontSize: 15, fontWeight: "700", marginBottom: 6 },
  promoBody: { color: "#9A9CA6", fontSize: 12.5, lineHeight: 17 },
  userRow: { flexDirection: "row", alignItems: "center", paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: "#2A2D36" },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.white, alignItems: "center", justifyContent: "center", marginRight: spacing.sm },
  avatarText: { fontWeight: "700", color: colors.text },
  userName: { color: colors.white, fontWeight: "600", fontSize: 13.5 },
  userSub: { color: colors.brand, fontSize: 12 },
});