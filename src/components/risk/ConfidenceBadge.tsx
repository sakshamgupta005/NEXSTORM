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
      color: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
      description: 'Ensemble member agreement ≥ 80%.',
    },
    medium: {
      label: 'Medium Confidence',
      variant: 'outline' as const,
      icon: ShieldMinus,
      color: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30',
      description: 'Ensemble member agreement 50%–79%.',
    },
    low: {
      label: 'Low Confidence',
      variant: 'destructive' as const,
      icon: ShieldAlert,
      color: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30',
      description: 'High ensemble divergence; agreement < 50%.',
    },
    unavailable: {
      label: 'Confidence Unavailable',
      variant: 'secondary' as const,
      icon: HelpCircle,
      color: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-400/30',
      description:
        memberCount <= 1
          ? 'Single deterministic scenario simulation. Confidence requires multi-member ensemble forecasting.'
          : 'Insufficient ensemble data to quantify statistical variance.',
    },
  }[confidence]

  const Icon = config.icon

  return (
    <div className="inline-flex flex-col gap-1" data-testid="confidence-badge">
      <div className="flex items-center gap-1.5">
        <Badge
          variant="outline"
          className={`flex items-center gap-1 text-[11px] font-medium border px-2 py-0.5 ${config.color}`}
        >
          <Icon className="w-3 h-3" />
          <span>{config.label}</span>
        </Badge>
      </div>
      <span className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
        {config.description}
      </span>
    </div>
  )
}
