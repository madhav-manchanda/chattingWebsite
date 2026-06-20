import React, { useState } from 'react';
import { X, Users, Shield, Trash2, LogOut, UserMinus, ChevronDown, Check, ShieldAlert } from 'lucide-react';
import axios from 'axios';
import { getAssetUrl } from '../utils/assets';

export default function GroupInfoModal({
  group,
  user,
  token,
  onClose,
  onGroupDeleted,
  onGroupLeft,
  onGroupUpdated
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(group.name || '');
  const [description, setDescription] = useState(group.description || '');
  const [openMemberMenu, setOpenMemberMenu] = useState(null);

  const isAdmin = group.adminId === user.id;

  const handleUpdate = async () => {
    try {
      const res = await axios.put(`/api/groups/${group.id}`, { name, description }, { headers: { Authorization: `Bearer ${token}` } });
      onGroupUpdated(res.data);
      setEditing(false);
    } catch (err) { alert('Failed to update group'); }
  };

  const handleLeave = async () => {
    if (!window.confirm('Are you sure you want to leave this group?')) return;
    try {
      await axios.post(`/api/groups/${group.id}/leave`, {}, { headers: { Authorization: `Bearer ${token}` } });
      onGroupLeft(group.id);
      onClose();
    } catch (err) { alert('Failed to leave group'); }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to completely delete this group? This cannot be undone.')) return;
    try {
      await axios.delete(`/api/groups/${group.id}`, { headers: { Authorization: `Bearer ${token}` } });
      onGroupDeleted(group.id);
      onClose();
    } catch (err) { alert('Failed to delete group'); }
  };

  const handleChangeRole = async (memberId, newRole) => {
    try {
      const res = await axios.put(`/api/groups/${group.id}/members/${memberId}/role`, { role: newRole }, { headers: { Authorization: `Bearer ${token}` } });
      onGroupUpdated(res.data);
      setOpenMemberMenu(null);
    } catch (err) { alert('Failed to change role'); }
  };

  const handleRemoveMember = async (memberId) => {
    if (!window.confirm('Remove this member from the group?')) return;
    try {
      const res = await axios.delete(`/api/groups/${group.id}/members/${memberId}`, { headers: { Authorization: `Bearer ${token}` } });
      onGroupUpdated(res.data);
      setOpenMemberMenu(null);
    } catch (err) { alert('Failed to remove member'); }
  };

  return (
    <div className="context-menu-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 3000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--surface-1)', borderRadius: '12px', width: '450px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
        
        {/* Header */}
        <div style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-app)' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Group Info</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}><X size={20} /></button>
        </div>
        
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          
          {/* Details Section */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px', color: 'var(--text-tertiary)' }}>
              <Users size={40} />
            </div>
            
            {editing && isAdmin ? (
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Group Name" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-medium)', background: 'var(--surface-white)', color: 'var(--text-primary)' }} />
                <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="Group Description" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-medium)', background: 'var(--surface-white)', color: 'var(--text-primary)' }} />
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button onClick={() => setEditing(false)} style={{ padding: '6px 12px', background: 'var(--surface-2)', border: 'none', borderRadius: '4px', cursor: 'pointer', color: 'var(--text-primary)' }}>Cancel</button>
                  <button onClick={handleUpdate} style={{ padding: '6px 12px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Save</button>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  {group.name}
                  {isAdmin && <button onClick={() => setEditing(true)} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.85rem' }}>Edit</button>}
                </h3>
                <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>{group.description || 'No description provided.'}</p>
                <div style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem', marginTop: '4px' }}>
                  {group.Members?.length || 0} participants
                </div>
              </div>
            )}
          </div>
          
          <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '0 -24px 24px' }}></div>
          
          {/* Members List */}
          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '12px', textTransform: 'uppercase' }}>Participants</h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {group.Members?.map(member => {
                const isGroupAdmin = member.GroupMember?.role === 'admin' || member.id === group.adminId;
                const isMe = member.id === user.id;
                
                return (
                  <div key={member.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px', background: 'var(--surface-2)', borderRadius: '8px', position: 'relative' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                        {member.avatar ? <img src={getAssetUrl(member.avatar)} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : member.name[0]}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 500 }}>{isMe ? 'You' : member.name}</span>
                        {isGroupAdmin && <span style={{ fontSize: '0.75rem', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '4px' }}><Shield size={10} /> Admin</span>}
                      </div>
                    </div>
                    
                    {isAdmin && !isMe && (
                      <div>
                        <button onClick={() => setOpenMemberMenu(openMemberMenu === member.id ? null : member.id)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}>
                          <ChevronDown size={20} />
                        </button>
                        
                        {openMemberMenu === member.id && (
                          <div style={{ position: 'absolute', right: '0', top: '100%', background: 'var(--surface-1)', border: '1px solid var(--border-medium)', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 10, minWidth: '150px', overflow: 'hidden' }}>
                            {isGroupAdmin ? (
                              <button onClick={() => handleChangeRole(member.id, 'member')} style={{ width: '100%', padding: '10px 16px', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                                <ShieldAlert size={16} /> Demote Admin
                              </button>
                            ) : (
                              <button onClick={() => handleChangeRole(member.id, 'admin')} style={{ width: '100%', padding: '10px 16px', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                                <Shield size={16} /> Make Admin
                              </button>
                            )}
                            <button onClick={() => handleRemoveMember(member.id)} style={{ width: '100%', padding: '10px 16px', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--danger)' }}>
                              <UserMinus size={16} /> Remove User
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          
          <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '0 -24px 24px' }}></div>
          
          {/* Danger Zone */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button onClick={handleLeave} style={{ padding: '12px', background: 'var(--surface-2)', color: 'var(--danger)', border: 'none', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600 }}>
              <LogOut size={18} /> Leave Group
            </button>
            
            {isAdmin && (
              <button onClick={handleDelete} style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600 }}>
                <Trash2 size={18} /> Delete Group
              </button>
            )}
          </div>
          
        </div>
      </div>
    </div>
  );
}
