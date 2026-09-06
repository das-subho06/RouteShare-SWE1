// Login.tsx
import React, { useState } from 'react';
import { API_URL } from './config';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Platform,
} from 'react-native';

// ---------------------------------------------------------------------------
// Design tokens — mirrors Signup / DriverDetails / RouteShareLanding palette
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

// The screen can be in one of these modes at any time
type Mode = 'login' | 'forgotPhone' | 'forgotOtp' | 'resetPassword' | 'resetDone';

interface LoginProps {
  onLogin?: (data: { username: string; password: string; designation: Designation }) => void;
  onPasswordReset?: (data: { phone: string; newPassword: string; designation: Designation }) => void;
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secure,
  keyboardType,
  maxLength,
  autoCapitalize = 'none',
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  secure?: boolean;
  keyboardType?: 'default' | 'phone-pad' | 'number-pad';
  maxLength?: number;
  autoCapitalize?: 'none' | 'words' | 'sentences' | 'characters';
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
        autoCapitalize={autoCapitalize}
        style={styles.fieldInput}
      />
    </View>
  );
}

export default function Login({ onLogin, onPasswordReset }: LoginProps) {
  const router = useRouter();
  const [designation, setDesignation] = useState<Designation>('user');
  const [mode, setMode] = useState<Mode>('login');
  const [message, setMessage] = useState('');

  // Login fields
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Forgot-password flow fields
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const resetForgotState = () => {
    setPhone('');
    setOtp('');
    setOtpSent(false);
    setNewPassword('');
    setConfirmPassword('');
    setMessage('');
  };

  // ---- Login ----
  const submitLogin = async () => {
  if (!username || !password) {
    setMessage(`Enter your ${designation === 'driver' ? 'name' : 'username'} and password.`);
    return;
  }
  try {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, designation }),
    });
    const data = await res.json();

    if (!res.ok) {
      if (data.error === 'new_user') {
        setMessage('You are a new user, please signup.');
      } else if (data.error === 'wrong_password') {
        setMessage('Password incorrect.');
      } else {
        setMessage(data.message || 'Login failed.');
      }
      return;
    }
    await AsyncStorage.multiSet([
  ['token', data.token],
  ['userId', String(data.userId)],
  ['designation', data.designation],
  ['name', data.name],
]);
    setMessage('');
    onLogin?.({ username, password, designation }); // parent can also read data.token/data.redirectTo
    router.replace({ pathname: data.redirectTo, params: { name: data.name, username } }); // '/ride' or '/driverDashboard'
  } catch (err) {
    setMessage('Network error. Please try again.');
  }
};

  // ---- Forgot password: step 1, send code to phone ----
