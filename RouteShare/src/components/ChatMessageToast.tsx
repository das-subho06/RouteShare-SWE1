import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePathname, useRouter } from 'expo-router';

import { getSocket } from './lib/socket';

type ChatNotification = {
  conversationId: string;
  messageId?: string | null;
  senderId: string;
  senderName: string;
  messageType: string;
  message: string;
};

export default function ChatMessageToast() {
  const router = useRouter();
  const pathname = usePathname();

  const [notification, setNotification] =
    useState<ChatNotification | null>(null);

  const [userId, setUserId] = useState<string | null>(null);

  const slideAnim = useRef(new Animated.Value(-120)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---------------------------------------------------------
  // Get logged-in user
  // ---------------------------------------------------------

  useEffect(() => {
    let mounted = true;

    const loadUser = async () => {
      const id = await AsyncStorage.getItem('userId');

      if (mounted) {
        setUserId(id);
      }
    };

    loadUser();

    return () => {
      mounted = false;
    };
  }, []);

  // ---------------------------------------------------------
  // Socket listener
  // ---------------------------------------------------------

  useEffect(() => {
    if (!userId) return;

    const socket = getSocket();

    const joinUserRoom = () => {
      console.log('👤 Joining global chat notification room:', userId);

      socket.emit('user_online', {
        userId,
      });
    };

    if (socket.connected) {
      joinUserRoom();
    } else {
      socket.once('connect', joinUserRoom);
    }

    const handleChatNotification = (
      payload: ChatNotification
    ) => {
      console.log('💬 GLOBAL CHAT NOTIFICATION:', payload);

      // Never show the global notification while inside Chat.
      if (pathname?.toLowerCase().includes('chat')) {
        return;
      }

      // Don't show notifications from ourselves.
      if (String(payload.senderId) === String(userId)) {
        return;
      }

      setNotification(payload);

      // Clear previous timer
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
      }

      // Slide down
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        friction: 8,
        tension: 70,
      }).start();

      // Auto hide
      hideTimer.current = setTimeout(() => {
        hideNotification();
      }, 4000);
    };

    socket.on(
      'chat_message_notification',
      handleChatNotification
    );

    return () => {
      socket.off(
        'chat_message_notification',
        handleChatNotification
      );

      socket.off('connect', joinUserRoom);

      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
      }
    };
  }, [userId, pathname]);

  // ---------------------------------------------------------
  // Hide notification
  // ---------------------------------------------------------

  const hideNotification = () => {
    Animated.timing(slideAnim, {
      toValue: -120,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      setNotification(null);
    });
  };

  // ---------------------------------------------------------
  // Open chat
  // ---------------------------------------------------------

  const openChat = () => {
    if (!notification) return;

    const conversationId = notification.conversationId;

    hideNotification();

    router.push({
      pathname: '/chat',
      params: {
        conversationId,
      },
    });
  };

  // ---------------------------------------------------------
  // Message preview
  // ---------------------------------------------------------

  const getPreview = () => {
    if (!notification) return '';

    switch (notification.messageType) {
      case 'image':
        return '📷 Photo';

      case 'location':
        return '📍 Location';

      case 'file':
        return '📎 File';

      case 'audio':
        return '🎤 Voice message';

      default:
        return notification.message || 'New message';
    }
  };

  if (!notification) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [
            {
              translateY: slideAnim,
            },
          ],
        },
      ]}
    >
      <Pressable
        style={styles.toast}
        onPress={openChat}
      >
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>💬</Text>
        </View>

        <View style={styles.content}>
          <Text
            style={styles.sender}
            numberOfLines={1}
          >
            {notification.senderName}
          </Text>

          <Text
            style={styles.message}
            numberOfLines={2}
          >
            {getPreview()}
          </Text>
        </View>

        <Pressable
          onPress={(event) => {
            event.stopPropagation();
            hideNotification();
          }}
          style={styles.closeButton}
        >
          <Text style={styles.closeText}>×</Text>
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 55,
    left: 16,
    right: 16,
    zIndex: 99999,
    elevation: 99999,
  },

  toast: {
    minHeight: 72,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',

    paddingHorizontal: 14,
    paddingVertical: 12,

    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.18,
    shadowRadius: 10,

    elevation: 10,
  },

  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  icon: {
    fontSize: 22,
  },

  content: {
    flex: 1,
  },

  sender: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 3,
  },

  message: {
    fontSize: 13,
    color: '#6b7280',
  },

  closeButton: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },

  closeText: {
    fontSize: 25,
    color: '#9ca3af',
    lineHeight: 25,
  },
});