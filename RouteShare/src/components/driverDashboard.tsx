import React, { useRef, useState } from 'react';
import { Video, ResizeMode } from 'expo-av';
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
export default function DriverDashboard() {
    return(
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f0f0' }}>
            <Text>Driver Dashboard</Text>
        </View>
    )
}