'use client'

import React, { useState, useRef } from 'react'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'

interface PillarSpotlightCardProps {
  index: string
  tag: string
  title: string
  description: string
  actionLabel: string
  actionHref?: string
  onActionClick?: () => void
  metricText: string
  theme?: 'blue' | 'emerald' | 'indigo' | 'grey'
}

export function PillarSpotlightCard({
  index,
  tag,
  title,
  description,
  actionLabel,
  actionHref,
  onActionClick,
  metricText,
}: PillarSpotlightCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [isHovered, setIsHovered] = useState(false)
  const [isPressed, setIsPressed] = useState(false)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    setMousePos({ x, y })

    // Gentle 3D perspective tilt
    const centerX = rect.width / 2
    const centerY = rect.height / 2
    const rotateX = Number((((y - centerY) / centerY) * -4).toFixed(2))
    const rotateY = Number((((x - centerX) / centerX) * 4).toFixed(2))
    setTilt({ x: rotateX, y: rotateY })
  }

  const handleMouseEnter = () => {
    setIsHovered(true)
  }

  const handleMouseLeave = () => {
    setIsHovered(false)
    setIsPressed(false)
    setTilt({ x: 0, y: 0 })
  }

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '36px 32px',
        backgroundColor: '#f5f5f7',
        borderRadius: '24px',
        border: isHovered 
          ? '1px solid rgba(15, 23, 42, 0.22)' 
          : '1px solid rgba(203, 213, 225, 0.85)',
        boxShadow: isHovered 
          ? '0 24px 48px -14px rgba(15, 23, 42, 0.08), 0 2px 6px rgba(15, 23, 42, 0.03)' 
          : '0 4px 20px -4px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.02)',
        transform: isPressed
          ? 'perspective(1000px) scale(0.985) translateY(-2px)'
          : isHovered 
          ? `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) translateY(-5px)` 
          : 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0)',
        transition: 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s ease, border-color 0.25s ease',
        overflow: 'hidden',
        cursor: 'default'
      }}
    >
      {/* Pure Neutral Monochrome Ambient Sheen (No Color Gradients) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          opacity: isHovered ? 1 : 0,
          transition: 'opacity 0.3s ease',
          background: `radial-gradient(380px circle at ${mousePos.x}px ${mousePos.y}px, rgba(15, 23, 42, 0.035), transparent 75%)`,
          zIndex: 1
        }}
      />

      {/* Top Content */}
      <div style={{ position: 'relative', zIndex: 2 }}>
        {/* Monochromatic Architectural Tag */}
        <div 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            marginBottom: '16px' 
          }}
        >
          <span 
            style={{
              fontFamily: "var(--font-mono-tag), 'Space Grotesk', monospace",
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.16em',
              color: '#64748b',
              textTransform: 'uppercase'
            }}
          >
            {index} / {tag}
          </span>
        </div>

        {/* Pillar Title */}
        <h3 
          style={{
            fontFamily: "var(--font-display), 'Outfit', sans-serif",
            fontSize: '22px',
            fontWeight: 800,
            color: '#0f172a',
            letterSpacing: '-0.025em',
            lineHeight: 1.25,
            marginBottom: '14px'
          }}
        >
          {title}
        </h3>

        {/* Body Text */}
        <p 
          style={{
            fontFamily: "var(--font-body), 'Plus Jakarta Sans', sans-serif",
            fontSize: '14.5px',
            color: '#475569',
            lineHeight: 1.68,
            margin: 0,
            fontWeight: 400
          }}
        >
          {description}
        </p>
      </div>

      {/* Footer Row: Action Button + Neutral Metric Tag */}
      <div 
        style={{
          position: 'relative',
          zIndex: 2,
          marginTop: '28px',
          paddingTop: '20px',
          borderTop: '1px solid #f1f5f9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px'
        }}
      >
        {actionHref ? (
          <Link
            href={actionHref}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontFamily: "var(--font-display), 'Outfit', sans-serif",
              fontSize: '12.5px',
              fontWeight: 700,
              color: isHovered ? '#0f172a' : '#334155',
              textDecoration: 'none',
              transition: 'color 0.2s ease'
            }}
          >
            <span>{actionLabel}</span>
            <ArrowUpRight 
              style={{ 
                width: '14px', 
                height: '14px',
                color: isHovered ? '#0f172a' : '#64748b',
                transform: isHovered ? 'translate(2px, -2px)' : 'translate(0, 0)',
                transition: 'transform 0.2s ease, color 0.2s ease'
              }} 
            />
          </Link>
        ) : (
          <button
            type="button"
            onClick={onActionClick}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontFamily: "var(--font-display), 'Outfit', sans-serif",
              fontSize: '12.5px',
              fontWeight: 700,
              color: isHovered ? '#0f172a' : '#334155',
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              transition: 'color 0.2s ease'
            }}
          >
            <span>{actionLabel}</span>
            <ArrowUpRight 
              style={{ 
                width: '14px', 
                height: '14px',
                color: isHovered ? '#0f172a' : '#64748b',
                transform: isHovered ? 'translate(2px, -2px)' : 'translate(0, 0)',
                transition: 'transform 0.2s ease, color 0.2s ease'
              }} 
            />
          </button>
        )}

        <span 
          style={{
            fontFamily: "var(--font-mono-tag), 'Space Grotesk', monospace",
            fontSize: '11px',
            fontWeight: 700,
            padding: '4px 10px',
            borderRadius: '9999px',
            backgroundColor: '#ffffff',
            color: '#334155',
            border: '1px solid #cbd5e1',
            letterSpacing: '0.02em',
            whiteSpace: 'nowrap'
          }}
        >
          {metricText}
        </span>
      </div>
    </div>
  )
}
