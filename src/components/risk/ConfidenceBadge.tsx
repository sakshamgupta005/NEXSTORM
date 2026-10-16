import React from 'react'
import type { Confidence } from '@/lib/risk/types'
import { Badge } from '@/components/ui/badge'
import { ShieldAlert, ShieldCheck, ShieldMinus, HelpCircle } from 'lucide-react'

interface ConfidenceBadgeProps {
  confidence: Confidence
  memberCount?: number
}

export function ConfidenceBadge({ confidence, memberCount = 1 }: ConfidenceBadgeProps) {
  const config = {
    high: {
      label: 'High Confidence',
      variant: 'default' as const,
      icon: ShieldCheck,
      color: 'bg-emerald-50 text-emerald-800 border-emerald-200 font-semibold',
      description: 'Ensemble member agreement ≥ 80%.',
    },
    medium: {
      label: 'Medium Confidence',
      variant: 'outline' as const,
      icon: ShieldMinus,
      color: 'bg-blue-50 text-blue-800 border-blue-200 font-semibold',
      description: 'Ensemble member agreement 50%–79%.',
    },
    low: {
      label: 'Low Confidence',
      variant: 'destructive' as const,
      icon: ShieldAlert,
      color: 'bg-amber-50 text-amber-800 border-amber-200 font-semibold',
      description: 'High ensemble divergence; agreement < 50%.',
    },
    unavailable: {
      label: 'Confidence Unavailable',
      variant: 'secondary' as const,
      icon: HelpCircle,
      color: 'bg-slate-100 text-slate-800 border-slate-200 font-semibold',
      description:
        memberCount <= 1
          ? 'Single deterministic scenario simulation. Confidence requires multi-member ensemble forecasting.'
          : 'Insufficient ensemble data to quantify statistical variance.',
    },
  }[confidence]

  const Icon = config.icon

  return (
    <div className="inline-flex flex-col gap-1.5" data-testid="confidence-badge">
      <div className="flex items-center gap-1.5">
        <Badge
          variant="outline"
          className={`flex items-center gap-1 text-[11px] border px-2 py-0.5 ${config.color}`}
        >
          <Icon className="w-3 h-3" />
          <span>{config.label}</span>
        </Badge>
      </div>
      <span className="text-xs text-slate-600 leading-snug">
        {config.description}
      </span>
    </div>
  )
}
