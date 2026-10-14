import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { GET as handleRiskGet } from '@/app/api/risk/route'

describe('Golden Replay Risk Assessment Tests (2025-09-01_amritsar)', () => {
  const replayPath = path.resolve(
    process.cwd(),
    'public',
    'data',
    'replay',
    '2025-09-01_amritsar.json'
  )
  const rawReplay = fs.readFileSync(replayPath, 'utf-8')
  const replayData = JSON.parse(rawReplay)

  const testHours = [0, 1, 2]

  for (const h of testHours) {
    const expected = replayData.hourly[h].goldenOutputs

    it(`matches golden reference outputs for hour t=${h} (${replayData.hourly[h].timestamp})`, async () => {
      const url = `http://localhost:3000/api/risk?cityId=amritsar&mode=replay&event=2025-09-01_amritsar&t=${h}`
      const req = new NextRequest(url, { method: 'GET' })

      const res = await handleRiskGet(req)
      expect(res.status).toBe(200)

      const json = await res.json()
      expect(json.success).toBe(true)

      const data = json.data
      expect(data.mode).toBe('replay')
      expect(data.cityId).toBe('amritsar')
      expect(data.status).toBe('ok')

      // 1. Verify RTI band and median RTI
      expect(data.selectedHour.band).toBe(expected.rtiBand)
      expect(data.selectedHour.medianRti).toBeCloseTo(expected.medianRti, 4)

      // 2. Verify exact class shares
      expect(data.selectedHour.classShare.low).toBeCloseTo(expected.classShares.low, 4)
      expect(data.selectedHour.classShare.moderate).toBeCloseTo(expected.classShares.moderate, 4)
      expect(data.selectedHour.classShare.high).toBeCloseTo(expected.classShares.high, 4)

      // 3. Verify deterministic single forecast -> confidence is unavailable
      expect(data.selectedHour.confidence).toBe('unavailable')
      expect(data.selectedHour.hasEnsemble).toBe(false)

      // 4. Verify replay provenance
      const replayProv = data.provenance.find((p: { kind: string }) => p.kind === 'replay')
      expect(replayProv).toBeDefined()
      expect(replayProv.kind).toBe('replay')
      expect(replayProv.note).toBe('replay uses a single forecast')

      // 5. Verify derived susceptibility provenance carries canonical configHash
      const suscProv = data.provenance.find((p: { source: string }) => p.source === 'susceptibility')
      expect(suscProv).toBeDefined()
      expect(suscProv.kind).toBe('derived')
      expect(suscProv.note).toBe('74f463261a4c15cdc850b8d5be687bee4e59fd2950b7b93395449f3dacefcd49')

      // 6. Verify permanent disclaimer string
      expect(data.disclaimer).toBe(
        'Experimental research prototype. Not an official weather forecast or emergency warning. For official alerts see IMD and NDMA SACHET.'
      )
    })
  }
})
