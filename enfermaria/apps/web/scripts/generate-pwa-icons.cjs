/**
 * Gera ícones PWA em PNG a partir do logo.svg
 * Uso: node scripts/generate-pwa-icons.cjs
 * Requer: sharp instalado no workspace (dependência transitiva do Next.js)
 */

// pnpm guarda no virtual store — localizar sharp dentro do workspace
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

function findSharp() {
  // Tentar via pnpm store do workspace
  const storeBase = path.resolve(__dirname, '../../../node_modules/.pnpm');
  if (fs.existsSync(storeBase)) {
    const dirs = fs.readdirSync(storeBase).filter(d => d.startsWith('sharp@'));
    if (dirs.length > 0) {
      return path.join(storeBase, dirs[0], 'node_modules', 'sharp');
    }
  }
  return 'sharp'; // fallback: assume instalado directamente
}

const sharp = require(findSharp());
const base = path.resolve(__dirname, '..');
const svg = fs.readFileSync(path.join(base, 'public/logo.svg'));
const outDir = path.join(base, 'public/icons');

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const sizes = [
  { size: 192, name: 'icon-192.png' },
  { size: 512, name: 'icon-512.png' },
  { size: 180, name: 'apple-touch-icon.png' },
];

(async () => {
  for (const { size, name } of sizes) {
    await sharp(svg).resize(size, size).png().toFile(path.join(outDir, name));
    console.log(`✓ ${name} (${size}×${size})`);
  }
  console.log('Ícones PWA gerados em public/icons/');
})();
