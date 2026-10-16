'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { X, Eye, EyeOff, ArrowRight, CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react'
import { loginSchema, signupSchema } from '@/lib/validations/auth'
import { createClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/config'

interface AuthModalProps {
  isOpen?: boolean
  onClose?: () => void
  initialTab?: 'signin' | 'signup'
  isModal?: boolean
}

/* ─── Shared inline styles for pixel-perfect control ─── */
const s = {
  input: {
    width: '100%',
    height: 50,
    padding: '0 16px',
    fontSize: 14,
    color: '#0f172a',
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: 14,
    outline: 'none',
    transition: 'all 0.15s',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    fontWeight: 500,
    letterSpacing: '0.01em',
  } as React.CSSProperties,
  inputErr: {
    borderColor: '#f87171',
    background: '#fef2f2',
  } as React.CSSProperties,
  label: {
    display: 'block',
    fontSize: 13,
    fontWeight: 700,
    color: '#1e293b',
    marginBottom: 8,
    letterSpacing: '0.01em',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
  } as React.CSSProperties,
  fieldErr: {
    marginTop: 6,
    fontSize: 12,
    color: '#dc2626',
    fontWeight: 600,
  } as React.CSSProperties,
  submitBtn: {
    width: '100%',
    height: 52,
    borderRadius: 14,
    border: 'none',
    fontWeight: 800,
    fontSize: 15,
    color: '#ffffff',
    background: '#0f172a',
    boxShadow: '0 4px 16px rgba(15,23,42,0.22)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    transition: 'all 0.18s',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    letterSpacing: '0.02em',
  } as React.CSSProperties,
}

export function AuthModal({
  isOpen = true,
  onClose = () => {},
  initialTab = 'signin',
  isModal = true,
}: AuthModalProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>(initialTab)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)

  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab)
      setErrorMessage(null)
      setSuccessMessage(null)
      setFieldErrors({})
    }
  }, [isOpen, initialTab])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const resetFeedback = () => {
    setErrorMessage(null)
    setSuccessMessage(null)
    setFieldErrors({})
  }

  const handleQuickDemo = (e: React.MouseEvent) => {
    e.preventDefault()
    resetFeedback()
    setEmail('hydrologist@nexstorm.org')
    setPassword('Nexstorm2026!')
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    resetFeedback()
    const validation = loginSchema.safeParse({ email, password })
    if (!validation.success) {
      const errors: Record<string, string> = {}
      validation.error.issues.forEach((err) => {
        if (err.path[0]) errors[err.path[0].toString()] = err.message
      })
      setFieldErrors(errors)
      return
    }
    setIsLoading(true)
    if (!isSupabaseConfigured()) {
      setTimeout(() => {
        setIsLoading(false)
        setSuccessMessage('Authenticated. Welcome to NEXSTORM!')
        setTimeout(() => { onClose(); router.push('/city/amritsar') }, 600)
      }, 500)
      return
    }
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setErrorMessage(error.message); setIsLoading(false); return }
      setSuccessMessage('Signed in successfully')
      setTimeout(() => { onClose(); router.refresh() }, 600)
    } catch {
      setErrorMessage('Sign in failed. Please check your credentials.')
      setIsLoading(false)
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    resetFeedback()
    const validation = signupSchema.safeParse({ email, password, confirmPassword: password })
    if (!validation.success) {
      const errors: Record<string, string> = {}
      validation.error.issues.forEach((err) => {
        if (err.path[0]) errors[err.path[0].toString()] = err.message
      })
      setFieldErrors(errors)
      return
    }
    setIsLoading(true)
    if (!isSupabaseConfigured()) {
      setTimeout(() => {
        setIsLoading(false)
        setSuccessMessage(`Account created for ${fullName || 'Hydrologist'}`)
        setTimeout(() => { onClose(); router.push('/city/amritsar') }, 700)
      }, 500)
      return
    }
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { data: { full_name: fullName } },
      })
      if (error) { setErrorMessage(error.message); setIsLoading(false); return }
      setSuccessMessage('Registration submitted. Check email for verification.')
      setTimeout(() => onClose(), 1000)
    } catch {
      setErrorMessage('Account registration failed. Please try again.')
      setIsLoading(false)
    }
  }

  const modalContent = (
    <div
      style={{
        width: '100%',
        maxWidth: 520,
        borderRadius: 24,
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        boxShadow: '0 24px 64px -16px rgba(15,23,42,0.18), 0 8px 24px -8px rgba(15,23,42,0.06)',
        fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif",
        overflow: 'hidden',
      }}
    >
      {/* ── Top accent bar ── */}
      <div style={{ height: 3, background: 'linear-gradient(90deg, #0f172a 0%, #1d4ed8 50%, #0f172a 100%)' }} />

      {/* ── Content wrapper with generous padding ── */}
      <div style={{ padding: '36px 40px 32px' }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 48, height: 48, borderRadius: 14,
                background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, boxShadow: '0 2px 8px rgba(15,23,42,0.15)',
              }}
            >
              <svg width="26" height="26" viewBox="0 0 40 40" fill="none">
                <rect x="2" y="2" width="36" height="36" rx="10" fill="#0f172a" />
                <path d="M20 7L29 12.5V23.5L20 29L11 23.5V12.5L20 7Z" stroke="#94a3b8" strokeWidth="1.8" strokeLinejoin="round" />
                <path d="M22 11L14 21H21L18 29L26 19H20L22 11Z" fill="#ffffff" />
                <circle cx="20" cy="20" r="2.2" fill="#2563eb" />
              </svg>
            </div>
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', fontFamily: "'Outfit', sans-serif", letterSpacing: '-0.3px', lineHeight: 1.25, margin: 0 }}>
                {activeTab === 'signin' ? 'Welcome Back' : 'Create Account'}
              </h2>
              <p style={{ fontSize: 13.5, color: '#64748b', marginTop: 4, fontWeight: 500, margin: '4px 0 0' }}>
                {activeTab === 'signin' ? 'Sign in to NEXSTORM Intelligence' : 'Join the urban resilience platform'}
              </p>
            </div>
          </div>

          {isModal && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={{
                width: 36, height: 36, borderRadius: '50%', border: '1px solid #e2e8f0',
                background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', flexShrink: 0, color: '#64748b', transition: 'all 0.15s',
              }}
              onMouseOver={(e) => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#0f172a' }}
              onMouseOut={(e) => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.color = '#64748b' }}
            >
              <X style={{ width: 18, height: 18 }} />
            </button>
          )}
        </div>

        {/* ── Tab Switcher ── */}
        <div style={{ display: 'flex', padding: 5, background: '#f1f5f9', borderRadius: 14, marginBottom: 28, border: '1px solid #e2e8f0' }}>
          {(['signin', 'signup'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => { setActiveTab(tab); resetFeedback() }}
              style={{
                flex: 1, padding: '11px 16px', fontSize: 13.5, fontWeight: 700, borderRadius: 10,
                border: activeTab === tab ? '1px solid #e2e8f0' : '1px solid transparent',
                background: activeTab === tab ? '#ffffff' : 'transparent',
                color: activeTab === tab ? '#0f172a' : '#64748b',
                boxShadow: activeTab === tab ? '0 1px 4px rgba(15,23,42,0.06)' : 'none',
                cursor: 'pointer', transition: 'all 0.2s', textAlign: 'center',
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}
            >
              {tab === 'signin' ? 'Sign In' : 'Sign Up'}
            </button>
          ))}
        </div>

        {/* ── Notifications ── */}
        {errorMessage && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderRadius: 14, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: 13, fontWeight: 600, marginBottom: 20 }}>
            <AlertCircle style={{ width: 18, height: 18, flexShrink: 0 }} />
            <span>{errorMessage}</span>
          </div>
        )}
        {successMessage && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderRadius: 14, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#065f46', fontSize: 13, fontWeight: 600, marginBottom: 20 }}>
            <CheckCircle2 style={{ width: 18, height: 18, flexShrink: 0 }} />
            <span>{successMessage}</span>
          </div>
        )}

        {/* ── Forms ── */}
        {activeTab === 'signin' ? (
          <form onSubmit={handleSignIn}>
            {/* Email */}
            <div style={{ marginBottom: 22 }}>
              <label style={s.label}>Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="hydrologist@nexstorm.org"
                required
                style={{ ...s.input, ...(fieldErrors.email ? s.inputErr : {}) }}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#1d4ed8'; e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(29,78,216,0.1)' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.boxShadow = 'none' }}
              />
              {fieldErrors.email && <p style={s.fieldErr}>{fieldErrors.email}</p>}
            </div>

            {/* Password */}
            <div style={{ marginBottom: 22 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <label style={{ ...s.label, marginBottom: 0 }}>Password</label>
                <button type="button" onClick={handleQuickDemo} style={{ fontSize: 12, fontWeight: 700, color: '#1d4ed8', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  Auto-fill demo
                </button>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  style={{ ...s.input, paddingRight: 48, ...(fieldErrors.password ? s.inputErr : {}) }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#1d4ed8'; e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(29,78,216,0.1)' }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.boxShadow = 'none' }}
                />
                <button
                  type="button" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4, display: 'flex' }}
                >
                  {showPassword ? <EyeOff style={{ width: 18, height: 18 }} /> : <Eye style={{ width: 18, height: 18 }} />}
                </button>
              </div>
              {fieldErrors.password && <p style={s.fieldErr}>{fieldErrors.password}</p>}
            </div>

            {/* Remember + Encrypted */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#334155', fontWeight: 600, cursor: 'pointer' }}>
                <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} style={{ width: 16, height: 16, borderRadius: 4, accentColor: '#0f172a' }} />
                Keep me signed in
              </label>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#64748b', fontWeight: 500 }}>
                <ShieldCheck style={{ width: 14, height: 14, color: '#15803d' }} />
                Encrypted
              </span>
            </div>

            {/* Submit */}
            <button
              type="submit" disabled={isLoading}
              style={{ ...s.submitBtn, opacity: isLoading ? 0.6 : 1, cursor: isLoading ? 'wait' : 'pointer' }}
              onMouseOver={(e) => { if (!isLoading) { e.currentTarget.style.background = '#1e293b'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(15,23,42,0.3)'; e.currentTarget.style.transform = 'translateY(-1px)' } }}
              onMouseOut={(e) => { e.currentTarget.style.background = '#0f172a'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(15,23,42,0.22)'; e.currentTarget.style.transform = 'translateY(0)' }}
            >
              {isLoading ? (
                <span style={{ display: 'inline-block', width: 20, height: 20, borderRadius: '50%', border: '2.5px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'spin 0.7s linear infinite' }} />
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight style={{ width: 18, height: 18 }} />
                </>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSignUp}>
            {/* Full Name */}
            <div style={{ marginBottom: 22 }}>
              <label style={s.label}>Full Name</label>
              <input
                type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
                placeholder="Dr. Rajesh Varma" required
                style={s.input}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#1d4ed8'; e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(29,78,216,0.1)' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.boxShadow = 'none' }}
              />
            </div>

            {/* Email */}
            <div style={{ marginBottom: 22 }}>
              <label style={s.label}>Work Email</label>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="name@organization.gov" required
                style={{ ...s.input, ...(fieldErrors.email ? s.inputErr : {}) }}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#1d4ed8'; e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(29,78,216,0.1)' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.boxShadow = 'none' }}
              />
              {fieldErrors.email && <p style={s.fieldErr}>{fieldErrors.email}</p>}
            </div>

            {/* Password */}
            <div style={{ marginBottom: 28 }}>
              <label style={s.label}>Create Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters" required
                  style={{ ...s.input, paddingRight: 48, ...(fieldErrors.password ? s.inputErr : {}) }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#1d4ed8'; e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(29,78,216,0.1)' }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.boxShadow = 'none' }}
                />
                <button
                  type="button" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4, display: 'flex' }}
                >
                  {showPassword ? <EyeOff style={{ width: 18, height: 18 }} /> : <Eye style={{ width: 18, height: 18 }} />}
                </button>
              </div>
              {fieldErrors.password && <p style={s.fieldErr}>{fieldErrors.password}</p>}
            </div>

            {/* Submit */}
            <button
              type="submit" disabled={isLoading}
              style={{ ...s.submitBtn, opacity: isLoading ? 0.6 : 1, cursor: isLoading ? 'wait' : 'pointer' }}
              onMouseOver={(e) => { if (!isLoading) { e.currentTarget.style.background = '#1e293b'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(15,23,42,0.3)'; e.currentTarget.style.transform = 'translateY(-1px)' } }}
              onMouseOut={(e) => { e.currentTarget.style.background = '#0f172a'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(15,23,42,0.22)'; e.currentTarget.style.transform = 'translateY(0)' }}
            >
              {isLoading ? (
                <span style={{ display: 'inline-block', width: 20, height: 20, borderRadius: '50%', border: '2.5px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'spin 0.7s linear infinite' }} />
              ) : (
                <>
                  <span>Create Account</span>
                  <ArrowRight style={{ width: 18, height: 18 }} />
                </>
              )}
            </button>
          </form>
        )}

        {/* ── Footer Switch ── */}
        <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid #f1f5f9', textAlign: 'center' }}>
          <p style={{ fontSize: 13.5, color: '#64748b', fontWeight: 500, margin: 0 }}>
            {activeTab === 'signin' ? "Don't have an account?" : 'Already registered?'}
            <button
              type="button"
              onClick={() => { setActiveTab(activeTab === 'signin' ? 'signup' : 'signin'); resetFeedback() }}
              style={{ marginLeft: 6, fontWeight: 800, color: '#0f172a', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13.5, padding: 0, textDecoration: 'underline', textUnderlineOffset: 2 }}
            >
              {activeTab === 'signin' ? 'Sign Up' : 'Sign In'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )

  if (!isModal) return modalContent

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      role="dialog"
      aria-modal="true"
    >
      {modalContent}
    </div>
  )
}
