import React, { useState, useRef, useEffect } from 'react';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import { Smile, Sticker, Send, X, ImagePlus, Search, Paperclip, Mic, Square, Edit2 } from 'lucide-react';
import axios from 'axios';
import { getAssetUrl } from '../utils/assets';

const GIPHY_API_KEY = 'p7xUh0q9NKv3h6QyJYnqlL09gdn8MGIC';

const STICKER_PACKS = [
  {
    name: 'Classic Faces',
    stickers: [
      { id: 'happy', label: 'Happy', emoji: '😊' },
      { id: 'love', label: 'Love', emoji: '😍' },
      { id: 'laugh', label: 'Laugh', emoji: '😂' },
      { id: 'cool', label: 'Cool', emoji: '😎' },
      { id: 'wink', label: 'Wink', emoji: '😉' },
      { id: 'think', label: 'Think', emoji: '🤔' },
      { id: 'sad', label: 'Sad', emoji: '😢' },
      { id: 'angry', label: 'Angry', emoji: '😤' },
      { id: 'party', label: 'Party', emoji: '🥳' },
      { id: 'shock', label: 'Shock', emoji: '😱' },
      { id: 'sleep', label: 'Sleep', emoji: '😴' },
      { id: 'fire', label: 'Fire', emoji: '🔥' },
    ]
  }
];

