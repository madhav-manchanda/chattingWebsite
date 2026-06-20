import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import axios from 'axios';

export default function Login() {
  const [view, setView] = useState('login'); // 'login', 'register', 'forgot_email', 'forgot_otp', 'reset_password'
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [otp, setOtp] = useState('');
  
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [usernameError, setUsernameError] = useState('');

  // Debounce username checking
  useEffect(() => {
    if (view !== 'register' || !username) {
      setUsernameError('');
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await axios.get(`/api/auth/check-username/${username}`);
        if (!res.data.available) {
          setUsernameError('Username is already taken');
        } else {
          setUsernameError('');
        }
      } catch (err) {
        console.error('Username check failed', err);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [username, view]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMsg('');

    try {
      if (view === 'register') {
        if (usernameError) return setError('Please choose a different username');
        
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name,
              username: username.startsWith('@') ? username : `@${username}`,
              avatar: null
            }
          }
        });
        if (error) throw error;
        setMsg('Check your email for a 6-digit verification code!');
        setView('signup_otp');
      } else if (view === 'signup_otp') {
        const { data, error } = await supabase.auth.verifyOtp({
          email,
          token: otp,
          type: 'signup'
        });
        if (error) throw error;
        setMsg('Email verified successfully! Logging you in...');
      } else if (view === 'login') {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        if (error) throw error;
      } else if (view === 'forgot_email') {
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) throw error;
        setMsg('A 6-digit OTP has been sent to your email.');
        setView('forgot_otp');
      } else if (view === 'forgot_otp') {
        const { data, error } = await supabase.auth.verifyOtp({
          email,
          token: otp,
          type: 'recovery'
        });
        if (error) throw error;
        setMsg('OTP verified! Please enter your new password.');
        setView('reset_password');
      } else if (view === 'reset_password') {
        const { error } = await supabase.auth.updateUser({
          password
        });
        if (error) throw error;
        setMsg('Password successfully reset! You can now log in.');
        setView('login');
      }
    } catch (err) {
      console.error("Auth error:", err);
      let errMsg = err.message || err.error_description || err.msg || 'An unknown error occurred';
      if (typeof errMsg === 'object') {
        try { errMsg = JSON.stringify(errMsg); } catch(e) {}
      }
      if (errMsg === '{}') errMsg = 'An unknown error occurred. Please check your credentials.';
      setError(errMsg);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google'
      });
      if (error) throw error;
    } catch (err) {
      setError('Google login failed');
    }
  };

  const renderForm = () => {
    if (view === 'signup_otp') {
      return (
        <>
          <p style={{marginBottom: 16, color: 'var(--text-secondary)'}}>Enter the 6-digit code sent to {email}.</p>
          <input type="text" placeholder="6-Digit OTP" className="retro-input retro-inset login-input" value={otp} onChange={e => setOtp(e.target.value)} maxLength={6} required style={{ letterSpacing: '4px', textAlign: 'center', fontSize: '1.2rem' }} />
          <button type="submit" className="retro-btn login-btn">Verify Account</button>
        </>
      );
    }
    if (view === 'forgot_email') {
      return (
        <>
          <p style={{marginBottom: 16, color: 'var(--text-secondary)'}}>Enter your email address to receive a 6-digit recovery code.</p>
          <input type="email" placeholder="Email" className="retro-input retro-inset login-input" value={email} onChange={e => setEmail(e.target.value)} required />
          <button type="submit" className="retro-btn login-btn">Send OTP</button>
        </>
      );
    }
    if (view === 'forgot_otp') {
      return (
        <>
          <p style={{marginBottom: 16, color: 'var(--text-secondary)'}}>Enter the 6-digit code sent to {email}.</p>
          <input type="text" placeholder="6-Digit OTP" className="retro-input retro-inset login-input" value={otp} onChange={e => setOtp(e.target.value)} maxLength={6} required style={{ letterSpacing: '4px', textAlign: 'center', fontSize: '1.2rem' }} />
          <button type="submit" className="retro-btn login-btn">Verify Code</button>
        </>
      );
    }
    if (view === 'reset_password') {
      return (
        <>
          <p style={{marginBottom: 16, color: 'var(--text-secondary)'}}>Enter your new password below.</p>
          <input type="password" placeholder="New Password" className="retro-input retro-inset login-input" value={password} onChange={e => setPassword(e.target.value)} required />
          <button type="submit" className="retro-btn login-btn">Update Password</button>
        </>
      );
    }

    // Default Login/Register
    return (
      <>
        {view === 'register' && (
          <>
            <input type="text" placeholder="Name" className="retro-input retro-inset login-input" value={name} onChange={e => setName(e.target.value)} required />
            <input type="text" placeholder="Username (e.g. coolkid)" className="retro-input retro-inset login-input" value={username} onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))} required style={{ borderColor: usernameError ? 'var(--danger)' : '' }} />
            {usernameError && <div style={{color: 'var(--danger)', fontSize: '0.85rem', marginTop: '-8px', marginBottom: '8px'}}>{usernameError}</div>}
          </>
        )}
        <input type="email" placeholder="Email" className="retro-input retro-inset login-input" value={email} onChange={e => setEmail(e.target.value)} required />
        <input type="password" placeholder="Password" className="retro-input retro-inset login-input" value={password} onChange={e => setPassword(e.target.value)} required />
        
        <button type="submit" className="retro-btn login-btn" disabled={!!usernameError}>
          {view === 'register' ? 'Sign Up' : 'Sign In'}
        </button>
      </>
    );
  };

  const renderTitle = () => {
    switch (view) {
      case 'register': return 'Register';
      case 'signup_otp': return 'Verify Email';
      case 'forgot_email': return 'Reset Password';
      case 'forgot_otp': return 'Enter OTP';
      case 'reset_password': return 'New Password';
      default: return 'Login';
    }
  };

  return (
    <div className="login-container">
      <div className="retro-panel login-box">
        <h2 className="login-title">{renderTitle()}</h2>
        
        {error && <div className="error-message retro-inset">{error}</div>}
        {msg && <div className="success-message retro-inset" style={{ color: 'var(--success)', marginBottom: '16px' }}>{msg}</div>}

        <form onSubmit={handleSubmit} className="login-form">
          {renderForm()}
        </form>

        {(view === 'login' || view === 'register') && (
          <>
            <div className="divider">or</div>
            <div className="google-login-wrapper" style={{ display: 'flex', justifyContent: 'center' }}>
              <button type="button" onClick={handleGoogleLogin} className="retro-btn" style={{ background: '#fff', color: '#000', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', border: '1px solid var(--border-strong)', padding: '12px', borderRadius: 'var(--r-sm)', cursor: 'pointer', fontWeight: '500', boxShadow: 'var(--shadow-xs)' }}>
                <svg width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
                Continue with Google
              </button>
            </div>
            {view === 'login' && (
              <p style={{ textAlign: 'center', marginTop: '12px' }}>
                <a href="#" onClick={(e) => { e.preventDefault(); setView('forgot_email'); setError(''); setMsg(''); }} style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: '0.9rem' }}>Forgot Password?</a>
              </p>
            )}
            <p className="toggle-auth">
              {view === 'register' ? 'Already have an account?' : "Don't have an account?"}
              <button type="button" className="retro-btn toggle-btn" onClick={() => { setView(view === 'register' ? 'login' : 'register'); setError(''); setMsg(''); }}>
                {view === 'register' ? 'Login' : 'Register'}
              </button>
            </p>
          </>
        )}

        {(view === 'forgot_email' || view === 'forgot_otp' || view === 'reset_password' || view === 'signup_otp') && (
          <p className="toggle-auth" style={{ marginTop: '16px', textAlign: 'center' }}>
            <button type="button" className="retro-btn toggle-btn" onClick={() => { setView('login'); setError(''); setMsg(''); }}>
              Back to Login
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
