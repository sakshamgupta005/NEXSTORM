import type { User } from '@supabase/supabase-js'

export type AuthUser = User

export interface NavItem {
  title: string
  href: string
  disabled?: boolean
  external?: boolean
  icon?: string
}

export interface SiteConfig {
  name: string
  description: string
  url: string
  ogImage: string
  links: {
    github: string
  }
}
