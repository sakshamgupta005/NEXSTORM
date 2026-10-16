'use client'

import React, { useRef, useState, useEffect } from 'react'
import { ArrowUpRight } from 'lucide-react'
import Link from 'next/link'

interface TimelinePoint {
  index: string
  stage: string
  title: string
  description: string
}

const TIMELINE_POINTS: TimelinePoint[] = [
  {
    index: '01',
    stage: 'INGESTION',
    title: 'Precipitation Ingestion',
    description: 'Continuous Doppler radar calibration with real-time ground rain gauges.'
  },
  {
    index: '02',
    stage: 'HYDROLOGY',
    title: 'Copernicus 30m Micro-Catchments',
    description: 'Digital elevation modeling extracting 14 topographic natural drainage basins.'
  },
  {
    index: '03',
    stage: 'SIMULATION',
    title: 'Deterministic 250m Macro-Mesh',
    description: '1,998 localized grid cells computing surface runoff velocity and retention.'
  },
  {
    index: '04',
    stage: 'EXPOSURE',
    title: 'Asset Risk Overlay',
    description: 'Spatial risk intersection across 360k+ buildings and 14.8k road segments.'
  },
  {
    index: '05',
    stage: 'ROUTING',
    title: 'Sub-2ms A* Evacuation Routing',
    description: 'Dynamic navigation rerouting emergency services around flooded corridors.'
  }
]

