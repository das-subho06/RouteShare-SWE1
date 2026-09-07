import React, { useEffect, useRef, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  Modal,
  StyleSheet,
  useWindowDimensions,
  Pressable,
  Animated,
  Easing,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {Sidebar} from './Sidebar';
// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MessageType = 'text' | 'image' | 'location' | 'file' | 'audio';

interface Message {
  id: string;
  chatId: string;
  sender: 'me' | 'them';
  type: MessageType;
  text?: string;
  imageUri?: string;
  fileName?: string;
  fileSize?: string;
  audioDuration?: number; // seconds
  lat?: number;
  lng?: number;
  timestamp: string;
  read: boolean;
}

interface Contact {
  id: string;
  name: string;
  role: string;
  avatar: string;
  online: boolean;
  lastSeen: string;
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const CONTACTS: Contact[] = [
  { id: 'c1', name: 'Priya Sharma', role: 'Rider', avatar: 'https://i.pravatar.cc/150?img=47', online: true, lastSeen: 'Online' },
  { id: 'c2', name: 'Amit Kumar', role: 'Driver', avatar: 'https://i.pravatar.cc/150?img=12', online: false, lastSeen: 'Last seen 1h ago' },
  { id: 'c3', name: 'Neha Kapoor', role: 'Rider', avatar: 'https://i.pravatar.cc/150?img=32', online: true, lastSeen: 'Online' },
  { id: 'c4', name: 'Rohan Mehta', role: 'Driver', avatar: 'https://i.pravatar.cc/150?img=15', online: false, lastSeen: 'Last seen 3h ago' },
  { id: 'c5', name: 'Sneha Iyer', role: 'Rider', avatar: 'https://i.pravatar.cc/150?img=44', online: false, lastSeen: 'Last seen yesterday' },
  { id: 'c6', name: 'Karan Verma', role: 'Driver', avatar: 'https://i.pravatar.cc/150?img=13', online: true, lastSeen: 'Online' },
  { id: 'c7', name: 'Ananya Das', role: 'Rider', avatar: 'https://i.pravatar.cc/150?img=35', online: false, lastSeen: 'Last seen Tuesday' },
  { id: 'c8', name: 'Vikram Singh', role: 'Driver', avatar: 'https://i.pravatar.cc/150?img=14', online: false, lastSeen: 'Last seen Monday' },
];

const UNREAD_SEED: Record<string, number> = { c1: 2, c2: 1, c4: 3 };

const SAMPLE_PHOTOS = [
  'https://picsum.photos/id/1015/400/300',
  'https://picsum.photos/id/1025/400/300',
  'https://picsum.photos/id/1035/400/300',
  'https://picsum.photos/id/1043/400/300',
  'https://picsum.photos/id/1050/400/300',
  'https://picsum.photos/id/1062/400/300',
];

const SAMPLE_FILES = [
  { name: 'Trip_Invoice.pdf', size: '182 KB' },
  { name: 'Ride_Ticket.pdf', size: '96 KB' },
  { name: 'Route_Map.docx', size: '340 KB' },
];

function seedMessages(): Record<string, Message[]> {
  const now = (h: string, m: string) => `${h}:${m} AM`;
  const data: Record<string, Message[]> = {
    c1: [
      { id: 'm1', chatId: 'c1', sender: 'them', type: 'text', text: 'Hi! Are you coming tomorrow for the event?', timestamp: now('09', '20'), read: true },
      { id: 'm2', chatId: 'c1', sender: 'me', type: 'text', text: "Yes! I'm on my way. Do you know what time it starts?", timestamp: now('09', '22'), read: true },
      { id: 'm3', chatId: 'c1', sender: 'them', type: 'text', text: "It starts at 10 AM. I'm already near the venue.", timestamp: now('09', '23'), read: true },
      { id: 'm4', chatId: 'c1', sender: 'me', type: 'text', text: "Great! I'll leave from home in 10 mins. Shall we meet at the main gate?", timestamp: now('09', '25'), read: true },
      { id: 'm5', chatId: 'c1', sender: 'them', type: 'text', text: "Sounds good! I'll be there. Just let me know when you reach.", timestamp: now('09', '26'), read: true },
      { id: 'm6', chatId: 'c1', sender: 'me', type: 'text', text: "Sure! I'll message you once I'm there. 🙂", timestamp: now('09', '28'), read: true },
      { id: 'm7', chatId: 'c1', sender: 'them', type: 'text', text: 'Perfect! See you soon!', timestamp: now('09', '29'), read: true },
    ],
    c2: [
      { id: 'm8', chatId: 'c2', sender: 'them', type: 'text', text: 'The car will be ready by 6 PM.', timestamp: now('09', '30'), read: true },
      { id: 'm9', chatId: 'c2', sender: 'me', type: 'text', text: "Perfect! I'll book it now.", timestamp: now('09', '32'), read: false },
    ],
    c3: [
      { id: 'm10', chatId: 'c3', sender: 'them', type: 'text', text: "That sounds great! 🙂", timestamp: now('08', '21'), read: true },
    ],
    c4: [
      { id: 'm11', chatId: 'c4', sender: 'them', type: 'text', text: "Let's meet at the pickup point.", timestamp: now('07', '56'), read: false },
    ],
    c5: [
      { id: 'm12', chatId: 'c5', sender: 'them', type: 'text', text: "I'll confirm the details soon.", timestamp: 'Yesterday', read: true },
    ],
    c6: [
      { id: 'm13', chatId: 'c6', sender: 'them', type: 'text', text: 'Thanks for the ride!', timestamp: 'Yesterday', read: true },
    ],
    c7: [
      { id: 'm14', chatId: 'c7', sender: 'them', type: 'text', text: 'See you tomorrow!', timestamp: 'Tue', read: true },
    ],
    c8: [
      { id: 'm15', chatId: 'c8', sender: 'them', type: 'text', text: 'Okay, noted!', timestamp: 'Mon', read: true },
    ],
  };
  return data;
}

const EMOJIS = ['😀', '😂', '🙂', '😍', '👍', '🙏', '🎉', '❤️', '😢', '🔥', '👌', '😴'];

function lastMessagePreview(msg?: Message): string {
  if (!msg) return '';
  switch (msg.type) {
    case 'image': return '📷 Photo';
    case 'location': return '📍 Location';
    case 'file': return `📎 ${msg.fileName ?? 'File'}`;
    case 'audio': return '🎤 Voice message';
    default: return msg.text ?? '';
  }
}

function fmtTime(): string {
  const d = new Date();
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h.toString().padStart(2, '0')}:${m} ${ampm}`;
}

let idCounter = 1000;
function nextId() {
  idCounter += 1;
  return `msg-${idCounter}`;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ChatApp() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWide = width >= 900; // tablet / desktop-web: show list + chat + profile together
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>(CONTACTS);
  const [unread, setUnread] = useState<Record<string, number>>(UNREAD_SEED);
  const [muted, setMuted] = useState<Set<string>>(new Set());
  const [blocked, setBlocked] = useState<Set<string>>(new Set());
  const [messagesByChat, setMessagesByChat] = useState<Record<string, Message[]>>(seedMessages());

  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [inputText, setInputText] = useState('');

  const [showAttachSheet, setShowAttachSheet] = useState(false);
  const [showPhotoPicker, setShowPhotoPicker] = useState(false);
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false); // narrow screens
  const [showProfileDetail, setShowProfileDetail] = useState(false);
  const [fullImage, setFullImage] = useState<string | null>(null);
  const [callType, setCallType] = useState<'audio' | 'video' | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const recordTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playProgress, setPlayProgress] = useState(0);
  const playTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const [toast, setToast] = useState<string | null>(null);
  const listRef = useRef<FlatList<Message>>(null);
  const pulse = useRef(new Animated.Value(1)).current;

  const activeContact = contacts.find((c) => c.id === activeChatId) || null;
  const activeMessages = activeChatId ? messagesByChat[activeChatId] ?? [] : [];
  const isBlocked = activeChatId ? blocked.has(activeChatId) : false;
  const { name: nameParam } = useLocalSearchParams<{ name?: string | string[] }>();
    const riderName = (Array.isArray(nameParam) ? nameParam[0] : nameParam)?.trim() || 'Rider';
  // Toast auto-hide
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  // Pulse animation for call modal
  useEffect(() => {
    if (callType) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.15, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [callType]);

  useEffect(() => {
    return () => {
      if (recordTimer.current) clearInterval(recordTimer.current);
      if (playTimer.current) clearInterval(playTimer.current);
    };
  }, []);

  function showToast(msg: string) {
    setToast(msg);
  }

  // -------------------------------------------------------------------
  // Chat list actions
  // -------------------------------------------------------------------

  function openChat(id: string) {
    setActiveChatId(id);
    setUnread((prev) => ({ ...prev, [id]: 0 }));
    setInputText('');
    setShowProfileDetail(false);
    if (!isWide) setShowProfileModal(false);
  }

  function backToList() {
    setActiveChatId(null);
  }

  const filteredContacts = contacts.filter((c) =>
    c.name.toLowerCase().includes(search.trim().toLowerCase())
  );

  // -------------------------------------------------------------------
  // Sending messages
  // -------------------------------------------------------------------

  function appendMessage(chatId: string, msg: Message) {
    setMessagesByChat((prev) => ({
      ...prev,
      [chatId]: [...(prev[chatId] ?? []), msg],
    }));
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);
  }

  function autoReply(chatId: string) {
    const replies = [
      'Got it, thanks!',
      "Sounds good 👍",
      'Okay, noted!',
      "I'll check and get back to you.",
      'Perfect, see you then!',
    ];
    const text = replies[Math.floor(Math.random() * replies.length)];
    setTimeout(() => {
      appendMessage(chatId, {
        id: nextId(),
        chatId,
        sender: 'them',
        type: 'text',
        text,
        timestamp: fmtTime(),
        read: true,
      });
    }, 1200 + Math.random() * 900);
  }

  function handleSend() {
    if (!activeChatId || isBlocked) return;
    const trimmed = inputText.trim();
    if (!trimmed) return;
    appendMessage(activeChatId, {
      id: nextId(),
      chatId: activeChatId,
      sender: 'me',
      type: 'text',
      text: trimmed,
      timestamp: fmtTime(),
      read: false,
    });
    setInputText('');
    autoReply(activeChatId);
  }

  function insertEmoji(e: string) {
    setInputText((prev) => prev + e);
  }

  // -------------------------------------------------------------------
  // Attachments
  // -------------------------------------------------------------------

  function openAttachSheet() {
    if (isBlocked) {
      showToast('You have blocked this user.');
      return;
    }
    setShowAttachSheet(true);
  }

  function pickPhotoQuick() {
    if (isBlocked) return showToast('You have blocked this user.');
    setShowAttachSheet(false);
    setShowPhotoPicker(true);
  }

  function sendPhoto(uri: string) {
    if (!activeChatId) return;
    appendMessage(activeChatId, {
      id: nextId(),
      chatId: activeChatId,
      sender: 'me',
      type: 'image',
      imageUri: uri,
      timestamp: fmtTime(),
      read: false,
    });
    setShowPhotoPicker(false);
    autoReply(activeChatId);
  }

  function pickFileQuick() {
    if (isBlocked) return showToast('You have blocked this user.');
    setShowAttachSheet(false);
    setShowFilePicker(true);
  }

  function sendFile(name: string, size: string) {
    if (!activeChatId) return;
    appendMessage(activeChatId, {
      id: nextId(),
      chatId: activeChatId,
      sender: 'me',
      type: 'file',
      fileName: name,
      fileSize: size,
      timestamp: fmtTime(),
      read: false,
    });
    setShowFilePicker(false);
    autoReply(activeChatId);
  }

  function shareLocation() {
    if (isBlocked) return showToast('You have blocked this user.');
    if (!activeChatId) return;
    setShowAttachSheet(false);
    // Mock coordinates (would come from a real geolocation API on-device)
    const lat = 22.5726 + (Math.random() - 0.5) * 0.05;
    const lng = 88.3639 + (Math.random() - 0.5) * 0.05;
    appendMessage(activeChatId, {
      id: nextId(),
      chatId: activeChatId,
      sender: 'me',
      type: 'location',
      lat,
      lng,
      timestamp: fmtTime(),
      read: false,
    });
    autoReply(activeChatId);
  }

  function quickShareLocationFromProfile() {
    if (!activeChatId) return;
    shareLocation();
    showToast('Location shared with ' + (activeContact?.name ?? 'contact'));
  }

  function toggleRecording() {
    if (isBlocked) return showToast('You have blocked this user.');
    if (!activeChatId) return;
    setShowAttachSheet(false);
    if (!isRecording) {
      setIsRecording(true);
      setRecordSeconds(0);
      recordTimer.current = setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);
    } else {
      if (recordTimer.current) clearInterval(recordTimer.current);
      setIsRecording(false);
      const duration = Math.max(1, recordSeconds);
      appendMessage(activeChatId, {
        id: nextId(),
        chatId: activeChatId,
        sender: 'me',
        type: 'audio',
        audioDuration: duration,
        timestamp: fmtTime(),
        read: false,
      });
      setRecordSeconds(0);
      autoReply(activeChatId);
    }
  }

  function togglePlay(messageId: string, duration: number) {
    if (playingId === messageId) {
      if (playTimer.current) clearInterval(playTimer.current);
      setPlayingId(null);
      setPlayProgress(0);
      return;
    }
    if (playTimer.current) clearInterval(playTimer.current);
    setPlayingId(messageId);
    setPlayProgress(0);
    const totalTicks = duration * 10;
    let tick = 0;
    playTimer.current = setInterval(() => {
      tick += 1;
      setPlayProgress(tick / totalTicks);
      if (tick >= totalTicks) {
        if (playTimer.current) clearInterval(playTimer.current);
        setPlayingId(null);
        setPlayProgress(0);
      }
    }, 100);
  }

  // -------------------------------------------------------------------
  // Header actions
  // -------------------------------------------------------------------

  function startCall(type: 'audio' | 'video') {
    if (isBlocked) return showToast('You have blocked this user.');
    setCallType(type);
  }

  function endCall() {
    setCallType(null);
  }

  function toggleMute() {
    if (!activeChatId) return;
    setMuted((prev) => {
      const next = new Set(prev);
      if (next.has(activeChatId)) {
        next.delete(activeChatId);
        showToast('Notifications unmuted');
      } else {
        next.add(activeChatId);
        showToast('Notifications muted');
      }
      return next;
    });
    setShowMoreMenu(false);
  }

  function clearChat() {
    if (!activeChatId) return;
    setMessagesByChat((prev) => ({ ...prev, [activeChatId]: [] }));
    setShowMoreMenu(false);
    showToast('Chat cleared');
  }

  function deleteChat() {
    if (!activeChatId) return;
    const id = activeChatId;
    setContacts((prev) => prev.filter((c) => c.id !== id));
    setShowMoreMenu(false);
    setActiveChatId(null);
    showToast('Chat deleted');
  }

  function toggleBlock() {
    if (!activeChatId) return;
    setBlocked((prev) => {
      const next = new Set(prev);
      if (next.has(activeChatId)) {
        next.delete(activeChatId);
        showToast('User unblocked');
      } else {
        next.add(activeChatId);
        showToast('User blocked');
      }
      return next;
    });
    setShowMoreMenu(false);
  }

  function reportUser() {
    setShowMoreMenu(false);
    showToast('Report submitted. Our team will review it.');
  }

  // -------------------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------------------

  function renderMessage({ item }: { item: Message }) {
    const mine = item.sender === 'me';
    return (
      <View style={[styles.msgRow, mine ? styles.msgRowMine : styles.msgRowTheirs]}>
        {!mine && activeContact && (
          <Image source={{ uri: activeContact.avatar }} style={styles.msgAvatar} />
        )}
        <View style={{ maxWidth: '72%' }}>
          <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
            {item.type === 'text' && (
              <Text style={mine ? styles.bubbleTextMine : styles.bubbleTextTheirs}>{item.text}</Text>
            )}

            {item.type === 'image' && (
              <TouchableOpacity onPress={() => setFullImage(item.imageUri ?? null)} activeOpacity={0.85}>
                <Image source={{ uri: item.imageUri }} style={styles.msgImage} />
              </TouchableOpacity>
            )}

            {item.type === 'location' && (
              <TouchableOpacity
                onPress={() => showToast(`Location: ${item.lat?.toFixed(4)}, ${item.lng?.toFixed(4)}`)}
                activeOpacity={0.85}
                style={styles.locationCard}
              >
                <View style={styles.locationMapPreview}>
                  <Text style={{ fontSize: 22 }}>📍</Text>
                </View>
                <View style={{ marginLeft: 8, flexShrink: 1 }}>
                  <Text style={[styles.bubbleTextMine, mine ? null : styles.bubbleTextTheirs, { fontWeight: '700' }]}>
                    Location shared
                  </Text>
                  <Text style={[mine ? styles.bubbleTextMine : styles.bubbleTextTheirs, { fontSize: 12, opacity: 0.85 }]}>
                    {item.lat?.toFixed(4)}, {item.lng?.toFixed(4)}
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            {item.type === 'file' && (
              <TouchableOpacity
                onPress={() => showToast(`Opening ${item.fileName}…`)}
                activeOpacity={0.85}
                style={styles.fileCard}
              >
                <Text style={{ fontSize: 22 }}>📎</Text>
                <View style={{ marginLeft: 8, flexShrink: 1 }}>
                  <Text style={[mine ? styles.bubbleTextMine : styles.bubbleTextTheirs, { fontWeight: '700' }]} numberOfLines={1}>
                    {item.fileName}
                  </Text>
                  <Text style={[mine ? styles.bubbleTextMine : styles.bubbleTextTheirs, { fontSize: 12, opacity: 0.85 }]}>
                    {item.fileSize}
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            {item.type === 'audio' && (
              <View style={styles.audioRow}>
                <TouchableOpacity
                  onPress={() => togglePlay(item.id, item.audioDuration ?? 3)}
                  style={[styles.playBtn, mine ? styles.playBtnMine : styles.playBtnTheirs]}
                >
                  <Text style={{ color: mine ? '#fff' : '#FF6F61', fontSize: 14 }}>
                    {playingId === item.id ? '⏸' : '▶'}
                  </Text>
                </TouchableOpacity>
                <View style={styles.waveTrack}>
                  <View
                    style={[
                      styles.waveFill,
                      { width: `${(playingId === item.id ? playProgress : 0) * 100}%`, backgroundColor: mine ? '#fff' : '#FF6F61' },
                    ]}
                  />
                </View>
                <Text style={[mine ? styles.bubbleTextMine : styles.bubbleTextTheirs, { fontSize: 12, marginLeft: 6 }]}>
                  0:{(item.audioDuration ?? 3).toString().padStart(2, '0')}
                </Text>
              </View>
            )}
          </View>
          <View style={[styles.msgMetaRow, mine ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' }]}>
            <Text style={styles.msgTime}>{item.timestamp}</Text>
            {mine && <Text style={styles.ticks}>{item.read ? ' ✓✓' : ' ✓'}</Text>}
          </View>
        </View>
      </View>
    );
  }

  // -------------------------------------------------------------------
  // Panels
  // -------------------------------------------------------------------
  const goTo = (key: string) => {
    if (key === 'ride') {
      router.push({ pathname: '/rider', params: { name: riderName, username: riderName } });
    }
  }
  const showListPanel = isWide || !activeChatId;
  const showChatPanel = !!activeChatId;
  const showProfilePanel = !!activeChatId && isWide;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.appBar}>
      {isWide ? (
              <Sidebar
                activeKey="activity"
                onSelectItem={goTo}
                user={{ name: riderName, profileLabel: 'View profile' }}
              />
            ) : (
              sidebarOpen && (
                <View style={styles.mobileSidebarOverlay}>
                  <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setSidebarOpen(false)} />
                  <View style={styles.mobileSidebarPanel}>
                    <Sidebar
                      activeKey="activity"
                      onSelectItem={(key) => { setSidebarOpen(false); goTo(key); }}
                      user={{ name: riderName, profileLabel: 'View profile' }}
                    />
                  </View>
                </View>
              )
            )}
            
      </View>

      <View style={styles.mainRow}>
        {/* --------------------------- CHAT LIST --------------------------- */}
        {showListPanel && (
          <View style={[styles.panel, styles.listPanel, isWide && styles.panelBordered]}>
            <View style={styles.searchBar}>
              <Text style={{ marginRight: 6 }}>🔍</Text>
              <TextInput
                placeholder="Search your chats..."
                placeholderTextColor="#9b8f8c"
                style={styles.searchInput}
                value={search}
                onChangeText={setSearch}
              />
              <TouchableOpacity onPress={() => showToast('Filters: All • Unread • Drivers • Riders')}>
                <Text style={{ fontSize: 16 }}>🎚️</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={filteredContacts}
              keyExtractor={(c) => c.id}
              style={{ flex: 1 }}
              renderItem={({ item }) => {
                const msgs = messagesByChat[item.id] ?? [];
                const last = msgs[msgs.length - 1];
                const isActive = activeChatId === item.id;
                const unreadCount = unread[item.id] ?? 0;
                return (
                  <TouchableOpacity
                    style={[styles.contactRow, isActive && styles.contactRowActive]}
                    onPress={() => openChat(item.id)}
                    activeOpacity={0.8}
                  >
                    <View>
                      <Image source={{ uri: item.avatar }} style={styles.avatar} />
                      {item.online && <View style={styles.onlineDot} />}
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={[styles.contactName, isActive && { color: '#fff' }]} numberOfLines={1}>
                          {item.name}
                        </Text>
                        <Text style={[styles.contactTime, isActive && { color: '#ffe4e1' }]}>{last?.timestamp ?? ''}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
                        <Text
                          style={[styles.contactPreview, isActive && { color: '#ffe4e1' }]}
                          numberOfLines={1}
                        >
                          {muted.has(item.id) ? '🔕 ' : ''}
                          {lastMessagePreview(last)}
                        </Text>
                        {unreadCount > 0 && (
                          <View style={styles.unreadBadge}>
                            <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              }}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              showsVerticalScrollIndicator={false}
            />
          </View>
        )}

        {/* --------------------------- CONVERSATION --------------------------- */}
        {showChatPanel && activeContact && (
          <View style={[styles.panel, styles.chatPanel, isWide && styles.panelBordered]}>
            {/* Header */}
            <View style={styles.chatHeader}>
              {!isWide && (
                <TouchableOpacity onPress={backToList} style={{ marginRight: 8 }}>
                  <Text style={{ fontSize: 20 }}>←</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                onPress={() => (isWide ? setShowProfileDetail(true) : setShowProfileModal(true))}
              >
                <Image source={{ uri: activeContact.avatar }} style={styles.headerAvatar} />
                <View style={{ marginLeft: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={styles.headerName}>{activeContact.name}</Text>
                    {activeContact.online && <View style={styles.headerOnlineDot} />}
                  </View>
                  <Text style={styles.headerStatus}>{isBlocked ? 'Blocked' : activeContact.lastSeen}</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.headerIconBtn} onPress={() => startCall('audio')}>
                <Text style={{ fontSize: 16 }}>📞</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.headerIconBtn} onPress={() => startCall('video')}>
                <Text style={{ fontSize: 16 }}>🎥</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.headerIconBtn} onPress={() => setShowMoreMenu(true)}>
                <Text style={{ fontSize: 18 }}>⋮</Text>
              </TouchableOpacity>

              {!isWide && (
                <TouchableOpacity style={styles.headerIconBtn} onPress={() => setShowProfileModal(true)}>
                  <Text style={{ fontSize: 16 }}>👤</Text>
                </TouchableOpacity>
              )}
            </View>

            {isBlocked && (
              <View style={styles.blockedBanner}>
                <Text style={styles.blockedBannerText}>
                  You've blocked {activeContact.name}. Unblock from the profile panel to chat.
                </Text>
              </View>
            )}

            {/* Messages */}
            <FlatList
              ref={listRef}
              data={activeMessages}
              keyExtractor={(m) => m.id}
              style={{ flex: 1 }}
              renderItem={renderMessage}
              contentContainerStyle={{ padding: 14, paddingBottom: 6 }}
              onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            />

            {isRecording && (
              <View style={styles.recordingBar}>
                <View style={styles.recDot} />
                <Text style={styles.recordingText}>Recording… 0:{recordSeconds.toString().padStart(2, '0')}</Text>
                <TouchableOpacity onPress={toggleRecording} style={styles.recordStopBtn}>
                  <Text style={{ color: '#fff', fontWeight: '700' }}>Stop & Send</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Input bar */}
            <View style={styles.inputBar}>
              <TouchableOpacity style={styles.plusBtn} onPress={openAttachSheet} disabled={isBlocked}>
                <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700' }}>+</Text>
              </TouchableOpacity>
              <TextInput
                style={styles.textInput}
                placeholder={isBlocked ? 'You cannot message this user' : 'Type a message...'}
                placeholderTextColor="#9b8f8c"
                value={inputText}
                onChangeText={setInputText}
                editable={!isBlocked}
                multiline
              />
              <TouchableOpacity onPress={pickPhotoQuick} disabled={isBlocked} style={styles.inputIconBtn}>
                <Text style={{ fontSize: 18 }}>🖼️</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowEmoji(true)} disabled={isBlocked} style={styles.inputIconBtn}>
                <Text style={{ fontSize: 18 }}>🙂</Text>
              </TouchableOpacity>
              {inputText.trim().length === 0 ? (
                <TouchableOpacity
                  style={styles.sendBtn}
                  onPress={toggleRecording}
                  disabled={isBlocked}
                >
                  <Text style={{ fontSize: 16 }}>🎤</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.sendBtn} onPress={handleSend} disabled={isBlocked}>
                  <Text style={{ fontSize: 16, color: '#fff' }}>➤</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Empty state when nothing selected on wide screens */}
        {isWide && !activeChatId && (
          <View style={[styles.panel, styles.chatPanel, styles.panelBordered, styles.emptyState]}>
            <Text style={{ fontSize: 40 }}>💬</Text>
            <Text style={styles.emptyStateText}>Select a chat to start messaging</Text>
          </View>
        )}

        {/* --------------------------- PROFILE PANEL (wide) --------------------------- */}
        {showProfilePanel && activeContact && (
          <ProfilePanel
            contact={activeContact}
            blocked={isBlocked}
            onShareLocation={quickShareLocationFromProfile}
            onBlock={toggleBlock}
            onReport={reportUser}
            onViewProfile={() => setShowProfileDetail(true)}
          />
        )}
      </View>

      {/* --------------------------- Modals --------------------------- */}

      {/* Profile modal for narrow screens */}
      <Modal visible={showProfileModal && !isWide} animationType="slide" transparent onRequestClose={() => setShowProfileModal(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowProfileModal(false)}>
          <Pressable style={styles.profileModalCard} onPress={() => {}}>
            {activeContact && (
              <ProfilePanel
                contact={activeContact}
                blocked={isBlocked}
                onShareLocation={quickShareLocationFromProfile}
                onBlock={toggleBlock}
                onReport={reportUser}
                onViewProfile={() => setShowProfileDetail(true)}
                embedded
              />
            )}
            <TouchableOpacity style={styles.closeModalBtn} onPress={() => setShowProfileModal(false)}>
              <Text style={{ color: '#FF6F61', fontWeight: '700' }}>Close</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Full profile detail */}
      <Modal visible={showProfileDetail} animationType="fade" transparent onRequestClose={() => setShowProfileDetail(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowProfileDetail(false)}>
          <Pressable style={styles.detailCard} onPress={() => {}}>
            {activeContact && (
              <>
                <Image source={{ uri: activeContact.avatar }} style={styles.detailAvatar} />
                <Text style={styles.detailName}>{activeContact.name}</Text>
                <Text style={styles.detailRole}>{activeContact.role}</Text>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Status</Text>
                  <Text style={styles.detailValue}>{activeContact.lastSeen}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Rides together</Text>
                  <Text style={styles.detailValue}>{Math.floor(Math.random() * 20) + 3}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Rating</Text>
                  <Text style={styles.detailValue}>⭐ 4.{Math.floor(Math.random() * 9)}</Text>
                </View>
                <TouchableOpacity style={styles.closeModalBtn} onPress={() => setShowProfileDetail(false)}>
                  <Text style={{ color: '#FF6F61', fontWeight: '700' }}>Close</Text>
                </TouchableOpacity>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Attachment sheet */}
      <Modal visible={showAttachSheet} animationType="slide" transparent onRequestClose={() => setShowAttachSheet(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowAttachSheet(false)}>
          <Pressable style={styles.sheetCard} onPress={() => {}}>
            <Text style={styles.sheetTitle}>Share content</Text>
            <View style={styles.sheetGrid}>
              <AttachOption emoji="📷" label="Photo" color="#FF6F61" onPress={pickPhotoQuick} />
              <AttachOption emoji="📍" label="Location" color="#4CAF50" onPress={shareLocation} />
              <AttachOption emoji="📎" label="Document" color="#5C6BC0" onPress={pickFileQuick} />
              <AttachOption emoji="🎤" label="Audio" color="#EF6C00" onPress={toggleRecording} />
            </View>
            <TouchableOpacity style={styles.closeModalBtn} onPress={() => setShowAttachSheet(false)}>
              <Text style={{ color: '#9b8f8c', fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Photo picker */}
      <Modal visible={showPhotoPicker} animationType="slide" transparent onRequestClose={() => setShowPhotoPicker(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowPhotoPicker(false)}>
          <Pressable style={styles.sheetCard} onPress={() => {}}>
            <Text style={styles.sheetTitle}>Choose a photo</Text>
            <View style={styles.photoGrid}>
              {SAMPLE_PHOTOS.map((uri) => (
                <TouchableOpacity key={uri} onPress={() => sendPhoto(uri)}>
                  <Image source={{ uri }} style={styles.photoThumb} />
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.closeModalBtn} onPress={() => setShowPhotoPicker(false)}>
              <Text style={{ color: '#9b8f8c', fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* File picker */}
      <Modal visible={showFilePicker} animationType="slide" transparent onRequestClose={() => setShowFilePicker(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowFilePicker(false)}>
          <Pressable style={styles.sheetCard} onPress={() => {}}>
            <Text style={styles.sheetTitle}>Choose a document</Text>
            {SAMPLE_FILES.map((f) => (
              <TouchableOpacity key={f.name} style={styles.fileRow} onPress={() => sendFile(f.name, f.size)}>
                <Text style={{ fontSize: 20, marginRight: 10 }}>📄</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', color: '#3a2e2c' }}>{f.name}</Text>
                  <Text style={{ color: '#9b8f8c', fontSize: 12 }}>{f.size}</Text>
                </View>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.closeModalBtn} onPress={() => setShowFilePicker(false)}>
              <Text style={{ color: '#9b8f8c', fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Emoji picker */}
      <Modal visible={showEmoji} animationType="fade" transparent onRequestClose={() => setShowEmoji(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowEmoji(false)}>
          <Pressable style={styles.emojiCard} onPress={() => {}}>
            <Text style={styles.sheetTitle}>Emoji</Text>
            <View style={styles.emojiGrid}>
              {EMOJIS.map((e) => (
                <TouchableOpacity
                  key={e}
                  style={styles.emojiCell}
                  onPress={() => {
                    insertEmoji(e);
                    setShowEmoji(false);
                  }}
                >
                  <Text style={{ fontSize: 26 }}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* More options menu */}
      <Modal visible={showMoreMenu} animationType="fade" transparent onRequestClose={() => setShowMoreMenu(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowMoreMenu(false)}>
          <Pressable style={styles.menuCard} onPress={() => {}}>
            <MenuItem label="View Contact" icon="👤" onPress={() => { setShowMoreMenu(false); setShowProfileDetail(true); }} />
            <MenuItem label={muted.has(activeChatId ?? '') ? 'Unmute Notifications' : 'Mute Notifications'} icon="🔕" onPress={toggleMute} />
            <MenuItem label="Clear Chat" icon="🧹" onPress={clearChat} />
            <MenuItem label="Delete Chat" icon="🗑️" onPress={deleteChat} destructive />
            <MenuItem label={isBlocked ? 'Unblock User' : 'Block User'} icon="🚫" onPress={toggleBlock} destructive />
            <MenuItem label="Report" icon="🚩" onPress={reportUser} destructive />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Full-screen image viewer */}
      <Modal visible={!!fullImage} animationType="fade" transparent onRequestClose={() => setFullImage(null)}>
        <Pressable style={styles.imageViewerBackdrop} onPress={() => setFullImage(null)}>
          {fullImage && <Image source={{ uri: fullImage }} style={styles.fullImage} resizeMode="contain" />}
          <TouchableOpacity style={styles.closeModalBtnLight} onPress={() => setFullImage(null)}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>✕ Close</Text>
          </TouchableOpacity>
        </Pressable>
      </Modal>

      {/* Call modal */}
      <Modal visible={!!callType} animationType="fade" transparent onRequestClose={endCall}>
        <View style={styles.callBackdrop}>
          {activeContact && (
            <>
              <Text style={styles.callLabel}>{callType === 'video' ? 'Video calling…' : 'Calling…'}</Text>
              <Animated.Image
                source={{ uri: activeContact.avatar }}
                style={[styles.callAvatar, { transform: [{ scale: pulse }] }]}
              />
              <Text style={styles.callName}>{activeContact.name}</Text>
              <Text style={styles.callSub}>Ringing…</Text>
              <TouchableOpacity style={styles.endCallBtn} onPress={endCall}>
                <Text style={{ fontSize: 26 }}>📞</Text>
              </TouchableOpacity>
              <Text style={styles.endCallLabel}>End Call</Text>
            </>
          )}
        </View>
      </Modal>

      {/* Toast */}
      {toast && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Small sub-components
// ---------------------------------------------------------------------------

function ProfilePanel({
  contact,
  blocked,
  onShareLocation,
  onBlock,
  onReport,
  onViewProfile,
  embedded,
}: {
  contact: Contact;
  blocked: boolean;
  onShareLocation: () => void;
  onBlock: () => void;
  onReport: () => void;
  onViewProfile: () => void;
  embedded?: boolean;
}) {
  return (
    <View style={[styles.panel, styles.profilePanel, !embedded && styles.panelBordered, embedded && { width: '100%', borderRadius: 20 }]}>
      <Text style={styles.profileTitle}>Profile</Text>
      <View style={{ alignItems: 'center', marginTop: 6 }}>
        <View>
          <Image source={{ uri: contact.avatar }} style={styles.profileAvatar} />
          {contact.online && <View style={styles.profileOnlineDot} />}
        </View>
        <Text style={styles.profileName}>{contact.name}</Text>
        <Text style={styles.profileRole}>{contact.role}</Text>
        <TouchableOpacity style={styles.viewProfileBtn} onPress={onViewProfile}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>👁 View Profile</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.divider} />

      <Text style={styles.quickActionsTitle}>Quick Actions</Text>
      <TouchableOpacity style={styles.quickAction} onPress={onShareLocation}>
        <Text style={styles.quickActionIcon}>📍</Text>
        <Text style={styles.quickActionText}>Share Location</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.quickAction} onPress={onBlock}>
        <Text style={styles.quickActionIcon}>🚫</Text>
        <Text style={styles.quickActionText}>{blocked ? 'Unblock User' : 'Block User'}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.quickAction} onPress={onReport}>
        <Text style={styles.quickActionIcon}>🚩</Text>
        <Text style={styles.quickActionText}>Report</Text>
      </TouchableOpacity>

      <View style={{ flex: 1 }} />
      <View style={{ alignItems: 'center', marginBottom: 8 }}>
        <Text style={{ fontSize: 28 }}>🚗</Text>
        <Text style={styles.brandFooter}>Better Rides Together ❤️</Text>
      </View>
    </View>
  );
}

function AttachOption({ emoji, label, color, onPress }: { emoji: string; label: string; color: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.attachOption} onPress={onPress}>
      <View style={[styles.attachIconWrap, { backgroundColor: color }]}>
        <Text style={{ fontSize: 24 }}>{emoji}</Text>
      </View>
      <Text style={styles.attachLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function MenuItem({ label, icon, onPress, destructive }: { label: string; icon: string; onPress: () => void; destructive?: boolean }) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <Text style={{ fontSize: 16, marginRight: 10 }}>{icon}</Text>
      <Text style={[styles.menuItemText, destructive && { color: '#E5484D' }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const RED = '#FF6F61';
const RED_DARK = '#E85A4F';
const BG = '#F3E4DE';
const CARD = '#FFFFFF';
const TEXT_DARK = '#3A2E2C';
const TEXT_MUTED = '#9B8F8C';

const styles = StyleSheet.create({
  safe: { flex: 1, flexDirection: 'row', backgroundColor: BG,  },   // added flexDirection: 'row'
  mobileSidebarOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 20, flexDirection: 'row' },   // NEW
  mobileSidebarPanel: { width: 248, height: '100%' },   // NEW
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  appTitle: { fontSize: 20, fontWeight: '800', color: RED, letterSpacing: 0.5 },
  appTitleAccent: { fontSize: 18 },

  mainRow: { flex: 1, flexDirection: 'row', paddingHorizontal: 10, paddingBottom: 10, gap: 10 },

  panel: {
    backgroundColor: CARD,
    borderRadius: 22,
    overflow: 'hidden',
  },
  panelBordered: {
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },

  // Chat list
  listPanel: { flex: 1.1, padding: 12, marginTop: 20 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F4EDEA',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 10,
  },
  searchInput: { flex: 1, color: TEXT_DARK, fontSize: 14 },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 14,
  },
  contactRowActive: { backgroundColor: RED },
  avatar: { width: 46, height: 46, borderRadius: 23 },
  onlineDot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#3DDC84',
    borderWidth: 2,
    borderColor: '#fff',
  },
  contactName: { fontSize: 14.5, fontWeight: '700', color: TEXT_DARK, flexShrink: 1 },
  contactTime: { fontSize: 11, color: TEXT_MUTED },
  contactPreview: { fontSize: 12.5, color: TEXT_MUTED, flexShrink: 1, marginRight: 6 },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: RED,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  unreadBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  separator: { height: 1, backgroundColor: '#F0E6E2', marginVertical: 2 },

  // Conversation
  chatPanel: { flex: 2, marginTop: 20, flexDirection: 'column', justifyContent: 'space-between' },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1E7E3',
  },
  headerAvatar: { width: 42, height: 42, borderRadius: 21 },
  headerName: { fontSize: 15.5, fontWeight: '800', color: TEXT_DARK },
  headerOnlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#3DDC84', marginLeft: 6 },
  headerStatus: { fontSize: 12, color: TEXT_MUTED, marginTop: 1 },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FBEDEA',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },

  blockedBanner: { backgroundColor: '#FFECEC', paddingVertical: 8, paddingHorizontal: 14 },
  blockedBannerText: { color: '#C0392B', fontSize: 12.5 },

  msgRow: { flexDirection: 'row', marginBottom: 14, alignItems: 'flex-end' },
  msgRowMine: { justifyContent: 'flex-end' },
  msgRowTheirs: { justifyContent: 'flex-start' },
  msgAvatar: { width: 30, height: 30, borderRadius: 15, marginRight: 8 },
  bubble: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMine: { backgroundColor: RED, borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: '#F1EAE7', borderBottomLeftRadius: 4 },
  bubbleTextMine: { color: '#fff', fontSize: 14.5, lineHeight: 20 },
  bubbleTextTheirs: { color: TEXT_DARK, fontSize: 14.5, lineHeight: 20 },
  msgMetaRow: { flexDirection: 'row', marginTop: 3, paddingHorizontal: 2 },
  msgTime: { fontSize: 10.5, color: TEXT_MUTED },
  ticks: { fontSize: 10.5, color: '#4FC3F7' },
  msgImage: { width: 190, height: 130, borderRadius: 12 },

  locationCard: { flexDirection: 'row', alignItems: 'center', minWidth: 180 },
  locationMapPreview: {
    width: 44, height: 44, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  fileCard: { flexDirection: 'row', alignItems: 'center', minWidth: 180 },

  audioRow: { flexDirection: 'row', alignItems: 'center', minWidth: 170 },
  playBtn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  playBtnMine: { backgroundColor: 'rgba(255,255,255,0.25)' },
  playBtnTheirs: { backgroundColor: '#fff' },
  waveTrack: { flex: 1, height: 4, backgroundColor: 'rgba(0,0,0,0.12)', borderRadius: 2, marginHorizontal: 8, overflow: 'hidden' },
  waveFill: { height: 4, borderRadius: 2 },

  recordingBar: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: '#FFF3F0',
  },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#E5484D', marginRight: 8 },
  recordingText: { flex: 1, color: '#C0392B', fontWeight: '600' },
  recordStopBtn: { backgroundColor: RED, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1E7E3',
  },
  plusBtn: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: RED,
    alignItems: 'center', justifyContent: 'center', marginRight: 8,
  },
  textInput: {
    flex: 1, backgroundColor: '#F4EDEA', borderRadius: 20, paddingHorizontal: 14,
    paddingVertical: 8, maxHeight: 90, color: TEXT_DARK, fontSize: 14,
  },
  inputIconBtn: { paddingHorizontal: 6, marginLeft: 4 },
  sendBtn: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: RED,
    alignItems: 'center', justifyContent: 'center', marginLeft: 6,
  },

  emptyState: { alignItems: 'center', justifyContent: 'center', flex: 2 },
  emptyStateText: { color: TEXT_MUTED, marginTop: 8, fontSize: 14 },

  // Profile panel
  profilePanel: { flex: 0.85, padding: 18, marginTop: 20, flexDirection: 'column', justifyContent: 'space-between' },
  profileTitle: { fontSize: 17, fontWeight: '800', color: TEXT_DARK },
  profileAvatar: { width: 96, height: 96, borderRadius: 48, marginTop: 10, borderWidth: 3, borderColor: '#fff' },
  profileOnlineDot: {
    position: 'absolute', right: 4, bottom: 4, width: 16, height: 16, borderRadius: 8,
    backgroundColor: '#3DDC84', borderWidth: 3, borderColor: '#fff',
  },
  profileName: { fontSize: 16.5, fontWeight: '800', color: TEXT_DARK, marginTop: 10 },
  profileRole: { fontSize: 13, color: TEXT_MUTED, marginTop: 2 },
  viewProfileBtn: {
    backgroundColor: RED, paddingHorizontal: 18, paddingVertical: 9, borderRadius: 16, marginTop: 12,
  },
  divider: { height: 1, backgroundColor: '#F1E7E3', marginVertical: 18 },
  quickActionsTitle: { fontSize: 13, fontWeight: '700', color: TEXT_MUTED, marginBottom: 10 },
  quickAction: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F7F1EE',
    borderRadius: 14, paddingVertical: 12, paddingHorizontal: 12, marginBottom: 10,
  },
  quickActionIcon: { fontSize: 16, marginRight: 10 },
  quickActionText: { fontSize: 13.5, color: TEXT_DARK, fontWeight: '600' },
  brandFooter: { fontSize: 12.5, color: RED_DARK, fontWeight: '700', marginTop: 4 },

  // Modals
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheetCard: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: TEXT_DARK, marginBottom: 14, textAlign: 'center' },
  sheetGrid: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 10 },
  attachOption: { alignItems: 'center' },
  attachIconWrap: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center' },
  attachLabel: { marginTop: 8, fontSize: 12.5, color: TEXT_DARK, fontWeight: '600' },
  closeModalBtn: { alignItems: 'center', paddingVertical: 12, marginTop: 6 },
  closeModalBtnLight: { position: 'absolute', top: 50, right: 20, padding: 10 },

  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  photoThumb: { width: 100, height: 80, borderRadius: 10, marginBottom: 10 },

  fileRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1E7E3' },

  emojiCard: { position: 'absolute', bottom: 90, alignSelf: 'center', backgroundColor: '#fff', borderRadius: 20, padding: 16, width: '88%' },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  emojiCell: { width: '16.6%', alignItems: 'center', paddingVertical: 8 },

  menuCard: {
    position: 'absolute', top: 100, right: 20, backgroundColor: '#fff', borderRadius: 16, paddingVertical: 6,
    width: 210, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, elevation: 6,
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11 },
  menuItemText: { fontSize: 13.5, color: TEXT_DARK, fontWeight: '600' },

  profileModalCard: { backgroundColor: 'transparent', paddingHorizontal: 12, paddingBottom: 12 },
  detailCard: {
    alignSelf: 'center', backgroundColor: '#fff', borderRadius: 22, padding: 24, width: '84%', alignItems: 'center',
    marginTop: 'auto', marginBottom: 'auto',
  },
  detailAvatar: { width: 90, height: 90, borderRadius: 45 },
  detailName: { fontSize: 17, fontWeight: '800', color: TEXT_DARK, marginTop: 10 },
  detailRole: { fontSize: 13, color: TEXT_MUTED, marginBottom: 14 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#F1E7E3' },
  detailLabel: { color: TEXT_MUTED, fontSize: 13 },
  detailValue: { color: TEXT_DARK, fontSize: 13, fontWeight: '700' },

  imageViewerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', alignItems: 'center', justifyContent: 'center' },
  fullImage: { width: '92%', height: '70%' },

  callBackdrop: { flex: 1, backgroundColor: '#2A2220', alignItems: 'center', justifyContent: 'center' },
  callLabel: { color: '#ffd8d0', fontSize: 14, marginBottom: 18, letterSpacing: 1 },
  callAvatar: { width: 130, height: 130, borderRadius: 65, borderWidth: 4, borderColor: RED },
  callName: { color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 18 },
  callSub: { color: '#cbb9b5', fontSize: 13, marginTop: 4 },
  endCallBtn: {
    width: 66, height: 66, borderRadius: 33, backgroundColor: '#E5484D', alignItems: 'center', justifyContent: 'center',
    marginTop: 46, transform: [{ rotate: '135deg' }],
  },
  endCallLabel: { color: '#cbb9b5', marginTop: 10, fontSize: 12 },

  toast: {
    position: 'absolute', bottom: 24, alignSelf: 'center', backgroundColor: 'rgba(30,24,22,0.92)',
    paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20,
  },
  toastText: { color: '#fff', fontSize: 13, fontWeight: '600' },
});
