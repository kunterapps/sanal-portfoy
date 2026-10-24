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
