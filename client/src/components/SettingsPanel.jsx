import React, { useState } from 'react';
import { X, Sun, Moon, Bell, BellOff, Volume2, VolumeX, Monitor, Trash2, CheckCheck } from 'lucide-react';
import axios from 'axios';

export default function SettingsPanel({ onClose, isDarkMode, toggleTheme, token, onLogout, readReceipts, setReadReceipts, showDeletedMessages, setShowDeletedMessages }) {
  const [deleting, setDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    if (!window.confirm("Are you sure you want to permanently delete your account? This action cannot be undone and you will lose all your friends and messages.")) return;
    
    setDeleting(true);
    try {
      await axios.delete('/api/users/profile', {
        headers: { Authorization: `Bearer ${token}` }
      });
      onLogout();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete account');
      setDeleting(false);
    }
  };

  return (
    <div className="panel-overlay" onClick={onClose}>
      <div className="panel-modal" onClick={e => e.stopPropagation()}>
        <div className="panel-header">
          <h2>Settings</h2>
          <button className="panel-close-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="panel-body">
          {/* Appearance */}
          <div className="settings-section">
            <h3 className="settings-section-title">Appearance</h3>
            
            <div className="settings-row" onClick={toggleTheme}>
              <div className="settings-row-left">
                {isDarkMode ? <Moon size={18} /> : <Sun size={18} />}
                <div>
                  <span className="settings-row-label">Dark Mode</span>
                  <span className="settings-row-desc">Switch between light and dark theme</span>
                </div>
              </div>
              <div className={`settings-toggle ${isDarkMode ? 'active' : ''}`}>
                <div className="settings-toggle-knob"></div>
              </div>
            </div>
          </div>

          {/* Notifications & Privacy */}
          <div className="settings-section">
            <h3 className="settings-section-title">Notifications & Privacy</h3>
            
            <div className="settings-row" onClick={() => {
              if ('Notification' in window) {
                Notification.requestPermission();
              }
            }}>
              <div className="settings-row-left">
                <Bell size={18} />
                <div>
                  <span className="settings-row-label">Push Notifications</span>
                  <span className="settings-row-desc">Enable browser notifications for new messages</span>
                </div>
              </div>
              <div className={`settings-toggle ${Notification?.permission === 'granted' ? 'active' : ''}`}>
                <div className="settings-toggle-knob"></div>
              </div>
            </div>

            <div className="settings-row" onClick={() => setReadReceipts(!readReceipts)}>
              <div className="settings-row-left">
                <CheckCheck size={18} />
                <div>
                  <span className="settings-row-label">Read Receipts</span>
                  <span className="settings-row-desc">Let others know when you've read their messages</span>
                </div>
              </div>
              <div className={`settings-toggle ${readReceipts ? 'active' : ''}`}>
                <div className="settings-toggle-knob"></div>
              </div>
            </div>

            <div className="settings-row" onClick={() => setShowDeletedMessages(!showDeletedMessages)}>
              <div className="settings-row-left">
                <Trash2 size={18} />
                <div>
                  <span className="settings-row-label">Show Deleted Messages</span>
                  <span className="settings-row-desc">Display placeholders for messages that were removed</span>
                </div>
              </div>
              <div className={`settings-toggle ${showDeletedMessages ? 'active' : ''}`}>
                <div className="settings-toggle-knob"></div>
              </div>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="settings-section">
            <h3 className="settings-section-title" style={{ color: 'var(--danger)' }}>Danger Zone</h3>
            
            <button 
              className="profile-dropdown-item profile-dropdown-danger" 
              onClick={handleDeleteAccount} 
              disabled={deleting}
              style={{ background: 'rgba(234, 84, 85, 0.08)', borderRadius: 'var(--r-sm)', padding: '12px 16px', marginTop: '8px' }}
            >
              <Trash2 size={18} /> {deleting ? 'Deleting...' : 'Permanently Delete Account'}
            </button>
          </div>

          {/* About */}
          <div className="settings-section">
            <h3 className="settings-section-title">About</h3>
            <div className="settings-about">
              <div className="settings-about-logo">S</div>
              <div>
                <span className="settings-row-label">Sunday Chat</span>
                <span className="settings-row-desc">Version 1.0.0</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
