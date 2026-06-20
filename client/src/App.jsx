import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useLiveQuery } from 'dexie-react-hooks';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Clock, Check, CheckCheck, MessageSquareDashed, Phone, Video, PhoneCall, X, PhoneOff, MonitorUp, Mic, MicOff, VideoOff, MessageSquare } from 'lucide-react';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import ChatInput from './components/ChatInput';
import ProfilePanel from './components/ProfilePanel';
import SettingsPanel from './components/SettingsPanel';
import SyncEngine from './services/SyncEngine';
import WebRTCManager from './services/WebRTCManager';
import { db } from './db/db';
import axios from 'axios';

let socket;
let syncEngine;
let rtcManager;

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')) || null);
  const [activeChat, setActiveChat] = useState(null);
  const [contextMenu, setContextMenu] = useState(null); // { id, x, y, isMe }
  const [searchQuery, setSearchQuery] = useState('');
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
  
  // Offline-first: Subscribe to Dexie DB
  const [isConnected, setIsConnected] = useState(false);
  const [remoteStream, setRemoteStream] = useState(null);
  const [localStream, setLocalStream] = useState(null);
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

  useEffect(() => {
    if (token) {
      fetchUsers();
      fetchFriends();
      fetchBlocks();
    }
  }, [token, activeTab, fetchUsers, fetchFriends, fetchBlocks]);

  const messagesEndRef = useRef(null);
  const listRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  
  const messages = useLiveQuery(() => {
    if (!user?.id) return [];
    return db.messages.where('ownerId').equals(user.id).sortBy('timestamp');
  }, [user?.id]) || [];

  // Auto scroll to bottom on new messages
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, scrollToBottom]);

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
      
      // Emit delivery receipt
      socket.emit('message_delivered', { id: msg.id });
      
      if (document.hidden) {
        if (Notification.permission === 'granted') {
          new Notification(`New message from ${msg.senderName}`, {
            body: msg.content?.substring(0, 50) + '...',
            icon: '/vite.svg'
          });
        }
      } else {
        // Chat is open, emit read receipt immediately if enabled
        if (readReceipts) {
          socket.emit('message_read', { id: msg.id });
        }
      }
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('receive_message', onReceiveMessage);
    
    const onUserStatus = (data) => {
      setContacts(prev => prev.map(c => c.id === data.userId ? { ...c, isOnline: data.isOnline, lastSeen: data.lastSeen } : c));
    };
    socket.on('user_status', onUserStatus);

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('receive_message', onReceiveMessage);
      socket.off('user_status', onUserStatus);
      socket.off('disconnect', onDisconnect);
      socket.off('receive_message', onReceiveMessage);
      socket.disconnect();
    };
  }, [token]);

  const handleLogin = (jwt, userData) => {
    localStorage.setItem('token', jwt);
    localStorage.setItem('user', JSON.stringify(userData));
    setToken(jwt);
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    if (socket) socket.disconnect();
  };

  const sendMessage = async (payload) => {
    if (syncEngine) {
      const msg = {
        id: crypto.randomUUID(),
        type: payload.type || 'text',
        content: payload.content,
        senderId: user.id,
        senderName: user.name,
        receiverId: activeChat.id,
        ownerId: user.id,
        timestamp: new Date().toISOString()
      };
      await syncEngine.enqueueMessage(msg);
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
      console.error(err);
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

  const handleEditMessage = async (msgId, oldContent) => {
    setContextMenu(null);
    const newContent = prompt('Edit your message:', oldContent);
    if (newContent && newContent.trim() !== oldContent) {
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
      {/* Top Navigation Bar */}
      <TopBar 
        user={user} 
        isDarkMode={isDarkMode} 
        toggleTheme={toggleTheme} 
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onLogout={handleLogout} 
        setActiveTab={setActiveTab}
        onOpenProfile={() => setShowProfile(true)}
        onOpenSettings={() => setShowSettings(true)}
        friendsData={friendsData}
        contacts={contacts}
        incomingCall={incomingCall}
        acceptCall={acceptCall}
        rejectCall={rejectCall}
      />

      {/* Main Content Area */}
      <div className="main-content">
        {/* Sidebar */}
        <Sidebar 
          user={user} 
          activeChat={activeChat} 
          onSelectChat={(chat) => { setActiveChat(chat); if(window.innerWidth < 768) setShowSidebar(false); }} 
          token={token} 
          socket={socket} 
          searchQuery={searchQuery}
          messages={messages}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          contacts={contacts}
          setContacts={setContacts}
          friendsData={friendsData}
          setFriendsData={setFriendsData}
          blocksData={blocksData}
          setBlocksData={setBlocksData}
          fetchFriends={fetchFriends}
          fetchBlocks={fetchBlocks}
        />

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
                              <span className="msg-status">
                                {m.status === 'SENT' ? <Check size={14} /> : m.status === 'READ' ? <CheckCheck size={14} color="#4cb5f9" /> : <CheckCheck size={14} />}
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
              <div className="chat-header-left">
                {activeChat.avatar ? (
                  <img src={activeChat.avatar} alt="avatar" className="avatar" style={{ objectFit: 'cover' }} />
                ) : (
                  <div className="avatar">{activeChat.name ? activeChat.name[0].toUpperCase() : '?'}</div>
                )}
                <div className="chat-header-info">
                  <h2 className="chat-contact-name">{activeChat.name}</h2>
                  <span className="chat-contact-status">
                    {activeChat.isOnline ? (
                      <><span className="status-dot-inline online"></span> online</>
                    ) : (
                      <><span className="status-dot-inline offline"></span> offline</>
                    )}
                  </span>
                </div>
              </div>
              <div className="chat-header-right" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <button onClick={() => initiateCall('video')} className="action-btn" title="Video Call"><Video size={20} /></button>
                <button onClick={() => initiateCall('audio')} className="action-btn" title="Voice Call"><Phone size={20} /></button>
              </div>
            </div>

            {/* Standard Messages View */}
            <div ref={listRef} className="chat-messages">
              {messages.filter(m => (m.senderId === user.id && m.receiverId === activeChat.id) || (m.senderId === activeChat.id && m.receiverId === user.id)).length === 0 && (
                <div className="empty-chat">
                  <MessageSquareDashed size={48} />
                  <p>No messages yet. Say hello!</p>
                </div>
              )}
              {messages.filter(m => {
                const isActiveChat = (m.senderId === user.id && m.receiverId === activeChat.id) || (m.senderId === activeChat.id && m.receiverId === user.id);
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
                          <span className="msg-status">
                            {m.status === 'SENT' ? <Check size={14} /> : m.status === 'READ' ? <CheckCheck size={14} color="#4cb5f9" /> : <CheckCheck size={14} />}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
            {/* Chat Input */}
            <ChatInput onSendMessage={sendMessage} onStartScreenShare={handleStartScreenShare} />
          </>
        ) : (
          <div className="empty-chat" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
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
        {contextMenu && (
          <div className="context-menu-overlay" onClick={() => setContextMenu(null)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000 }}>
            <div className="context-menu" style={{ position: 'absolute', top: contextMenu.y, left: contextMenu.x, background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', zIndex: 1001, minWidth: '150px' }}>
              {contextMenu.isMe && (
                <>
                  <button onClick={(e) => { e.stopPropagation(); handleEditMessage(contextMenu.id, messages.find(m => m.id === contextMenu.id)?.content); }} style={{ display: 'block', width: '100%', padding: '8px 12px', textAlign: 'left', background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', borderRadius: '4px' }}>Edit</button>
                  <button onClick={(e) => { e.stopPropagation(); handleDeleteMessage(contextMenu.id, 'everyone'); }} style={{ display: 'block', width: '100%', padding: '8px 12px', textAlign: 'left', background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', borderRadius: '4px' }}>Delete for everyone</button>
                </>
              )}
              <button onClick={(e) => { e.stopPropagation(); handleDeleteMessage(contextMenu.id, 'me'); }} style={{ display: 'block', width: '100%', padding: '8px 12px', textAlign: 'left', background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', borderRadius: '4px' }}>Delete for me</button>
            </div>
          </div>
        )}

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
          onClose={() => setShowSettings(false)} 
          isDarkMode={isDarkMode} 
          toggleTheme={toggleTheme} 
          token={token}
          onLogout={handleLogout}
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
    </div>
  );
}

export default App;
