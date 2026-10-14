/**
 * scripts/probe-sources.mjs
 * Probes external weather and alert sources for Amritsar (31.63 N, 74.87 E)
 * Saves sanitized fixtures under tests/fixtures/openmeteo/ and tests/fixtures/
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const AMRITSAR = {
  lat: 31.63,
  lon: 74.87,
  timezone: 'Asia/Kolkata',
};

const FIXTURES_DIR = path.join(ROOT, 'tests', 'fixtures');
const OPENMETEO_FIXTURES_DIR = path.join(FIXTURES_DIR, 'openmeteo');

fs.mkdirSync(OPENMETEO_FIXTURES_DIR, { recursive: true });

const results = [];

async function probeSource({ name, url, parser, validator, fixturePath, note }) {
  const start = Date.now();
  let status = 'UNKNOWN';
  let latency = 0;
  let keySummary = '';
  let validShape = false;
  let fixtureSaved = false;
  let errorMsg = '';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'NEXSTORM-Probe/1.0 (Hackathon-Prototype)',
        'Accept': 'application/json, application/xml, text/xml, */*',
      },
    });
    clearTimeout(timeout);

    latency = Date.now() - start;
    status = `HTTP ${res.status}`;

    if (!res.ok) {
      errorMsg = `Status ${res.status} ${res.statusText}`;
    } else {
      const text = await res.text();
      const parsed = parser(text);
      const validation = validator(parsed);
      validShape = validation.valid;
      keySummary = validation.summary;

      if (validShape && fixturePath) {
        fs.writeFileSync(fixturePath, typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2), 'utf-8');
        fixtureSaved = true;
      }
    }
  } catch (err) {
    latency = Date.now() - start;
    status = err.name === 'AbortError' ? 'TIMEOUT (10s)' : 'UNREACHABLE';
    errorMsg = err.message;
  }

  results.push({
    name,
    url,
    status,
    latency: `${latency}ms`,
    shapeValid: validShape ? 'YES' : 'NO',
    fixtureSaved: fixtureSaved ? 'YES' : 'NO',
    keys: keySummary || errorMsg || 'N/A',
    note: note || '',
  });
}

