import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
mkdirSync('tests/fixtures', { recursive: true });
for (const [name, lines] of [
  [
    'synthetic-medicine',
    [
      'SYNTHETIC TEST PACKAGE',
      'Sample package',
      'Not a real medicine',
      'LOT: DEMO-ONLY',
      'Expiry: deliberately missing',
    ],
  ],
  [
    'synthetic-receipt',
    [
      'SYNTHETIC TEST RECEIPT',
      'Synthetic pharmacy | 2026-10-01',
      'SAMPLE TAB.     2 x EUR 5.00 = 10.00',
      'SAMPLE SOAP     1 x EUR 2.00 =  2.00',
      'TOTAL EUR 12.00',
      'No real pharmacy or payment details',
    ],
  ],
] as const) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="700" height="500"><rect width="700" height="500" fill="#F7F6F2"/>${lines.map((l, i) => `<text x="36" y="${65 + i * 60}" font-family="sans-serif" font-size="24" fill="#162B2A">${l}</text>`).join('')}</svg>`;
  await sharp(Buffer.from(svg)).png().toFile(`tests/fixtures/${name}.png`);
}
