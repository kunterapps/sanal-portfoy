import { describe, expect, it } from 'vitest';
import { generateStandaloneHtml, toInlineScriptJson } from '../utils/standaloneHtmlGenerator';
import { makeAsset, RATES } from './fixtures';

describe('toInlineScriptJson', () => {
  it('cannot close the surrounding script tag', () => {
    const json = toInlineScriptJson({ notes: '</script><script>alert(1)</script>' });
    expect(json).not.toContain('</script>');
    expect(JSON.parse(json)).toEqual({ notes: '</script><script>alert(1)</script>' });
  });
});

describe('generateStandaloneHtml', () => {
  it('embeds assets safely', () => {
    const html = generateStandaloneHtml([makeAsset({ notes: '</script><img src=x onerror=alert(1)>' })], RATES);
    expect(html.match(/<\/script>/g)?.length).toBe(html.match(/<script\b/g)?.length);
  });
});

describe('standalone export data', () => {
  it('embeds recorded snapshots and no hard-coded daily change', () => {
    const snapshot = { date: '2026-10-23', timestamp: 0, totalValueTRY: 1, totalValueUSD: 1, totalCostTRY: 1, totalCostUSD: 1 };
    const html = generateStandaloneHtml([makeAsset()], RATES, [snapshot]);
    expect(html).toContain('"2026-10-23"');
    expect(html).not.toContain('0.0084');
    expect(html).not.toContain('0.84%');
  });
});
