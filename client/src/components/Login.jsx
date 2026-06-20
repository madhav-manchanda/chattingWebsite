import React, { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import axios from 'axios';

const API_URL = 'http://localhost:3000/api/auth';

export default function Login({ onLogin }) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const endpoint = isRegister ? '/register' : '/login';
      const payload = isRegister ? { email, password, name, username: username.startsWith('@') ? username : `@${username}` } : { email, password };
      
      const res = await axios.post(`${API_URL}${endpoint}`, payload);
      onLogin(res.data.token, res.data.user);
    } catch (err) {
      setError(err.response?.data?.error || 'Authentication failed');
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      const res = await axios.post(`${API_URL}/google`, {
        token: credentialResponse.credential
      });
      onLogin(res.data.token, res.data.user);
    } catch (err) {
      setError('Google login failed');
    }
  };

  return (
    <div className="login-container">
      <div className="retro-panel login-box">
        <h2 className="login-title">{isRegister ? 'Register' : 'Login'}</h2>
        
        {error && <div className="error-message retro-inset">{error}</div>}

        <form onSubmit={handleSubmit} className="login-form">
          {isRegister && (
            <>
              <input 
                type="text" 
                placeholder="Name" 
                className="retro-input retro-inset login-input" 
                value={name} 
                onChange={e => setName(e.target.value)} 
                required 
              />
              <input 
                type="text" 
                placeholder="Username (e.g. @coolkid)" 
                className="retro-input retro-inset login-input" 
                value={username} 
                onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9@]/g, ''))} 
                required 
              />
            </>
          )}
          <input 
            type="email" 
            placeholder="Email" 
            className="retro-input retro-inset login-input" 
            value={email} 
            onChange={e => setEmail(e.target.value)} 
            required 
          />
          <input 
            type="password" 
            placeholder="Password" 
            className="retro-input retro-inset login-input" 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
            required 
          />
          
          <button type="submit" className="retro-btn login-btn">
            {isRegister ? 'Sign Up' : 'Sign In'}
          </button>
        </form>

        <div className="divider">or</div>

        <div className="google-login-wrapper">
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => setError('Google login failed')}
            theme="filled_black"
            text={isRegister ? "signup_with" : "signin_with"}
          />
        </div>

        <p className="toggle-auth">
          {isRegister ? 'Already have an account?' : "Don't have an account?"}
          <button type="button" className="retro-btn toggle-btn" onClick={() => setIsRegister(!isRegister)}>
            {isRegister ? 'Login' : 'Register'}
          </button>
        </p>
      </div>
    </div>
  );
}
