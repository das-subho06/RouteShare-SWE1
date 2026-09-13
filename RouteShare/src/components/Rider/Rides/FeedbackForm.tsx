import React, { useState } from 'react';
import AsyncStorage from '../../lib/storage';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  SafeAreaView,
  Platform,
} from 'react-native';
import { API_URL } from '../../config';
import { useLocalSearchParams } from 'expo-router';
import {useRouter} from 'expo-router';
// -----------------------------------------------------------------------
// Colors / theme
// -----------------------------------------------------------------------
const CORAL = '#F65E5E';
const CORAL_LIGHT = '#FDECEC';
const DARK_TEXT = '#1F2937';
const PLACEHOLDER = '#9CA3AF';
const BORDER = '#E5E7EB';
const BG = '#EEF1F5';
const CARD_BG = '#FFFFFF';

const MAX_STARS = 5;

export default function FeedbackForm() {
  const router = useRouter();
   const { requestId, driverId, riderId, riderName } = useLocalSearchParams<{
    requestId?: string; driverId?: string; riderId?: string;riderName?: string
  }>();
  const [rating, setRating] = useState(0);
  const [description, setDescription] = useState('');
  const [email, setEmail] = useState('');
  const [attachmentName, setAttachmentName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // -------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------
  const handleStarPress = (index: number) => {
    // Tapping the same star that is already the top of the current
    // rating clears it back to 0, otherwise sets rating to index+1.
    setRating((prev) => (prev === index + 1 ? 0 : index + 1));
  };

  const handleAttachPress = () => {
    // Native file/image pickers require an additional native module
    // (e.g. expo-document-picker / expo-image-picker). Since this file
    // is meant to be dependency-free and drop-in, we simulate the
    // attach action here. Swap the body of this function for a real
    // picker call if you add one of those packages to your project.
    if (attachmentName) {
      Alert.alert('Remove attachment?', `Remove "${attachmentName}"?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => setAttachmentName(null),
        },
      ]);
      return;
    }

    Alert.alert('Attach a file', 'Choose an attachment source', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Simulate Photo',
        onPress: () => setAttachmentName('screenshot.png'),
      },
      {
        text: 'Simulate Document',
        onPress: () => setAttachmentName('notes.pdf'),
      },
    ]);
  };

  const isValidEmail = (value: string) => {
    if (!value) return true; // email is optional
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  };

  const resetForm = () => {
    setRating(0);
    setDescription('');
    setEmail('');
    setAttachmentName(null);
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert('Rating required', 'Please tap a star to rate our service.');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Description required', 'Please describe your experience.');
      return;
    }
    if (!isValidEmail(email.trim())) {
      Alert.alert('Invalid email', 'Please enter a valid email address or leave it blank.');
      return;
    }

    setSubmitting(true);
    try {
  const res = await fetch(`${API_URL}/driver-rating`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      rideId: requestId,
      driverId,
      riderId,
      rating,
      description: description.trim(),
    }),
  });
   setSubmitting(false);

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    Alert.alert('Could not submit feedback', err.error ?? 'Please try again.');
    return;
  }
    Alert.alert(
    'Thank you!',
    `Your feedback has been submitted.\n\nRating: ${rating}/${MAX_STARS}`
  );
   const name = (Array.isArray(riderName) ? riderName[0] : riderName) || '';
  router.replace({ pathname: '/rider', params: { name, username: name } });
} catch (err) {
  setSubmitting(false);
  Alert.alert('Could not submit feedback', 'Please check your connection and try again.');
}
  };

  // -------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerText}>Give us your feedback</Text>
          </View>

          <View style={styles.body}>
            {/* Rating */}
            <Text style={styles.label}>How would you rate our service?</Text>
            <View style={styles.starsRow}>
              {Array.from({ length: MAX_STARS }).map((_, index) => {
                const filled = index < rating;
                return (
                  <TouchableOpacity
                    key={index}
                    onPress={() => handleStarPress(index)}
                    activeOpacity={0.6}
                    hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                    accessibilityRole="button"
                    accessibilityLabel={`Rate ${index + 1} star${index === 0 ? '' : 's'}`}
                  >
                    <Text style={[styles.star, filled && styles.starFilled]}>
                      {filled ? '★' : '☆'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Description */}
            <Text style={styles.label}>Describe your experience</Text>
            <TextInput
              style={styles.textArea}
              placeholder="Type something here..."
              placeholderTextColor={PLACEHOLDER}
              multiline
              numberOfLines={6}
              value={description}
              onChangeText={setDescription}
              textAlignVertical="top"
            />                       {/* Bottom row: attach + submit */}
            <View style={styles.bottomRow}>
             

              <TouchableOpacity
                style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                activeOpacity={0.85}
                disabled={submitting}
                accessibilityRole="button"
                accessibilityLabel="Submit feedback"
              >
                <Text style={styles.submitText}>
                  {submitting ? 'Submitting...' : 'Submit'}
                </Text>
              </TouchableOpacity>
            </View>

            
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// -----------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BG,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: CARD_BG,
    borderRadius: 24,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.08,
        shadowRadius: 20,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  header: {
    paddingVertical: 22,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  headerText: {
    color: CORAL,
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  body: {
    padding: 22,
  },
  label: {
    fontSize: 17,
    fontWeight: '600',
    color: DARK_TEXT,
    textAlign: 'center',
    marginBottom: 14,
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 24,
  },
  star: {
    fontSize: 40,
    color: CORAL,
    marginHorizontal: 8,
  },
  starFilled: {
    color: CORAL,
  },
  textArea: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    padding: 16,
    minHeight: 150,
    fontSize: 15,
    color: DARK_TEXT,
    marginBottom: 16,
    backgroundColor: '#FAFBFC',
  },
  input: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: DARK_TEXT,
    marginBottom: 12,
    backgroundColor: '#FAFBFC',
  },
  attachmentPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: CORAL_LIGHT,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  attachmentText: {
    color: DARK_TEXT,
    fontSize: 13,
    flex: 1,
    marginRight: 8,
  },
  attachmentRemove: {
    color: CORAL,
    fontSize: 14,
    fontWeight: '700',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  attachButton: {
    width: 56,
    height: 56,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    backgroundColor: '#FAFBFC',
  },
  attachIcon: {
    fontSize: 22,
    color: CORAL,
  },
  submitButton: {
    flex: 1,
    height: 56,
    borderRadius: 14,
    backgroundColor: CORAL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  footer: {
    textAlign: 'center',
    color: PLACEHOLDER,
    fontSize: 13,
    marginTop: 18,
  },
});
