import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { Icon } from '@iconify/react';
import Navigacija from './navigacija';
import NavTop from './nav-top';
import NavSideChat from './chat/NavSideChat';
import ChatContainer from './chat/ChatContainer';
import ApiConfig from '../components/apiConfig.js';
import axios from 'axios';
import io from 'socket.io-client';
import LoadingShell from '../components/LoadingShell.jsx';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { getFCMToken, onMessageListener, getMessagingInstance } from '../firebase-config';
import { encryptMessage, decryptMessage, generateChatKey, storeChatKey, getChatKey } from '../utils/encryption';
import CryptoJS from 'crypto-js';
import Notifikacija from '../components/Notifikacija';
import { getMessaging, getToken } from 'firebase/messaging';
import styles from './Chat.module.css';
import Modal from '../components/Modal';

const Chat = ({
  user,
  socket: propSocket,
  onMessagesRead,
  unreadChatsCount,
  chat = true
}) => {
  const [messages, setMessages] = useState([]);
  const [chats, setChats] = useState([]);
  const [chatData, setChatData] = useState({});
  const [selectedChat, setSelectedChat] = useState(null);
  const [selectedChatName, setSelectedChatName] = useState('');
  const [chatGumb, setChatGumb] = useState(true);
  const [notification, setNotification] = useState(null);
  const messagesEndRef = useRef(null);
  const chatRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [availableMentors, setAvailableMentors] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [selectedMentors, setSelectedMentors] = useState([]);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [showAddMembersPopup, setShowAddMembersPopup] = useState(false);
  const [showGroupDetails, setShowGroupDetails] = useState(false);
  const [groupAdmin, setGroupAdmin] = useState(null);
  const [memberDetails, setMemberDetails] = useState({});
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [rateLimitTimer, setRateLimitTimer] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [autoAddTheoryStudents, setAutoAddTheoryStudents] = useState(false);
  const [programs, setPrograms] = useState([]);
  const [selectedProgram, setSelectedProgram] = useState('');
  const [showProgramFilter, setShowProgramFilter] = useState(false);

  // Use socket from props or get from window
  const socket = propSocket || window.socket;

  // Fetch chat data (unread counts and last messages)
  const fetchChatData = useCallback(async () => {
    try {
      const response = await ApiConfig.api.get('/api/chats');

      // Initialize an empty map for chat data
      const chatDataMap = {};

      // Handle array of chat data
      if (Array.isArray(response.data)) {
        response.data.forEach(chat => {
          // For individual chats
          if (chat.participant) {
            chatDataMap[chat.participant.id] = {
              unreadCount: parseInt(chat.unreadCount || 0, 10),
              lastMessage: chat.lastMessageText || '',
              lastMessageAt: chat.lastMessageAt || null
            };
          }
          // For group chats
          if (chat.groupId) {
            chatDataMap[chat.groupId] = {
              unreadCount: parseInt(user.isMentor ? chat.unreadCountMentor : chat.unreadCountUser, 10) || 0,
              lastMessage: chat.lastMessageText || '',
              lastMessageAt: chat.lastMessageAt || null,
              lastMessageSender: chat.lastMessageSender || ''
            };
          }
        });
      }

      setChatData(chatDataMap);
      return chatDataMap;
    } catch (error) {
      console.error('Error fetching chat data:', error);
      if (error.response) {
        console.error('Server response:', error.response.data);
      }
      return {};
    }
  }, [user?.isMentor]);

  // Fetch chats (students or mentors)
  const fetchChats = useCallback(async (chatDataResponse) => {
    try {
      let chatList = [];

      // Fetch individual chats first
      if (user.isMentor && user.studentId?.length > 0) {
        const response = await ApiConfig.api.get('/api/mentors/students');

        chatList = await Promise.all(response.data
          .filter(student => user.studentId.includes(student.id))
          .map(async student => {
            const chatInfo = chatDataResponse?.[student.id] || {};
            let profilePicture = null;

            // Only fetch profile picture if hasProfilePicture is true
            if (student.hasProfilePicture) {
              try {
                const picResponse = await ApiConfig.api.get(`/api/profile-picture/${student.id}`);
                if (picResponse.data.success && picResponse.data.profilePicture) {
                  profilePicture = `data:${picResponse.data.profilePicture.contentType};base64,${picResponse.data.profilePicture.data}`;
                }
              } catch (error) {
                // Only log errors that aren't 404 (missing profile picture)
                if (error.response?.status !== 404) {
                  console.error('Error fetching student profile picture:', error);
                }
              }
            }

            return {
              id: student.id,
              name: `${student.ime} ${student.prezime}`,
              program: student.programs?.[0]?.naziv || 'Nije dodijeljeno',
              unreadCount: parseInt(chatInfo.unreadCount || 0, 10),
              lastMessage: chatInfo.lastMessage || '',
              lastMessageAt: chatInfo.lastMessageAt || null,
              lastMessageSender: chatInfo.lastMessageSender || '',
              isGroup: false,
              profilePicture,
              hasProfilePicture: student.hasProfilePicture || false
            };
          }));
      }

      if (user.isStudent && user.mentors?.length > 0) {
        chatList = await Promise.all(user.mentors.map(async mentor => {
          const chatInfo = chatDataResponse?.[mentor.id] || {};
          let profilePicture = null;

          // Only fetch profile picture if hasProfilePicture is true
          if (mentor.hasProfilePicture) {
            try {
              const picResponse = await ApiConfig.api.get(`/api/profile-picture/${mentor.id}`);
              if (picResponse.data.success && picResponse.data.profilePicture) {
                profilePicture = `data:${picResponse.data.profilePicture.contentType};base64,${picResponse.data.profilePicture.data}`;
              }
            } catch (error) {
              // Only log errors that aren't 404 (missing profile picture)
              if (error.response?.status !== 404) {
                console.error('Error fetching mentor profile picture:', error);
              }
            }
          }

          return {
            id: mentor.id,
            name: `${mentor.ime} ${mentor.prezime}`,
            unreadCount: parseInt(chatInfo.unreadCount || 0, 10),
            lastMessage: chatInfo.lastMessage || '',
            lastMessageAt: chatInfo.lastMessageAt || null,
            lastMessageSender: chatInfo.lastMessageSender || '',
            isGroup: false,
            profilePicture,
            hasProfilePicture: mentor.hasProfilePicture || false
          };
        }));
      }

      // Fetch groups
      try {
        const groupsResponse = await ApiConfig.api.get('/api/groups');

        if (Array.isArray(groupsResponse.data)) {
          const groups = groupsResponse.data.map(group => {
            const chatInfo = chatDataResponse?.[group.id] || {};
            return {
              id: group.id,
              name: group.name,
              unreadCount: parseInt(user.isMentor ? group.unreadCountMentor : group.unreadCountUser, 10) || 0,
              lastMessage: group.lastMessageText || chatInfo.lastMessage || '',
              lastMessageAt: group.lastMessageAt || chatInfo.lastMessageAt || null,
              lastMessageSender: group.lastMessageSender || chatInfo.lastMessageSender || '',
              isGroup: true,
              memberCount: (group.members?.length || 0) + (group.mentorMembers?.length || 0),
              members: group.members || [],
              mentorMembers: group.mentorMembers || [],
              description: group.description || '',
              adminId: group.adminId || '',
              profilePicture: null  // Groups don't have profile pictures
            };
          });
          chatList = [...chatList, ...groups];
        }
      } catch (error) {
        console.error('Error fetching groups:', error);
      }

      // Sort chats by:
      // 1. Unread messages first
      // 2. Then by last message timestamp (most recent first)
      // 3. Finally alphabetically by name
      chatList.sort((a, b) => {
        // First sort by unread count (descending)
        if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
        if (a.unreadCount === 0 && b.unreadCount > 0) return 1;

        // Then sort by last message timestamp (most recent first)
        if (a.lastMessageAt && b.lastMessageAt) {
          return new Date(b.lastMessageAt) - new Date(a.lastMessageAt);
        }

        // If one has a message and the other doesn't, prioritize the one with a message
        if (a.lastMessageAt && !b.lastMessageAt) return -1;
        if (!a.lastMessageAt && b.lastMessageAt) return 1;

        // Finally sort alphabetically by name
        return a.name.localeCompare(b.name, 'hr');
      });
      setChats(chatList);
      setError(null);
    } catch (error) {
      console.error('Error in fetchChats:', error);
      setError('Failed to fetch chats');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const markMessagesAsRead = useCallback(async () => {
    try {
      if (!selectedChat || !messages.length) return;

      const selectedChatData = chats.find(chat => chat.id === selectedChat);
      const isGroupChat = selectedChatData?.isGroup;

      // Filter unread messages where user is recipient
      const unreadMessages = isGroupChat
        ? messages.filter(m => !m.read && m.senderId !== user.id)
        : messages.filter(m => !m.read && m.recipientId === user.id);

      if (unreadMessages.length === 0) {
        return;
      }

      // Make API call to mark messages as read
      let response;
      if (isGroupChat) {
       response = await ApiConfig.api.post('/api/messages/group/mark-read', {
          groupId: selectedChat,
          messageIds: unreadMessages.map(m => m.id)
        });
      } else {
         response = await ApiConfig.api.post('/api/messages/mark-read', {
          recipientId: selectedChat,
          messageIds: unreadMessages.map(m => m.id)
        });
      }

      if (!response.data) {
        throw new Error('Failed to mark messages as read');
      }

      // Update local message state
      setMessages(prevMessages =>
        prevMessages.map(msg => ({
          ...msg,
          read: msg.senderId !== user.id ? true : msg.read
        }))
      );

      // Update local chat state to reflect read status
      setChats(prevChats =>
        prevChats.map(chat => {
          if (chat.id === selectedChat) {
            return {
              ...chat,
              unreadCount: 0
            };
          }
          return chat;
        })
      );

      // For both chat types, fetch fresh data to update NavSideChat
      await fetchChatData();
      await fetchChats();

      // Dispatch chatUpdate event to trigger NavSideChat refresh
      const chatUpdateEvent = new CustomEvent('chatUpdate');
      window.dispatchEvent(chatUpdateEvent);

      // Update parent component's unread count
      if (onMessagesRead) {
        onMessagesRead(unreadMessages.length);
      }

    } catch (error) {
      console.error('Error marking messages as read:', error);
      if (error.response) {
        console.error('Server response:', error.response.data);
      }
      toast.error('Greška pri označavanju poruka kao pročitanih');
    }
  }, [selectedChat, messages, chats, user, fetchChatData, fetchChats, onMessagesRead]);

  // Define fetchMessages first since it's used in dependencies
  const fetchMessages = useCallback(async (recipientId) => {
    if (!recipientId) return;

    try {
      // Check if this is a group chat
      const selectedChatData = chats.find(chat => chat.id === recipientId);
      let response;

      if (selectedChatData?.isGroup) {
        response = await ApiConfig.api.get(`/api/groups/${recipientId}/messages`);
      } else {
        response = await ApiConfig.api.get(`/api/messages/${recipientId}`);
      }

      let messagesData = response.data || [];

      // Get the chat key for this recipient (only for individual chats)
      if (!selectedChatData?.isGroup) {
        const chatKey = getChatKey(recipientId);

        // Decrypt messages if we have a key
        if (chatKey) {
          messagesData = messagesData.map(message => {
            // Check if the message is encrypted (either has encrypted flag or text looks encrypted)
            const isEncrypted = message.encrypted ||
              (message.text && message.text.startsWith('U2FsdGVk'));

            if (isEncrypted) {
              try {
                const decryptedText = decryptMessage(message.text, chatKey);
                return {
                  ...message,
                  originalText: message.text,
                  text: decryptedText,
                  decrypted: true
                };
              } catch (error) {
                console.error('Error decrypting message:', error);
                return message;
              }
            }
            return message;
          });
        }
      }

      setMessages(messagesData);
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast.error('Greška pri dohvaćanju poruka');
      setNotification({
        type: 'error',
        message: 'Greška pri dohvaćanju poruka'
      });
    }
  }, [chats]);

  // Handle chat selection
  const handleChatClick = useCallback((chatId, chatName) => {
    setSelectedChat(chatId);
    setSelectedChatName(chatName);

    // If it's a group chat, set the selected group
    const selectedChatData = chats.find(chat => chat.id === chatId);
    if (selectedChatData?.isGroup) {
      setSelectedGroup(selectedChatData);
    } else {
      setSelectedGroup(null);
    }

    // On mobile, close the chat list when a chat is selected
    if (window.innerWidth <= 1300) {
      setChatGumb(false);
    }

    // For group chats, we need to fetch messages first, then mark as read
    // For regular chats, we can do both in parallel
    if (selectedChatData?.isGroup) {
      fetchMessages(chatId).then(() => {
        markMessagesAsRead();
      });
    } else {
      Promise.all([
        fetchMessages(chatId),
        markMessagesAsRead()
      ]);
    }
  }, [fetchMessages, markMessagesAsRead, chats]);

  // Initial fetch of both chats and chat data
  useEffect(() => {
    const initializeChats = async () => {
      if (!user?.id) return;

      setIsLoading(true);
      try {
        const chatData = await fetchChatData();
        await fetchChats(chatData);
      } catch (error) {
        console.error('Error initializing chats:', error);
      }
    };

    initializeChats();
  }, [user?.id]);

  // Message listener for Firebase notifications
  useEffect(() => {
    const messagingInstance = getMessagingInstance();
    if (!messagingInstance) return;

    const messageHandler = async (payload) => {

      try {
        // Update chat data and list
        const chatData = await fetchChatData();
        await fetchChats(chatData);

        // If we're in the current chat, update messages
        if (selectedChat && payload.data &&
            (payload.data.senderId === selectedChat || payload.data.recipientId === selectedChat || payload.data.groupId === selectedChat)) {
          await fetchMessages(selectedChat);
          await markMessagesAsRead();
        } else {
          // Show notification if we're not in the chat
          const notificationMessage = payload.notification?.body ||
            (payload.data?.groupId
              ? `Nova poruka u grupi ${payload.data.groupName || 'Grupa'}`
              : `Nova poruka od ${payload.data.senderName || 'korisnika'}`);

          toast.info(notificationMessage, {
            position: "top-right",
            autoClose: 5000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
            progress: undefined,
            theme: "light",
            style: {
              background: 'var(--iznad)',
              color: 'var(--tekst)',
            },
            onClick: () => {
              const chatId = payload.data?.groupId || payload.data?.senderId || payload.data?.chatId;
              const chatName = payload.data?.groupName || payload.data?.senderName;
              if (chatId) {
                handleChatClick(chatId, chatName);
              }
            }
          });

          // Update unread count in parent component
          if (onMessagesRead) {
            onMessagesRead(-1); // Increment unread count by 1
          }
        }
      } catch (error) {
        console.error('Error handling Firebase message:', error);
      }
    };

    // Request notification permission and set up FCM token
    const setupNotifications = async () => {
      try {
        const messagingInstance = getMessagingInstance();
        if (!messagingInstance) {
          return;
        }

        const fcmToken = await getToken(messagingInstance, {
          vapidKey: "BB3Wbtcy5tB6mujuv50L9AVzlhE7kgq6pACMtQ-UZjWeY9MCMPHaFqpiCf6Iz5Tkk35YsLfOPTg4tGprkZRAGsU"
        });

        // Only update FCM token if we haven't already done so in this session
        if (fcmToken && !window.fcmTokenUpdated) {
          try {
            await ApiConfig.api.post('/api/users/fcm-token', { fcmToken });
            window.fcmTokenUpdated = true;
          } catch (err) {
            console.error('Failed to update FCM token:', err);
            // Don't set window.fcmTokenUpdated so we can try again later
          }
        }
      } catch (error) {
        console.error('Error setting up notifications:', error);
      }
    };

    // Only setup notifications once on component mount
    if (!window.notificationsSetup) {
      setupNotifications();
      window.notificationsSetup = true;
    }

    const unsubscribe = onMessageListener(messageHandler);

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [selectedChat, fetchChatData, fetchChats, fetchMessages, handleChatClick, user, onMessagesRead, markMessagesAsRead]);

  // Socket handling for real-time messages
  useEffect(() => {
    if (!user?.id || !socket) return;

    const handleNewMessage = async (newMessage) => {

      try {
        // First update chat data to get latest unread counts
        const chatData = await fetchChatData();
        await fetchChats(chatData);

        // Update messages if we're in the same chat
        if (selectedChat === newMessage.senderId || selectedChat === newMessage.recipientId) {
          setMessages(prev => {
            const exists = prev.some(msg => msg.id === newMessage.id);
            if (exists) return prev;
            return [...prev, newMessage];
          });
          await markMessagesAsRead();
        } else {
          // Show notification if we're not in the chat
          toast.info(`Nova poruka od ${newMessage.senderName || 'korisnika'}`, {
            position: "top-right",
            autoClose: 5000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
            progress: undefined,
            theme: "light",
            style: {
              background: 'var(--iznad)',
              color: 'var(--tekst)',
            },
            onClick: () => handleChatClick(newMessage.senderId, newMessage.senderName)
          });

          if (onMessagesRead) {
            onMessagesRead(-1);
          }
        }
      } catch (error) {
        console.error('Error handling new message:', error);
      }
    };

    const handleNewGroupMessage = async (newMessage) => {

      try {
        const chatData = await fetchChatData();
        await fetchChats(chatData);

        if (selectedChat === newMessage.groupId) {
          setMessages(prev => {
            const exists = prev.some(msg => msg.id === newMessage.id);
            if (exists) return prev;
            return [...prev, newMessage];
          });
          await markMessagesAsRead();
        } else {
          const groupChat = chats.find(c => c.id === newMessage.groupId);
          const groupName = groupChat?.name || 'grupa';
          const senderName = newMessage.senderName || newMessage.senderMentor?.ime || 'korisnik';

          toast.info(`${senderName} je poslao/la poruku u grupi ${groupName}`, {
            position: "top-right",
            autoClose: 5000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
            progress: undefined,
            theme: "light",
            style: {
              background: 'var(--iznad)',
              color: 'var(--tekst)',
            },
            onClick: () => handleChatClick(newMessage.groupId, groupName)
          });

          if (onMessagesRead) {
            onMessagesRead(-1);
          }
        }
      } catch (error) {
        console.error('Error handling new group message:', error);
      }
    };

    socket.on('newMessage', handleNewMessage);
    socket.on('newGroupMessage', handleNewGroupMessage);

    return () => {
      socket.off('newMessage', handleNewMessage);
      socket.off('newGroupMessage', handleNewGroupMessage);
    };
  }, [user, socket, selectedChat, fetchChatData, fetchChats, markMessagesAsRead, handleChatClick, chats, onMessagesRead]);

  const handleItemClickChatGumb = () => {
    setChatGumb(!chatGumb);
    // If we're on mobile and closing the chat list, reset selected chat
    if (window.innerWidth <= 1300 && chatGumb) {
      setSelectedChat(null);
      setSelectedChatName('');
    }
  };

  const handleSendMessage = async (text, replyToId = null) => {
    try {
      let messageData;
      let endpoint;
      let response;

      // Check if this is a group chat
      const selectedChatData = chats.find(chat => chat.id === selectedChat);
      if (selectedChatData?.isGroup) {
        messageData = {
          text,
          groupId: selectedChat,
          replyToId
        };
        endpoint = '/api/messages/group';
      } else {
        messageData = {
          text,
          recipientId: selectedChat,
          chatId: selectedChat,
          replyToId
        };
        endpoint = '/api/messages';
      }

      response = await ApiConfig.api.post(endpoint, messageData);
      const newMessage = response.data;

      // Update local messages state
      setMessages(prevMessages => [...prevMessages, newMessage]);

      // Update chat data and list to refresh NavSideChat
      await Promise.all([
        fetchChatData(),
        fetchChats()
      ]);

      // Emit message through socket
      if (socket && socket.connected) {
        if (selectedChatData?.isGroup) {
          socket.emit('new_group_message', newMessage);
        } else {
          socket.emit('new_message', {
            ...newMessage,
            recipientId: selectedChat
          });
        }
      } else {
        console.warn('Socket not connected when trying to send message');
      }

      // Scroll to bottom after sending
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }

      return newMessage;
    } catch (error) {
      console.error('Error sending message:', error);

      // Check if it's a rate limit error
      if (error.response?.data?.error?.includes('Too many messages')) {
        setIsRateLimited(true);
        toast.error('Prekoračili ste limit poruka. Sačekajte minutu prije slanja novih poruka.', {
          autoClose: 60000 // Show for full minute
        });

        // Start a timer to re-enable sending after 1 minute
        const timer = setTimeout(() => {
          setIsRateLimited(false);
          toast.success('Možete ponovo slati poruke.');
        }, 60000);

        setRateLimitTimer(timer);
      } else {
        toast.error(error.response?.data?.error || 'Greška pri slanju poruke');
      }
      return null;
    }
  };

  const handleMessageUpdate = (messageId, action, replyMessage = null) => {
    if (action === 'delete') {
      setMessages(prev => prev.filter(m => m.id !== messageId));
    } else if (action === 'reply' && replyMessage) {
      // Just return the data for the reply - don't try to send it directly
      return {
        text: '',  // Empty text for the user to fill in
        replyToId: messageId  // The ID of the message being replied to
      };
    }
    return null;
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const requestNotificationPermission = async () => {
    try {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        const permission = await window.Notification.requestPermission();
        if (permission === 'granted') {
          const token = await getFCMToken();
          if (token && user && user.id) {

            const response = await ApiConfig.api.post('/api/user/fcm-token', {
              token,
              userId: user.id
            });
          }
        }
      }
    } catch (error) {
      console.error('Error handling notifications:', error);
      if (error.response) {
        console.error('Server response:', error.response.data);
      }
    }
  };

  const startNewChat = async (recipientId) => {
    // Generate a new encryption key
    const chatKey = generateChatKey();

    // Store locally
    storeChatKey(recipientId, chatKey);

    // Encrypt the key with the recipient's public key (would require RSA implementation)
    // This is a simplified example - in a real app, you'd use asymmetric encryption
    const encryptedKey = await encryptKeyForRecipient(chatKey, recipientId);

    // Send the encrypted key to the recipient
    await ApiConfig.api.post('/api/chat/key-exchange', {
      recipientId,
      encryptedKey
    });
  };

  const decryptMessage = (text) => {
    try {
      // Check if the message appears to be encrypted (base64 format)
      if (text && text.match(/^U2FsdGVk/)) {
        const key = localStorage.getItem('encryptionKey') || 'defaultEncryptionKey';
        const bytes = CryptoJS.AES.decrypt(text, key);
        const decrypted = bytes.toString(CryptoJS.enc.Utf8);
        return decrypted || text;
      }
      return text;
    } catch (error) {
      console.error('Error decrypting message:', error);
      return text;
    }
  };

  useEffect(() => {
    if (!selectedChat) return;

    // Request desktop notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [selectedChat]);

  // Fetch available users and mentors when modal opens
  useEffect(() => {
    if (showGroupModal) {
      fetchAvailableUsers();
      fetchAvailableMentors();
    }
  }, [showGroupModal]);

  const fetchAvailableUsers = async () => {
    try {
      const response = await ApiConfig.api.get('/api/users');
      setAvailableUsers(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Greška pri dohvaćanju korisnika');
    }
  };

  const fetchAvailableMentors = async () => {
    try {
      const response = await ApiConfig.api.get('/api/mentori');
      setAvailableMentors(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching mentors:', error);
      toast.error('Greška pri dohvaćanju mentora');
    }
  };

  const handleSearch = async (query) => {
    setSearchInput(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      const response = await ApiConfig.api.get('/api/search/users', {
        params: { query }
      });
      // Filter out already selected users and map roles correctly
      const filteredResults = response.data.results.filter(person => {
        const isMentor = person.uloga === 'Mentor';
        return isMentor
          ? !selectedMentors.includes(person.id)
          : !selectedUsers.includes(person.id);
      }).map(person => ({
        ...person,
        uloga: person.uloga === 'Mentor' ? 'mentor' : 'student' // Map to expected format
      }));
      setSearchResults(filteredResults || []);
    } catch (error) {
      console.error('Error searching:', error);
      toast.error('Greška pri pretraživanju korisnika');
    }
  };

  const handleAddMember = (person) => {
    const isMentor = person.uloga === 'mentor';
    if (isMentor) {
      setSelectedMentors(prev => [...prev, person]);
    } else {
      setSelectedUsers(prev => [...prev, person]);
    }
    setSearchInput('');
    setSearchResults([]);
  };

  const handleRemoveMember = (person) => {
    const isMentor = person.uloga === 'mentor';
    if (isMentor) {
      setSelectedMentors(prev => prev.filter(p => p.id !== person.id));
    } else {
      setSelectedUsers(prev => prev.filter(p => p.id !== person.id));
    }
  };

  // Create regular group
  const handleCreateRegularGroup = async () => {
    if (!newGroupName.trim()) {
      toast.error('Ime grupe je obavezno');
      return;
    }

    try {
      setIsCreatingGroup(true);
      const response = await ApiConfig.api.post('/api/groups', {
        name: newGroupName,
        userIds: selectedUsers.map(u => u.id),
        mentorIds: selectedMentors.map(m => m.id)
      });

      handleGroupCreationSuccess();
    } catch (error) {
      console.error('Error creating group:', error);
      toast.error('Greška pri kreiranju grupe');
    } finally {
      setIsCreatingGroup(false);
    }
  };

  // Create theory group
  const handleCreateTheoryGroup = async () => {
    if (!newGroupName.trim()) {
      toast.error('Ime grupe je obavezno');
      return;
    }

    try {
      setIsCreatingGroup(true);

      // Get theory students
      const theoryResponse = await ApiConfig.api.get('/api/group-create/theory');
      const theoryStudents = theoryResponse.data;

      if (!theoryStudents || theoryStudents.length === 0) {
        toast.error('Nema učenika koji pohađaju teoriju');
        return;
      }

      // Create group with theory students
      const response = await ApiConfig.api.post('/api/groups', {
        name: newGroupName,
        userIds: theoryStudents.map(student => student.id),
        mentorIds: []
      });

      handleGroupCreationSuccess();
    } catch (error) {
      console.error('Error creating theory group:', error);
      toast.error('Greška pri kreiranju grupe teorije');
    } finally {
      setIsCreatingGroup(false);
    }
  };

  // Create program group
  const handleCreateProgramGroup = async () => {
    if (!newGroupName.trim()) {
      toast.error('Ime grupe je obavezno');
      return;
    }

    if (!selectedProgram) {
      toast.error('Odaberite program');
      return;
    }

    try {
      setIsCreatingGroup(true);

      // Get program students
      const programResponse = await ApiConfig.api.get('/api/group-create/by-program', {
        params: { programId: selectedProgram }
      });
      const programStudents = programResponse.data;

      if (!programStudents || programStudents.length === 0) {
        toast.error('Nema učenika u odabranom programu');
        return;
      }

      // Create group with program students
      const response = await ApiConfig.api.post('/api/groups', {
        name: newGroupName,
        userIds: programStudents.map(student => student.id),
        mentorIds: []
      });

      handleGroupCreationSuccess();
    } catch (error) {
      console.error('Error creating program group:', error);
      toast.error('Greška pri kreiranju grupe programa');
    } finally {
      setIsCreatingGroup(false);
    }
  };

  // Helper function for after successful group creation
  const handleGroupCreationSuccess = () => {
    setShowGroupModal(false);
    setNewGroupName('');
    setSelectedUsers([]);
    setSelectedMentors([]);
    setAutoAddTheoryStudents(false);
    setShowProgramFilter(false);
    setSelectedProgram('');
    toast.success('Grupa je uspješno kreirana');
    fetchChats();
  };

  // Main group creation handler
  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      toast.error('Ime grupe je obavezno');
      return;
    }

    try {
      setIsCreatingGroup(true);

      let finalUserIds = [...selectedUsers.map(u => u.id)];
      let finalMentorIds = [...selectedMentors.map(m => m.id)];

      // If auto-add theory students is enabled, fetch and add them
      if (autoAddTheoryStudents) {
        try {
          const response = await ApiConfig.api.get('/api/group-create/theory');
          const theoryStudents = response.data;

          // Add theory students that aren't already selected
          const newTheoryStudentIds = theoryStudents
            .filter(student => !finalUserIds.includes(student.id))
            .map(student => student.id);

          finalUserIds = [...finalUserIds, ...newTheoryStudentIds];
        } catch (error) {
          console.error('Error fetching theory students:', error);
          toast.error('Greška pri dohvaćanju učenika teorije');
        }
      }

      /* Temporarily disabled until program students endpoint is fixed
      // If program is selected, fetch students for that program
      if (showProgramFilter && selectedProgram) {
        try {
          const response = await ApiConfig.api.get('/api/group-create/by-program', {
            params: { programId: selectedProgram }
          });
          const programStudents = response.data;

          // Add program students that aren't already selected
          const newProgramStudentIds = programStudents
            .filter(student => !finalUserIds.includes(student.id))
            .map(student => student.id);

          finalUserIds = [...finalUserIds, ...newProgramStudentIds];
        } catch (error) {
          console.error('Error fetching students by program:', error);
          toast.error('Greška pri dohvaćanju učenika programa');
        }
      }
      */

      const response = await ApiConfig.api.post('/api/groups', {
        name: newGroupName,
        userIds: finalUserIds,
        mentorIds: finalMentorIds
      });

      setShowGroupModal(false);
      setNewGroupName('');
      setSelectedUsers([]);
      setSelectedMentors([]);
      setAutoAddTheoryStudents(false);
      setShowProgramFilter(false);
      setSelectedProgram('');
      toast.success('Grupa je uspješno kreirana');

      // Refresh chat list
      fetchChats();
    } catch (error) {
      console.error('Error creating group:', error);
      toast.error('Greška pri kreiranju grupe');
    } finally {
      setIsCreatingGroup(false);
    }
  };

  const handleEditGroup = async () => {
    if (!newGroupName.trim()) {
      toast.error('Ime grupe je obavezno');
      return;
    }

    try {
      setIsCreatingGroup(true);
      const response = await ApiConfig.api.put(`/api/groups/${editingGroup.id}`, {
        name: newGroupName,
        userIds: selectedUsers.map(u => u.id),
        mentorIds: selectedMentors.map(m => m.id)
      });

      setShowGroupModal(false);
      setNewGroupName('');
      setSelectedUsers([]);
      setSelectedMentors([]);
      setEditingGroup(null);
      toast.success('Grupa je uspješno ažurirana');

      // Refresh chat list
      fetchChats();
    } catch (error) {
      console.error('Error updating group:', error);
      toast.error('Greška pri ažuriranju grupe');
    } finally {
      setIsCreatingGroup(false);
    }
  };

  const openGroupModal = (group = null) => {
    if (group) {
      setEditingGroup(group);
      setNewGroupName(group.name);
      setSelectedUsers(group.members || []);
      setSelectedMentors(group.mentorMembers || []);
    } else {
      setEditingGroup(null);
      setNewGroupName('');
      setSelectedUsers([]);
      setSelectedMentors([]);
    }
    setShowGroupModal(true);
  };

  const handleAddMembers = () => {
    setShowAddMembersPopup(true);
  };

  const handleRemoveMembers = async (userIds) => {
    try {
      await ApiConfig.api.delete(`/api/groups/${selectedGroup.id}/members`, {
        data: { userIds }
      });
      // Refresh the chats to update the group data
      fetchChats();
      toast.success('Članovi uspješno uklonjeni');
    } catch (error) {
      console.error('Error removing members:', error);
      toast.error('Greška pri uklanjanju članova');
    }
  };

  const handleAddMembersSubmit = async (selectedUsers) => {
    try {
      await ApiConfig.api.post(`/api/groups/${selectedGroup.id}/members`, {
        userIds: selectedUsers.map(user => user.id)
      });
      // Refresh the chats to update the group data
      fetchChats();
      setShowAddMembersPopup(false);
      toast.success('Članovi uspješno dodani');
    } catch (error) {
      console.error('Error adding members:', error);
      toast.error('Greška pri dodavanju članova');
    }
  };

  const fetchAdminDetails = async (adminId) => {
    try {
      const response = await ApiConfig.api.get(`/api/mentor-osnovno/${adminId}`);
      setGroupAdmin(response.data);
    } catch (error) {
      console.error('Error fetching admin details:', error);
    }
  };

  const fetchMemberDetails = async (memberId, isMentor) => {
    try {
      const endpoint = isMentor ? '/api/mentor-osnovno/' : '/api/korisnik-osnovno/';
      const response = await ApiConfig.api.get(`${endpoint}${memberId}`);
      setMemberDetails(prev => ({
        ...prev,
        [memberId]: response.data
      }));
    } catch (error) {
      console.error(`Error fetching ${isMentor ? 'mentor' : 'user'} details:`, error);
    }
  };

  const handleShowGroupDetails = async () => {
    if (selectedGroup) {
      const currentMembers = [...selectedGroup.members, ...selectedGroup.mentorMembers];
      const adminInMembers = currentMembers.find(member => member.id === selectedGroup.adminId);

      // Fetch admin details if needed
      if (!adminInMembers && selectedGroup.adminId !== user.id) {
        await fetchAdminDetails(selectedGroup.adminId);
      }

      // Fetch details for any missing members
      const fetchPromises = currentMembers
        .filter(member => {
          // Only fetch if we don't have complete member data
          return !member.ime || !member.prezime || !member.email || !member.school;
        })
        .map(member => fetchMemberDetails(member.id, member.uloga === 'mentor'));

      await Promise.all(fetchPromises);
    }
    setShowGroupDetails(true);
  };

  const handleCloseGroupDetails = () => {
    setShowGroupDetails(false);
  };

  const handleDeleteGroup = async () => {
    try {
      await ApiConfig.api.delete(`/api/groups/${selectedGroup.id}`);
      toast.success('Grupa je uspješno obrisana');
      handleCloseGroupDetails();
      fetchChats(); // Refresh the chat list
      setSelectedChat(null);
      setSelectedChatName('');
      setSelectedGroup(null);
      setShowDeleteConfirmation(false);
    } catch (error) {
      console.error('Error deleting group:', error);
      toast.error('Greška pri brisanju grupe');
    }
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (rateLimitTimer) {
        clearTimeout(rateLimitTimer);
      }
    };
  }, [rateLimitTimer]);

  // Fetch programs
  const fetchPrograms = async () => {
    try {
      // Check if programs are already cached
      if (Array.isArray(programs) && programs.length > 0) {
        return;
      }
      const response = await ApiConfig.api.get('/api/programs');

      if (response.data && Array.isArray(response.data)) {
        setPrograms(response.data);
      } else {
        console.warn('Received invalid programs data', response.data);
        setPrograms([]);
      }
    } catch (error) {
      console.error('Error fetching programs:', error);
      setPrograms([]);
    }
  };

  useEffect(() => {
    if (showGroupModal && Array.isArray(programs) && programs.length === 0) {
      fetchPrograms();
    }
  }, [showGroupModal]);

  if (isLoading) {
    return <LoadingShell />;
  }

  if (error) {
    return (
      <div className="error-container">
        <p>Error: {error}</p>
        <button onClick={fetchChats}>Pokušaj ponovno</button>
      </div>
    );
  }

  if (!user?.id) {
    return <div>Molimo prijavite se za pristup chatu</div>;
  }

  return (
    <div className={styles.chatContainer}>
      <NavTop
        user={user}
        naslov={selectedChatName}
        group={selectedGroup}
        onAddMembers={handleShowGroupDetails}
        onRemoveMembers={handleRemoveMembers}
      />

      <Navigacija user={user} otvoreno="chat" chat={!chatGumb} unreadChatsCount={unreadChatsCount} />
      <ToastContainer />
      <div className="main">
        <div className="flex items-center justify-center pt-20 px-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-6xl h-[calc(100vh-8rem)]">
            <div className="flex h-full rounded-lg overflow-hidden relative">
              <div className="rl-gumb chat-tgl-btn" onClick={handleItemClickChatGumb}>
                <Icon
                  className="icon"
                  icon={chatGumb ? "" : "solar:arrow-left-broken"}
                />
              </div>
              <div className={`chat-nav-container ${chatGumb ? 'open' : ''}`}>
                <NavSideChat
                  chats={chats}
                  onChatClick={handleChatClick}
                  user={user}
                  onUpdate={() => {
                    fetchChatData().then(() => fetchChats());
                  }}
                  onCreateGroupClick={() => openGroupModal()}
                />
              </div>
              {selectedChat && (
                <ChatContainer
                  messages={messages}
                  handleSendMessage={handleSendMessage}
                  selectedChat={selectedChat}
                  user={user}
                  setMessages={setMessages}
                  onMessageUpdate={handleMessageUpdate}
                  onSendMessage={handleSendMessage}
                  messagesEndRef={messagesEndRef}
                  isRateLimited={isRateLimited}
                  setIsRateLimited={setIsRateLimited}
                  rateLimitTimer={rateLimitTimer}
                  setRateLimitTimer={setRateLimitTimer}
                  socket={socket}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Group Chat Creation/Edit Modal */}
      {showGroupModal && (
        <Modal
          isOpen={true}
          onClose={() => {
            setShowGroupModal(false);
            setSearchInput('');
            setSearchResults([]);
            setEditingGroup(null);
            setAutoAddTheoryStudents(false);
            setShowProgramFilter(false);
            setSelectedProgram('');
          }}
          title={
            <>
              <Icon icon={editingGroup ? "solar:pen-new-square-broken" : "solar:users-group-two-rounded-broken"} />
              {editingGroup ? 'Uredi grupu' : 'Kreiraj novu grupu'}
            </>
          }
          maxWidth="800px"
          isFormModal={true}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Group Name */}
            <div>
              <label htmlFor="group-name" style={{ fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>
                Ime grupe <span style={{ color: 'red' }}>*</span>
              </label>
              <input
                id="group-name"
                type="text"
                placeholder="Unesite ime grupe"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                className="input-login-signup"
                style={{ width: '100%' }}
              />
            </div>

            {/* Auto-add Options */}
            {!editingGroup && (
              <div style={{
                background: 'rgba(var(--isticanje2), 0.05)',
                padding: '1rem',
                borderRadius: 'var(--radius)',
                border: '1px solid rgba(var(--isticanje2), 0.2)'
              }}>
                <div style={{ fontWeight: 600, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Icon icon="solar:user-plus-broken" />
                  Brzo dodavanje učenika
                </div>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  cursor: 'pointer',
                  padding: '0.5rem',
                  borderRadius: 'var(--radius)',
                  transition: 'background 0.2s'
                }}>
                  <input
                    type="checkbox"
                    checked={autoAddTheoryStudents}
                    onChange={(e) => {
                      e.stopPropagation();
                      setAutoAddTheoryStudents(e.target.checked);
                    }}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <span>Dodaj sve učenike koji pohađaju teoriju</span>
                </label>
              </div>
            )}

            {/* Add Members */}
            <div>
              <label htmlFor="member-search" style={{ fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>
                Dodaj članove
              </label>
              <input
                id="member-search"
                type="text"
                placeholder="Pretraži korisnike..."
                value={searchInput}
                onChange={(e) => handleSearch(e.target.value)}
                className="input-login-signup"
                style={{ width: '100%' }}
              />

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div style={{ marginTop: '0.75rem' }}>
                  <div style={{ fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                    Rezultati pretrage
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '200px', overflowY: 'auto' }}>
                    {searchResults.map(person => (
                      <div
                        key={person.id}
                        style={{
                          background: 'rgba(var(--isticanje2), 0.05)',
                          border: '1px solid rgba(var(--isticanje2), 0.2)',
                          borderRadius: 'var(--radius)',
                          padding: '0.75rem',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '1rem'
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600 }}>{person.ime} {person.prezime}</div>
                          <div style={{ fontSize: '0.85rem', opacity: 0.7 }}>{person.email}</div>
                          <div style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
                            <span style={{
                              padding: '0.2rem 0.5rem',
                              borderRadius: 'var(--radius)',
                              background: person.uloga === 'mentor' ? 'rgba(var(--isticanje), 0.15)' : 'rgba(var(--isticanje2), 0.15)',
                              fontSize: '0.75rem',
                              fontWeight: 600
                            }}>
                              {person.uloga === 'mentor' ? 'Mentor' : 'Učenik'}
                            </span>
                            <span style={{ marginLeft: '0.5rem', opacity: 0.6 }}>{person.school?.name}</span>
                          </div>
                        </div>
                        <button
                          className="action-btn spremiBtn"
                          onClick={() => handleAddMember(person)}
                          style={{ padding: '0.5rem 1rem' }}
                        >
                          <Icon icon="solar:add-circle-broken" /> Dodaj
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Selected Members */}
              {([...selectedUsers, ...selectedMentors].length > 0) && (
                <div style={{ marginTop: '1rem' }}>
                  <div style={{ fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                    Članovi grupe ({[...selectedUsers, ...selectedMentors].length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '200px', overflowY: 'auto' }}>
                    {[...selectedUsers, ...selectedMentors].map(person => {
                      const isMentor = person.uloga === 'mentor';
                      return (
                        <div
                          key={`${isMentor ? 'mentor' : 'user'}-${person.id}`}
                          style={{
                            background: 'rgba(var(--isticanje), 0.05)',
                            border: '1px solid rgba(var(--isticanje), 0.2)',
                            borderRadius: 'var(--radius)',
                            padding: '0.75rem',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '1rem'
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600 }}>{person.ime} {person.prezime}</div>
                            <div style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
                              <span style={{
                                padding: '0.2rem 0.5rem',
                                borderRadius: 'var(--radius)',
                                background: isMentor ? 'rgba(var(--isticanje), 0.15)' : 'rgba(var(--isticanje2), 0.15)',
                                fontSize: '0.75rem',
                                fontWeight: 600
                              }}>
                                {isMentor ? 'Mentor' : 'Učenik'}
                              </span>
                            </div>
                          </div>
                          <button
                            className="action-btn abDelete"
                            onClick={() => handleRemoveMember(person)}
                            style={{ padding: '0.5rem' }}
                          >
                            <Icon icon="solar:trash-bin-trash-broken" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="div-radio">
              <button
                className="gumb action-btn zatvoriBtn"
                onClick={() => {
                  setShowGroupModal(false);
                  setSearchInput('');
                  setSearchResults([]);
                  setEditingGroup(null);
                  setAutoAddTheoryStudents(false);
                  setShowProgramFilter(false);
                  setSelectedProgram('');
                }}
                type="button"
              >
                <Icon icon="solar:close-circle-broken" /> Odustani
              </button>
              <button
                className="gumb action-btn spremiBtn"
                onClick={editingGroup ? handleEditGroup : handleCreateGroup}
                disabled={isCreatingGroup}
                type="button"
              >
                <Icon icon={isCreatingGroup ? "solar:loading-bold-duotone" : editingGroup ? "solar:diskette-broken" : "solar:users-group-two-rounded-broken"} className={isCreatingGroup ? "spin" : ""} />
                {isCreatingGroup ? 'Spremanje...' : editingGroup ? 'Spremi promjene' : 'Kreiraj grupu'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {notification && (
        <Notifikacija
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}

      {showAddMembersPopup && (
        <Modal
          isOpen={true}
          onClose={() => {
            setShowAddMembersPopup(false);
            setSearchInput('');
            setSearchResults([]);
          }}
          title={
            <>
              <Icon icon="solar:user-plus-broken" />
              Dodaj članove u grupu
            </>
          }
          maxWidth="700px"
          isFormModal={false}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Search Input */}
            <div>
              <label htmlFor="add-member-search" style={{ fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>
                Pretraži korisnike
              </label>
              <input
                id="add-member-search"
                type="text"
                placeholder="Pretraži korisnike..."
                value={searchInput}
                onChange={(e) => handleSearch(e.target.value)}
                className="input-login-signup"
                style={{ width: '100%' }}
              />
            </div>

            {/* Search Results */}
            {searchInput.length > 0 && searchResults.length > 0 && (
              <div>
                <div style={{ fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                  Rezultati pretrage ({searchResults.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '400px', overflowY: 'auto' }}>
                  {searchResults.map(person => (
                    <div
                      key={`${person.uloga}-${person.id}`}
                      style={{
                        background: 'rgba(var(--isticanje2), 0.05)',
                        border: '1px solid rgba(var(--isticanje2), 0.2)',
                        borderRadius: 'var(--radius)',
                        padding: '0.75rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '1rem'
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600 }}>{person.ime} {person.prezime}</div>
                        <div style={{ fontSize: '0.85rem', opacity: 0.7 }}>{person.email}</div>
                        <div style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
                          <span style={{
                            padding: '0.2rem 0.5rem',
                            borderRadius: 'var(--radius)',
                            background: person.uloga === 'mentor' ? 'rgba(var(--isticanje), 0.15)' : 'rgba(var(--isticanje2), 0.15)',
                            fontSize: '0.75rem',
                            fontWeight: 600
                          }}>
                            {person.uloga === 'mentor' ? 'Mentor' : 'Učenik'}
                          </span>
                          <span style={{ marginLeft: '0.5rem', opacity: 0.6 }}>{person.school?.name}</span>
                        </div>
                      </div>
                      <button
                        className="action-btn spremiBtn"
                        onClick={() => handleAddMembersSubmit([person])}
                        style={{ padding: '0.5rem 1rem' }}
                      >
                        <Icon icon="solar:add-circle-broken" /> Dodaj
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {searchInput.length > 0 && searchResults.length === 0 && (
              <div style={{
                padding: '2rem',
                textAlign: 'center',
                background: 'rgba(var(--isticanje2), 0.05)',
                borderRadius: 'var(--radius)',
                border: '1px solid rgba(var(--isticanje2), 0.2)'
              }}>
                <Icon icon="solar:user-broken" style={{ fontSize: '3rem', opacity: 0.3, marginBottom: '1rem' }} />
                <p style={{ margin: 0, opacity: 0.7 }}>Nema rezultata pretrage</p>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Group Details Popup */}
      {showGroupDetails && selectedGroup && (
        <Modal
          isOpen={true}
          onClose={handleCloseGroupDetails}
          title={
            <>
              <Icon icon="solar:users-group-rounded-broken" />
              {selectedGroup.name}
            </>
          }
          maxWidth="800px"
          isFormModal={false}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Group Info */}
            <div style={{
              background: 'rgba(var(--isticanje), 0.05)',
              padding: '1rem',
              borderRadius: 'var(--radius)',
              border: '1px solid rgba(var(--isticanje), 0.2)'
            }}>
              {selectedGroup.description && (
                <div style={{ marginBottom: '0.75rem', fontSize: '0.95rem' }}>{selectedGroup.description}</div>
              )}
              <div style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Icon icon="solar:shield-user-broken" style={{ fontSize: '1.2rem', color: 'rgb(var(--isticanje))' }} />
                <strong>Admin:</strong> {
                  selectedGroup.adminId === user.id
                    ? `${user.ime} ${user.prezime}`
                    : (() => {
                        const adminMember = [...selectedGroup.members, ...selectedGroup.mentorMembers]
                          .find(member => member.id === selectedGroup.adminId);
                        return adminMember
                          ? `${adminMember.ime} ${adminMember.prezime}`
                          : groupAdmin
                            ? `${groupAdmin.ime} ${groupAdmin.prezime}`
                            : 'Učitavanje...'
                      })()
                }
              </div>
            </div>

            {/* Members List */}
            <div>
              <div style={{ fontWeight: 600, marginBottom: '1rem', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Icon icon="solar:users-group-two-rounded-broken" />
                Članovi grupe ({[...selectedGroup.members, ...selectedGroup.mentorMembers].length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '400px', overflowY: 'auto' }}>
                {[...selectedGroup.members, ...selectedGroup.mentorMembers].map(member => {
                  const isAdmin = member.id === selectedGroup.adminId || (selectedGroup.adminId === user.id && member.id === user.id);
                  return (
                    <div
                      key={member.id}
                      style={{
                        background: isAdmin ? 'rgba(var(--isticanje), 0.1)' : 'rgba(var(--isticanje2), 0.05)',
                        border: `1px solid ${isAdmin ? 'rgba(var(--isticanje), 0.3)' : 'rgba(var(--isticanje2), 0.2)'}`,
                        borderRadius: 'var(--radius)',
                        padding: '0.75rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '1rem'
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontWeight: 600 }}>{member.ime} {member.prezime}</span>
                          {isAdmin && (
                            <span style={{
                              padding: '0.2rem 0.5rem',
                              borderRadius: 'var(--radius)',
                              background: 'rgb(var(--isticanje))',
                              color: 'var(--pozadina)',
                              fontSize: '0.7rem',
                              fontWeight: 600
                            }}>
                              <Icon icon="solar:shield-check-broken" style={{ verticalAlign: 'middle', marginRight: '0.25rem' }} />
                              Admin
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.85rem', opacity: 0.7, marginTop: '0.25rem' }}>{member.email}</div>
                        <div style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
                          <span style={{
                            padding: '0.2rem 0.5rem',
                            borderRadius: 'var(--radius)',
                            background: member.uloga === 'mentor' ? 'rgba(var(--isticanje), 0.15)' : 'rgba(var(--isticanje2), 0.15)',
                            fontSize: '0.75rem',
                            fontWeight: 600
                          }}>
                            {member.uloga === 'mentor' ? 'Mentor' : 'Učenik'}
                          </span>
                          {member.school?.name && (
                            <span style={{ marginLeft: '0.5rem', opacity: 0.6 }}>{member.school.name}</span>
                          )}
                        </div>
                      </div>
                      {selectedGroup.adminId === user.id && member.id !== selectedGroup.adminId && (
                        <button
                          className="action-btn abDelete"
                          onClick={() => handleRemoveMembers([member.id])}
                          style={{ padding: '0.5rem' }}
                        >
                          <Icon icon="solar:trash-bin-trash-broken" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Admin Actions */}
            {selectedGroup.adminId === user.id && (
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', paddingTop: '0.5rem', borderTop: '1px solid rgba(var(--isticanje2), 0.3)' }}>
                <button
                  className="gumb action-btn spremiBtn"
                  onClick={() => {
                    handleCloseGroupDetails();
                    handleAddMembers();
                  }}
                >
                  <Icon icon="solar:user-plus-broken" /> Dodaj članove
                </button>
                <button
                  className="gumb action-btn abDelete"
                  onClick={() => setShowDeleteConfirmation(true)}
                >
                  <Icon icon="solar:trash-bin-trash-broken" /> Obriši grupu
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Popup */}
      {showDeleteConfirmation && (
        <Modal
          isOpen={true}
          onClose={() => setShowDeleteConfirmation(false)}
          title={
            <>
              <Icon icon="solar:danger-triangle-broken" />
              Potvrda brisanja
            </>
          }
          maxWidth="500px"
          isFormModal={true}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{
              padding: '1rem',
              background: 'rgba(220, 53, 69, 0.1)',
              border: '1px solid rgba(220, 53, 69, 0.3)',
              borderRadius: 'var(--radius)',
              textAlign: 'center'
            }}>
              <p style={{ margin: 0, fontSize: '1rem', marginBottom: '0.5rem' }}>
                Jeste li sigurni da želite obrisati grupu <strong>"{selectedGroup?.name}"</strong>?
              </p>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#dc3545', fontWeight: 600 }}>
                <Icon icon="solar:danger-broken" style={{ verticalAlign: 'middle', marginRight: '0.25rem' }} />
                Ova akcija je nepovratna.
              </p>
            </div>

            <div className="div-radio">
              <button
                className="gumb action-btn zatvoriBtn"
                onClick={() => setShowDeleteConfirmation(false)}
                type="button"
              >
                <Icon icon="solar:close-circle-broken" /> Odustani
              </button>
              <button
                className="gumb action-btn abDelete"
                onClick={handleDeleteGroup}
                type="button"
              >
                <Icon icon="solar:trash-bin-trash-broken" /> Obriši grupu
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default Chat;