export default function ChatInput({ onSendMessage, onTypingStart, onTypingStop, onStartScreenShare, token, editingMessage, replyingMessage, onEditMessage, onCancelEdit, onCancelReply }) {
  const [input, setInput] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [showStickers, setShowStickers] = useState(false);
  const [activeTab, setActiveTab] = useState('classic'); // 'classic', 'giphy', 'custom'
  
  // Giphy state
  const [giphySearch, setGiphySearch] = useState('');
  const [giphyResults, setGiphyResults] = useState([]);
  
  // Custom sticker state
  const [customStickers, setCustomStickers] = useState([]);
  
  const inputRef = useRef(null);
  const pickerRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);

  // Close picker on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setShowEmoji(false);
        setShowStickers(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch custom stickers
  useEffect(() => {
    if (activeTab === 'custom' && token) {
      axios.get('/api/stickers', { headers: { Authorization: `Bearer ${token}` } })
        .then(res => setCustomStickers(res.data))
        .catch(err => console.error(err));
    }
  }, [activeTab, token]);

  // Search Giphy
  useEffect(() => {
    if (activeTab === 'giphy') {
      const query = giphySearch || 'trending';
      const endpoint = giphySearch 
        ? `https://api.giphy.com/v1/stickers/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=20`
        : `https://api.giphy.com/v1/stickers/trending?api_key=${GIPHY_API_KEY}&limit=20`;
        
      fetch(endpoint)
        .then(res => res.json())
        .then(data => {
          if (data.data) {
            setGiphyResults(data.data.map(item => ({
              id: item.id,
              url: item.images.fixed_height_small.url
            })));
          }
        })
        .catch(err => console.error(err));
    }
  }, [activeTab, giphySearch]);

  // Handle editing message prop
  useEffect(() => {
    if (editingMessage) {
      setInput(editingMessage.content);
      if (inputRef.current) inputRef.current.focus();
    } else if (!replyingMessage) {
      setInput('');
    }
  }, [editingMessage]);

  useEffect(() => {
    if (replyingMessage) {
      if (inputRef.current) inputRef.current.focus();
    }
  }, [replyingMessage]);

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    if (input.trim()) {
      if (editingMessage) {
        onEditMessage(editingMessage.id, input);
        if (onCancelEdit) onCancelEdit();
      } else {
        onSendMessage({ type: 'text', content: input });
        if (onCancelReply) onCancelReply();
      }
      setInput('');
      setShowEmoji(false);
      setShowStickers(false);
      if (onTypingStop) {
        onTypingStop();
        clearTimeout(typingTimeoutRef.current);
      }
      if (inputRef.current) {
        inputRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    const scrollHeight = e.target.scrollHeight;
    e.target.style.height = `${Math.min(scrollHeight, 120)}px`;
    e.target.style.overflowY = scrollHeight > 120 ? 'auto' : 'hidden';

    if (onTypingStart) onTypingStart();

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      if (onTypingStop) onTypingStop();
    }, 1500);
  };

  const handleEmojiSelect = (emoji) => {
    setInput(prev => prev + emoji.native);
    inputRef.current?.focus();
  };

  const handleStickerSelect = (content, isCustom = false) => {
    onSendMessage({ 
      type: isCustom ? 'custom_sticker' : 'sticker', 
      content 
    });
    setShowStickers(false);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;

    const formData = new FormData();
    formData.append('sticker', file);

    try {
      const res = await axios.post('/api/stickers/upload', formData, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      setCustomStickers(prev => [res.data, ...prev]);
    } catch (err) {
      console.error('Failed to upload sticker', err);
    }
  };

  const closeAllPickers = () => {
    setShowEmoji(false);
    setShowStickers(false);
  };

  const handleMediaUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await axios.post('/api/uploads', formData, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      // Detect type
      let msgType = 'file';
      if (file.type.startsWith('image/')) msgType = 'image';
      else if (file.type.startsWith('video/')) msgType = 'video';
      
      onSendMessage({ 
        type: msgType, 
        content: res.data.url, 
        filename: res.data.filename,
        replyTo: replyingMessage ? replyingMessage.id : null
      });
      if (onCancelReply) onCancelReply();
    } catch (err) {
      console.error('Failed to upload media', err);
    }
  };

  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('file', audioBlob, 'voice_message.webm');

        try {
          const res = await axios.post('/api/uploads', formData, {
            headers: { 
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'multipart/form-data'
            }
          });
          onSendMessage({ type: 'voice', content: res.data.url });
          if (onCancelReply) onCancelReply();
        } catch (err) {
          console.error('Failed to upload voice message', err);
        }
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error('Microphone access denied', err);
      alert('Could not access microphone. Please allow permissions.');
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
      clearInterval(recordingTimerRef.current);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="chat-input-wrapper" ref={pickerRef}>
      {showEmoji && (
        <div className="picker-popup">
          <div className="picker-header">
            <span>Emoji</span>
            <button className="picker-close" onClick={closeAllPickers}><X size={16} /></button>
          </div>
          <Picker data={data} onEmojiSelect={handleEmojiSelect} theme="light" set="native" previewPosition="none" skinTonePosition="search" />
        </div>
      )}

      {showStickers && (
        <div className="picker-popup sticker-popup">
          <div className="picker-header">
            <span>Stickers</span>
            <button className="picker-close" onClick={closeAllPickers}><X size={16} /></button>
          </div>
          
          <div className="sticker-pack-tabs">
            <button className={`sticker-tab ${activeTab === 'classic' ? 'active' : ''}`} onClick={() => setActiveTab('classic')}>Classic</button>
            <button className={`sticker-tab ${activeTab === 'giphy' ? 'active' : ''}`} onClick={() => setActiveTab('giphy')}>Giphy</button>
            <button className={`sticker-tab ${activeTab === 'custom' ? 'active' : ''}`} onClick={() => setActiveTab('custom')}>Custom</button>
          </div>

          <div className="sticker-content" style={{ padding: '8px', maxHeight: '280px', overflowY: 'auto' }}>
            {activeTab === 'classic' && (
              <div className="sticker-grid">
                {STICKER_PACKS[0].stickers.map(s => (
                  <button key={s.id} className="sticker-item" onClick={() => handleStickerSelect(s.emoji)}>
                    <span className="sticker-emoji">{s.emoji}</span>
                  </button>
                ))}
              </div>
            )}

            {activeTab === 'giphy' && (
              <div className="giphy-tab">
                <div className="search-box" style={{ marginBottom: '8px' }}>
                  <Search size={14} className="search-icon" />
                  <input 
                    type="text" 
                    placeholder="Search Giphy..." 
                    value={giphySearch} 
                    onChange={e => setGiphySearch(e.target.value)}
                    className="search-input"
                  />
                </div>
                <div className="sticker-grid">
                  {giphyResults.map(gif => (
                    <button key={gif.id} className="sticker-item" style={{ padding: '2px' }} onClick={() => handleStickerSelect(gif.url, true)}>
                      <img src={getAssetUrl(gif.url)} alt="gif" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px' }} />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'custom' && (
              <div className="custom-tab">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  style={{ display: 'none' }} 
                  accept="image/*"
                  onChange={handleFileUpload}
                />
                <button 
                  className="retro-btn" 
                  style={{ width: '100%', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImagePlus size={16} /> Upload Sticker
                </button>
                <div className="sticker-grid">
                  {customStickers.map(s => (
                    <button key={s.id} className="sticker-item" style={{ padding: '2px' }} onClick={() => handleStickerSelect(s.imageUrl, true)}>
                      <img src={getAssetUrl(s.imageUrl)} alt="custom" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px' }} />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {editingMessage && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: 'var(--surface-1)', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
          <Edit2 size={16} style={{ color: 'var(--accent)' }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent)' }}>Edit Message</div>
            <div style={{ fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{editingMessage.content}</div>
          </div>
          <button onClick={onCancelEdit} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '50%' }} className="hover-bg">
            <X size={18} />
          </button>
        </div>
      )}

      {replyingMessage && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: 'var(--surface-1)', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
          <div style={{ flex: 1, minWidth: 0, borderLeft: '3px solid var(--accent)', paddingLeft: '8px' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent)' }}>Replying to {replyingMessage.senderName}</div>
            <div style={{ fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{replyingMessage.content || (replyingMessage.type !== 'text' ? `[${replyingMessage.type}]` : '')}</div>
          </div>
          <button onClick={onCancelReply} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '50%' }} className="hover-bg">
            <X size={18} />
          </button>
        </div>
      )}

      <form className="input-bar" onSubmit={handleSubmit} style={{ borderTopLeftRadius: (editingMessage || replyingMessage) ? '0' : '24px', borderTopRightRadius: (editingMessage || replyingMessage) ? '0' : '24px' }}>
        <div className="input-actions">
          <button type="button" className={`action-btn ${showEmoji ? 'active' : ''}`} onClick={() => { setShowStickers(false); setShowEmoji(!showEmoji); }} title="Emoji">
            <Smile size={20} />
          </button>
          <button type="button" className={`action-btn ${showStickers ? 'active' : ''}`} onClick={() => { setShowEmoji(false); setShowStickers(!showStickers); }} title="Stickers">
            <Sticker size={20} />
          </button>
          <button type="button" className="action-btn" onClick={() => mediaInputRef.current?.click()} title="Attach File">
            <Paperclip size={20} />
          </button>
          <input 
            type="file" 
            ref={mediaInputRef} 
            style={{ display: 'none' }} 
            onChange={handleMediaUpload}
          />
        </div>

        {isRecording ? (
          <div className="message-input" style={{ display: 'flex', alignItems: 'center', color: 'var(--danger)', fontWeight: 600 }}>
            <span className="icon-pulse" style={{ display: 'inline-block', width: '10px', height: '10px', background: 'var(--danger)', borderRadius: '50%', marginRight: '10px' }}></span>
            Recording: {formatTime(recordingTime)}
          </div>
        ) : (
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={editingMessage ? "Edit your message..." : "Type a message..."}
            className="message-input"
            rows={1}
            style={{ resize: 'none', overflowY: 'hidden' }}
          />
        )}

        {input.trim() ? (
          <button type="submit" className="send-btn has-text">
            <Send size={18} className="icon-animate-in" />
          </button>
        ) : isRecording ? (
          <button type="button" className="send-btn has-text" style={{ background: 'var(--danger)' }} onClick={handleStopRecording} title="Stop Recording">
            <Square size={18} />
          </button>
        ) : (
          <button type="button" className="send-btn" onMouseDown={handleStartRecording} onClick={(e) => e.preventDefault()} title="Record Voice Message">
            <Mic size={18} />
          </button>
        )}
      </form>
    </div>
  );
}
