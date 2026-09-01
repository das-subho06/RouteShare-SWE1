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
import { useLocalSearchParams } from "expo-router";


/* ------------------------------------------------------------------ */
/*  Theme                                                               */
/* ------------------------------------------------------------------ */

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

const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
const radius = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 };

/* ------------------------------------------------------------------ */
/*  Optional native modules, loaded defensively                        */
/* ------------------------------------------------------------------ */

let MapView: any = null;
let Marker: any = null;
let Polyline: any = null;
let PROVIDER_GOOGLE: any = undefined;
let DateTimePickerNative: any = null;

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
}

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

type Place = { label: string; sublabel: string; latitude: number; longitude: number };

/* ------------------------------------------------------------------ */
/*  Sidebar (reusable — mount it any number of times)                  */
/* ------------------------------------------------------------------ */

export type SidebarNavItem = { key: string; label: string; icon: keyof typeof Ionicons.glyphMap };
export type SidebarUser = { name: string; initials?: string; profileLabel?: string };

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
  const currentActive = activeKey ?? internalActive;

  const handleSelect = (key: string) => {
    if (onSelectItem) onSelectItem(key);
    else setInternalActive(key);
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

/* ------------------------------------------------------------------ */
/*  Generic modal wrapper                                               */
/* ------------------------------------------------------------------ */
type PlaceSuggestion = { label: string; sublabel: string; latitude: number; longitude: number };

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
            label: item.display_name.split(",")[0],
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
async function resolvePlaceFromCoords(lat: number, lng: number): Promise<Place> {
  if (Platform.OS === "web") {
    const { label, sublabel } = await reverseGeocodeWeb(lat, lng);
    return { label, sublabel, latitude: lat, longitude: lng };
  }
  try {
    const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    const place = results?.[0];
    const label = buildFullAddress(place) || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    const sublabel = [place?.city, place?.region, place?.postalCode].filter(Boolean).join(", ");
    return { label, sublabel, latitude: lat, longitude: lng };
  } catch {
    return { label: `${lat.toFixed(4)}, ${lng.toFixed(4)}`, sublabel: "", latitude: lat, longitude: lng };
  }
}
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
      <View style={[searchStyles.inputRow, active && searchStyles.inputRowActive]}>
        <View style={[searchStyles.dot, { backgroundColor: dotColor }]} />
        <TextInput
          value={text}
          onChangeText={(t) => {
            setText(t);
            search(t);
          }}
          onFocus={onFocusField}
          placeholder={placeholder}
          style={searchStyles.input}
          placeholderTextColor={colors.textFaint}
        />
        {(loading || locating) && <ActivityIndicator size="small" color={colors.brand} />}
        {!!onLocatePress && (
          <TouchableOpacity
            onPress={onLocatePress}
            style={searchStyles.pinBtn}
            accessibilityLabel="Use current location"
            disabled={locating}
          >
            <Ionicons name="locate" size={16} color={colors.brand} />
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={onPinPress} style={searchStyles.pinBtn} accessibilityLabel="Pin on map">
          <Ionicons name="navigate-outline" size={16} color={active ? colors.brand : colors.textMuted} />
        </TouchableOpacity>
        {!!text && !!onClear && (
          <TouchableOpacity
            onPress={() => {
              setText("");
              clear();
              onClear();
            }}
            style={searchStyles.pinBtn}
          >
            <Ionicons name="close" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {results.length > 0 && (
        <View style={searchStyles.dropdown}>
          {results.map((r, i) => (
            <TouchableOpacity
              key={i}
              style={searchStyles.suggestionRow}
              onPress={() => {
                // Use the full formatted address as the place's label so the field
                // (and any saved place) shows the complete address, not just the first token.
                const fullAddressPlace: PlaceSuggestion = { ...r, label: r.sublabel || r.label };
                onSelect(fullAddressPlace);
                setText(fullAddressPlace.label);
                clear();
              }}
            >
              <Ionicons name="location-outline" size={15} color={colors.textMuted} />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={searchStyles.suggestionTitle} numberOfLines={1}>{r.label}</Text>
                <Text style={searchStyles.suggestionSub} numberOfLines={1}>{r.sublabel}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const searchStyles = StyleSheet.create({
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    gap: 8,
  },
  inputRowActive: { borderColor: colors.brand, backgroundColor: colors.brandTint },
  dot: { width: 9, height: 9, borderRadius: 5 },
  input: { flex: 1, paddingVertical: 12, fontSize: 14, color: colors.text },
  pinBtn: { padding: 4 },
  dropdown: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    marginTop: 4,
    backgroundColor: colors.white,
    overflow: "hidden",
  },
  suggestionRow: { flexDirection: "row", alignItems: "center", padding: spacing.sm },
  suggestionTitle: { fontSize: 13.5, fontWeight: "600", color: colors.text },
  suggestionSub: { fontSize: 11, color: colors.textMuted },
});
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

/* ------------------------------------------------------------------ */
/*  City picker modal                                                   */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  Rider count modal                                                   */
/* ------------------------------------------------------------------ */

function RiderCountModal({
  visible,
  count,
  onClose,
  onSelect,
}: {
  visible: boolean;
  count: number;
  onClose: () => void;
  onSelect: (n: number) => void;
}) {
  return (
    <SheetModal visible={visible} title="Riders" onClose={onClose} width={260}>
      {[1, 2, 3, 4].map((n) => {
        const active = n === count;
        return (
          <TouchableOpacity
            key={n}
            style={[pickerStyles.row, active && pickerStyles.rowActive]}
            onPress={() => {
              onSelect(n);
              onClose();
            }}
          >
            <Ionicons name="person-outline" size={16} color={active ? colors.brand : colors.textMuted} />
            <Text style={[pickerStyles.label, active && pickerStyles.labelActive]}>
              {n} {n === 1 ? "Rider" : "Riders"}
            </Text>
            {active && <Ionicons name="checkmark" size={16} color={colors.brand} style={{ marginLeft: "auto" }} />}
          </TouchableOpacity>
        );
      })}
    </SheetModal>
  );
}

/* ------------------------------------------------------------------ */
/*  Payment method modal                                                */
/* ------------------------------------------------------------------ */

const PAYMENT_METHODS: { key: string; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "cash", label: "Cash", icon: "cash-outline" },
  { key: "card", label: "Credit / Debit card", icon: "card-outline" },
  { key: "upi", label: "UPI", icon: "phone-portrait-outline" },
  { key: "wallet", label: "Wallet", icon: "wallet-outline" },
];

function PaymentModal({
  visible,
  method,
  onClose,
  onSelect,
}: {
  visible: boolean;
  method: string;
  onClose: () => void;
  onSelect: (m: string) => void;
}) {
  return (
    <SheetModal visible={visible} title="Payment method" onClose={onClose} width={300}>
      {PAYMENT_METHODS.map((m) => {
        const active = m.key === method;
        return (
          <TouchableOpacity
            key={m.key}
            style={[pickerStyles.row, active && pickerStyles.rowActive]}
            onPress={() => {
              onSelect(m.key);
              onClose();
            }}
          >
            <Ionicons name={m.icon} size={16} color={active ? colors.brand : colors.textMuted} />
            <Text style={[pickerStyles.label, active && pickerStyles.labelActive]}>{m.label}</Text>
            {active && <Ionicons name="checkmark" size={16} color={colors.brand} style={{ marginLeft: "auto" }} />}
          </TouchableOpacity>
        );
      })}
    </SheetModal>
  );
}

/* ------------------------------------------------------------------ */
/*  Ride options modal                                                  */
/* ------------------------------------------------------------------ */

const OPTION_LIST = [
  { key: "ac", label: "AC required" },
  { key: "pet", label: "Pet friendly" },
  { key: "quiet", label: "Quiet ride" },
  { key: "extra_luggage", label: "Extra luggage space" },
];

function OptionsModal({
  visible,
  selected,
  onClose,
  onToggle,
}: {
  visible: boolean;
  selected: string[];
  onClose: () => void;
  onToggle: (key: string) => void;
}) {
  return (
    <SheetModal visible={visible} title="Ride options" onClose={onClose} width={300}>
      {OPTION_LIST.map((opt) => {
        const active = selected.includes(opt.key);
        return (
          <TouchableOpacity key={opt.key} style={optionModalStyles.row} onPress={() => onToggle(opt.key)}>
            <View style={[optionModalStyles.checkbox, active && optionModalStyles.checkboxActive]}>
              {active && <Ionicons name="checkmark" size={13} color="#fff" />}
            </View>
            <Text style={optionModalStyles.label}>{opt.label}</Text>
          </TouchableOpacity>
        );
      })}
      <TouchableOpacity style={optionModalStyles.doneBtn} onPress={onClose}>
        <Text style={optionModalStyles.doneText}>Done</Text>
      </TouchableOpacity>
    </SheetModal>
  );
}

const optionModalStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 10 },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: colors.border, alignItems: "center", justifyContent: "center", marginRight: spacing.sm },
  checkboxActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  label: { fontSize: 14.5, color: colors.text },
  doneBtn: { marginTop: spacing.sm, backgroundColor: colors.brand, borderRadius: radius.md, paddingVertical: 12, alignItems: "center" },
  doneText: { color: "#fff", fontWeight: "700" },
});

const pickerStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: spacing.sm, borderRadius: radius.sm },
  rowActive: { backgroundColor: colors.brandTint },
  label: { marginLeft: spacing.sm, fontSize: 14.5, color: colors.text },
  labelActive: { color: colors.brandDark, fontWeight: "700" },
});

