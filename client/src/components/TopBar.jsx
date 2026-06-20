import React, { useState, useRef, useEffect } from 'react';
import { Search, Bell, MessageSquare, Sun, Moon, LogOut, User, Settings } from 'lucide-react';

export default function TopBar({ user, isDarkMode, toggleTheme, searchQuery, setSearchQuery, onLogout, setActiveTab, onOpenProfile, onOpenSettings, friendsData = [], contacts = [], incomingCall, acceptCall, rejectCall }) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
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

  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const today = days[new Date().getDay()];

  return (
    <div className="top-bar">
      <div className="top-bar-left">
        <div className="logo-box">{today[0]}</div>
        <span className="logo-text">{today}</span>
      </div>

      <div className="top-bar-center">
        <div className="top-search-box">
          <Search size={16} className="top-search-icon" />
          <input 
            type="text" 
            placeholder="Search..." 
            className="top-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="top-bar-right">
        <div className="profile-wrapper" ref={notificationRef}>
          <button className="top-action-btn" onClick={() => setShowNotifications(!showNotifications)} title="Notifications" style={{ position: 'relative' }}>
            <Bell size={18} />
            {notificationCount > 0 && <span className="notification-badge">{notificationCount}</span>}
          </button>
          
          {showNotifications && (
            <div className="profile-dropdown" style={{ width: '280px', right: 0 }}>
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
        <button className="top-action-btn" onClick={() => setActiveTab('chats')} title="Chats">
          <MessageSquare size={18} />
        </button>
        <button className="top-action-btn" onClick={toggleTheme} title="Toggle Theme">
          {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* Profile Avatar + Dropdown */}
        <div className="profile-wrapper" ref={dropdownRef}>
          <div className="top-user-avatar" onClick={() => setShowDropdown(!showDropdown)}>
            {user?.avatar ? <img src={user.avatar} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'var(--r-full)' }} /> : (user?.name ? user.name[0].toUpperCase() : 'U')}
          </div>

          {showDropdown && (
            <div className="profile-dropdown">
              <div className="profile-dropdown-header">
                <div className="profile-dropdown-avatar">
                  {user?.avatar ? <img src={user.avatar} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'var(--r-full)' }} /> : (user?.name ? user.name[0].toUpperCase() : 'U')}
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
    </div>
  );
}
