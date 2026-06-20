import React, { useState } from 'react';
import { X, User, Mail, AtSign, Camera } from 'lucide-react';
import axios from 'axios';

export default function ProfilePanel({ user, token, onClose, onUpdateUser }) {
  const [name, setName] = useState(user?.name || '');
  const [username, setUsername] = useState(user?.username || '');
  const [avatar, setAvatar] = useState(user?.avatar || null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const fileInputRef = React.useRef(null);

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 1024 * 1024 * 2) {
        setMessage({ type: 'error', text: 'Image size must be less than 2MB' });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatar(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await axios.put('/api/users/profile', { name, username, avatar }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      onUpdateUser(res.data);
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to update profile' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="panel-overlay" onClick={onClose}>
      <div className="panel-modal" onClick={e => e.stopPropagation()}>
        <div className="panel-header">
          <h2>Profile</h2>
          <button className="panel-close-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="panel-body">
          {/* Avatar */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px' }}>
            <div 
              className="profile-panel-avatar" 
              style={{ position: 'relative', cursor: 'pointer', overflow: 'hidden' }}
              onClick={() => fileInputRef.current?.click()}
            >
              {avatar ? (
                <img src={avatar} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                user?.name ? user.name[0].toUpperCase() : 'U'
              )}
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.6)', padding: '4px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#fff' }}>
                <Camera size={16} />
              </div>
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              accept="image/*" 
              onChange={handleAvatarChange} 
            />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginTop: '8px' }}>Click to change photo (Max 2MB)</span>
          </div>

          {/* Name */}
          <div className="panel-field">
            <label className="panel-label"><User size={14} /> Display Name</label>
            <input 
              type="text" 
              className="panel-input" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              placeholder="Your name"
            />
          </div>

          {/* Username */}
          <div className="panel-field">
            <label className="panel-label"><AtSign size={14} /> Username</label>
            <input 
              type="text" 
              className="panel-input" 
              value={username} 
              onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9@]/g, ''))}
              placeholder="@username"
            />
          </div>

          {/* Email (read-only) */}
          <div className="panel-field">
            <label className="panel-label"><Mail size={14} /> Email</label>
            <input 
              type="text" 
              className="panel-input" 
              value={user?.email || ''} 
              disabled
              style={{ opacity: 0.6 }}
            />
          </div>

          {message && (
            <div className={`panel-message ${message.type}`}>
              {message.text}
            </div>
          )}

          <button className="panel-save-btn" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
