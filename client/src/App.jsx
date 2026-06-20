import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useLiveQuery } from 'dexie-react-hooks';
import { useVirtualizer } from '@tanstack/react-virtual';
import { MessageSquare, Settings, LogOut, Search, UserPlus, Phone, Video, Mic, MicOff, VideoOff, PhoneOff, MonitorUp, PhoneCall, Check, CheckCheck, Clock, MessageSquareDashed, X, ChevronLeft, ChevronRight, Reply, SmilePlus, Plus, Users } from 'lucide-react';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import ChatInput from './components/ChatInput';
import ProfilePanel from './components/ProfilePanel';
import SettingsPanel from './components/SettingsPanel';
import GroupInfoModal from './components/GroupInfoModal';
import SyncEngine from './services/SyncEngine';
import WebRTCManager from './services/WebRTCManager';
import { db } from './db/db';
import axios from 'axios';
import { supabase } from './supabaseClient';
import CustomAudioPlayer from './components/CustomAudioPlayer';

let socket;
let syncEngine;
let rtcManager;

const timeAgo = (date) => {
  if (!date) return '';
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  if (seconds < 60) return `just now`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const getInitials = (name) => name ? name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() : '??';

function App() {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [activeChat, setActiveChat] = useState(null);
  const [contextMenu, setContextMenu] = useState(null); // { id, x, y, isMe }
  const [searchQuery, setSearchQuery] = useState('');
  const [editingMessage, setEditingMessage] = useState(null);
  const [replyingMessage, setReplyingMessage] = useState(null);
  const [reactionDetail, setReactionDetail] = useState(null); // { messageId, reactions }
  const [showMoreEmojis, setShowMoreEmojis] = useState(false);
  const [activeTab, setActiveTab] = useState('chats');
  const [showProfile, setShowProfile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  // Theme state
  const [isDarkMode, setIsDarkMode] = useState(localStorage.getItem('theme') === 'dark');

  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add('dark-theme');
      localStorage.setItem('theme', 'dark');
    } else {
      document.body.classList.remove('dark-theme');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode(prev => !prev);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      handleSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSession = async (session) => {
    if (session) {
      try {
        const res = await axios.post('/api/auth/sync', {
          email: session.user.email,
          name: session.user.user_metadata?.name || session.user.user_metadata?.full_name,
          username: session.user.user_metadata?.username,
          avatar: session.user.user_metadata?.avatar_url
        }, {
          headers: { Authorization: `Bearer ${session.access_token}` }
        });
        setToken(session.access_token);
        setUser(res.data.user);
      } catch (err) {
        console.error('Failed to sync user with backend', err);
        setToken(null);
        setUser(null);
      }
    } else {
      setToken(null);
      setUser(null);
    }
    setAuthChecking(false);
  };
  
  // Offline-first: Subscribe to Dexie DB
  const [isConnected, setIsConnected] = useState(false);
  const [remoteStream, setRemoteStream] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [incomingCall, setIncomingCall] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showCallChat, setShowCallChat] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [readReceipts, setReadReceipts] = useState(() => {
    try {
      const saved = localStorage.getItem('readReceipts');
      return saved !== null && saved !== 'undefined' ? JSON.parse(saved) : true;
    } catch (e) { return true; }
  });
  const [showDeletedMessages, setShowDeletedMessages] = useState(() => {
    try {
      const saved = localStorage.getItem('showDeletedMessages');
      return saved !== null && saved !== 'undefined' ? JSON.parse(saved) : true;
    } catch (e) { return true; }
  });

  // Global Data State
  const [contacts, setContacts] = useState([]);
  const [friendsData, setFriendsData] = useState([]);
  const [blocksData, setBlocksData] = useState([]);
  const [groupsData, setGroupsData] = useState([]);
  const [typingUsers, setTypingUsers] = useState({});
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [hiddenChats, setHiddenChats] = useState(() => {
    try {
      const saved = localStorage.getItem('hiddenChats');
      return saved ? JSON.parse(saved) : [];
    } catch(e) { return []; }
  });

  const handleHideChat = async (id) => {
    if (!window.confirm('Delete this chat? All local messages will be removed.')) return;
    try {
      // Delete all messages with this contact from Dexie
      await db.messages.filter(m => 
        (m.senderId === id && m.receiverId === user.id) || 
        (m.senderId === user.id && m.receiverId === id) ||
        m.receiverId === id // for group messages
      ).delete();
    } catch(e) { console.error('Failed to delete messages', e); }

    setHiddenChats(prev => {
      if (prev.includes(id)) return prev;
      const updated = [...prev, id];
      localStorage.setItem('hiddenChats', JSON.stringify(updated));
      return updated;
    });
    if (activeChat?.id === id) {
      setActiveChat(null);
    }
  };

  const handleGroupUpdated = (updatedGroup) => {
    setGroupsData(prev => prev.map(g => g.id === updatedGroup.id ? { ...updatedGroup, isGroup: true } : g));
    if (activeChat?.id === updatedGroup.id) {
      setActiveChat({ ...updatedGroup, isGroup: true });
    }
  };

  const handleGroupLeftOrDeleted = (groupId) => {
    setGroupsData(prev => prev.filter(g => g.id !== groupId));
    if (activeChat?.id === groupId) {
      setActiveChat(null);
    }
    setShowGroupInfo(false);
  };

  // Fetch all users
  const fetchUsers = useCallback(async () => {
    if (!token) return;
    try {
      const res = await axios.get('/api/users', { headers: { Authorization: `Bearer ${token}` } });
      setContacts(res.data);
    } catch (err) { console.error(err); }
  }, [token]);

  // Fetch friends and requests
  const fetchFriends = useCallback(async () => {
    if (!token) return;
    try {
      const res = await axios.get('/api/friends', { headers: { Authorization: `Bearer ${token}` } });
      setFriendsData(res.data);
    } catch (err) { console.error(err); }
  }, [token]);

  // Fetch blocked users
  const fetchBlocks = useCallback(async () => {
    if (!token) return;
    try {
      const res = await axios.get('/api/blocks', { headers: { Authorization: `Bearer ${token}` } });
      setBlocksData(res.data);
    } catch (err) { console.error(err); }
  }, [token]);

  // Fetch groups
  const fetchGroups = useCallback(async () => {
    if (!token) return;
    try {
      const res = await axios.get('/api/groups', { headers: { Authorization: `Bearer ${token}` } });
      const mappedGroups = res.data.map(g => ({ ...g, isGroup: true }));
      setGroupsData(mappedGroups);
    } catch (err) { console.error(err); }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchUsers();
      fetchFriends();
      fetchBlocks();
      fetchGroups();
    }
  }, [token, activeTab, fetchUsers, fetchFriends, fetchBlocks, fetchGroups]);

  const messagesEndRef = useRef(null);
  const listRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  
  const messages = useLiveQuery(() => {
    if (!user?.id) return [];
    return db.messages.where('ownerId').equals(user.id).sortBy('timestamp');
  }, [user?.id]) || [];

  // Auto scroll to bottom on new messages or chat switch
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    // Wait a tiny bit for the DOM to update with the new messages
    const timeoutId = setTimeout(scrollToBottom, 50);
    return () => clearTimeout(timeoutId);
  }, [messages, activeChat?.id, scrollToBottom]);

  useEffect(() => {
    if (!token) return;

    socket = io('/', { 
      path: '/socket.io',
      auth: { token }
    });
    
    syncEngine = new SyncEngine(socket);
    rtcManager = new WebRTCManager(socket, user.id);

    rtcManager.onRemoteStream = (stream) => {
      setRemoteStream(stream);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
      }
    };

    rtcManager.onCallIncoming = (data) => setIncomingCall(data);
    rtcManager.onCallAccepted = async (data) => {
      setActiveCall(prev => ({ type: 'active', peerId: data.responderId, callType: prev?.callType }));
      setIncomingCall(null);
      if (localVideoRef.current && rtcManager.localStream) localVideoRef.current.srcObject = rtcManager.localStream;
      await rtcManager.startConnection(data.responderId);
    };
    rtcManager.onCallRejected = () => {
      setIncomingCall(null);
      setActiveCall(null);
    };
    rtcManager.onCallEnded = () => {
      setIncomingCall(null);
      setActiveCall(null);
      setLocalStream(null);
      setRemoteStream(null);
    };

    function onConnect() { setIsConnected(true); }
    function onDisconnect() { setIsConnected(false); }

    function onReceiveMessage(msg) {
      msg.ownerId = user.id;
      syncEngine.handleIncomingMessage(msg);
      
      // Clear typing indicator since they sent a message
      setTypingUsers(prev => ({ ...prev, [msg.senderId]: false }));

      // Unhide chat if it was hidden
      const contactId = msg.groupId || msg.senderId;
      setHiddenChats(prev => {
        if (prev.includes(contactId) && contactId !== user.id) {
          const updated = prev.filter(id => id !== contactId);
          localStorage.setItem('hiddenChats', JSON.stringify(updated));
          return updated;
        }
        return prev;
      });
      
      // Emit delivery receipt
      socket.emit('message_delivered', { id: msg.id });
      
      if (document.hidden) {
        if (Notification.permission === 'granted') {
          new Notification(`New message from ${msg.senderName}`, {
            body: msg.content?.substring(0, 50) + '...',
            icon: '/vite.svg'
          });
        }
      }
    }

    // Store timeouts for typing indicators
    const typingTimeouts = {};

    const onTypingStart = (data) => {
      setTypingUsers(prev => ({ ...prev, [data.senderId]: true }));
      
      // Auto-clear typing indicator after 3 seconds to prevent it from getting stuck
      if (typingTimeouts[data.senderId]) {
        clearTimeout(typingTimeouts[data.senderId]);
      }
      typingTimeouts[data.senderId] = setTimeout(() => {
        setTypingUsers(prev => ({ ...prev, [data.senderId]: false }));
        delete typingTimeouts[data.senderId];
      }, 3000);
    };

    const onTypingStop = (data) => {
      setTypingUsers(prev => ({ ...prev, [data.senderId]: false }));
      if (typingTimeouts[data.senderId]) {
        clearTimeout(typingTimeouts[data.senderId]);
        delete typingTimeouts[data.senderId];
      }
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('receive_message', onReceiveMessage);
    
    const onUserStatus = (data) => {
      setContacts(prev => prev.map(c => c.id === data.userId ? { ...c, isOnline: data.isOnline, lastSeen: data.lastSeen } : c));
    };

    socket.on('user_status', onUserStatus);
    socket.on('typing_start', onTypingStart);
    socket.on('typing_stop', onTypingStop);

    // Listen for status updates (DELIVERED / READ)
    const onMessageStatus = async (data) => {
      // data = { id, status }
      try {
        const msg = await db.messages.get(data.id);
        if (msg) {
          const levels = { 'SENT': 1, 'DELIVERED': 2, 'READ': 3 };
          const currentLevel = levels[msg.status] || 0;
          const newLevel = levels[data.status] || 0;
          
          if (newLevel > currentLevel) {
            await db.messages.update(data.id, { status: data.status });
          }
        }
      } catch (e) { console.error('Status update error', e); }
    };
    socket.on('message_status', onMessageStatus);

    // Listen for edits from other user
    const onMessageEdited = async (data) => {
      try {
        const msg = await db.messages.get(data.id);
        if (msg) {
          await db.messages.update(data.id, { content: data.content, isEdited: true });
        }
      } catch (e) { console.error('Edit update error', e); }
    };
    socket.on('message_edited', onMessageEdited);

    // Listen for deletes from other user
    const onMessageDeleted = async (data) => {
      try {
        if (data.type === 'everyone') {
          await db.messages.update(data.id, { isDeleted: true });
        }
      } catch (e) { console.error('Delete update error', e); }
    };
    socket.on('message_deleted', onMessageDeleted);

    // Listen for reactions from other user
    const onMessageReacted = async (data) => {
      try {
        const msg = await db.messages.get(data.messageId);
        if (msg) {
          const reactions = msg.reactions || {};
          if (!reactions[data.emoji]) reactions[data.emoji] = [];
          const idx = reactions[data.emoji].indexOf(data.userId);
          if (idx > -1) {
            reactions[data.emoji].splice(idx, 1);
            if (reactions[data.emoji].length === 0) delete reactions[data.emoji];
          } else {
            reactions[data.emoji].push(data.userId);
          }
          await db.messages.update(data.messageId, { reactions });
        }
      } catch (e) { console.error('Reaction update error', e); }
    };
    socket.on('message_reacted', onMessageReacted);

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return () => {
      if (rtcManager) {
        rtcManager.onRemoteStream = null;
        rtcManager.onCallIncoming = null;
        rtcManager.onCallAccepted = null;
        rtcManager.onCallRejected = null;
        rtcManager.onCallEnded = null;
      }
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('receive_message', onReceiveMessage);
      socket.off('user_status', onUserStatus);
      socket.off('typing_start', onTypingStart);
      socket.off('typing_stop', onTypingStop);
      socket.off('message_status', onMessageStatus);
      socket.off('message_edited', onMessageEdited);
      socket.off('message_deleted', onMessageDeleted);
      socket.off('message_reacted', onMessageReacted);
      socket.disconnect();
    };
  }, [token]);

  // Mark messages as read when chat is active
  useEffect(() => {
    if (!activeChat || !user || !socket) return;
    
    const markAsRead = async () => {
      if (document.hidden) return;
      
      // Find unread messages received FROM the activeChat user
      const unread = await db.messages.where('ownerId').equals(user.id)
        .filter(m => m.senderId === activeChat.id && m.status !== 'READ' && m.senderId !== user.id)
        .toArray();
        
      if (unread.length > 0) {
        for (const m of unread) {
          await db.messages.update(m.id, { status: 'READ' });
          if (readReceipts) {
            socket.emit('message_read', { id: m.id });
          }
        }
      }
    };
    
    // Run on messages change or when active chat changes
    markAsRead();
    
    // Also run when user switches back to this tab
    const handleVisibility = () => {
      if (!document.hidden) markAsRead();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [activeChat, messages, readReceipts, user]);

  if (authChecking) {
    return <div className="loading-screen" style={{height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>Loading...</div>;
  }

  if (!token || !user) {
    return <Login />;
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setToken(null);
    setUser(null);
    if (socket) socket.disconnect();
    window.location.reload();
  };

  const sendMessage = async (payload) => {
    if (syncEngine) {
      const msg = {
        id: crypto.randomUUID(),
        type: payload.type || 'text',
        content: payload.content,
        filename: payload.filename,
        replyToMessage: replyingMessage ? { id: replyingMessage.id, senderName: replyingMessage.senderName, content: replyingMessage.content, type: replyingMessage.type } : null,
        senderId: user.id,
        senderName: user.name,
        receiverId: activeChat.id,
        isGroup: activeChat.isGroup || false,
        ownerId: user.id,
        timestamp: new Date().toISOString()
      };
      await syncEngine.enqueueMessage(msg);
      setReplyingMessage(null);
    }
  };

  const initiateCall = async (type) => {
    if (!activeChat) return;
    rtcManager.initiateCall(activeChat.id, type, user.name);
    setActiveCall({ type: 'calling', peerId: activeChat.id, peerName: activeChat.name, peerAvatar: activeChat.avatar, callType: type });
    try {
      const stream = await rtcManager.getLocalMedia(type);
      setLocalStream(stream);
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    } catch(err) {
      console.error("Failed to initiate media:", err);
      alert(`Could not access camera/microphone.\n\nError: ${err.message}`);
      rtcManager.endCall(activeChat.id);
      setActiveCall(null);
    }
  };

  const acceptCall = async () => {
    if (!incomingCall) return;
    try {
      const stream = await rtcManager.getLocalMedia(incomingCall.type);
      setLocalStream(stream);
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      
      await rtcManager.acceptCall(incomingCall.callerId, incomingCall.type);
      const peerContact = contacts.find(c => c.id === incomingCall.callerId);
      setActiveCall({ type: 'active', peerId: incomingCall.callerId, peerName: incomingCall.callerName, peerAvatar: peerContact?.avatar, callType: incomingCall.type });
      setIncomingCall(null);
    } catch(err) {
      console.error("Failed to get local media:", err);
      alert(`Could not access camera/microphone.\n\nNote for local testing: Windows prevents two different browsers (like Chrome and Edge) from using the same webcam at the same time. The browser that initiated the call has locked the camera, so the receiving browser cannot access it.\n\nError: ${err.message}`);
      rejectCall();
    }
  };

  const rejectCall = () => {
    if (incomingCall) rtcManager.rejectCall(incomingCall.callerId);
    setIncomingCall(null);
  };

  const endCall = () => {
    if (activeCall) rtcManager.endCall(activeCall.peerId);
    setActiveCall(null);
    setLocalStream(null);
    setRemoteStream(null);
    setShowCallChat(false);
    setIsMuted(false);
    setIsVideoOff(false);
  };

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => track.enabled = !track.enabled);
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => track.enabled = !track.enabled);
      setIsVideoOff(!isVideoOff);
    }
  };

  const handleStartScreenShare = async () => {
    if (!activeCall) return alert("You must be in a call to screen share!");
    try {
      const stream = await rtcManager.getLocalMedia('screen');
      await rtcManager.replaceVideoTrack(stream);
      setLocalStream(stream);
      setIsScreenSharing(true);
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      
      const track = stream.getVideoTracks()[0];
      if (track) {
        track.onended = async () => {
          const camStream = await rtcManager.getLocalMedia('video');
          await rtcManager.replaceVideoTrack(camStream);
          setLocalStream(camStream);
          setIsScreenSharing(false);
          if (localVideoRef.current) localVideoRef.current.srcObject = camStream;
        };
      }
    } catch (err) {
      console.error(err);
      alert('Could not start screen share: ' + err.message);
    }
  };

  const handleEditMessage = (msg) => {
    setContextMenu(null);
    if (msg.type !== 'text') return alert('You can only edit text messages.');
    setEditingMessage(msg);
    setReplyingMessage(null);
  };

  const handleReplyMessage = (msg) => {
    setContextMenu(null);
    setReplyingMessage(msg);
    setEditingMessage(null);
  };

  const commitEditMessage = async (msgId, newContent) => {
    setEditingMessage(null);
    const msg = await db.messages.get(msgId);
    if (msg && newContent && newContent.trim() !== msg.content) {
      await db.messages.update(msgId, { content: newContent, isEdited: true });
      socket.emit('edit_message', { id: msgId, content: newContent });
    }
  };

  const handleDeleteMessage = async (msgId, scope) => {
    setContextMenu(null);
    if (scope === 'me') {
      await db.messages.delete(msgId);
    } else {
      await db.messages.update(msgId, { isDeleted: true, content: '🚫 This message was deleted.' });
      socket.emit('delete_message', { id: msgId, scope: 'everyone' });
    }
  };

  const handleReactMessage = async (msgId, emoji) => {
    setContextMenu(null);
    const msg = await db.messages.get(msgId);
    if (!msg) return;
    
    // Toggle reaction logic
    const currentReactions = msg.reactions || {};
    const hasReacted = currentReactions[emoji]?.includes(user.id);
    
    // Create new object to avoid mutation issues
    const newReactions = JSON.parse(JSON.stringify(currentReactions));
    
    if (hasReacted) {
      newReactions[emoji] = newReactions[emoji].filter(id => id !== user.id);
      if (newReactions[emoji].length === 0) delete newReactions[emoji];
    } else {
      if (!newReactions[emoji]) newReactions[emoji] = [];
      newReactions[emoji].push(user.id);
    }
    
    await db.messages.update(msgId, { reactions: newReactions });
    socket.emit('react_message', { id: msgId, emoji, userId: user.id, isAdd: !hasReacted });
  };

  const renderStatusIcon = (status) => {
    switch (status) {
      case 'PENDING':
        return <span className="status-icon pending" style={{ color: 'var(--text-muted)' }}><Clock size={12} /></span>;
      case 'SENT':
        return <span className="status-icon sent" style={{ color: 'var(--text-tertiary)' }}><Check size={12} /></span>;
      case 'DELIVERED':
        return <span className="status-icon delivered" style={{ color: 'var(--text-tertiary)' }}><CheckCheck size={12} /></span>;
      case 'READ':
        return <span className="status-icon read" style={{ color: '#4cb5f9' }}><CheckCheck size={12} /></span>;
      default:
        return null;
    }
  };

  if (!token) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="app-layout">
      {/* Main Content Area */}
      <div className={`main-content ${activeChat || activeCall ? 'mobile-chat-open' : ''}`}>
        {/* Sidebar */}
        {showSidebar && (
          <Sidebar 
            user={user} 
            activeChat={activeChat} 
            onSelectChat={(chat) => { 
              setActiveChat(chat); 
            }} 
            token={token} 
          socket={socket} 
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          messages={messages}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          contacts={contacts}
          setContacts={setContacts}
          friendsData={friendsData}
          setFriendsData={setFriendsData}
          blocksData={blocksData}
          setBlocksData={setBlocksData}
          groupsData={groupsData}
          fetchFriends={fetchFriends}
          fetchBlocks={fetchBlocks}
          fetchGroups={fetchGroups}
          hiddenChats={hiddenChats}
          onHideChat={handleHideChat}
          isDarkMode={isDarkMode}
            toggleTheme={toggleTheme}
            onLogout={handleLogout}
            onOpenProfile={() => setShowProfile(true)}
            onOpenSettings={() => setShowSettings(true)}
            incomingCall={incomingCall}
            acceptCall={acceptCall}
            rejectCall={rejectCall}
          />
        )}

        {/* Toggle Handle */}
        <div style={{ width: 0, position: 'relative', zIndex: 100 }}>
          <div 
            className="sidebar-toggle-handle" 
            onClick={() => setShowSidebar(!showSidebar)}
            title={showSidebar ? "Hide Sidebar" : "Show Sidebar"}
          >
            {showSidebar ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </div>
        </div>

        {/* Right Panel: Chat Area */}
      <div className="chat-panel">
        {activeCall ? (
          <div className="call-view">
            <div className="call-video-container">
              <video 
                ref={remoteVideoRef} 
                className="video-main" 
                autoPlay 
                playsInline 
                style={{ display: activeCall?.callType === 'audio' ? 'none' : 'block' }} 
              />
              
              {(!remoteStream || activeCall?.callType === 'audio') && (
                <div className="call-empty-video">
                  {activeCall.peerAvatar ? (
                    <img src={activeCall.peerAvatar} alt="avatar" className="call-empty-avatar" style={{ objectFit: 'cover' }} />
                  ) : (
                    <div className="call-empty-avatar">{activeCall.peerName ? activeCall.peerName[0].toUpperCase() : '?'}</div>
                  )}
                  <h2>{activeCall.peerName || 'Unknown'}</h2>
                  <p style={{ opacity: 0.8, marginTop: '8px' }}>
                    {!remoteStream ? (activeCall.type === 'calling' ? 'Calling...' : 'Connecting...') : 'In Call'}
                  </p>
                </div>
              )}
              
              <video ref={localVideoRef} className={`video-pip ${!localStream || isVideoOff || activeCall?.callType === 'audio' ? 'hidden' : ''} ${isScreenSharing ? 'is-screen-share' : ''}`} autoPlay playsInline muted />
            </div>
            
            <div className="call-controls">
              <button onClick={toggleMute} className={isMuted ? 'danger' : ''} title={isMuted ? 'Unmute' : 'Mute'}>
                {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
              </button>
              {activeCall?.callType !== 'audio' && (
                <>
                  <button onClick={toggleVideo} className={isVideoOff ? 'danger' : ''} title={isVideoOff ? 'Start Video' : 'Stop Video'}>
                    {isVideoOff ? <VideoOff size={24} /> : <Video size={24} />}
                  </button>
                  <button onClick={handleStartScreenShare} title="Share Screen">
                    <MonitorUp size={24} />
                  </button>
                </>
              )}
              <button onClick={() => setShowCallChat(!showCallChat)} className={showCallChat ? 'active' : ''} title="Chat">
                <MessageSquare size={24} />
              </button>
              <button className="danger" onClick={endCall} title="End Call">
                <PhoneOff size={24} />
              </button>
            </div>

            {showCallChat && (
              <div className="call-chat-overlay">
                <div className="call-chat-header">
                  <h3>Chat with {activeCall.peerName || 'Unknown'}</h3>
                  <button className="retro-btn" onClick={() => setShowCallChat(false)} style={{ background: 'transparent', color: 'var(--text-secondary)' }}><X size={20} /></button>
                </div>
                
                <div ref={listRef} className="chat-messages" style={{ border: 'none', background: 'transparent' }}>
                  {messages.filter(m => (m.senderId === user.id && m.receiverId === activeCall.peerId) || (m.senderId === activeCall.peerId && m.receiverId === user.id)).length === 0 && (
                    <div className="empty-chat">
                      <MessageSquareDashed size={48} />
                      <p>No messages yet.</p>
                    </div>
                  )}
                  {messages.filter(m => {
                    const isActiveChat = (m.senderId === user.id && m.receiverId === activeCall.peerId) || (m.senderId === activeCall.peerId && m.receiverId === user.id);
                    const isVisible = showDeletedMessages ? true : !m.isDeleted;
                    return isActiveChat && isVisible;
                  }).map((m) => {
                    const isMe = m.senderId === user.id;
                    return (
                      <div key={m.id} className={`msg ${isMe ? 'msg-sent' : 'msg-received'}`} onContextMenu={(e) => { e.preventDefault(); setContextMenu({ id: m.id, x: e.clientX, y: e.clientY, isMe }); }}>
                        <div className={`msg-bubble ${isMe ? 'bubble-sent' : 'bubble-received'} ${m.isDeleted ? 'deleted' : ''}`}>
                          {!isMe && <div className="msg-sender">{m.senderName}</div>}
                          
                          {m.isDeleted ? (
                            <div className="msg-text" style={{ fontStyle: 'italic', opacity: 0.6, display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ display: 'inline-flex', padding: '4px 8px', background: 'rgba(0,0,0,0.1)', borderRadius: '4px', fontSize: '0.8rem' }}>
                                🚫 This message was deleted
                              </span>
                            </div>
                          ) : m.type === 'sticker' ? (
                            <div className="msg-sticker">{m.content}</div>
                          ) : m.type === 'custom_sticker' ? (
                            <div className="msg-custom-sticker" style={{ padding: '4px' }}>
                              <img src={m.content} alt="sticker" style={{ maxWidth: '160px', borderRadius: '8px' }} />
                            </div>
                          ) : (
                            <div className="msg-text">
                              {m.content}
                              {m.isEdited && <span className="edited-tag" style={{ fontSize: '0.65rem', marginLeft: '6px', opacity: 0.6 }}>(edited)</span>}
                            </div>
                          )}
                          
                          <div className="msg-footer">
                            <span className="msg-time">
                              {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {isMe && (
                              <span className="msg-status" style={{ display: 'inline-flex', alignItems: 'center' }}>
                                {m.status === 'SENT' ? (
                                  <Check size={14} style={{ stroke: 'var(--text-tertiary)' }} />
                                ) : m.status === 'READ' ? (
                                  <CheckCheck size={15} strokeWidth={2.5} style={{ stroke: '#4cb5f9', color: '#4cb5f9', filter: 'drop-shadow(0 0 1px rgba(76,181,249,0.5))' }} />
                                ) : (
                                  <CheckCheck size={14} style={{ stroke: 'var(--text-secondary)' }} />
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
                <ChatInput onSendMessage={sendMessage} />
              </div>
            )}
          </div>
        ) : activeChat ? (
          <>
            {/* Chat Header */}
            <div className="chat-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button 
                  className="mobile-back-btn action-btn" 
                  onClick={() => { setActiveChat(null); }}
                >
                  <ChevronLeft size={24} />
                </button>
                <div 
                  className="chat-header-left" 
                  onClick={() => activeChat.isGroup && setShowGroupInfo(true)}
                  style={{ cursor: activeChat.isGroup ? 'pointer' : 'default' }}
                  title={activeChat.isGroup ? "View Group Info" : ""}
                >
                  <div className="chat-avatar-wrapper">
                  {activeChat.avatar ? (
                    <img src={activeChat.avatar} alt="avatar" className="avatar" style={{ objectFit: 'cover' }} />
                  ) : (
                    <div className="avatar">
                      {activeChat.isGroup ? <Users size={20} color="#fff" /> : getInitials(activeChat.name)}
                    </div>
                  )}
                  {!activeChat.isGroup && activeChat.isOnline && <div className="online-badge"></div>}
                </div>
                <div className="chat-header-info">
                  <span className="chat-contact-name">{activeChat.name}</span>
                  <span className="chat-contact-status">
                    {activeChat.isGroup 
                      ? `${activeChat.Members?.length || 0} participants` 
                      : (activeChat.isOnline ? 'Online' : (activeChat.lastSeen ? `Last seen ${timeAgo(activeChat.lastSeen)}` : 'Offline'))
                    }
                  </span>
                </div>
                </div>
              </div>
              <div className="chat-header-right" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                {!activeChat.isGroup && (
                  <>
                    <button onClick={() => initiateCall('video')} className="action-btn" title="Video Call"><Video size={20} /></button>
                    <button onClick={() => initiateCall('audio')} className="action-btn" title="Voice Call"><Phone size={20} /></button>
                  </>
                )}
              </div>
            </div>

            {/* Standard Messages View */}
            <div ref={listRef} className="chat-messages">
              {messages.filter(m => activeChat.isGroup ? m.receiverId === activeChat.id : ((m.senderId === user.id && m.receiverId === activeChat.id) || (m.senderId === activeChat.id && m.receiverId === user.id))).length === 0 && (
                <div className="empty-chat">
                  <MessageSquareDashed size={48} />
                  <p>No messages yet. Say hello!</p>
                </div>
              )}
              {messages.filter(m => {
                const isActiveChat = activeChat.isGroup 
                  ? m.receiverId === activeChat.id 
                  : ((m.senderId === user.id && m.receiverId === activeChat.id) || (m.senderId === activeChat.id && m.receiverId === user.id));
                const isVisible = showDeletedMessages ? true : !m.isDeleted;
                return isActiveChat && isVisible;
              }).map((m) => {
                const isMe = m.senderId === user.id;
                return (
                  <div key={m.id} id={`msg-${m.id}`} className={`msg ${isMe ? 'msg-sent' : 'msg-received'}`} style={{ display: 'flex', alignItems: 'center', gap: '4px', flexDirection: isMe ? 'row-reverse' : 'row', maxWidth: '75%' }}>
                    <div className={`msg-bubble ${isMe ? 'bubble-sent' : 'bubble-received'} ${m.isDeleted ? 'deleted' : ''}`} onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setContextMenu({ id: m.id, x: e.clientX, y: e.clientY, isMe }); }}>
                      {!isMe && <div className="msg-sender">{m.senderName}</div>}
                      
                      {m.replyToMessage && (
                        <div 
                          onClick={() => {
                            const el = document.getElementById(`msg-${m.replyToMessage.id}`);
                            if (el) {
                              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              const bubble = el.querySelector('.msg-bubble');
                              if (bubble) {
                                bubble.classList.add('highlight-msg');
                                setTimeout(() => bubble.classList.remove('highlight-msg'), 2000);
                              }
                            }
                          }}
                          className="msg-reply-block"
                        >
                          <div className="msg-reply-sender">{m.replyToMessage.senderName}</div>
                          <div className="msg-reply-content">{m.replyToMessage.content || (m.replyToMessage.type !== 'text' ? `[${m.replyToMessage.type}]` : '')}</div>
                        </div>
                      )}
                      
                      {m.isDeleted ? (
                        <div className="msg-text" style={{ fontStyle: 'italic', opacity: 0.6, display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ display: 'inline-flex', padding: '4px 8px', background: 'rgba(0,0,0,0.1)', borderRadius: '4px', fontSize: '0.8rem' }}>
                            🚫 This message was deleted
                          </span>
                        </div>
                      ) : m.type === 'sticker' ? (
                        <div className="msg-sticker">{m.content}</div>
                      ) : m.type === 'custom_sticker' ? (
                        <div className="msg-custom-sticker" style={{ padding: '4px' }}>
                          <img src={m.content} alt="sticker" style={{ maxWidth: '160px', borderRadius: '8px' }} />
                        </div>
                      ) : m.type === 'image' ? (
                        <div className="msg-image" style={{ padding: '4px' }}>
                          <img src={m.content} alt="attachment" style={{ maxWidth: '240px', borderRadius: '8px', display: 'block' }} />
                        </div>
                      ) : m.type === 'video' ? (
                        <div className="msg-video" style={{ padding: '4px' }}>
                          <video src={m.content} controls style={{ maxWidth: '240px', borderRadius: '8px', display: 'block' }} />
                        </div>
                      ) : m.type === 'voice' ? (
                        <div className="msg-voice" style={{ maxWidth: '280px', width: '100%', boxSizing: 'border-box' }}>
                          <CustomAudioPlayer src={m.content} />
                        </div>
                      ) : m.type === 'file' ? (
                        <div className="msg-file" style={{ padding: '8px', maxWidth: '280px' }}>
                          <a href={m.content} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'inherit', textDecoration: 'none' }}>
                            <div style={{ background: 'rgba(0,0,0,0.1)', padding: '8px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <span style={{ fontSize: '1.2rem' }}>📄</span>
                            </div>
                            <span style={{ wordBreak: 'break-word', fontWeight: 500, fontSize: '0.85rem' }}>{m.filename || 'Attachment'}</span>
                          </a>
                        </div>
                      ) : (
                        <div className="msg-text">
                          {m.content}
                          {m.isEdited && <span className="edited-tag" style={{ fontSize: '0.65rem', marginLeft: '6px', opacity: 0.6 }}>(edited)</span>}
                        </div>
                      )}
                      
                      <div className="msg-footer">
                        <span className="msg-time">
                          {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {isMe && (
                          <span className="msg-status" style={{ display: 'inline-flex', alignItems: 'center' }}>
                            {m.status === 'SENT' ? (
                              <Check size={14} style={{ stroke: 'var(--text-tertiary)' }} />
                            ) : m.status === 'READ' ? (
                              <CheckCheck size={15} strokeWidth={2.5} style={{ stroke: '#4cb5f9', color: '#4cb5f9', filter: 'drop-shadow(0 0 1px rgba(76,181,249,0.5))' }} />
                            ) : (
                              <CheckCheck size={14} style={{ stroke: 'var(--text-secondary)' }} />
                            )}
                          </span>
                        )}
                      </div>
                      
                      {/* Reactions - inside bubble */}
                      {m.reactions && Object.keys(m.reactions).length > 0 && (
                        <div style={{ 
                          display: 'flex', gap: '3px', flexWrap: 'wrap',
                          marginTop: '2px', marginBottom: '-4px',
                          justifyContent: isMe ? 'flex-end' : 'flex-start',
                        }}>
                          {Object.entries(m.reactions).map(([emoji, users]) => (
                            <div 
                              key={emoji} 
                              onClick={(e) => { e.stopPropagation(); handleReactMessage(m.id, emoji); }} 
                              onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setReactionDetail({ messageId: m.id, reactions: m.reactions }); }}
                              title={users.map(uid => uid === user.id ? 'You' : (contacts.find(c => c.id === uid)?.name || uid)).join(', ')}
                              style={{ 
                                background: users.includes(user.id) ? 'rgba(255,123,66,0.2)' : 'rgba(0,0,0,0.15)', 
                                border: `1px solid ${users.includes(user.id) ? 'var(--accent)' : 'rgba(255,255,255,0.1)'}`, 
                                padding: '1px 5px', borderRadius: '10px', fontSize: '0.72rem', 
                                display: 'flex', alignItems: 'center', gap: '3px', 
                                cursor: 'pointer',
                                backdropFilter: 'blur(4px)',
                              }}
                            >
                              <span>{emoji}</span>
                              <span style={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.65rem' }}>{users.length}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    {/* Hover Actions (Reply & React) */}
                    <div className="msg-actions" style={{ display: 'flex', gap: '4px' }}>
                      <button className="msg-action-btn" onClick={() => handleReplyMessage(m)} title="Reply">
                        <Reply size={16} />
                      </button>
                      <button className="msg-action-btn" onClick={(e) => setContextMenu({ id: m.id, x: e.clientX, y: e.clientY, isMe })} title="React">
                        <SmilePlus size={16} />
                      </button>
                    </div>
                  </div>
              );
              })}
              {typingUsers[activeChat.id] && (
                <div className="typing-indicator" style={{ display: 'flex', gap: '4px', padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: '18px', width: 'fit-content', marginLeft: '12px', marginBottom: '8px', alignItems: 'center' }}>
                  <div className="typing-dot" style={{ width: '6px', height: '6px', background: 'var(--text-secondary)', borderRadius: '50%', animation: 'typing 1.4s infinite ease-in-out both' }}></div>
                  <div className="typing-dot" style={{ width: '6px', height: '6px', background: 'var(--text-secondary)', borderRadius: '50%', animation: 'typing 1.4s infinite ease-in-out both', animationDelay: '0.2s' }}></div>
                  <div className="typing-dot" style={{ width: '6px', height: '6px', background: 'var(--text-secondary)', borderRadius: '50%', animation: 'typing 1.4s infinite ease-in-out both', animationDelay: '0.4s' }}></div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
            {/* Chat Input */}
            <ChatInput 
              onSendMessage={sendMessage} 
              onTypingStart={() => socket.emit('typing_start', { receiverId: activeChat.id })}
              onTypingStop={() => socket.emit('typing_stop', { receiverId: activeChat.id })}
              onStartScreenShare={handleStartScreenShare} 
              token={token}
              editingMessage={editingMessage}
              replyingMessage={replyingMessage}
              onEditMessage={commitEditMessage}
              onCancelEdit={() => { setEditingMessage(null); }}
              onCancelReply={() => { setReplyingMessage(null); }}
            />
          </>
        ) : (
          <div className="empty-chat" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', position: 'relative' }}>
            <div style={{ position: 'relative', width: '120px', height: '120px', marginBottom: '24px' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, width: '90px', height: '90px', background: 'linear-gradient(135deg, #ffd18c, #ffaa33)', borderRadius: '50%', borderBottomLeftRadius: '10px' }}></div>
              <div style={{ position: 'absolute', bottom: 0, right: 0, width: '70px', height: '70px', background: 'linear-gradient(135deg, #ffe2b3, #ffcc80)', borderRadius: '50%', borderBottomRightRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', boxShadow: '-2px 2px 10px rgba(0,0,0,0.1)' }}>
                <div style={{ width: '6px', height: '6px', background: '#e58e00', borderRadius: '50%' }}></div>
                <div style={{ width: '6px', height: '6px', background: '#e58e00', borderRadius: '50%' }}></div>
                <div style={{ width: '6px', height: '6px', background: '#e58e00', borderRadius: '50%' }}></div>
              </div>
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>No conversation selected</h2>
            <p style={{ color: 'var(--text-tertiary)' }}>You can view your conversation in the side bar</p>
          </div>
        )}

        {/* Context Menu Overlay */}
        {contextMenu && (() => {
          const m = messages.find(msg => msg.id === contextMenu.id);
          const menuWidth = 260; // Exact width
          const menuHeight = contextMenu.isMe ? 340 : 240;
          
          // For sent messages (right side), anchor menu to the left of the cursor so it doesn't cover the bubble
          // For received messages (left side), anchor menu to the right of the cursor
          let desiredX = contextMenu.isMe ? contextMenu.x - menuWidth : contextMenu.x;
          
          const clampedX = Math.max(10, Math.min(desiredX, window.innerWidth - menuWidth - 10));
          const clampedY = Math.max(10, Math.min(contextMenu.y, window.innerHeight - menuHeight - 10));
          
          const statusLabel = m?.status === 'READ' ? 'Read' : m?.status === 'DELIVERED' ? 'Delivered' : 'Sent';
          const statusColor = m?.status === 'READ' ? '#4cb5f9' : m?.status === 'DELIVERED' ? 'var(--text-secondary)' : 'var(--text-tertiary)';
          
          return (
            <div className="context-menu-overlay" onClick={() => setContextMenu(null)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000 }}>
              <div className="context-menu" onClick={(e) => e.stopPropagation()} style={{ 
                position: 'absolute', top: clampedY, left: clampedX, 
                background: 'var(--surface-1)', 
                border: '1px solid var(--border-subtle)', 
                borderRadius: '12px', padding: '6px', 
                boxShadow: '0 8px 24px rgba(0,0,0,0.25)', 
                zIndex: 1001, minWidth: '240px', width: 'fit-content',
              }}>
                {m && (
                  <>
                    {/* Quick Reactions */}
                    <div style={{ display: 'flex', gap: '2px', padding: '4px 2px 8px', borderBottom: '1px solid var(--border-subtle)', justifyContent: 'center' }}>
                      {['👍', '❤️', '😂', '😮', '😢', '🙏'].map(emoji => (
                        <button key={emoji} onClick={() => { handleReactMessage(m.id, emoji); setContextMenu(null); setShowMoreEmojis(false); }} style={{ 
                          background: 'transparent', border: 'none', fontSize: '1.1rem', 
                          cursor: 'pointer', padding: '5px 6px', borderRadius: '8px', 
                          transition: 'transform 0.15s, background 0.15s',
                        }} 
                        onMouseOver={(e) => { e.currentTarget.style.transform = 'scale(1.2)'; e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
                        onMouseOut={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.background = 'transparent'; }}
                        >
                          {emoji}
                        </button>
                      ))}
                      <button onClick={() => setShowMoreEmojis(!showMoreEmojis)} style={{
                        background: 'transparent', border: 'none', color: 'var(--text-secondary)',
                        cursor: 'pointer', padding: '5px 6px', borderRadius: '8px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'transform 0.15s, background 0.15s'
                      }}
                      onMouseOver={(e) => { e.currentTarget.style.transform = 'scale(1.2)'; e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
                      onMouseOut={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.background = 'transparent'; }}
                      title="More emojis"
                      >
                        <Plus size={18} />
                      </button>
                    </div>

                    {showMoreEmojis && (
                      <div style={{ 
                        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px',
                        padding: '8px 4px', borderBottom: '1px solid var(--border-subtle)',
                        maxHeight: '180px', overflowY: 'auto',
                      }}>
                        {['😀','😁','😆','🤣','😊','😇','🙂','😉','😍','🥰','😘','😋','😜','🤪','🤨','🧐','🤓','😎','🥳','🤩','😏','😒','😞','😔','😟','😕','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤬','🤯','😳','🥵','🥶','😱','😨','😰','😥','😓','🤗','🤔','🤭','🤫','🤥','😶','😐','😑','😬','🙄','😯','😦','😧','😮','😲','🥱','😴','🤤','😪','😵','🤐','🥴','🤢','🤮','🤧','😷','🤒','🤕','🔥','💯','⭐','✨','💫','🎉','🎊','👏','🙌','👊','✊','🤝','💪','🫶','❤️‍🔥'].map(emoji => (
                          <button key={emoji} onClick={() => { handleReactMessage(m.id, emoji); setContextMenu(null); setShowMoreEmojis(false); }} style={{
                            background: 'transparent', border: 'none', fontSize: '1.1rem',
                            cursor: 'pointer', padding: '4px', borderRadius: '6px',
                            transition: 'background 0.1s',
                          }}
                          onMouseEnter={(e) => { e.target.style.background = 'var(--surface-2)'; }}
                          onMouseLeave={(e) => { e.target.style.background = 'transparent'; }}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
                <div style={{ padding: '2px 0' }}>
                  <button onClick={() => { handleReplyMessage(m); setContextMenu(null); }} style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '8px 12px', textAlign: 'left', background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', borderRadius: '6px', fontSize: '0.85rem' }} className="context-btn hover-bg">
                    <Reply size={15} /> Reply
                  </button>
                  {contextMenu.isMe && (
                    <>
                      <button onClick={() => { handleEditMessage(m); setContextMenu(null); }} style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '8px 12px', textAlign: 'left', background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', borderRadius: '6px', fontSize: '0.85rem' }} className="context-btn hover-bg">
                        ✏️ Edit
                      </button>
                      <button onClick={() => { handleDeleteMessage(contextMenu.id, 'everyone'); setContextMenu(null); }} style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '8px 12px', textAlign: 'left', background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', borderRadius: '6px', fontSize: '0.85rem' }} className="context-btn hover-bg">
                        🗑️ Delete for everyone
                      </button>
                    </>
                  )}
                  <button onClick={() => { handleDeleteMessage(contextMenu.id, 'me'); setContextMenu(null); }} style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '8px 12px', textAlign: 'left', background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', borderRadius: '6px', fontSize: '0.85rem' }} className="context-btn hover-bg">
                    🗑️ Delete for me
                  </button>
                </div>
                {/* Info footer */}
                <div style={{ padding: '6px 12px 4px', borderTop: '1px solid var(--border-subtle)', fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{new Date(m?.timestamp).toLocaleString([], { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}</span>
                    {contextMenu.isMe && (
                      <span style={{ color: statusColor, fontWeight: 600 }}>
                        {statusLabel} {m?.status === 'READ' ? '✓✓' : m?.status === 'DELIVERED' ? '✓✓' : '✓'}
                      </span>
                    )}
                    {!contextMenu.isMe && <span style={{ fontWeight: 500 }}>Received</span>}
                  </div>
                  {m?.isEdited && <div style={{ color: 'var(--accent)', marginTop: '2px' }}>• edited</div>}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Reaction Detail Modal */}
        {reactionDetail && (() => {
          const allReactions = reactionDetail.reactions;
          const getName = (uid) => uid === user.id ? 'You' : (contacts.find(c => c.id === uid)?.name || 'Unknown');
          
          return (
            <div onClick={() => setReactionDetail(null)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1500, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
              <div onClick={(e) => e.stopPropagation()} style={{
                background: 'var(--surface-1)', borderRadius: '16px 16px 0 0',
                width: '100%', maxWidth: '420px', maxHeight: '50vh',
                padding: '16px 0', boxShadow: '0 -8px 32px rgba(0,0,0,0.3)',
                animation: 'slideUp 0.25s ease-out',
              }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Reactions</h3>
                  <button onClick={() => setReactionDetail(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.2rem', padding: '4px' }}>✕</button>
                </div>

                {/* Emoji summary row */}
                <div style={{ display: 'flex', gap: '4px', padding: '12px 20px', borderBottom: '1px solid var(--border-subtle)', flexWrap: 'wrap' }}>
                  <div style={{
                    padding: '4px 12px', borderRadius: '16px', fontSize: '0.8rem', fontWeight: 600,
                    background: 'var(--accent-muted)', color: 'var(--accent)',
                  }}>
                    All {Object.values(allReactions).reduce((sum, arr) => sum + arr.length, 0)}
                  </div>
                  {Object.entries(allReactions).map(([emoji, users]) => (
                    <div key={emoji} style={{
                      padding: '4px 10px', borderRadius: '16px', fontSize: '0.8rem',
                      background: 'var(--surface-2)', color: 'var(--text-primary)',
                      display: 'flex', alignItems: 'center', gap: '4px',
                    }}>
                      <span>{emoji}</span>
                      <span style={{ fontWeight: 600 }}>{users.length}</span>
                    </div>
                  ))}
                </div>

                {/* User list */}
                <div style={{ overflowY: 'auto', maxHeight: '30vh', padding: '8px 0' }}>
                  {Object.entries(allReactions).map(([emoji, users]) => (
                    users.map(uid => (
                      <div key={`${emoji}-${uid}`} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 20px',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{
                            width: '36px', height: '36px', borderRadius: '50%',
                            background: 'var(--accent-muted)', color: 'var(--accent)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 700, fontSize: '0.85rem',
                          }}>
                            {getName(uid)[0]?.toUpperCase()}
                          </div>
                          <span style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                            {getName(uid)}
                          </span>
                        </div>
                        <span style={{ fontSize: '1.3rem' }}>{emoji}</span>
                      </div>
                    ))
                  ))}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Incoming Call Modal */}
        {incomingCall && (
          <div className="context-menu-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 2000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="incoming-call-modal" style={{ background: 'var(--surface-1)', padding: '24px', borderRadius: '12px', textAlign: 'center', boxShadow: '0 8px 32px rgba(0,0,0,0.4)', minWidth: '300px' }}>
              <PhoneCall size={48} className="icon-pulse" style={{ color: 'var(--success)', marginBottom: '16px' }} />
              <h3 style={{ marginBottom: '8px' }}>Incoming {incomingCall.type === 'video' ? 'Video' : 'Voice'} Call</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>{incomingCall.callerName || 'Someone'} is calling you...</p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button onClick={acceptCall} className="retro-btn" style={{ background: 'var(--success)', color: '#fff', border: 'none', flex: 1 }}>Accept</button>
                <button onClick={rejectCall} className="retro-btn" style={{ background: 'var(--danger)', color: '#fff', border: 'none', flex: 1 }}>Decline</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>

      {/* Profile Panel */}
      {showProfile && (
        <ProfilePanel 
          user={user} 
          token={token} 
          onClose={() => setShowProfile(false)} 
          onUpdateUser={(updated) => {
            const newUser = { ...user, ...updated };
            setUser(newUser);
            localStorage.setItem('user', JSON.stringify(newUser));
          }}
        />
      )}

      {/* Settings Panel */}
      {showSettings && (
        <SettingsPanel
          user={user}
          token={token}
          isDarkMode={isDarkMode}
          toggleTheme={toggleTheme}
          onClose={() => setShowSettings(false)}
          readReceipts={readReceipts}
          setReadReceipts={(val) => {
            setReadReceipts(val);
            localStorage.setItem('readReceipts', JSON.stringify(val));
          }}
          showDeletedMessages={showDeletedMessages}
          setShowDeletedMessages={(val) => {
            setShowDeletedMessages(val);
            localStorage.setItem('showDeletedMessages', JSON.stringify(val));
          }}
        />
      )}

      {/* Group Info Modal */}
      {showGroupInfo && activeChat?.isGroup && (
        <GroupInfoModal 
          group={activeChat}
          user={user}
          token={token}
          onClose={() => setShowGroupInfo(false)}
          onGroupUpdated={handleGroupUpdated}
          onGroupDeleted={handleGroupLeftOrDeleted}
          onGroupLeft={handleGroupLeftOrDeleted}
        />
      )}
    </div>
  );
}

export default App;
