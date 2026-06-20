import React, { useState, useEffect } from 'react';
import { Search, Users, Settings, LogOut, Sun, Moon, UserPlus, UserX, UserCheck, ShieldAlert, Sparkles } from 'lucide-react';
import axios from 'axios';

export default function Sidebar({ user, activeChat, onSelectChat, token, socket, searchQuery, messages = [], activeTab, setActiveTab, contacts, setContacts, friendsData, setFriendsData, blocksData, setBlocksData, fetchFriends, fetchBlocks }) {

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

  const getInitials = (name) => name ? name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() : '??';

  const blockedUserIds = blocksData.map(b => b.blockedId);
  
  // Get IDs of accepted friends
  const acceptedFriendIds = friendsData
    .filter(f => f.status === 'accepted')
    .map(f => f.senderId === user.id ? f.receiverId : f.senderId);

  // Filter all users (for network tab)
  const filteredContacts = contacts.filter(c => {
    const matchName = c.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchUser = c.username && c.username.toLowerCase().includes(searchQuery.toLowerCase());
    return (matchName || matchUser) && !blockedUserIds.includes(c.id);
  });

  // Filter for active chats (only accepted friends)
  const chatContacts = filteredContacts.filter(c => acceptedFriendIds.includes(c.id));

  return (
    <div className="sidebar">
      <div style={{ padding: '24px 24px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Messages</h2>
        <Search size={20} style={{ color: 'var(--text-tertiary)' }} />
      </div>

      {/* Tabs */}
      <div className="sunday-tabs" style={{ display: 'flex', gap: '16px', padding: '0 24px', borderBottom: '1px solid var(--border-subtle)', marginBottom: '16px' }}>
        <button className={`sunday-tab ${activeTab === 'chats' ? 'active' : ''}`} onClick={() => setActiveTab('chats')}>All messages</button>
        <button className={`sunday-tab ${activeTab === 'network' ? 'active' : ''}`} onClick={() => setActiveTab('network')}>Network</button>
        <button className={`sunday-tab ${activeTab === 'blocked' ? 'active' : ''}`} onClick={() => setActiveTab('blocked')}>Blocked</button>
      </div>

      <div className="contact-list" style={{ padding: '0 12px' }}>
        {activeTab === 'chats' && chatContacts.length === 0 && (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>
            No active chats. Head to the Network tab to find people!
          </div>
        )}
        {activeTab === 'chats' && chatContacts.map(contact => {
          // Find the latest message for this contact
          const contactMsgs = messages.filter(m => 
            (m.senderId === user.id && m.receiverId === contact.id) || 
            (m.senderId === contact.id && m.receiverId === user.id)
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
            <div key={contact.id} className={`contact-item ${activeChat?.id === contact.id ? 'active' : ''}`} onClick={() => onSelectChat(contact)}>
              <div className="contact-avatar-wrapper">
                {contact.avatar ? (
                  <img src={contact.avatar} alt="avatar" className="avatar" style={{ objectFit: 'cover' }} />
                ) : (
                  <div className="avatar">{getInitials(contact.name)}</div>
                )}
                {contact.isOnline && <div className="online-badge"></div>}
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
            
            <h4 style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', margin: '20px 0 10px 0' }}>All Users</h4>
            {filteredContacts.map(contact => (
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
      </div>
    </div>
  );
}
