import { redirect } from 'next/navigation'

export const metadata = {
  title: 'About NEXSTORM — Technical Architecture, Methodology & System Verification',
  description:
    'Comprehensive technical explanation of NEXSTORM: data sources, algorithms, risk calculation methodology, and system implementation.',
}

export default function AboutPage() {
  redirect('/?tab=about')
}
