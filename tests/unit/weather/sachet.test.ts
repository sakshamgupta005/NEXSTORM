import { describe, it, expect } from 'vitest';
import { parseSachetRss, isPunjabAlert } from '@/lib/weather/sachet';
import fs from 'node:fs';
import path from 'node:path';

describe('SACHET RSS Alert Adapter & Regional Filter', () => {
  const realSachetXml = fs.readFileSync(path.resolve(__dirname, '../../fixtures/sachet.xml'), 'utf-8');

  it('parses real SACHET RSS fixture into structured SachetAlert records', () => {
    const alerts = parseSachetRss(realSachetXml);

    expect(alerts.length).toBeGreaterThan(0);
    const first = alerts[0];
    expect(first.id).toBeDefined();
    expect(first.event).toBeDefined();
    expect(first.link).toContain('https://sachet.ndma.gov.in');
    expect(first.author).toBeDefined();
  });

  it('handles empty feed safely returning empty array', () => {
    const emptyRss = `<?xml version="1.0"?><rss version="2.0"><channel><title>Empty</title></channel></rss>`;
    const alerts = parseSachetRss(emptyRss);
    expect(alerts).toEqual([]);
  });

  it('handles completely malformed XML safely without throwing', () => {
    const brokenXml = `<channel><broken<item><title>Unclosed`;
    const alerts = parseSachetRss(brokenXml);
    expect(Array.isArray(alerts)).toBe(true);
  });

  it('unwraps CDATA sections properly in titles and descriptions', () => {
    const cdataXml = `
      <rss version="2.0">
        <channel>
          <item>
            <title><![CDATA[Heavy rainfall advisory for Amritsar district]]></title>
            <guid>test-101</guid>
            <author>controlroom@ndma.gov.in (Punjab SDMA)</author>
          </item>
        </channel>
      </rss>
    `;

    const alerts = parseSachetRss(cdataXml);
    expect(alerts.length).toBe(1);
    expect(alerts[0].event).toBe('Heavy rainfall advisory for Amritsar district');
    expect(alerts[0].author).toBe('controlroom@ndma.gov.in (Punjab SDMA)');
  });

  describe('Punjab regional filtering', () => {
    it('accepts alerts explicitly mentioning Punjab in author or title', () => {
      expect(isPunjabAlert({
        author: 'controlroom@ndma.gov.in (Punjab SDMA)',
        event: 'Thunderstorm advisory',
      })).toBe(true);

      expect(isPunjabAlert({
        author: 'controlroom@ndma.gov.in (IMD Chandigarh)',
        event: 'Severe waterlogging warning for Punjab plains',
      })).toBe(true);
    });

    it('accepts alerts referencing specific Punjab districts', () => {
      expect(isPunjabAlert({
        author: 'controlroom@ndma.gov.in (IMD)',
        event: 'Heavy downpour expected across Amritsar and Tarn Taran',
      })).toBe(true);

      expect(isPunjabAlert({
        author: 'controlroom@ndma.gov.in (IMD Chandigarh)',
        areaDescription: 'Isolated waterlogging likely in Ludhiana and Jalandhar urban zones',
      })).toBe(true);
    });

    it('rejects alerts from other states or vague titles without Punjab relevance', () => {
      expect(isPunjabAlert({
        author: 'controlroom@ndma.gov.in (Andhra Pradesh SDMA)',
        event: 'Thunderstorm warning for coastal districts',
      })).toBe(false);

      expect(isPunjabAlert({
        author: 'controlroom@ndma.gov.in (IMD Jaipur)',
        event: 'Dust storm over Bikaner and Jodhpur',
      })).toBe(false);

      expect(isPunjabAlert({
        author: 'controlroom@ndma.gov.in (IMD)',
        event: 'Moderate rainfall likely in some parts',
      })).toBe(false);
    });
  });
});
