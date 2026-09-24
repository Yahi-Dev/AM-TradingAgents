/**
 * Unit test — design token values (US-UI-0001 AC-03, AC-04).
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const tokensPath = path.resolve(__dirname, '../../src/styles/design-tokens.css');
const css = fs.readFileSync(tokensPath, 'utf-8');

describe('Design Tokens — US-UI-0001', () => {
  it('AC-04: --bg-0 is #0A0B0D', () => {
    expect(css).toMatch(/--bg-0:\s*#0A0B0D/i);
  });

  it('AC-03: --amber is defined', () => {
    expect(css).toMatch(/--amber:\s*#[0-9A-Fa-f]{6}/);
  });

  it('AC-03: --teal is defined', () => {
    expect(css).toMatch(/--teal:\s*#[0-9A-Fa-f]{6}/);
  });

  it('AC-03: --green is defined', () => {
    expect(css).toMatch(/--green:\s*#[0-9A-Fa-f]{6}/);
  });

  it('AC-03: --rose is defined', () => {
    expect(css).toMatch(/--rose:\s*#[0-9A-Fa-f]{6}/);
  });

  it('AC-03: soft variants exist for amber, teal, green, rose', () => {
    expect(css).toMatch(/--amber-soft/);
    expect(css).toMatch(/--teal-soft/);
    expect(css).toMatch(/--green-soft/);
    expect(css).toMatch(/--rose-soft/);
  });

  it('AC-03: typography — Space Grotesk for UI', () => {
    expect(css).toMatch(/--font-ui:\s*'Space Grotesk'/);
  });

  it('AC-03: typography — IBM Plex Mono for numbers', () => {
    expect(css).toMatch(/--font-mono:\s*'IBM Plex Mono'/);
  });

  it('AC-01: layout constants — rail 72px, topbar 64px', () => {
    expect(css).toMatch(/--rail-width:\s*72px/);
    expect(css).toMatch(/--topbar-height:\s*64px/);
  });
});