const sendCode = async () => {
  if (phone.length !== 10) {
    setMessage('Enter a valid 10-digit phone number.');
    return;
  }
  try {
    const res = await fetch(`${API_URL}/otp/send-reset-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || 'Could not send code.');
      return;
    }
    setOtpSent(true);
    setMessage(`Verification code sent to ${phone}.`);
    setMode('forgotOtp');
  } catch {
    setMessage('Network error. Please try again.');
  }
}; 

  // ---- Forgot password: step 2, verify the code ----
  const verifyCode = () => {
  if (otp.length !== 6) {
    setMessage('Enter the 6-digit code sent to your phone.');
    return;
  }
  setMessage('');
  setMode('resetPassword'); // actual verification happens in submitNewPassword
};

  const resendCode = () => {
    setOtp('');
    setMessage(`Verification code resent to ${phone}.`);
  };

  // ---- Forgot password: step 3, set a new password ----
  const submitNewPassword = async () => {
  if (newPassword.length < 8) {
    setMessage('Password should be at least 8 characters.');
    return;
  }
  if (newPassword !== confirmPassword) {
    setMessage('Passwords don\u2019t match.');
    return;
  }
  try {
    const res = await fetch(`${API_URL}/otp/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code: otp, newPassword }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || 'Could not reset password.');
      return;
    }
    onPasswordReset?.({ phone, newPassword, designation });
    setMode('resetDone');
    setMessage('');
  } catch {
    setMessage('Network error. Please try again.');
  }
};

  const backToLogin = () => {
    resetForgotState();
    setMode('login');
  };

  // ---------------------------------------------------------------------
  // Designation toggle — shared across every mode
  // ---------------------------------------------------------------------
  const DesignationToggle = (
    <>
      <Text style={styles.fieldLabel}>I am logging in as</Text>
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
    </>
  );

  // ---------------------------------------------------------------------
  // Mode: reset complete
  // ---------------------------------------------------------------------
  if (mode === 'resetDone') {
    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>Password updated</Text>
        <Text style={styles.successMsg}>
          Your password has been changed. You can now log in with your new password.
        </Text>
        <Pressable
          onPress={backToLogin}
          style={({ pressed }) => [styles.submitBtn, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.submitLabel}>Back to login</Text>
        </Pressable>
      </View>
    );
  }

  // ---------------------------------------------------------------------
  // Mode: set new password
  // ---------------------------------------------------------------------
  if (mode === 'resetPassword') {
    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>Set a new password</Text>
        <Text style={styles.successMsg}>Choose a new password for your account.</Text>

        <Field
          label="New password"
          value={newPassword}
          onChangeText={setNewPassword}
          placeholder="••••••••"
          secure
        />
        <Field
          label="Confirm new password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="••••••••"
          secure
        />

        {!!message && <Text style={styles.modalMsg}>{message}</Text>}

        <Pressable
          onPress={submitNewPassword}
          style={({ pressed }) => [styles.submitBtn, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.submitLabel}>Update password</Text>
        </Pressable>

        <Pressable onPress={backToLogin} style={styles.linkBtn}>
          <Text style={styles.linkText}>Cancel</Text>
        </Pressable>
      </View>
    );
  }

  // ---------------------------------------------------------------------
  // Mode: enter OTP
  // ---------------------------------------------------------------------
  if (mode === 'forgotOtp') {
    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>Verify your phone</Text>
        <Text style={styles.successMsg}>
          Enter the 6-digit code sent to {phone}.
        </Text>

        <Field
          label="Verification code"
          value={otp}
          onChangeText={(t) => setOtp(t.replace(/[^0-9]/g, ''))}
          placeholder="6-digit code"
          keyboardType="number-pad"
          maxLength={6}
        />

        {!!message && <Text style={styles.modalMsg}>{message}</Text>}

        <Pressable
          onPress={verifyCode}
          style={({ pressed }) => [styles.submitBtn, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.submitLabel}>Verify code</Text>
        </Pressable>

        <Pressable onPress={resendCode} style={styles.linkBtn}>
          <Text style={styles.linkText}>Resend code</Text>
        </Pressable>
        <Pressable onPress={backToLogin} style={styles.linkBtn}>
          <Text style={styles.linkText}>Cancel</Text>
        </Pressable>
      </View>
    );
  }

  // ---------------------------------------------------------------------
  // Mode: enter phone number
  // ---------------------------------------------------------------------
  if (mode === 'forgotPhone') {
    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>Reset your password</Text>
        <Text style={styles.successMsg}>
          Enter the phone number linked to your account. We will send you a code to verify it's you.
        </Text>

        <Field
          label="Phone number"
          value={phone}
          onChangeText={(t) => setPhone(t.replace(/[^0-9]/g, ''))}
          placeholder="10-digit phone number"
          keyboardType="phone-pad"
          maxLength={10}
        />

        {!!message && <Text style={styles.modalMsg}>{message}</Text>}

        <Pressable
          onPress={sendCode}
          style={({ pressed }) => [styles.submitBtn, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.submitLabel}>Send code</Text>
        </Pressable>

        <Pressable onPress={backToLogin} style={styles.linkBtn}>
          <Text style={styles.linkText}>Cancel</Text>
        </Pressable>
      </View>
    );
  }

  // ---------------------------------------------------------------------
  // Mode: login (default)
  // ---------------------------------------------------------------------
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Log in</Text>

      {DesignationToggle}

      <Field
        label={designation === 'driver' ? 'Name' : 'Username'}
        value={username}
        onChangeText={setUsername}
        placeholder={designation === 'driver' ? 'Jane Doe' : 'janedoe_23'}
      />
      <Field
        label="Password"
        value={password}
        onChangeText={setPassword}
        placeholder="••••••••"
        secure
      />

      <Pressable
        onPress={() => {
          resetForgotState();
          setMode('forgotPhone');
        }}
        style={styles.linkBtn}
      >
        <Text style={styles.linkText}>Forgot password?</Text>
      </Pressable>

      {!!message && <Text style={styles.modalMsg}>{message}</Text>}

      <Pressable
        onPress={submitLogin}
        style={({ pressed }) => [styles.submitBtn, pressed && { opacity: 0.85 }]}
      >
        <Text style={styles.submitLabel}>Log in</Text>
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
  linkBtn: {
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  linkText: {
    color: COLORS.coralDeep,
    fontWeight: '700',
    fontSize: 13,
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
    marginBottom: 12,
  },
  submitLabel: { color: COLORS.white, fontWeight: '700', fontSize: 15 },
});