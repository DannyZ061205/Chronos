#!/usr/bin/env node

/**
 * Simple icon generator for Chronos extension
 * Creates placeholder PNG icons using Node.js
 * 
 * Run: node scripts/generate-icons.js
 */

const fs = require('fs');
const path = require('path');

// SVG template for icons
const generateSVG = (size) => `
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#3b82f6;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#2563eb;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${size * 0.2}" fill="url(#grad)"/>
  <circle cx="${size * 0.5}" cy="${size * 0.5}" r="${size * 0.35}" fill="none" stroke="white" stroke-width="${size * 0.08}"/>
  <line x1="${size * 0.5}" y1="${size * 0.3}" x2="${size * 0.5}" y2="${size * 0.5}" stroke="white" stroke-width="${size * 0.08}" stroke-linecap="round"/>
  <line x1="${size * 0.5}" y1="${size * 0.5}" x2="${size * 0.65}" y2="${size * 0.65}" stroke="white" stroke-width="${size * 0.08}" stroke-linecap="round"/>
</svg>
`;

const iconsDir = path.join(__dirname, '..', 'public', 'icons');

// Create icons directory if it doesn't exist
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Generate SVG files
const sizes = [16, 32, 48, 128];

sizes.forEach(size => {
  const svg = generateSVG(size);
  const filename = `icon${size}.svg`;
  const filepath = path.join(iconsDir, filename);
  
  fs.writeFileSync(filepath, svg.trim());
  console.log(`✓ Generated ${filename}`);
});

console.log('\n📝 Note: These are SVG files. For Chrome extension, you should convert them to PNG.');
console.log('You can use an online converter or tools like Inkscape, ImageMagick, or sharp.');
console.log('\nExample with ImageMagick:');
console.log('  convert icon128.svg icon128.png');
console.log('\nOr use an online tool like: https://cloudconvert.com/svg-to-png');
