import React, { useState, useRef, useEffect } from 'react';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import { Smile, Sticker, MonitorUp, Send, X, ImagePlus, Search } from 'lucide-react';
import axios from 'axios';

const GIPHY_API_KEY = 'dc6zaTOxFJmzC'; // Public beta key for demo

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

export default function ChatInput({ onSendMessage, onStartScreenShare, token }) {
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

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    if (input.trim()) {
      onSendMessage({ type: 'text', content: input });
      setInput('');
      setShowEmoji(false);
      setShowStickers(false);
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
                      <img src={gif.url} alt="gif" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px' }} />
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
                      <img src={s.imageUrl} alt="custom" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px' }} />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <form className="input-bar" onSubmit={handleSubmit}>
        <div className="input-actions">
          <button type="button" className={`action-btn ${showEmoji ? 'active' : ''}`} onClick={() => { setShowStickers(false); setShowEmoji(!showEmoji); }} title="Emoji">
            <Smile size={20} />
          </button>
          <button type="button" className={`action-btn ${showStickers ? 'active' : ''}`} onClick={() => { setShowEmoji(false); setShowStickers(!showStickers); }} title="Stickers">
            <Sticker size={20} />
          </button>
          {onStartScreenShare && (
            <button type="button" className="action-btn" onClick={onStartScreenShare} title="Screen Share">
              <MonitorUp size={20} />
            </button>
          )}
        </div>

        <textarea
          ref={inputRef}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          className="message-input"
          rows={1}
          style={{ resize: 'none', overflowY: 'hidden' }}
        />

        <button type="submit" disabled={!input.trim()} className={`send-btn ${input.trim() ? 'has-text' : ''}`}>
          <Send size={18} className={input.trim() ? 'icon-animate-in' : ''} />
        </button>
      </form>
    </div>
  );
}
