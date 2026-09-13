import React, { useState } from 'react';
import AsyncStorage from "./lib/storage";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Platform,
} from 'react-native';
import { API_URL } from './config';
import { useRouter } from 'expo-router';
import DriverDetails from './Driver/Driver';

// ---------------------------------------------------------------------------
// Design tokens — mirrors RouteShareLanding's palette
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
};

type Designation = 'user' | 'driver';
type Gender = 'male' | 'female' | 'other';

interface SignupProps {
  onSubmit?: (data: {
    name: string;
    email: string;
    password: string;
    phone: string;
    aadhar: string;
    designation: Designation;
    username?: string;
    gender?: Gender;
    dob?: string;
  }) => void;
  /** Called right before we navigate a rider away to the full /rider page,
   *  so the parent can dismiss whatever modal is wrapping this form. */
  onClose?: () => void;
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secure,
  keyboardType,
  maxLength,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  secure?: boolean;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'number-pad';
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
        secureTextEntry={secure}
        keyboardType={keyboardType}
        maxLength={maxLength}
        autoCapitalize="none"
        style={styles.fieldInput}
      />
    </View>
  );
}

const GENDER_OPTIONS: { id: Gender; label: string }[] = [
  { id: 'male', label: 'Male' },
  { id: 'female', label: 'Female' },
  { id: 'other', label: 'Other' },
];

// Formats raw digits into DD/MM/YYYY as the person types
function formatDob(raw: string) {
  const digits = raw.replace(/[^0-9]/g, '').slice(0, 8);
  const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean);
  return parts.join('/');
}

