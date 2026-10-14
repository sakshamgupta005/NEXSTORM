/**
 * src/lib/weather/sachet.ts
 * NDMA SACHET RSS feed adapter for official disaster alerts.
 * Features safe zero-dependency XML parsing, Punjab regional filtering, and provenance tracking.
 */

import { createApiClient } from '../api/client';
import { recordSourceSuccess, recordSourceFailure } from './source-tracker';
import type { SachetAlert, WeatherAdapterResult } from './types';
import type { Provenance } from '../risk/types';

export function getSachetRssUrl(): string {
  return process.env.SACHET_RSS_URL || 'https://sachet.ndma.gov.in/cap_public_website/rss/rss_india.xml';
}

/**
 * Standard list of Punjab districts and governing authorities for verified regional filtering.
 */
const PUNJAB_DISTRICTS = new Set([
  'amritsar', 'barnala', 'bathinda', 'faridkot', 'fatehgarh sahib', 'fazilka',
  'ferozepur', 'gurdaspur', 'hoshiarpur', 'jalandhar', 'kapurthala', 'ludhiana',
  'malerkotla', 'mansa', 'moga', 'muktsar', 'pathankot', 'patiala', 'rupnagar',
  'ropar', 'mohali', 'sas nagar', 'sangrur', 'nawanshahr', 'sbs nagar', 'tarn taran'
]);

/**
 * Evaluates whether an alert unambiguously applies to the State of Punjab.
 */
export function isPunjabAlert(alert: Partial<SachetAlert>): boolean {
  const author = (alert.author || '').toLowerCase();
  const title = (alert.event || '').toLowerCase();
  const areaDesc = (alert.areaDescription || '').toLowerCase();

  // Explicit Punjab SDMA or Punjab government alerts
  if (author.includes('punjab') || author.includes('punjab sdma')) return true;

  // IMD Chandigarh issues alerts for Punjab and Chandigarh
  if (author.includes('imd chandigarh') || author.includes('chandigarh')) {
    // If issued by IMD Chandigarh, check if title or areaDesc mentions Punjab or a Punjab district
    if (title.includes('punjab') || areaDesc.includes('punjab')) return true;
    for (const dist of PUNJAB_DISTRICTS) {
      if (title.includes(dist) || areaDesc.includes(dist)) return true;
    }
    return false;
  }

  // Check if title or area description explicitly mentions Punjab or any Punjab district
  if (title.includes('punjab') || areaDesc.includes('punjab')) return true;

  for (const dist of PUNJAB_DISTRICTS) {
    // Word boundary check to avoid false partial matches
    const regex = new RegExp(`\\b${dist}\\b`, 'i');
    if (regex.test(title) || regex.test(areaDesc)) {
      return true;
    }
  }

  return false;
}

/**
 * Safe tag extractor that avoids regex catastrophic backtracking.
 */
function extractTagContent(xmlSnippet: string, tagName: string): string | undefined {
  const openTag = `<${tagName}`;
  const closeTag = `</${tagName}>`;

  const startIdx = xmlSnippet.indexOf(openTag);
  if (startIdx === -1) return undefined;

  const contentStart = xmlSnippet.indexOf('>', startIdx) + 1;
  if (contentStart === 0) return undefined;

  const endIdx = xmlSnippet.indexOf(closeTag, contentStart);
  if (endIdx === -1) return undefined;

  let raw = xmlSnippet.slice(contentStart, endIdx).trim();

  // Strip CDATA wrapper if present
  if (raw.startsWith('<![CDATA[') && raw.endsWith(']]>')) {
    raw = raw.slice(9, -3).trim();
  }

  return raw;
}

/**
 * Parses raw RSS/XML string into an array of SachetAlert objects.
 * Handles malformed XML, missing tags, and empty feeds safely without throwing.
 */
export function parseSachetRss(xmlText: string): SachetAlert[] {
  if (typeof xmlText !== 'string' || !xmlText.trim()) {
    return [];
  }

  const items: SachetAlert[] = [];
  const itemRegex = /<item[\s>]([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(xmlText)) !== null) {
    const itemBlock = match[1];
    if (!itemBlock) continue;

    const guid = extractTagContent(itemBlock, 'guid') || '';
    const title = extractTagContent(itemBlock, 'title') || '';
    const description = extractTagContent(itemBlock, 'description') || '';
    const link = extractTagContent(itemBlock, 'link') || '';
    const author = extractTagContent(itemBlock, 'author') || '';
    const category = extractTagContent(itemBlock, 'category');
    const pubDate = extractTagContent(itemBlock, 'pubDate');

    // Also look for CAP tags if present
    const capEvent = extractTagContent(itemBlock, 'cap:event');
    const capSeverity = extractTagContent(itemBlock, 'cap:severity');
    const capArea = extractTagContent(itemBlock, 'cap:areaDesc');
    const capEffective = extractTagContent(itemBlock, 'cap:effective');
    const capExpires = extractTagContent(itemBlock, 'cap:expires');

    const effectiveDate = capEffective
      ? new Date(capEffective).toISOString()
      : (pubDate ? new Date(pubDate).toISOString() : undefined);

    const alert: SachetAlert = {
      id: guid || `alert-${items.length + 1}`,
      event: capEvent || title || 'Weather Alert',
      severity: capSeverity || category || 'Unknown',
      areaDescription: capArea || description || undefined,
      effective: effectiveDate,
      expires: capExpires ? new Date(capExpires).toISOString() : undefined,
      link: link || undefined,
      author: author || undefined,
    };

    items.push(alert);
  }

  return items;
}

/**
 * Fetches and parses official SACHET alerts.
 */
export async function fetchSachetAlerts(options?: {
  stateFilter?: string;
  url?: string;
}): Promise<WeatherAdapterResult<SachetAlert[]>> {
  const url = options?.url || getSachetRssUrl();
  const filterState = options?.stateFilter?.toLowerCase();

  const client = createApiClient({
    baseUrl: url,
    timeoutMs: 8000,
    retries: 2,
    retryDelayMs: 500,
  });

  try {
    const res = await client.get<string>(url);

    if (!res.ok || typeof res.data !== 'string') {
      throw new Error(res.error || `SACHET RSS returned status ${res.status}`);
    }

    const allAlerts = parseSachetRss(res.data);

    // Apply state filter if requested
    let filteredAlerts = allAlerts;
    if (filterState === 'punjab') {
      filteredAlerts = allAlerts.filter(isPunjabAlert);
    }

    recordSourceSuccess('NDMA SACHET RSS');

    const provenance: Provenance = {
      kind: 'official',
      source: 'NDMA SACHET CAP Alerts Feed',
      fetchedAt: new Date().toISOString(),
      note: 'OFFICIAL ALERTS — National Disaster Management Authority (CAP RSS). Unmodified government notices.',
    };

    return {
      status: 'ok',
      data: filteredAlerts,
      provenance,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    recordSourceFailure('NDMA SACHET RSS', errorMsg);

    const degradedProvenance: Provenance = {
      kind: 'official',
      source: 'NDMA SACHET RSS (Unavailable)',
      fetchedAt: new Date().toISOString(),
      note: `DEGRADED — Failed to fetch official alerts from SACHET: ${errorMsg}`,
    };

    return {
      status: 'unavailable',
      data: [],
      provenance: degradedProvenance,
      error: errorMsg,
    };
  }
}