async function run() {
  console.log(`\n======================================================`);
  console.log(` NEXSTORM External Source Probe — Amritsar (${AMRITSAR.lat}°N, ${AMRITSAR.lon}°E)`);
  console.log(` Timezone: ${AMRITSAR.timezone}`);
  console.log(`======================================================\n`);

  // 1. Open-Meteo Forecast API
  const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${AMRITSAR.lat}&longitude=${AMRITSAR.lon}&hourly=precipitation,rain&forecast_days=3&past_days=1&timezone=${encodeURIComponent(AMRITSAR.timezone)}`;
  await probeSource({
    name: 'Open-Meteo Forecast',
    url: forecastUrl,
    parser: (t) => JSON.parse(t),
    validator: (data) => {
      const valid = Boolean(data?.hourly?.time && (data?.hourly?.precipitation || data?.hourly?.rain));
      const keys = data?.hourly ? Object.keys(data.hourly).join(', ') : 'none';
      return { valid, summary: `hourly: [${keys}] (${data?.hourly?.time?.length || 0} hrs)` };
    },
    fixturePath: path.join(OPENMETEO_FIXTURES_DIR, 'forecast.json'),
    note: 'Deterministic forecast + 1 past day',
  });

  // 2. Open-Meteo Ensemble API (try ecmwf_ifs025 first, then gfs025)
  let ensembleSuccess = false;
  const ensembleEcmwfUrl = `https://ensemble-api.open-meteo.com/v1/ensemble?latitude=${AMRITSAR.lat}&longitude=${AMRITSAR.lon}&models=ecmwf_ifs025&hourly=precipitation&forecast_days=3&timezone=${encodeURIComponent(AMRITSAR.timezone)}`;
  await probeSource({
    name: 'Open-Meteo Ensemble (ECMWF)',
    url: ensembleEcmwfUrl,
    parser: (t) => JSON.parse(t),
    validator: (data) => {
      const memberKeys = data?.hourly ? Object.keys(data.hourly).filter((k) => k.startsWith('precipitation')) : [];
      const valid = Boolean(data?.hourly?.time && memberKeys.length > 0);
      if (valid) ensembleSuccess = true;
      return { valid, summary: `${memberKeys.length} precipitation keys (${memberKeys.slice(0, 3).join(', ')}...)` };
    },
    fixturePath: path.join(OPENMETEO_FIXTURES_DIR, 'ensemble.json'),
    note: 'ecmwf_ifs025 model',
  });

  if (!ensembleSuccess) {
    const ensembleGfsUrl = `https://ensemble-api.open-meteo.com/v1/ensemble?latitude=${AMRITSAR.lat}&longitude=${AMRITSAR.lon}&models=gfs025&hourly=precipitation&forecast_days=3&timezone=${encodeURIComponent(AMRITSAR.timezone)}`;
    await probeSource({
      name: 'Open-Meteo Ensemble (GFS fallback)',
      url: ensembleGfsUrl,
      parser: (t) => JSON.parse(t),
      validator: (data) => {
        const memberKeys = data?.hourly ? Object.keys(data.hourly).filter((k) => k.startsWith('precipitation')) : [];
        const valid = Boolean(data?.hourly?.time && memberKeys.length > 0);
        return { valid, summary: `${memberKeys.length} precipitation keys` };
      },
      fixturePath: path.join(OPENMETEO_FIXTURES_DIR, 'ensemble.json'),
      note: 'gfs025 fallback model',
    });
  }

  // 3. Open-Meteo Archive API (7 days from 2024 monsoon: 2024-07-01 to 2024-07-07)
  const archiveUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${AMRITSAR.lat}&longitude=${AMRITSAR.lon}&start_date=2024-07-01&end_date=2024-07-07&hourly=precipitation&timezone=${encodeURIComponent(AMRITSAR.timezone)}`;
  await probeSource({
    name: 'Open-Meteo Archive',
    url: archiveUrl,
    parser: (t) => JSON.parse(t),
    validator: (data) => {
      const valid = Boolean(data?.hourly?.time && data?.hourly?.precipitation);
      const len = data?.hourly?.time?.length || 0;
      return { valid, summary: `hourly.precipitation: ${len} hrs (2024-07-01..07)` };
    },
    fixturePath: path.join(OPENMETEO_FIXTURES_DIR, 'archive.json'),
    note: 'ERA5/ERA5-Land reanalysis archive',
  });

  // 4. Open-Meteo Historical Forecast API
  const histForecastUrl = `https://historical-forecast-api.open-meteo.com/v1/forecast?latitude=${AMRITSAR.lat}&longitude=${AMRITSAR.lon}&start_date=2024-07-01&end_date=2024-07-07&hourly=precipitation&timezone=${encodeURIComponent(AMRITSAR.timezone)}`;
  await probeSource({
    name: 'Open-Meteo Historical Forecast',
    url: histForecastUrl,
    parser: (t) => JSON.parse(t),
    validator: (data) => {
      const valid = Boolean(data?.hourly?.time && data?.hourly?.precipitation);
      const len = data?.hourly?.time?.length || 0;
      return { valid, summary: `hourly.precipitation: ${len} hrs (archived forecasts)` };
    },
    fixturePath: path.join(OPENMETEO_FIXTURES_DIR, 'historical_forecast.json'),
    note: 'Past forecast runs archive',
  });

  // 5. NDMA SACHET RSS
  const sachetUrl = `https://sachet.ndma.gov.in/cap_public_website/rss/rss_india.xml`;
  await probeSource({
    name: 'NDMA SACHET RSS',
    url: sachetUrl,
    parser: (t) => t,
    validator: (xml) => {
      const isXml = typeof xml === 'string' && (xml.includes('<rss') || xml.includes('<feed') || xml.includes('<channel'));
      const itemCount = (xml.match(/<item[\s>]/gi) || []).length;
      return { valid: isXml, summary: `XML RSS feed (${itemCount} items found)` };
    },
    fixturePath: path.join(FIXTURES_DIR, 'sachet.xml'),
    note: 'National Disaster Management Authority CAP alerts',
  });

  console.log('Results Summary:');
  console.table(results.map(r => ({
    Source: r.name,
    Status: r.status,
    Latency: r.latency,
    'Shape Valid': r.shapeValid,
    'Fixture Saved': r.fixtureSaved,
    'Keys / Details': r.keys.length > 50 ? r.keys.slice(0, 47) + '...' : r.keys,
  })));

  console.log('\nProbe completed safely.\n');
}

run().catch((err) => {
  console.error('Probe encountered unexpected error:', err);
  process.exit(1);
});