export function SystemTimelineSection() {
  const lineContainerRef = useRef<HTMLDivElement>(null)
  const [scrollProgress, setScrollProgress] = useState(0)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  useEffect(() => {
    const handleScroll = () => {
      if (!lineContainerRef.current) return
      const rect = lineContainerRef.current.getBoundingClientRect()
      const windowHeight = window.innerHeight

      // Trigger fill smoothly as user scrolls down through the timeline
      const startTrigger = windowHeight * 0.72
      const totalHeight = rect.height

      if (rect.top > startTrigger) {
        setScrollProgress(0)
      } else {
        const scrolled = startTrigger - rect.top
        const progress = Math.min(Math.max((scrolled / totalHeight) * 100, 0), 100)
        setScrollProgress(progress)
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <section 
      style={{
        width: '100%',
        maxWidth: '820px',
        margin: '0 auto',
        padding: '40px 24px 90px 24px',
        position: 'relative'
      }}
      id="how-it-works"
    >
      {/* Centered Editorial Section Header */}
      <div 
        style={{
          textAlign: 'center',
          maxWidth: '560px',
          margin: '0 auto 64px auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}
      >
        <div 
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '14px'
          }}
        >
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#0f172a' }} />
          <span 
            style={{
              fontFamily: 'monospace',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.22em',
              color: '#64748b',
              textTransform: 'uppercase'
            }}
          >
            Operational Architecture
          </span>
        </div>
        
        <h2 
          style={{
            fontSize: '42px',
            fontWeight: 800,
            color: '#0f172a',
            letterSpacing: '-0.03em',
            lineHeight: 1.15,
            margin: '0 0 14px 0'
          }}
        >
          How Our System Works
        </h2>
        
        <p 
          style={{
            fontSize: '15px',
            color: '#64748b',
            lineHeight: 1.6,
            margin: 0,
            fontWeight: 400
          }}
        >
          Deterministic 5-stage hydrodynamic intelligence engine.
        </p>
      </div>

      {/* Dynamic Timeline Layout with Precision Center-Axis Alignment */}
      <div 
        ref={lineContainerRef} 
        style={{ 
          position: 'relative', 
          display: 'flex', 
          flexDirection: 'column',
          gap: '56px',
          width: '100%'
        }}
      >
        {/* Continuous Vertical Tracking Line spanning the entire timeline on exact axis left: 20px */}
        <div 
          style={{
            position: 'absolute',
            top: '8px',
            bottom: '24px',
            left: '20px',
            width: '1.5px',
            backgroundColor: '#e2e8f0',
            transform: 'translateX(-50%)',
            zIndex: 1
          }} 
        />

        {/* Dynamic Fill: Solid Black line that grows downward with scroll on exact axis left: 20px */}
        <div 
          style={{
            position: 'absolute',
            top: '8px',
            left: '20px',
            width: '1.5px',
            backgroundColor: '#000000',
            transform: 'translateX(-50%)',
            height: `${scrollProgress}%`,
            maxHeight: 'calc(100% - 32px)',
            transition: 'height 0.08s ease-out',
            boxShadow: '0 0 4px rgba(0,0,0,0.4)',
            zIndex: 2
          }}
        />

        {/* Traveling tracker bead precisely centered at left: 20px */}
        {scrollProgress > 2 && scrollProgress < 98 && (
          <div 
            style={{
              position: 'absolute',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#000000',
              border: '1.5px solid #ffffff',
              left: '20px',
              transform: 'translate(-50%, -50%)',
              top: `calc(8px + ${(scrollProgress / 100) * (lineContainerRef.current ? lineContainerRef.current.clientHeight - 32 : 0)}px)`,
              pointerEvents: 'none',
              boxShadow: '0 0 8px rgba(0,0,0,0.5)',
              zIndex: 15
            }}
          />
        )}

        {/* Timeline Points */}
        {TIMELINE_POINTS.map((pt, idx) => {
          const targetRatio = (idx + 0.12) / TIMELINE_POINTS.length
          const isPassed = (scrollProgress / 100) >= targetRatio
          const isHovered = hoveredIndex === idx

          return (
            <div 
              key={pt.index}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                position: 'relative',
                zIndex: 5
              }}
            >
              {/* 40px Center Column: Big Circle is DEAD-CENTER at left: 20px */}
              <div 
                style={{
                  width: '40px',
                  height: '24px',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative'
                }}
              >
                <div 
                  style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    backgroundColor: isPassed ? '#000000' : '#ffffff',
                    border: isPassed ? 'none' : '1.5px solid #cbd5e1',
                    boxShadow: isPassed ? '0 0 10px rgba(0,0,0,0.45)' : 'none',
                    transform: isPassed ? 'scale(1.15)' : 'scale(1)',
                    transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                    zIndex: 6
                  }}
                />
              </div>

              {/* Text Content Column */}
              <div 
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
                style={{
                  flex: 1,
                  paddingLeft: '16px',
                  transition: 'opacity 0.25s ease, transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                  opacity: isPassed ? 1 : 0.42,
                  transform: isHovered ? 'translateX(4px)' : 'translateX(0)',
                  cursor: 'default'
                }}
              >
                {/* Minimal Stage Label */}
                <div 
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '6px'
                  }}
                >
                  <span 
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      color: isPassed ? '#000000' : '#94a3b8'
                    }}
                  >
                    {pt.index}
                  </span>
                  <span style={{ color: '#cbd5e1', fontSize: '11px' }}>&bull;</span>
                  <span 
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '10px',
                      fontWeight: 700,
                      letterSpacing: '0.14em',
                      color: isPassed ? '#475569' : '#94a3b8',
                      textTransform: 'uppercase'
                    }}
                  >
                    STAGE {pt.stage}
                  </span>
                </div>

                {/* Concise Heading */}
                <h3 
                  style={{
                    fontSize: '20px',
                    fontWeight: 700,
                    letterSpacing: '-0.02em',
                    color: isPassed ? '#0f172a' : '#475569',
                    margin: '0 0 6px 0',
                    lineHeight: 1.25,
                    transition: 'color 0.25s'
                  }}
                >
                  {pt.title}
                </h3>

                {/* Single Short 1-Line Description */}
                <p 
                  style={{
                    fontSize: '14.5px',
                    color: isPassed ? '#475569' : '#64748b',
                    lineHeight: 1.55,
                    margin: 0,
                    maxWidth: '540px',
                    transition: 'color 0.25s'
                  }}
                >
                  {pt.description}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Minimalist Terminal Link with 70px Top Margin */}
      <div 
        style={{
          marginTop: '72px',
          paddingTop: '32px',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px'
        }}
      >
        <div>
          <span 
            style={{
              fontSize: '10.5px',
              fontFamily: 'monospace',
              fontWeight: 600,
              color: '#94a3b8',
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              display: 'block',
              marginBottom: '4px'
            }}
          >
            250m Macro Grid Intelligence
          </span>
          <p 
            style={{
              fontSize: '13.5px',
              fontWeight: 500,
              color: '#1e293b',
              margin: 0
            }}
          >
            Deterministic hydrodynamic calculations across 1,998 Amritsar cells.
          </p>
        </div>
        
        <Link
          href="/city/amritsar"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 22px',
            borderRadius: '9999px',
            backgroundColor: '#0f172a',
            color: '#ffffff',
            fontWeight: 700,
            fontSize: '12px',
            textDecoration: 'none',
            boxShadow: '0 2px 8px rgba(15,23,42,0.18)',
            transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
            whiteSpace: 'nowrap',
            cursor: 'pointer'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = '#000000'
            e.currentTarget.style.transform = 'translateY(-2px)'
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(15,23,42,0.25)'
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = '#0f172a'
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(15,23,42,0.18)'
          }}
          onMouseDown={(e) => {
            e.currentTarget.style.transform = 'scale(0.97)'
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)'
          }}
        >
          <span>Launch 250m Grid Console</span>
          <ArrowUpRight style={{ width: '13px', height: '13px' }} />
        </Link>
      </div>
    </section>
  )
}
