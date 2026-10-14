'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { loginSchema, signupSchema } from '@/lib/validations/auth'
import { getSafeRedirectPath } from '@/lib/utils/redirect'

export type AuthActionResult = {
  error?: string
  success?: boolean
  message?: string
}

export async function loginAction(
  prevState: AuthActionResult | null,
  formData: FormData
): Promise<AuthActionResult> {
  if (!isSupabaseConfigured()) {
    return {
      error: 'Supabase is not configured. Please add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local',
    }
  }

  const rawData = {
    email: formData.get('email'),
    password: formData.get('password'),
  }

  const validation = loginSchema.safeParse(rawData)
  if (!validation.success) {
    return {
      error: validation.error.issues[0]?.message || 'Invalid form input',
    }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: validation.data.email,
    password: validation.data.password,
  })

  if (error) {
    return { error: error.message }
  }

  const rawRedirectTo = formData.get('redirectTo')?.toString()
  const safeRedirectTo = getSafeRedirectPath(rawRedirectTo, '/dashboard')
  redirect(safeRedirectTo)
}

export async function signupAction(
  prevState: AuthActionResult | null,
  formData: FormData
): Promise<AuthActionResult> {
  if (!isSupabaseConfigured()) {
    return {
      error: 'Supabase is not configured. Please add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local',
    }
  }

  const rawData = {
    email: formData.get('email'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  }

  const validation = signupSchema.safeParse(rawData)
  if (!validation.success) {
    return {
      error: validation.error.issues[0]?.message || 'Invalid form input',
    }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email: validation.data.email,
    password: validation.data.password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback`,
    },
  })

  if (error) {
    return { error: error.message }
  }

  // If Supabase has email confirmation enabled, data.session will be null
  if (data.user && !data.session) {
    return {
      success: true,
      message: 'Account created! Please check your email inbox to confirm your registration before logging in.',
    }
  }

  redirect('/dashboard')
}

export async function signoutAction(): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await createClient()
    await supabase.auth.signOut()
  }
  redirect('/login')
}
