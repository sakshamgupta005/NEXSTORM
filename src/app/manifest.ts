import type { MetadataRoute } from 'next'
import { DEFAULT_PWA_CONFIG } from '@/lib/pwa/config'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: DEFAULT_PWA_CONFIG.appName,
    short_name: DEFAULT_PWA_CONFIG.shortName,
    description: 'Production-ready hackathon starter template with optional PWA and offline sync capabilities.',
    start_url: '/',
    display: DEFAULT_PWA_CONFIG.display,
    background_color: DEFAULT_PWA_CONFIG.backgroundColor,
    theme_color: DEFAULT_PWA_CONFIG.themeColor,
    icons: [
      {
        src: '/globe.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
  }
}
