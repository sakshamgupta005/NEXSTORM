import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import {
  type ValueSourceCategory,
  ValueMetaPresets,
} from '@/lib/metadata'
import { GET as handleRainfallGet } from '@/app/api/rainfall/route'
import { GET as handleRiskGet } from '@/app/api/risk/route'
import { GET as handleOfficialAlertsGet } from '@/app/api/official-alerts/route'
import { GET as handleObservationsGet } from '@/app/api/observations/route'
import { GET as handleEvaluationGet } from '@/app/api/evaluation/route'
import { GET as handleRoadsRiskGet } from '@/app/api/roads/risk/route'
import { GET as handleBuildingsGet } from '@/app/api/buildings/route'

describe('Value-Level Human-Readable Metadata & Warnings', () => {
  describe('ValueMetaPresets category and phrasing compliance', () => {
    it('covers all five source categories with valid status values', () => {
      const validStatuses: ValueSourceCategory[] = [
        'Observed',
        'Historical reanalysis',
        'Estimated',
        'Simulated value',
        'Unavailable',
      ]

      const metaObserved = ValueMetaPresets.officialAlert()
      const metaReanalysis = ValueMetaPresets.historicalReanalysis('Past Rainfall')
      const metaEstimated = ValueMetaPresets.susceptibility()
      const metaSimulated = ValueMetaPresets.rainfall24h('scenario')
      const metaUnavailable = ValueMetaPresets.unavailable('Missing Metric', 'No data feed')

      expect(validStatuses).toContain(metaObserved.status)
      expect(validStatuses).toContain(metaReanalysis.status)
      expect(validStatuses).toContain(metaEstimated.status)
      expect(validStatuses).toContain(metaSimulated.status)
      expect(validStatuses).toContain(metaUnavailable.status)

      expect(metaObserved.status).toBe('Observed')
      expect(metaReanalysis.status).toBe('Historical reanalysis')
      expect(metaEstimated.status).toBe('Estimated')
      expect(metaSimulated.status).toBe('Simulated value')
      expect(metaUnavailable.status).toBe('Unavailable')
    })

    it('explains susceptibility as relative propensity, not calibrated probability or flood depth', () => {
      const meta = ValueMetaPresets.susceptibility()
      expect(meta.label).toBe('Relative Waterlogging Susceptibility')
      expect(meta.explanation.toLowerCase()).toContain('relative susceptibility')
      expect(meta.explanation.toLowerCase()).toContain('not a flood depth')
      expect(meta.explanation.toLowerCase()).toContain('calibrated probability')
    })

    it('explains historical reanalysis as atmospheric reconstruction, not in-situ gauge observation', () => {
      const meta = ValueMetaPresets.historicalReanalysis('ERA5 Reanalysis')
      expect(meta.explanation.toLowerCase()).toContain('reconstruction')
      expect(meta.explanation.toLowerCase()).toContain('not a direct rain-gauge')
    })

    it('distinguishes live forecast estimates, historical reanalysis, and simulated values for rainfall', () => {
      const live = ValueMetaPresets.rainfall24h('live')
      expect(live.status).toBe('Estimated')
      expect(live.explanation.toLowerCase()).toContain('numerical atmospheric prediction')

      const replay = ValueMetaPresets.rainfall24h('replay')
      expect(replay.status).toBe('Historical reanalysis')
      expect(replay.explanation.toLowerCase()).toContain('era5-land')

      const scenario = ValueMetaPresets.rainfall24h('scenario')
      expect(scenario.status).toBe('Simulated value')
      expect(scenario.explanation.toLowerCase()).toContain('synthetic')
    })

    it('clearly labels news archival reports vs municipal vs community field observations', () => {
      const news = ValueMetaPresets.observation(false, true)
      expect(news.status).toBe('Observed')
      expect(news.label).toBe('Documented News Waterlogging Report')
      expect(news.explanation.toLowerCase()).toContain('newspaper archives')

      const verified = ValueMetaPresets.observation(true, false)
      expect(verified.label).toBe('Waterlogging Field Report')
      expect(verified.source).toBe('Municipal Field Inspection')

      const community = ValueMetaPresets.observation(false, false)
      expect(community.label).toBe('Waterlogging Field Report')
      expect(community.explanation.toLowerCase()).toContain('community')
    })
  })

  describe('API Endpoints valueMeta integration', () => {
    it('GET /api/rainfall returns valueMeta with Estimated status for forecast', async () => {
      const req = new NextRequest('http://localhost:3000/api/rainfall?cityId=amritsar')
      const res = await handleRainfallGet(req)
      expect(res.status).toBe(200)

      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data.valueMeta).toBeDefined()
      expect(json.data.valueMeta.total24hMm.status).toBe('Estimated')
      expect(json.data.valueMeta.peak1hRate.status).toBe('Estimated')
      expect(json.data.valueMeta.imdCategory.status).toBe('Estimated')
    })

    it('GET /api/risk (live) returns valueMeta with Estimated status for live values', async () => {
      const req = new NextRequest('http://localhost:3000/api/risk?cityId=amritsar&mode=live')
      const res = await handleRiskGet(req)
      expect(res.status).toBe(200)

      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data.valueMeta).toBeDefined()
      expect(json.data.valueMeta.susceptibility.status).toBe('Estimated')
      expect(json.data.valueMeta.rainfall24h.status).toBe('Estimated')
      expect(json.data.valueMeta.riskClass.status).toBe('Estimated')
    })

    it('GET /api/risk (replay) returns valueMeta with Historical reanalysis status for weather and Estimated for risk', async () => {
      const req = new NextRequest('http://localhost:3000/api/risk?cityId=amritsar&mode=replay&date=2023-07-09')
      const res = await handleRiskGet(req)
      expect(res.status).toBe(200)

      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data.valueMeta).toBeDefined()
      expect(json.data.valueMeta.rainfall24h.status).toBe('Historical reanalysis')
      expect(json.data.valueMeta.rti.status).toBe('Historical reanalysis')
      expect(json.data.valueMeta.riskClass.status).toBe('Estimated')
    })

    it('GET /api/official-alerts returns valueMeta with Observed status for CAP alerts', async () => {
      const req = new NextRequest('http://localhost:3000/api/official-alerts?cityId=amritsar')
      const res = await handleOfficialAlertsGet(req)
      expect(res.status).toBe(200)

      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data.valueMeta).toBeDefined()
      expect(json.data.valueMeta.officialAlerts.status).toBe('Observed')
    })

    it('GET /api/observations returns valueMeta with Observed status and individual item metadata', async () => {
      const req = new NextRequest('http://localhost:3000/api/observations?cityId=amritsar')
      const res = await handleObservationsGet(req)
      expect(res.status).toBe(200)

      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data.valueMeta).toBeDefined()
      expect(json.data.valueMeta.observationReport.status).toBe('Observed')

      if (json.data.observations.length > 0) {
        const firstObs = json.data.observations[0]
        expect(firstObs.valueMeta).toBeDefined()
        expect(firstObs.valueMeta.status).toBe('Observed')
      }
    })

    it('GET /api/roads/risk returns valueMeta for road corridor risk', async () => {
      const req = new NextRequest('http://localhost:3000/api/roads/risk?cityId=amritsar')
      const res = await handleRoadsRiskGet(req)
      expect(res.status).toBe(200)

      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data.valueMeta).toBeDefined()
      expect(json.data.valueMeta.roadRisk.status).toBe('Estimated')
    })

    it('GET /api/buildings returns valueMeta for building catchment exposure', async () => {
      const req = new NextRequest('http://localhost:3000/api/buildings?cityId=amritsar')
      const res = await handleBuildingsGet(req)
      expect(res.status).toBe(200)

      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data.valueMeta).toBeDefined()
      expect(json.data.valueMeta.buildingExposure.status).toBe('Estimated')
    })

    it('GET /api/evaluation returns valueMeta for Amritsar backtest and Unavailable status for Jalandhar backtest', async () => {
      // Amritsar evaluation
      const reqAsr = new NextRequest('http://localhost:3000/api/evaluation?cityId=amritsar')
      const resAsr = await handleEvaluationGet(reqAsr)
      expect(resAsr.status).toBe(200)

      const jsonAsr = await resAsr.json()
      expect(jsonAsr.success).toBe(true)
      expect(jsonAsr.data.valueMeta).toBeDefined()
      expect(jsonAsr.data.valueMeta.modelPod.status).toBe('Historical reanalysis')

      // Jalandhar evaluation
      const reqJal = new NextRequest('http://localhost:3000/api/evaluation?cityId=jalandhar')
      const resJal = await handleEvaluationGet(reqJal)
      expect(resJal.status).toBe(200)

      const jsonJal = await resJal.json()
      expect(jsonJal.success).toBe(true)
      expect(jsonJal.data.valueMeta).toBeDefined()
      expect(jsonJal.data.valueMeta.evaluationStatus.status).toBe('Unavailable')
    })
  })
})