/* ------------------------------------------------------------------ */
/*  Schedule-later modal — real calendar (date) + clock (time) picker  */
/* ------------------------------------------------------------------ */

function toDateInputValue(d: Date) {
  return d.toISOString().slice(0, 10);
}
function toTimeInputValue(d: Date) {
  return d.toTimeString().slice(0, 5);
}

function ScheduleModal({
  visible,
  onClose,
  onConfirm,
  initialDate,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: (date: Date) => void;
  initialDate?: Date;
}) {
  const base = initialDate ?? new Date();

  // --- Web branch: native HTML date/time inputs (real browser calendar + clock) ---
  const [dateStr, setDateStr] = useState(toDateInputValue(base));
  const [timeStr, setTimeStr] = useState(toTimeInputValue(base));
  const dateInputRef = useRef<any>(null);
  const timeInputRef = useRef<any>(null);

  const openPicker = (ref: React.MutableRefObject<any>) => {
    const el = ref.current;
    if (!el) return;
    try {
      if (typeof el.showPicker === "function") el.showPicker();
      else el.focus();
    } catch {
      el.focus?.();
    }
  };

  // --- Native branch: @react-native-community/datetimepicker ---
  const [nativeDate, setNativeDate] = useState(base);
  const [pickerMode, setPickerMode] = useState<"date" | "time">("date");
  const [showNativePicker, setShowNativePicker] = useState(Platform.OS === "ios");

  const handleNativeChange = (_: any, selected?: Date) => {
    if (Platform.OS === "android") setShowNativePicker(false);
    if (selected) {
      const next = new Date(nativeDate);
      if (pickerMode === "date") next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
      else next.setHours(selected.getHours(), selected.getMinutes());
      setNativeDate(next);
    }
  };

  if (Platform.OS === "web") {
    return (
      <SheetModal visible={visible} title="Schedule later" onClose={onClose} width={340}>
        <View style={scheduleStyles.row}>
          <TouchableOpacity
            style={scheduleStyles.field}
            activeOpacity={0.7}
            onPress={() => openPicker(dateInputRef)}
          >
            <Ionicons name="calendar-outline" size={18} color={colors.brand} />
            {/* @ts-ignore - raw html input via react-native-web */}
            <input
              ref={dateInputRef}
              type="date"
              value={dateStr}
              onChange={(e: any) => setDateStr(e.target.value)}
              style={webInputStyle}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={scheduleStyles.field}
            activeOpacity={0.7}
            onPress={() => openPicker(timeInputRef)}
          >
            <Ionicons name="time-outline" size={18} color={colors.brand} />
            {/* @ts-ignore - raw html input via react-native-web */}
            <input
              ref={timeInputRef}
              type="time"
              value={timeStr}
              onChange={(e: any) => setTimeStr(e.target.value)}
              style={webInputStyle}
            />
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={scheduleStyles.confirmBtn}
          onPress={() => {
            const [y, m, d] = dateStr.split("-").map(Number);
            const [hh, mm] = timeStr.split(":").map(Number);
            onConfirm(new Date(y, (m ?? 1) - 1, d, hh, mm));
            onClose();
          }}
        >
          <Text style={scheduleStyles.confirmText}>Confirm schedule</Text>
        </TouchableOpacity>
      </SheetModal>
    );
  }

  // Native (iOS/Android)
  return (
    <SheetModal visible={visible} title="Schedule later" onClose={onClose} width={340}>
      <View style={scheduleStyles.row}>
        <TouchableOpacity
          style={scheduleStyles.field}
          onPress={() => {
            setPickerMode("date");
            setShowNativePicker(true);
          }}
        >
          <Ionicons name="calendar-outline" size={18} color={colors.brand} />
          <Text style={scheduleStyles.fieldText}>
            {nativeDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={scheduleStyles.field}
          onPress={() => {
            setPickerMode("time");
            setShowNativePicker(true);
          }}
        >
          <Ionicons name="time-outline" size={18} color={colors.brand} />
          <Text style={scheduleStyles.fieldText}>
            {nativeDate.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
          </Text>
        </TouchableOpacity>
      </View>

      {showNativePicker && DateTimePickerNative && (
        <DateTimePickerNative
          value={nativeDate}
          mode={pickerMode}
          is24Hour={false}
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={handleNativeChange}
          minimumDate={new Date()}
        />
      )}
      {!DateTimePickerNative && (
        <Text style={{ color: colors.textFaint, fontSize: 12, marginBottom: spacing.sm }}>
          Install @react-native-community/datetimepicker for native calendar/clock UI.
        </Text>
      )}

      <TouchableOpacity
        style={scheduleStyles.confirmBtn}
        onPress={() => {
          onConfirm(nativeDate);
          onClose();
        }}
      >
        <Text style={scheduleStyles.confirmText}>Confirm schedule</Text>
      </TouchableOpacity>
    </SheetModal>
  );
}

const webInputStyle: any = {
  border: "none",
  outline: "none",
  fontSize: 13.5,
  fontWeight: 600,
  color: colors.text,
  fontFamily: "inherit",
  background: "transparent",
  marginLeft: 8,
  width: "100%",
};

const scheduleStyles = StyleSheet.create({
  row: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  field: { flex: 1, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: spacing.sm, gap: 8 },
  fieldText: { fontSize: 13.5, color: colors.text, fontWeight: "600" },
  confirmBtn: { backgroundColor: colors.brand, borderRadius: radius.md, paddingVertical: 13, alignItems: "center", marginTop: spacing.sm },
  confirmText: { color: "#fff", fontWeight: "700" },
});

/* ------------------------------------------------------------------ */
/*  Map — react-native-maps on native, Google Maps iframe on web       */
/* ------------------------------------------------------------------ */

const ROUTE_POINTS = [
  { latitude: 22.5726, longitude: 88.4312 },
  { latitude: 22.5695, longitude: 88.4285 },
  { latitude: 22.566, longitude: 88.415 },
  { latitude: 22.5605, longitude: 88.409 },
  { latitude: 22.556, longitude: 88.398 },
  { latitude: 22.5527, longitude: 88.3529 },
];

function RouteMap({
  pickup,
  destination,
  durationMinutes,
  distanceKm,
  pickMode,          // "pickup" | "destination" | null — which field a map tap should fill
  onMapPick,          // (lat, lng) => void
}: {
  pickup: Place;
  destination: Place | null;
  durationMinutes: number;
  distanceKm: number;
  pickMode: "pickup" | "destination" | null;
  onMapPick: (lat: number, lng: number) => void;
}) {
   useEffect(() => {
    if (Platform.OS !== "web") return;
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "map-click" && pickMode) onMapPick(e.data.lat, e.data.lng);
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [pickMode, onMapPick]);

  // Pan the native camera to the pickup point whenever it changes (e.g. the
  // "use current location" button) — initialRegion only applies on first mount.
  const nativeMapRef = useRef<any>(null);
  useEffect(() => {
    if (Platform.OS === "web") return;
    if (!nativeMapRef.current) return;
    nativeMapRef.current.animateToRegion(
      { latitude: pickup.latitude, longitude: pickup.longitude, latitudeDelta: 0.08, longitudeDelta: 0.08 },
      500
    );
  }, [pickup.latitude, pickup.longitude]);

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
        const map = L.map('map').setView([${centerLat}, ${centerLng}], 12);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
        const pin = (color) => L.divIcon({className:'',html:'<div style="width:14px;height:14px;border-radius:7px;background:'+color+';border:2px solid white;"></div>'});
        L.marker([${pickup.latitude}, ${pickup.longitude}], {icon: pin('${colors.pickupDot}')}).addTo(map);
        ${destination ? `L.marker([${destination.latitude}, ${destination.longitude}], {icon: pin('${colors.destDot}')}).addTo(map);
        L.polyline([[${pickup.latitude},${pickup.longitude}],[${destination.latitude},${destination.longitude}]], {color:'${colors.brand}', weight:4}).addTo(map);` : ""}
        map.on('click', function(e) {
          window.parent.postMessage({ type: 'map-click', lat: e.latlng.lat, lng: e.latlng.lng }, '*');
        });
      </script>
      </body></html>
    `;
    return (
      <View style={mapStyles.container}>
        {/* @ts-ignore */}
        <iframe title="interactive-map" srcDoc={html} style={{ border: 0, width: "100%", height: "100%" }} />
        {pickMode && (
          <View style={mapStyles.pickBanner} pointerEvents="none">
            <Text style={mapStyles.pickBannerText}>Tap the map to set {pickMode}</Text>
          </View>
        )}
        {destination && (
          <View style={mapStyles.durationBadge} pointerEvents="none">
            <Text style={mapStyles.durationText}>🚗 {durationMinutes} min</Text>
            <Text style={mapStyles.distanceText}>{distanceKm} km</Text>
          </View>
        )}
      </View>
    );
  }

  if (!MapView) {
    return (
      <View style={[mapStyles.container, mapStyles.mapEmpty]}>
        <Ionicons name="map-outline" size={28} color={colors.textFaint} />
        <Text style={{ color: colors.textFaint, marginTop: 8 }}>Install react-native-maps to render the native map</Text>
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
        onPress={(e: any) => {
          if (pickMode) onMapPick(e.nativeEvent.coordinate.latitude, e.nativeEvent.coordinate.longitude);
        }}
      >
        <Marker coordinate={pickup} title={pickup.label}>
          <View style={[mapStyles.pin, { backgroundColor: colors.pickupDot }]} />
        </Marker>
        {destination && (
          <>
            <Marker coordinate={destination} title={destination.label}>
              <View style={[mapStyles.pin, { backgroundColor: colors.destDot }]} />
            </Marker>
            <Polyline coordinates={[pickup, destination]} strokeColor={colors.brand} strokeWidth={4} />
          </>
        )}
      </MapView>
      {pickMode && (
        <View style={mapStyles.pickBanner} pointerEvents="none">
          <Text style={mapStyles.pickBannerText}>Tap the map to set {pickMode}</Text>
        </View>
      )}
      {destination && (
        <View style={mapStyles.durationBadge}>
          <Text style={mapStyles.durationText}>🚗 {durationMinutes} min</Text>
          <Text style={mapStyles.distanceText}>{distanceKm} km</Text>
        </View>
      )}
    </View>
  );
}
const mapStyles = StyleSheet.create({
  container: { flex: 1, borderRadius: radius.lg, overflow: "hidden", position: "relative" },
  mapEmpty: { alignItems: "center", justifyContent: "center", backgroundColor: "#EEF0F3" },
  pin: { width: 16, height: 16, borderRadius: 8, borderWidth: 3, borderColor: "#fff" },
  durationBadge: {
    position: "absolute",
    top: 20,
    right: 20,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
  },
  durationText: { fontWeight: "700", fontSize: 13 },
  distanceText: { fontSize: 11, color: "#666" },
  pickBanner: {
    position: "absolute",
    top: 20,
    left: 20,
    backgroundColor: colors.brand,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  pickBannerText: { color: "#fff", fontSize: 12, fontWeight: "700" },
});
/* ------------------------------------------------------------------ */
/*  Current-location hook                                               */
/* ------------------------------------------------------------------ */

async function reverseGeocodeWeb(lat: number, lon: number) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`);
    const json = await res.json();
    const addr = json?.address || {};
    const shortLabel =
      json?.name ||
      addr.road ||
      addr.neighbourhood ||
      addr.suburb ||
      addr.village ||
      addr.town ||
      json?.display_name?.split(",")[0] ||
      `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
    // Full address for the input field / stored place; short name kept as sublabel for reference.
    const label = json?.display_name || shortLabel;
    const sublabel = shortLabel;
    return { label, sublabel };
  } catch {
    return { label: `${lat.toFixed(4)}, ${lon.toFixed(4)}`, sublabel: "" };
  }
}

// Joins whatever fields expo-location's reverseGeocodeAsync gave us into one full address string,
// deduping consecutive repeats (e.g. name === street) so it doesn't read redundantly.
function buildFullAddress(place: Location.LocationGeocodedAddress | undefined | null): string {
  if (!place) return "";
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
  return parts.join(", ");
}

function useCurrentLocation() {
  const [loading, setLoading] = useState(false);

  const getCurrentLocation = useCallback(async (): Promise<Place | null> => {
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return null;

      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = position.coords;

      if (Platform.OS === "web") {
        const { label, sublabel } = await reverseGeocodeWeb(latitude, longitude);
        return { label, sublabel, latitude, longitude };
      }

      const results = await Location.reverseGeocodeAsync({ latitude, longitude });
      const place = results?.[0];
      const label = buildFullAddress(place) || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
      const sublabel = [place?.city, place?.region, place?.postalCode].filter(Boolean).join(", ");
      return { label, sublabel, latitude, longitude };
    } catch {
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { getCurrentLocation, loading };
}
function SaveLocationRow({ onSave, onDismiss }: { onSave: (cat: "home" | "work" | "other" | "favorite") => void; onDismiss: () => void }) {
  const options: { key: "home" | "work" | "other" | "favorite"; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: "home", label: "Home", icon: "home-outline" },
    { key: "work", label: "Work", icon: "briefcase-outline" },
    { key: "other", label: "Other", icon: "location-outline" },
    { key: "favorite", label: "Favorite", icon: "star-outline" },
  ];
  return (
    <View style={saveRowStyles.container}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={saveRowStyles.label}>Save this pickup as</Text>
        <TouchableOpacity onPress={onDismiss}>
          <Ionicons name="close" size={14} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
      <View style={saveRowStyles.row}>
        {options.map((o) => (
          <TouchableOpacity key={o.key} style={saveRowStyles.chip} onPress={() => onSave(o.key)}>
            <Ionicons name={o.icon} size={13} color={colors.text} />
            <Text style={saveRowStyles.chipText}>{o.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const saveRowStyles = StyleSheet.create({
  container: { marginTop: -8, marginBottom: spacing.lg, padding: spacing.sm, backgroundColor: "#FAFAFB", borderRadius: radius.md },
  label: { fontSize: 11.5, color: colors.textMuted, marginBottom: 6 },
  row: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  chip: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: 10, backgroundColor: colors.white },
  chipText: { fontSize: 11.5, fontWeight: "600", color: colors.text },
});
/* ------------------------------------------------------------------ */
/*  Screen                                                              */
/* ------------------------------------------------------------------ */

// Blank label so the pickup field shows its placeholder instead of a preset address.
// Coordinates are central Kolkata (Esplanade/Maidan area) so the map opens centered on the city
// rather than one specific neighbourhood, until the rider searches or uses their current location.
const KOLKATA_CENTER: Place = { label: "", sublabel: "", latitude: 22.5677, longitude: 88.3572 };

const WORK_PLACE: Place = { label: "Ecospace Business Park", sublabel: "New Town, Kolkata, West Bengal", latitude: 22.5771, longitude: 88.4297 };

export default function Rider() {
  const { width } = useWindowDimensions();
  const isWide = width >= 980;
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Signup navigates here with `params: { name, username }` after a rider signs up.
  const { name: nameParam } = useLocalSearchParams<{ name?: string | string[]; username?: string | string[] }>();
  const riderName = (Array.isArray(nameParam) ? nameParam[0] : nameParam)?.trim() || "Rider";

  const [city, setCity] = useState("Kolkata");
  const [pickupMode, setPickupMode] = useState<"now" | "later">("now");
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);

  const [pickup, setPickup] = useState<Place>(KOLKATA_CENTER);
  const [destination, setDestination] = useState<Place | null>(null);

  const [riderCount, setRiderCount] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [rideOptions, setRideOptions] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<Place[]>([]);

  const [cityModal, setCityModal] = useState(false);
  const [scheduleModal, setScheduleModal] = useState(false);
  const [riderModal, setRiderModal] = useState(false);
  const [paymentModal, setPaymentModal] = useState(false);
  const [optionsModal, setOptionsModal] = useState(false);

  const { getCurrentLocation, loading: locLoading } = useCurrentLocation();

  const distanceKm = 12.6;
  const durationMinutes = 24;

  const paymentLabel = useMemo(
    () => ({ cash: "Cash", card: "Card", upi: "UPI", wallet: "Wallet" }[paymentMethod] ?? "Cash"),
    [paymentMethod]
  );
  const [activeField, setActiveField] = useState<"pickup" | "destination" | null>(null);
const [showSavePrompt, setShowSavePrompt] = useState(false);
const [savedPlaces, setSavedPlaces] = useState<{
  home?: Place; work?: Place; other: Place[]; favorite: Place[];
}>({ other: [], favorite: [] });

const handleSelectSuggestion = (field: "pickup" | "destination", place: PlaceSuggestion) => {
  if (field === "pickup") {
    setPickup(place);
    setShowSavePrompt(true);
  } else {
    setDestination(place);
  }
  setActiveField(null);
};

const handleMapPick = async (lat: number, lng: number) => {
  const place = await resolvePlaceFromCoords(lat, lng);
  if (activeField === "pickup") {
    setPickup(place);
    setShowSavePrompt(true);
  } else if (activeField === "destination") {
    setDestination(place);
  }
  setActiveField(null);
};

const handleSaveCategory = (cat: "home" | "work" | "other" | "favorite") => {
  setSavedPlaces((prev) => {
    if (cat === "home") return { ...prev, home: pickup };
    if (cat === "work") return { ...prev, work: pickup };
    if (cat === "other") return { ...prev, other: [...prev.other, pickup] };
    return { ...prev, favorite: [...prev.favorite, pickup] };
  });
  setShowSavePrompt(false);
};
 const handleUseCurrentLocation = async () => {
  const loc = await getCurrentLocation();
  if (loc) {
    setPickup(loc);
    setShowSavePrompt(true);
  } else {
    Alert.alert("Location unavailable", "We couldn't access your current location.");
  }
};

  const handleAddFavorite = () => {
    if (!destination) return;
    setFavorites((prev) => (prev.find((f) => f.label === destination.label) ? prev : [...prev, destination]));
    Alert.alert("Saved", `${destination.label} added to your favorites.`);
  };

  const handleSeePrices = () => {
    if (!pickup.label) {
      Alert.alert("Add a pickup location", "Please enter your pickup location, or use your current location.");
      return;
    }
    if (!destination) {
      Alert.alert("Add a destination", "Please choose where you're headed first.");
      return;
    }
    Alert.alert(
      "Fare estimate",
      `${pickup.label} → ${destination.label}\n${distanceKm} km · ${durationMinutes} min\n\nEconomy: ₹${Math.round(distanceKm * 14)}\nPremium: ₹${Math.round(distanceKm * 22)}`
    );
  };

  const scheduleLabel =
    pickupMode === "later" && scheduledAt
      ? scheduledAt.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
      : "Schedule later";

  return (
    <View style={screenStyles.root}>
      {isWide ? (
        <Sidebar user={{ name: riderName, profileLabel: "View profile" }} />
      ) : (
        sidebarOpen && (
          <View style={screenStyles.mobileSidebarOverlay}>
            <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setSidebarOpen(false)} />
            <View style={screenStyles.mobileSidebarPanel}>
              <Sidebar user={{ name: riderName, profileLabel: "View profile" }} />
            </View>
          </View>
        )
      )}

      <View style={{ flex: 1 }}>
        <View style={screenStyles.header}>
          <View style={screenStyles.headerLeft}>
            {!isWide && (
              <TouchableOpacity onPress={() => setSidebarOpen(true)} style={{ marginRight: spacing.md }}>
                <Ionicons name="menu" size={24} color={colors.text} />
              </TouchableOpacity>
            )}
            <View>
              <Text style={screenStyles.headerTitle}>Welcome, {riderName} 👋</Text>
              <Text style={screenStyles.headerSub}>Where are you headed today?</Text>
            </View>
          </View>
          <View style={screenStyles.headerRight}>
            <TouchableOpacity style={{ padding: 6 }}>
              <Ionicons name="notifications-outline" size={20} color={colors.text} />
            </TouchableOpacity>
            <View style={screenStyles.avatarSmall}>
              <Text style={{ fontWeight: "700" }}>{riderName[0]?.toUpperCase() ?? "?"}</Text>
            </View>
          </View>
        </View>

        <ScrollView contentContainerStyle={[screenStyles.content, isWide && screenStyles.contentWide]} showsVerticalScrollIndicator={false}>
          <View style={[screenStyles.card, isWide && screenStyles.cardWide]}>
            <Text style={screenStyles.cardTitle}>Request a ride</Text>

            <TouchableOpacity style={screenStyles.cityRow} onPress={() => setCityModal(true)}>
              <Ionicons name="location" size={16} color={colors.text} />
              <Text style={screenStyles.cityText}>{city}</Text>
              <View style={{ flex: 1 }} />
              <Text style={screenStyles.changeCity}>Change city</Text>
              <Ionicons name="chevron-down" size={14} color={colors.brand} />
            </TouchableOpacity>

            <View style={screenStyles.toggleRow}>
              <TouchableOpacity
                style={[screenStyles.toggleBtn, pickupMode === "now" && screenStyles.toggleBtnActive]}
                onPress={() => setPickupMode("now")}
              >
                <Ionicons name="time" size={15} color={pickupMode === "now" ? colors.brand : colors.textMuted} />
                <Text style={[screenStyles.toggleText, pickupMode === "now" && screenStyles.toggleTextActive]}>Pickup now</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[screenStyles.toggleBtn, pickupMode === "later" && screenStyles.toggleBtnActive]}
                onPress={() => {
                  setPickupMode("later");
                  setScheduleModal(true);
                }}
              >
                <Ionicons name="calendar-outline" size={15} color={pickupMode === "later" ? colors.brand : colors.textMuted} />
                <Text style={[screenStyles.toggleText, pickupMode === "later" && screenStyles.toggleTextActive]} numberOfLines={1}>
                  {scheduleLabel}
                </Text>
              </TouchableOpacity>
            </View>
<View style={{ gap: spacing.sm, marginBottom: spacing.sm }}>
  <LocationSearchField
    placeholder="Enter pickup location"
    value={pickup.label}
    dotColor={colors.pickupDot}
    active={activeField === "pickup"}
    onFocusField={() => setActiveField("pickup")}
    onSelect={(p) => handleSelectSuggestion("pickup", p)}
    onPinPress={() => setActiveField(activeField === "pickup" ? null : "pickup")}
    onLocatePress={handleUseCurrentLocation}
    locating={locLoading}
  />
  <LocationSearchField
    placeholder="Enter destination"
    value={destination?.label ?? ""}
    dotColor={colors.destDot}
    active={activeField === "destination"}
    onFocusField={() => setActiveField("destination")}
    onSelect={(p) => handleSelectSuggestion("destination", p)}
    onPinPress={() => setActiveField(activeField === "destination" ? null : "destination")}
    onClear={() => setDestination(null)}
  />
</View>

{showSavePrompt && (
  <SaveLocationRow onSave={handleSaveCategory} onDismiss={() => setShowSavePrompt(false)} />
)}
            

            <View style={screenStyles.chipsRow}>
              <TouchableOpacity style={screenStyles.chip} onPress={() => savedPlaces.home && setPickup(savedPlaces.home)}>
                <Ionicons name="home-outline" size={16} color={colors.text} />
                <View>
                  <Text style={screenStyles.chipTitle}>Home</Text>
                  <Text style={screenStyles.chipSub}>{savedPlaces.home?.label}</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={screenStyles.chip} onPress={() => savedPlaces.work && setDestination(savedPlaces.work)}>
                <Ionicons name="briefcase-outline" size={16} color={colors.text} />
                <View>
                  <Text style={screenStyles.chipTitle}>Work</Text>
                  <Text style={screenStyles.chipSub}>{savedPlaces.work?.label}</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={screenStyles.chip} onPress={handleAddFavorite}>
                <Ionicons name="star-outline" size={16} color={colors.text} />
                <Text style={screenStyles.chipTitle}>Add favorite</Text>
              </TouchableOpacity>
            </View>

            <View style={screenStyles.optionsRow}>
              <TouchableOpacity style={screenStyles.optionBtn} onPress={() => setRiderModal(true)}>
                <Ionicons name="person-outline" size={16} color={colors.text} />
                <Text style={screenStyles.optionText}>
                  {riderCount} {riderCount === 1 ? "Rider" : "Riders"}
                </Text>
                <Ionicons name="chevron-down" size={13} color={colors.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity style={screenStyles.optionBtn} onPress={() => setPaymentModal(true)}>
                <Ionicons name="card-outline" size={16} color={colors.text} />
                <Text style={screenStyles.optionText}>{paymentLabel}</Text>
                <Ionicons name="chevron-down" size={13} color={colors.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity style={screenStyles.optionBtn} onPress={() => setOptionsModal(true)}>
                <Ionicons name="options-outline" size={16} color={colors.text} />
                <Text style={screenStyles.optionText}>Options{rideOptions.length ? ` (${rideOptions.length})` : ""}</Text>
                <Ionicons name="chevron-down" size={13} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={screenStyles.seePricesBtn} onPress={handleSeePrices}>
              <Text style={screenStyles.seePricesText}>See prices</Text>
              <Ionicons name="chevron-forward" size={18} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={[screenStyles.mapWrap, isWide && screenStyles.mapWrapWide]}>
            <RouteMap
              pickup={pickup}
              destination={destination}
              durationMinutes={durationMinutes}
              distanceKm={distanceKm}
              pickMode={activeField}
              onMapPick={handleMapPick}
            />
          </View>
        </ScrollView>
      </View>

      <CityPickerModal visible={cityModal} currentCity={city} onClose={() => setCityModal(false)} onSelect={setCity} />
      <ScheduleModal visible={scheduleModal} onClose={() => setScheduleModal(false)} onConfirm={setScheduledAt} initialDate={scheduledAt ?? undefined} />
      <RiderCountModal visible={riderModal} count={riderCount} onClose={() => setRiderModal(false)} onSelect={setRiderCount} />
      <PaymentModal visible={paymentModal} method={paymentMethod} onClose={() => setPaymentModal(false)} onSelect={setPaymentMethod} />
      <OptionsModal
        visible={optionsModal}
        selected={rideOptions}
        onClose={() => setOptionsModal(false)}
        onToggle={(key) => setRideOptions((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))}
      />
    </View>
  );
}

const screenStyles = StyleSheet.create({
  root: { flex: 1, flexDirection: "row", backgroundColor: colors.bgApp },
  mobileSidebarOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 20, flexDirection: "row" },
  mobileSidebarPanel: { width: 248, height: "100%" },

  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.md },
  headerLeft: { flexDirection: "row", alignItems: "center" },
  headerTitle: { fontSize: 22, fontWeight: "800", color: colors.text },
  headerSub: { fontSize: 13.5, color: colors.textMuted, marginTop: 2 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatarSmall: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#E9EAEE", alignItems: "center", justifyContent: "center" },

  content: { padding: spacing.xl, gap: spacing.xl },
  contentWide: { flexDirection: "row", alignItems: "flex-start" },

  card: { backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.xl, borderWidth: 1, borderColor: colors.border },
  cardWide: { width: 460 },
  cardTitle: { fontSize: 19, fontWeight: "800", color: colors.text, marginBottom: spacing.lg },

  cityRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.lg },
  cityText: { fontSize: 14.5, fontWeight: "700", color: colors.text },
  changeCity: { fontSize: 13, color: colors.brand, fontWeight: "600", marginRight: 2 },

  toggleRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg },
  toggleBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  toggleBtnActive: { backgroundColor: colors.brandTint, borderColor: colors.brand },
  toggleText: { fontSize: 13, color: colors.textMuted, fontWeight: "600" },
  toggleTextActive: { color: colors.brandDark },

  locationBlock: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, marginBottom: spacing.lg, overflow: "hidden" },
  locationRow: { flexDirection: "row", alignItems: "center", padding: spacing.md, gap: spacing.sm },
  dot: { width: 9, height: 9, borderRadius: 5, marginTop: 4 },
  dashedLine: { height: 1, borderStyle: "dashed", borderWidth: 0.5, borderColor: colors.border, marginLeft: 24 },
  locationLabel: { fontSize: 11.5, color: colors.textMuted },
  locationTitle: { fontSize: 14.5, fontWeight: "700", color: colors.text, marginTop: 1 },
  locationSub: { fontSize: 12, color: colors.textMuted },
  locationPlaceholder: { fontSize: 14, color: colors.textFaint, marginTop: 2 },

  chipsRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg, flexWrap: "wrap" },
  chip: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: spacing.sm, flexGrow: 1 },
  chipTitle: { fontSize: 12.5, fontWeight: "700", color: colors.text },
  chipSub: { fontSize: 10.5, color: colors.textMuted },

  optionsRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg, flexWrap: "wrap" },
  optionBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: spacing.md, flexGrow: 1, justifyContent: "center" },
  optionText: { fontSize: 12.5, fontWeight: "600", color: colors.text },

  seePricesBtn: { backgroundColor: colors.brand, borderRadius: radius.md, paddingVertical: 15, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  seePricesText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  mapWrap: { height: 380, borderRadius: radius.xl, overflow: "hidden", borderWidth: 1, borderColor: colors.border },
  mapWrapWide: { flex: 1, height: 620 },
});