'use client'

import React from 'react'
import { Activity, ShieldCheck, CheckCircle2, Navigation, Layers, Building } from 'lucide-react'

export function HeroTelemetryCard() {
  return (
    <div 
      style={{
        width: '100%',
        maxWidth: '370px',
        backgroundColor: '#ffffff',
        borderRadius: '24px',
        border: '1px solid rgba(226, 232, 240, 0.95)',
        padding: '24px 24px',
        boxShadow: '0 4px 20px -4px rgba(15, 23, 42, 0.05), 0 20px 40px -10px rgba(15, 23, 42, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.95)',
        transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        position: 'relative',
        cursor: 'default'
      }}
      className="hover:-translate-y-1 hover:shadow-xl active:scale-[0.99]"
    >
      {/* Top Header Row with Live Pulse */}
      <div 
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: '16px',
          marginBottom: '16px',
          borderBottom: '1px solid #f1f5f9'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ position: 'relative', width: '8px', height: '8px' }}>
            <span 
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                backgroundColor: '#10b981',
                opacity: 0.75,
                animation: 'pulseGlow 2s infinite ease-in-out'
              }}
            />
            <span 
              style={{
                position: 'relative',
                display: 'block',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#059669'
              }}
            />
          </div>
          <div>
            <span 
              style={{
                fontSize: '11px',
                fontFamily: 'monospace',
                fontWeight: 800,
                color: '#0f172a',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                display: 'block',
                lineHeight: 1.2
              }}
            >
              NEXSTORM Solution Mesh
            </span>
            <span 
              style={{
                fontSize: '10.5px',
                color: '#64748b',
                display: 'block'
              }}
            >
              Amritsar 250m Early-Warning
            </span>
          </div>
        </div>

        <span 
          style={{
            padding: '3px 8px',
            borderRadius: '9999px',
            backgroundColor: '#0f172a',
            color: '#ffffff',
            fontSize: '9.5px',
            fontFamily: 'monospace',
            fontWeight: 800,
            letterSpacing: '0.08em'
          }}
        >
          LIVE
        </span>
      </div>

      {/* Primary Gauge: Modeled Water Depth */}
      <div 
        style={{
          padding: '16px 18px',
          backgroundColor: '#f8fafc',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          marginBottom: '16px'
        }}
      >
        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '6px'
          }}
        >
          <span 
            style={{
              fontSize: '10.5px',
              fontFamily: 'monospace',
              fontWeight: 700,
              color: '#64748b',
              textTransform: 'uppercase',
              letterSpacing: '0.04em'
            }}
          >
            Modeled Inundation Depth
          </span>
          <span 
            style={{
              padding: '2px 8px',
              borderRadius: '9999px',
              fontSize: '9.5px',
              fontFamily: 'monospace',
              fontWeight: 700,
              backgroundColor: '#fef2f2',
              color: '#b91c1c',
              border: '1px solid #fecaca'
            }}
          >
            Critical Sump
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '8px' }}>
          <span 
            style={{
              fontSize: '30px',
              fontWeight: 900,
              fontFamily: 'monospace',
              color: '#0f172a',
              letterSpacing: '-0.03em',
              lineHeight: 1
            }}
          >
            34.2 cm
          </span>
          <span style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>
            Hall Gate Basin &bull; 66 mm/h
          </span>
        </div>

        {/* Dynamic Water-Level Bar */}
        <div 
          style={{
            width: '100%',
            height: '6px',
            borderRadius: '9999px',
            backgroundColor: '#e2e8f0',
            overflow: 'hidden'
          }}
        >
          <div 
            style={{
              width: '76%',
              height: '100%',
              background: 'linear-gradient(90deg, #3b82f6 0%, #1d4ed8 70%, #0f172a 100%)',
              borderRadius: '9999px'
            }}
          />
        </div>
      </div>

      {/* Solution Pillars Breakdown: 3 Core Capabilities */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            borderRadius: '12px',
            backgroundColor: '#ffffff',
            border: '1px solid #f1f5f9'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers style={{ width: '13px', height: '13px', color: '#2563eb' }} />
            <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#334155' }}>
              Terrain Hydrology
            </span>
          </div>
          <span style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: 700, color: '#0f172a' }}>
            Copernicus 30m DEM
          </span>
        </div>

        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            borderRadius: '12px',
            backgroundColor: '#ffffff',
            border: '1px solid #f1f5f9'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building style={{ width: '13px', height: '13px', color: '#059669' }} />
            <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#334155' }}>
              Building Exposure
            </span>
          </div>
          <span style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: 700, color: '#0f172a' }}>
            360,252 Footprints
          </span>
        </div>

        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            borderRadius: '12px',
            backgroundColor: '#ffffff',
            border: '1px solid #f1f5f9'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Navigation style={{ width: '13px', height: '13px', color: '#d97706' }} />
            <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#334155' }}>
              A* Route Diverter
            </span>
          </div>
          <span style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: 700, color: '#059669' }}>
            1.8 ms Latency
          </span>
        </div>
      </div>

      {/* Footer Info Row */}
      <div 
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: '12px',
          borderTop: '1px solid #f1f5f9',
          fontSize: '10.5px',
          fontFamily: 'monospace',
          color: '#64748b'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <CheckCircle2 style={{ width: '13px', height: '13px', color: '#059669' }} />
          <span>Deterministic Solver: Ready</span>
        </div>
        <span>1,998 Grid Cells</span>
      </div>
    </div>
  )
}
