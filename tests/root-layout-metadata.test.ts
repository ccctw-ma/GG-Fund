import { describe, expect, it } from 'vitest';
import { metadata } from '../app/layout';

describe('root layout metadata', () => {
  it('uses the GG brand mark as the browser favicon', () => {
    expect(metadata.icons).toMatchObject({
      icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
      shortcut: ['/icon.svg'],
      apple: [{ url: '/apple-icon.png', sizes: '180x180', type: 'image/png' }],
    });
  });
});