export default function Signup({ onSubmit, onClose }: SignupProps) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [aadhar, setAadhar] = useState('');
  const [designation, setDesignation] = useState<Designation>('user');
  const [showVerifiedScreen, setShowVerifiedScreen] = useState(false);
  const [showDriverDetails, setShowDriverDetails] = useState(false);
  const [createdUserId, setCreatedUserId] = useState<number | null>(null); // NEW: Store the user ID
  const [username, setUsername] = useState('');
  const [gender, setGender] = useState<Gender | ''>('');
  const [dob, setDob] = useState('');

  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const isRider = designation === 'user';

  const sendCode = async () => {
    if (phone.length < 10) {
      setMessage('Enter a valid 10-digit phone number first.');
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`${API_URL}/otp/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Could not send code.');
      setOtpSent(true);
      setMessage(`Verification code sent to ${phone}.`);
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setSending(false);
    }
  };

  const verifyCode = async () => {
    if (otp.length !== 6) {
      setMessage('Enter the 6-digit code sent to your phone.');
      return;
    }
    setVerifying(true);
    try {
      const res = await fetch(`${API_URL}/otp/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code: otp }),
      });
      const result = await res.json();
      if (!res.ok || !result.verified) throw new Error(result.error || 'Incorrect code.');
      setOtpVerified(true);
      setMessage('Phone number verified.');
      setShowVerifiedScreen(true);
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setVerifying(false);
    }
  };

  const submit = async () => {
    if (!name || !email || !password) {
      setMessage('Fill in your name, email, and password.');
      return;
    }
    if (phone.length < 10) {
      setMessage('Enter a valid phone number.');
      return;
    }
    if (aadhar.length !== 12) {
      setMessage('Aadhar number should be 12 digits.');
      return;
    }
    if (!otpVerified) {
      setMessage('Please verify your phone number first.');
      return;
    }
    if (isRider) {
      if (!username) {
        setMessage('Choose a username.');
        return;
      }
      if (!gender) {
        setMessage('Select your gender.');
        return;
      }
      if (dob.length !== 10) {
        setMessage('Enter your date of birth as DD/MM/YYYY.');
        return;
      }
    }

    setMessage('');
    const payload = {
      name,
      email,
      password,
      phone,
      aadhar,
      designation,
      ...(isRider ? { username, gender: gender as Gender, dob } : {}),
    };

    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Signup failed.');
      await AsyncStorage.setItem('userId', String(result.userId));
      onSubmit?.(payload);

      if (isRider) {
        // Full page, not a box inside this modal — close the modal and navigate.
        onClose?.();
        router.push({ pathname: '/rider', params: { name, username } });
        return;
      }
      
      // NEW: Store the userId and show the driver details form
      setCreatedUserId(result.userId);
      setShowDriverDetails(true);
      setSubmitted(true);
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (showVerifiedScreen) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>✓ Phone verified!</Text>
        <Text style={styles.successMsg}>
          {phone} has been verified successfully. Routing is working — tap continue to finish signing up.
        </Text>
        <Pressable
          onPress={() => setShowVerifiedScreen(false)}
          style={({ pressed }) => [styles.submitBtn, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.submitLabel}>Continue</Text>
        </Pressable>
      </View>
    );
  }

  // NEW: Updated DriverDetails block
  if (showDriverDetails) {
    return (
      <DriverDetails
        onSubmit={async (data) => {
          try {
            // Save the driver details to the database using the stored userId
            const res = await fetch(`${API_URL}/driver/driver-details`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId: createdUserId,
                ...data 
              }),
            });
            
            const result = await res.json();
            if (!res.ok) throw new Error(result.error || 'Failed to save driver details.');

            // Hide the details form and navigate to the new page using the router
            setShowDriverDetails(false);
            onClose?.(); // Close the modal if there is one
            router.push({ pathname: '/driverDashboard', params: { name, username:name } });
            
          } catch (err: any) {
            setMessage(err.message);
          }
        }}
      />
    );
  }

  if (submitted) {
    return (
      <View style={styles.wrap}>
         <Text style={styles.title}>You are all set, {name}!</Text>
         <Text style={styles.successMsg}>
           Your {designation} account has been created. A confirmation was sent to {email}.
        </Text>
       </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Create your account</Text>

      {/* Designation toggle */}
      <Text style={styles.fieldLabel}>I am signing up as</Text>
      <View style={styles.segmentWrap}>
        {(['user', 'driver'] as Designation[]).map((d) => (
          <Pressable
            key={d}
            onPress={() => setDesignation(d)}
            style={[
              styles.segmentBtn,
              designation === d && styles.segmentBtnActive,
            ]}
          >
            <Text
              style={[
                styles.segmentLabel,
                designation === d && styles.segmentLabelActive,
              ]}
            >
              {d === 'user' ? 'Rider' : 'Driver'}
            </Text>
          </Pressable>
        ))}
      </View>

      <Field label="Full name" value={name} onChangeText={setName} placeholder="Jane Doe" />

      {/* Rider-only fields */}
      {isRider && (
        <>
          <Field
            label="Username"
            value={username}
            onChangeText={setUsername}
            placeholder="janedoe_23"
          />

          <Text style={styles.fieldLabel}>Gender</Text>
          <View style={styles.segmentWrap}>
            {GENDER_OPTIONS.map((g) => (
              <Pressable
                key={g.id}
                onPress={() => setGender(g.id)}
                style={[
                  styles.segmentBtn,
                  gender === g.id && styles.segmentBtnActive,
                ]}
              >
                <Text
                  style={[
                    styles.segmentLabel,
                    gender === g.id && styles.segmentLabelActive,
                  ]}
                >
                  {g.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Field
            label="Date of birth"
            value={dob}
            onChangeText={(t) => setDob(formatDob(t))}
            placeholder="DD/MM/YYYY"
            keyboardType="number-pad"
            maxLength={10}
          />
        </>
      )}

      <Field
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        keyboardType="email-address"
      />
      <Field
        label="Password"
        value={password}
        onChangeText={setPassword}
        placeholder="••••••••"
        secure
      />
      <Field
        label="Aadhar number"
        value={aadhar}
        onChangeText={(t) => setAadhar(t.replace(/[^0-9]/g, ''))}
        placeholder="12-digit Aadhar number"
        keyboardType="number-pad"
        maxLength={12}
      />

      {/* Phone + OTP verification */}
      <Text style={styles.fieldLabel}>Phone number</Text>
      <View style={styles.phoneRow}>
        <TextInput
          value={phone}
          onChangeText={(t) => {
            setPhone(t.replace(/[^0-9]/g, ''));
            setOtpSent(false);
            setOtpVerified(false);
          }}
          placeholder="10-digit phone number"
          placeholderTextColor="#9a9a9a"
          keyboardType="phone-pad"
          maxLength={10}
          style={[styles.fieldInput, { flex: 1 }]}
        />
        <Pressable
          onPress={sendCode}
          disabled={otpVerified}
          style={[styles.otpBtn, otpVerified && { opacity: 0.5 }]}
        >
          <Text style={styles.otpBtnLabel}>
            {otpSent ? 'Resend' : 'Send code'}
          </Text>
        </Pressable>
      </View>

      {otpSent && !otpVerified && (
        <View style={styles.phoneRow}>
          <TextInput
            value={otp}
            onChangeText={(t) => setOtp(t.replace(/[^0-9]/g, ''))}
            placeholder="6-digit code"
            placeholderTextColor="#9a9a9a"
            keyboardType="number-pad"
            maxLength={6}
            style={[styles.fieldInput, { flex: 1 }]}
          />
          <Pressable onPress={verifyCode} style={styles.otpBtn}>
            <Text style={styles.otpBtnLabel}>Verify</Text>
          </Pressable>
        </View>
      )}

      {otpVerified && <Text style={styles.verifiedTag}>✓ Phone verified</Text>}

      {!!message && <Text style={styles.modalMsg}>{message}</Text>}

      <Pressable
        onPress={submit}
        disabled={submitting}
        style={({ pressed }) => [
          styles.submitBtn,
          (pressed || submitting) && { opacity: 0.85 },
        ]}
      >
        <Text style={styles.submitLabel}>{submitting ? 'Signing up…' : 'Sign up'}</Text>
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
  segmentWrap: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  segmentBtnActive: {
    backgroundColor: COLORS.ink,
    borderColor: COLORS.ink,
  },
  segmentLabel: {
    fontSize: 13.5,
    fontWeight: '700',
    color: COLORS.ink,
  },
  segmentLabelActive: { color: COLORS.white },
  phoneRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    marginBottom: 16,
  },
  otpBtn: {
    backgroundColor: COLORS.ink,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
  },
  otpBtnLabel: { color: COLORS.white, fontWeight: '700', fontSize: 12.5 },
  verifiedTag: {
    color: '#2a8f4f',
    fontWeight: '700',
    fontSize: 12.5,
    marginBottom: 16,
  },
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