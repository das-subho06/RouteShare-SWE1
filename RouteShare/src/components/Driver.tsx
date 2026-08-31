// DriverDetails.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Platform,
} from 'react-native';

// ---------------------------------------------------------------------------
// Design tokens — mirrors RouteShareLanding / Signup palette
// ---------------------------------------------------------------------------
const COLORS = {
  ink: '#141414',
  inkSoft: '#2a2a2a',
  coral: '#fb6f6a',
  coralDeep: '#f4534c',
  cardGray: '#ececec',
  textMuted: '#5b5b5b',
  white: '#ffffff',
  border: '#dcdcdc',
  pending: '#c9860e',
  verified: '#2a8f4f',
  rejected: '#d13b3b',
};

type VehicleType = 'car' | 'bike' | 'auto' | 'van';
type VerificationStatus = 'pending' | 'verified' | 'rejected';

interface DriverDetailsData {
  licenseNumber: string;
  vehicleNumber: string;
  vehicleType: VehicleType;
  vehicleModel: string;
  seats: string;
  wheels: string;
  verificationStatus: VerificationStatus;
}

interface DriverDetailsProps {
  initialStatus?: VerificationStatus;
  onSubmit?: (data: DriverDetailsData) => void;
}

const VEHICLE_TYPES: { id: VehicleType; label: string; wheels: string }[] = [
  { id: 'bike', label: 'Bike', wheels: '2' },
  { id: 'auto', label: 'Auto', wheels: '3' },
  { id: 'car', label: 'Car', wheels: '4' },
  { id: 'van', label: 'Van', wheels: '4' },
];

const STATUS_STYLES: Record<VerificationStatus, { bg: string; label: string }> = {
  pending: { bg: COLORS.pending, label: 'Pending review' },
  verified: { bg: COLORS.verified, label: 'Verified' },
  rejected: { bg: COLORS.rejected, label: 'Rejected — resubmit' },
};

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  maxLength,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'number-pad';
  maxLength?: number;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9a9a9a"
        keyboardType={keyboardType}
        maxLength={maxLength}
        autoCapitalize="characters"
        style={styles.fieldInput}
      />
    </View>
  );
}

export default function DriverDetails({
  initialStatus = 'pending',
  onSubmit,
}: DriverDetailsProps) {
  const [licenseNumber, setLicenseNumber] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [vehicleType, setVehicleType] = useState<VehicleType>('car');
  const [vehicleModel, setVehicleModel] = useState('');
  const [seats, setSeats] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const status = initialStatus;
  const wheels = VEHICLE_TYPES.find((v) => v.id === vehicleType)?.wheels ?? '4';

  const submit = () => {
    if (!licenseNumber || !vehicleNumber || !vehicleModel) {
      setMessage('Fill in your license number, vehicle number, and model.');
      return;
    }
    if (!seats || isNaN(Number(seats)) || Number(seats) < 1) {
      setMessage('Enter a valid seat count.');
      return;
    }

    const data: DriverDetailsData = {
      licenseNumber,
      vehicleNumber,
      vehicleType,
      vehicleModel,
      seats,
      wheels,
      verificationStatus: status,
    };

    onSubmit?.(data);
    setSubmitted(true);
    setMessage('');
  };

  if (submitted) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>Vehicle details submitted</Text>
        <Text style={styles.successMsg}>
          We\u2019ll review your documents and update your verification status shortly.
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: STATUS_STYLES[status].bg }]}>
          <Text style={styles.statusLabel}>{STATUS_STYLES[status].label}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Vehicle & license details</Text>

      <View style={[styles.statusBadge, { backgroundColor: STATUS_STYLES[status].bg, marginBottom: 20 }]}>
        <Text style={styles.statusLabel}>{STATUS_STYLES[status].label}</Text>
      </View>

      <Field
        label="Driving license number"
        value={licenseNumber}
        onChangeText={setLicenseNumber}
        placeholder="DL-1420110012345"
      />
      <Field
        label="Vehicle number"
        value={vehicleNumber}
        onChangeText={setVehicleNumber}
        placeholder="WB 06 AB 1234"
      />

      {/* Vehicle type selector — drives wheel count automatically */}
      <Text style={styles.fieldLabel}>Vehicle type</Text>
      <View style={styles.typeGrid}>
        {VEHICLE_TYPES.map((v) => (
          <Pressable
            key={v.id}
            onPress={() => setVehicleType(v.id)}
            style={[
              styles.typeBtn,
              vehicleType === v.id && styles.typeBtnActive,
            ]}
          >
            <Text
              style={[
                styles.typeLabel,
                vehicleType === v.id && styles.typeLabelActive,
              ]}
            >
              {v.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Field
        label="Vehicle model"
        value={vehicleModel}
        onChangeText={setVehicleModel}
        placeholder="e.g. Maruti Swift, Honda Activa"
      />
      <Field
        label="Number of seats (excluding driver)"
        value={seats}
        onChangeText={(t) => setSeats(t.replace(/[^0-9]/g, ''))}
        placeholder="e.g. 4"
        keyboardType="number-pad"
        maxLength={2}
      />

      {/* Read-only, auto-derived from vehicle type */}
      <View style={styles.fieldWrap}>
        <Text style={styles.fieldLabel}>Number of wheels</Text>
        <View style={styles.readOnlyBox}>
          <Text style={styles.readOnlyText}>{wheels}</Text>
        </View>
      </View>

      {!!message && <Text style={styles.modalMsg}>{message}</Text>}

      <Pressable
        onPress={submit}
        style={({ pressed }) => [styles.submitBtn, pressed && { opacity: 0.85 }]}
      >
        <Text style={styles.submitLabel}>Submit for verification</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.ink,
    marginBottom: 18,
  },
  successMsg: {
    fontSize: 14,
    color: COLORS.inkSoft,
    lineHeight: 21,
    marginBottom: 16,
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
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 14,
    color: COLORS.ink,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  typeBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  typeBtnActive: {
    backgroundColor: COLORS.ink,
    borderColor: COLORS.ink,
  },
  typeLabel: {
    fontSize: 13.5,
    fontWeight: '700',
    color: COLORS.ink,
  },
  typeLabelActive: { color: COLORS.white },
  readOnlyBox: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    backgroundColor: COLORS.cardGray,
  },
  readOnlyText: { fontSize: 14, color: COLORS.inkSoft, fontWeight: '600' },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusLabel: { color: COLORS.white, fontWeight: '700', fontSize: 12.5 },
  modalMsg: {
    fontSize: 13.5,
    color: COLORS.coralDeep,
    marginBottom: 14,
    lineHeight: 19,
  },
  submitBtn: {
    backgroundColor: COLORS.coral,
    paddingVertical: 14,
    borderRadius: 30,
    alignItems: 'center',
  },
  submitLabel: { color: COLORS.white, fontWeight: '700', fontSize: 15 },
});