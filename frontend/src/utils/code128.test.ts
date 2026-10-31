import { code128Widths, encodableCode128 } from './code128';

/** D9 — a label a scanner cannot read is worse than none. */
it('encodes start B, the data, the checksum and stop, all in 11-module symbols', () => {
  const widths = code128Widths('ABC-1');
  // 1 start + 5 data + 1 checksum = 7 symbols of 6 widths, + 7 for stop.
  expect(widths).toHaveLength(7 * 6 + 7);
  expect(widths.slice(0, 6).reduce((a, b) => a + b, 0)).toBe(11);
  expect(widths.slice(-7).reduce((a, b) => a + b, 0)).toBe(13);
  // Start B is 211214.
  expect(widths.slice(0, 6).join('')).toBe('211214');
});

it('puts the weighted checksum before STOP ("PJJ123C" → 55)', () => {
  // 104 + 48·1 + 42·2 + 42·3 + 17·4 + 18·5 + 19·6 + 35·7 = 879; 879 mod 103 = 55,
  // whose pattern is 311321.
  const widths = code128Widths('PJJ123C');
  expect(widths.slice(-13, -7).join('')).toBe('311321');
});

it('refuses what set B cannot carry', () => {
  expect(encodableCode128('')).toBe(false);
  expect(encodableCode128('साड़ी')).toBe(false);
  expect(code128Widths('साड़ी')).toEqual([]);
});
