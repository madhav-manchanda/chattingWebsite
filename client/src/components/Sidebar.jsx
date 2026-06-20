import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Users, Settings, LogOut, Sun, Moon, UserPlus, UserX, UserCheck, ShieldAlert, Sparkles, Bell, X, User, Trash2 } from 'lucide-react';
import axios from 'axios';
import { getAssetUrl } from '../utils/assets';

export default function Sidebar({ 
  user, activeChat, onSelectChat, token, socket, searchQuery, setSearchQuery, 
  messages = [], activeTab, setActiveTab, contacts, setContacts, 
  friendsData, setFriendsData, blocksData, setBlocksData, groupsData = [], fetchFriends, fetchBlocks, fetchGroups,
  isDarkMode, toggleTheme, onLogout, onOpenProfile, onOpenSettings, 
  incomingCall, acceptCall, rejectCall, hiddenChats = [], onHideChat
}) {
  const [isSearching, setIsSearching] = useState(false);
  const [openChatMenu, setOpenChatMenu] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [selectedFriends, setSelectedFriends] = useState([]);
  const dropdownRef = useRef(null);
  const notificationRef = useRef(null);

  const pendingRequests = friendsData.filter(f => f.status === 'pending' && f.receiverId === user?.id);
  const notificationCount = pendingRequests.length + (incomingCall ? 1 : 0);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(e.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const sendFriendRequest = async (receiverId) => {
    try {
      await axios.post('/api/friends/request', { receiverId }, { headers: { Authorization: `Bearer ${token}` } });
      fetchFriends();
    } catch (err) { alert(err.response?.data?.error || 'Failed'); }
  };

  const respondToRequest = async (id, action) => {
    try {
      await axios.post(`/api/friends/${action}`, { id }, { headers: { Authorization: `Bearer ${token}` } });
      fetchFriends();
    } catch (err) { alert(err.response?.data?.error || 'Failed'); }
  };

  const blockUser = async (blockedId) => {
    try {
      await axios.post('/api/blocks/block', { blockedId }, { headers: { Authorization: `Bearer ${token}` } });
      fetchBlocks();
    } catch (err) { alert(err.response?.data?.error || 'Failed'); }
  };

  const unblockUser = async (blockedId) => {
    try {
      await axios.post('/api/blocks/unblock', { blockedId }, { headers: { Authorization: `Bearer ${token}` } });
      fetchBlocks();
    } catch (err) { alert(err.response?.data?.error || 'Failed'); }
  };

  const createGroup = async () => {
    if (!groupName.trim()) return alert("Group name is required");
    try {
      await axios.post('/api/groups', {
        name: groupName,
        description: groupDescription,
        memberIds: selectedFriends
      }, { headers: { Authorization: `Bearer ${token}` } });
      setShowCreateGroup(false);
      setGroupName('');
      setGroupDescription('');
      setSelectedFriends([]);
      fetchGroups();
    } catch (err) { alert(err.response?.data?.error || 'Failed'); }
  };

  // Get list of friends (accepted relationships)
  const myFriends = useMemo(() => {
    return friendsData
      .filter(f => f.status === 'accepted')
      .map(f => f.senderId === user?.id ? f.Receiver : f.Sender)
      .filter(Boolean)
      .filter((v, i, a) => a.findIndex(t => (t.id === v.id)) === i);
  }, [friendsData, user?.id]);

  const allBlockedIds = useMemo(() => {
    const blockedUserIds = blocksData.filter(b => b.blockerId === user?.id).map(b => b.blockedId);
    const blockedByIds = blocksData.filter(b => b.blockedId === user?.id).map(b => b.blockerId);
    return [...blockedUserIds, ...blockedByIds];
  }, [blocksData, user?.id]);

  const getInitials = (name) => name ? name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() : '??';

  // Base filter for search query
  const isSearchEmpty = !searchQuery || searchQuery.trim() === '';
  const baseFilteredContacts = useMemo(() => {
    return contacts.filter(c => {
      const matchName = c.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchUser = c.username && c.username.toLowerCase().includes(searchQuery.toLowerCase());
      return (matchName || matchUser) && !allBlockedIds.includes(c.id);
    });
  }, [contacts, searchQuery, allBlockedIds]);

  // For Network tab: only show results if user searched for something
  const networkContacts = isSearchEmpty ? [] : baseFilteredContacts;

  // Filter for active chats (only accepted friends)
  const chatContacts = useMemo(() => {
    return baseFilteredContacts.filter(c => myFriends.find(f => f.id === c.id));
  }, [baseFilteredContacts, myFriends]);

  return (
    <div className="sidebar" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {isSearching ? (
        <div className="sidebar-search-header" style={{ padding: '24px 24px 16px', display: 'flex', alignItems: 'center', gap: '12px', animation: 'fadeIn 0.2s ease-out' }}>
          <div className="top-search-box" style={{ flex: 1, margin: 0, background: 'var(--bg-input-bar)' }}>
            <Search size={16} className="top-search-icon" />
            <input 
              type="text" 
              placeholder="Search..." 
              className="top-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
          </div>
          <button className="top-action-btn" onClick={() => { setIsSearching(false); setSearchQuery(''); }}>
            <X size={20} />
          </button>
        </div>
      ) : (
        <div style={{ padding: '24px 24px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, margin: 0 }}>{activeTab === 'chats' ? 'Messages' : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</h2>
          <button className="top-action-btn" onClick={() => setIsSearching(true)}><Search size={20} /></button>
        </div>
      )}

      {/* Tabs */}
      <div className="sunday-tabs" style={{ display: 'flex', gap: '16px', padding: '0 24px', borderBottom: '1px solid var(--border-subtle)', marginBottom: '16px' }}>
        <button className={`sunday-tab ${activeTab === 'chats' ? 'active' : ''}`} onClick={() => setActiveTab('chats')}>All messages</button>
        <button className={`sunday-tab ${activeTab === 'network' ? 'active' : ''}`} onClick={() => setActiveTab('network')}>Network</button>
        <button className={`sunday-tab ${activeTab === 'blocked' ? 'active' : ''}`} onClick={() => setActiveTab('blocked')}>Blocked</button>
      </div>

      <div className="contact-list" style={{ padding: '0 12px', flex: 1, overflowY: 'auto' }}>
        {activeTab === 'chats' && [...groupsData, ...myFriends].filter(item => {
          if (hiddenChats.includes(item.id)) return false;
          if (isSearchEmpty) return true;
          return item.name?.toLowerCase().includes(searchQuery.toLowerCase()) || item.username?.toLowerCase().includes(searchQuery.toLowerCase());
        }).map((contact) => {
          const contactMsgs = messages.filter(m => 
            contact.isGroup ? m.receiverId === contact.id :
            ((m.senderId === user.id && m.receiverId === contact.id) || (m.senderId === contact.id && m.receiverId === user.id))
          );
          const lastMsg = contactMsgs.length > 0 ? contactMsgs[contactMsgs.length - 1] : null;
          
          let lastMsgText = "Tap to chat";
          if (lastMsg) {
            if (lastMsg.isDeleted) lastMsgText = "🚫 Message deleted";
            else if (lastMsg.type === 'sticker' || lastMsg.type === 'custom_sticker') lastMsgText = "🖼️ Sticker";
            else if (lastMsg.content) lastMsgText = lastMsg.content.substring(0, 30) + (lastMsg.content.length > 30 ? '...' : '');
            else lastMsgText = 'New message';
          }

          return (
            <div 
              key={contact.id} 
              className={`contact-item ${activeChat?.id === contact.id ? 'active' : ''}`} 
              onClick={() => { onSelectChat(contact); setOpenChatMenu(null); }}
              onContextMenu={(e) => { e.preventDefault(); setOpenChatMenu(contact.id); }}
              style={{ position: 'relative' }}
            >
              <div className="contact-avatar-wrapper">
                {contact.avatar ? (
                  <img src={getAssetUrl(contact.avatar)} alt="avatar" className="avatar" style={{ objectFit: 'cover' }} />
                ) : (
                  <div className="avatar">
                    {contact.isGroup ? <Users size={16} color="#fff" /> : getInitials(contact.name)}
                  </div>
                )}
                {!contact.isGroup && contact.isOnline && <div className="online-badge"></div>}
              </div>
              <div className="contact-info">
                <div className="contact-top">
                  <span className="contact-name">{contact.name}</span>
                  <span className="contact-time">{contact.isOnline ? 'online' : (lastMsg ? new Date(lastMsg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '')}</span>
                </div>
                <div className="contact-bottom" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="contact-last-msg">{lastMsgText}</span>
                  {contact.username && <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>{contact.username}</span>}
                </div>
              </div>
              
              {openChatMenu === contact.id && (
                <div onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', right: '20px', top: '50%', transform: 'translateY(-50%)', background: 'var(--surface-1)', border: '1px solid var(--border-medium)', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', zIndex: 10, minWidth: '150px', overflow: 'hidden' }}>
                  <button onClick={(e) => { e.stopPropagation(); onHideChat(contact.id); setOpenChatMenu(null); }} style={{ width: '100%', padding: '10px 16px', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                    <Trash2 size={16} /> Hide / Clear Chat
                  </button>
                  {!contact.isGroup && (
                    <button onClick={(e) => { e.stopPropagation(); blockUser(contact.id); setOpenChatMenu(null); }} style={{ width: '100%', padding: '10px 16px', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--danger)' }}>
                      <ShieldAlert size={16} /> Block User
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {activeTab === 'network' && (
          <div style={{ padding: '14px' }}>
            <h4 style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '10px' }}>Pending Requests</h4>
            {friendsData.filter(f => f.status === 'pending' && f.receiverId === user.id).map(req => (
              <div key={req.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface-1)', padding: '8px', borderRadius: '4px', marginBottom: '8px' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.85rem' }}>{req.Sender.name}</span>
                  {req.Sender.username && <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>{req.Sender.username}</span>}
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button onClick={() => respondToRequest(req.id, 'accept')} style={{ background: 'var(--success)', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}><UserCheck size={14} /></button>
                  <button onClick={() => respondToRequest(req.id, 'reject')} style={{ background: 'var(--danger)', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}><UserX size={14} /></button>
                </div>
              </div>
            ))}
            
            {!isSearchEmpty && (
              <>
                <h4 style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', margin: '20px 0 10px 0' }}>Search Results</h4>
                {networkContacts.length === 0 && <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No users found.</p>}
                {networkContacts.map(contact => (
                  <div key={contact.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '0.85rem' }}>{contact.name}</span>
                      {contact.username && <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>{contact.username}</span>}
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button onClick={() => sendFriendRequest(contact.id)} title="Add Friend" style={{ background: 'var(--accent)', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}><UserPlus size={14} /></button>
                      <button onClick={() => blockUser(contact.id)} title="Block" style={{ background: 'var(--surface-3)', color: 'var(--danger)', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}><ShieldAlert size={14} /></button>
                    </div>
                  </div>
                ))}
              </>
            )}
            {isSearchEmpty && (
              <div style={{ textAlign: 'center', marginTop: '30px', color: 'var(--text-tertiary)' }}>
                <Search size={32} style={{ opacity: 0.3, marginBottom: '10px' }} />
                <p style={{ fontSize: '0.9rem' }}>Search for a user by name or @username to add them to your network.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'blocked' && (
          <div style={{ padding: '14px' }}>
            <h4 style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '10px' }}>Blocked Users</h4>
            {blocksData.length === 0 && <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No blocked users.</p>}
            {blocksData.map(b => (
              <div key={b.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '0.85rem' }}>{b.Blocked.name}</span>
                <button onClick={() => unblockUser(b.blockedId)} style={{ background: 'var(--surface-3)', color: 'var(--text-primary)', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}>Unblock</button>
              </div>
            ))}
          </div>
        )}
      </div> {/* End contact-list */}

      {/* Sidebar Footer */}
      <div className="sidebar-footer" style={{ borderTop: '1px solid var(--border-subtle)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-sidebar)' }}>
        <div className="profile-wrapper" ref={notificationRef}>
          <button className="top-action-btn" onClick={() => setShowNotifications(!showNotifications)} title="Notifications" style={{ position: 'relative' }}>
            <Bell size={20} />
            {notificationCount > 0 && <span className="notification-badge">{notificationCount}</span>}
          </button>
          
          {showNotifications && (
            <div className="profile-dropdown" style={{ width: '280px', left: 0, right: 'auto', top: 'auto', bottom: 'calc(100% + 12px)', transformOrigin: 'bottom left' }}>
              <div className="profile-dropdown-header">
                <span style={{ fontWeight: 600 }}>Notifications</span>
              </div>
              <div className="profile-dropdown-divider"></div>
              {notificationCount === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-tertiary)' }}>No new notifications</div>
              ) : (
                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  {incomingCall && (
                    <div className="notification-item" style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px', borderBottom: '1px solid var(--border-subtle)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 8px var(--success)' }}></div>
                        <span style={{ fontWeight: 500 }}>Incoming {incomingCall.type} call</span>
                      </div>
                      <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                        From {incomingCall.callerName || 'Someone'}
                      </div>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                        <button onClick={() => { acceptCall(); setShowNotifications(false); }} style={{ flex: 1, padding: '6px 0', background: 'var(--success)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 500 }}>Accept</button>
                        <button onClick={() => { rejectCall(); setShowNotifications(false); }} style={{ flex: 1, padding: '6px 0', background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 500 }}>Decline</button>
                      </div>
                    </div>
                  )}
                  {pendingRequests.map(req => {
                    const sender = contacts?.find(c => c.id === req.senderId);
                    return (
                      <div key={req.id} className="notification-item" style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px', borderBottom: '1px solid var(--border-subtle)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <User size={14} style={{ color: 'var(--primary)' }} />
                          <span style={{ fontWeight: 500 }}>Friend Request</span>
                        </div>
                        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                          From <strong style={{color: 'var(--text-primary)'}}>{sender?.name || 'Someone'}</strong>
                        </div>
                        <button onClick={() => { setActiveTab('network'); setShowNotifications(false); }} style={{ width: '100%', padding: '6px 0', background: 'var(--surface-3)', color: 'var(--text-primary)', border: '1px solid var(--border-strong)', borderRadius: '4px', cursor: 'pointer', marginTop: '4px', fontWeight: 500 }}>
                          View Request
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <button className="top-action-btn" onClick={toggleTheme} title="Toggle Theme">
          {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        <button className="top-action-btn" onClick={() => setShowCreateGroup(true)} title="Create Group">
          <Users size={20} />
        </button>

        {/* Profile Avatar + Dropdown */}
        <div className="profile-wrapper" ref={dropdownRef}>
          <div className="top-user-avatar" onClick={() => setShowDropdown(!showDropdown)} style={{ cursor: 'pointer' }}>
            {user?.avatar ? <img src={getAssetUrl(user.avatar)} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'var(--r-full)' }} /> : (user?.name ? user.name[0].toUpperCase() : 'U')}
          </div>

          {showDropdown && (
            <div className="profile-dropdown" style={{ width: '220px', left: 'auto', right: 0, top: 'auto', bottom: 'calc(100% + 12px)', transformOrigin: 'bottom right' }}>
              <div className="profile-dropdown-header">
                <div className="profile-dropdown-avatar">
                  {user?.avatar ? <img src={getAssetUrl(user.avatar)} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'var(--r-full)' }} /> : (user?.name ? user.name[0].toUpperCase() : 'U')}
                </div>
                <div className="profile-dropdown-info">
                  <span className="profile-dropdown-name">{user?.name || 'User'}</span>
                  <span className="profile-dropdown-email">{user?.email || ''}</span>
                  {user?.username && <span className="profile-dropdown-username">{user.username}</span>}
                </div>
              </div>
              <div className="profile-dropdown-divider"></div>
              <button className="profile-dropdown-item" onClick={() => { setShowDropdown(false); onOpenProfile(); }}>
                <User size={16} /> Profile
              </button>
              <button className="profile-dropdown-item" onClick={() => { setShowDropdown(false); onOpenSettings(); }}>
                <Settings size={16} /> Settings
              </button>
              <div className="profile-dropdown-divider"></div>
              <button className="profile-dropdown-item profile-dropdown-danger" onClick={() => { setShowDropdown(false); onLogout(); }}>
                <LogOut size={16} /> Logout
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* Create Group Modal */}
      {showCreateGroup && (
        <div className="context-menu-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 2000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--surface-1)', padding: '24px', borderRadius: '12px', width: '400px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0 }}>Create Group</h2>
              <button onClick={() => setShowCreateGroup(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}><X size={20} /></button>
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Group Name</label>
              <input type="text" value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="Enter group name" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-medium)', background: 'var(--surface-white)', color: 'var(--text-primary)' }} />
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Description (Optional)</label>
              <input type="text" value={groupDescription} onChange={e => setGroupDescription(e.target.value)} placeholder="What is this group about?" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-medium)', background: 'var(--surface-white)', color: 'var(--text-primary)' }} />
            </div>
            
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Select Members</label>
              <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '8px', background: 'var(--bg-app)' }}>
                {myFriends.length === 0 ? (
                  <div style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem', textAlign: 'center', padding: '10px 0' }}>No friends available to add</div>
                ) : myFriends.map(f => (
                  <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px', cursor: 'pointer' }} onClick={() => {
                    setSelectedFriends(prev => prev.includes(f.id) ? prev.filter(id => id !== f.id) : [...prev, f.id]);
                  }}>
                    <input type="checkbox" checked={selectedFriends.includes(f.id)} readOnly style={{ cursor: 'pointer' }} />
                    <span style={{ fontSize: '0.9rem' }}>{f.name}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <button onClick={createGroup} className="login-btn" style={{ width: '100%' }}>Create Group</button>
          </div>
        </div>
      )}
    </div>
  );
}
