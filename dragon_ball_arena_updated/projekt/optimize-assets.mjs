/**
 * optimize-assets.mjs
 * Resizes all PNGs in public/assets/characters and public/assets/techniques to 128x128.
 *
 * Usage:  node optimize-assets.mjs
 * Options:
 *   --size 64        change target size (default: 128)
 *   --mode cover     cover | contain | fill (default: cover)
 *   --dry-run        only show what would be done, no files changed
 */

import { execSync } from 'child_process';
import { createRequire } from 'module';
import { readdir, stat } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── CLI args ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);

function getArg(flag, fallback) {
    const i = args.indexOf(flag);
    return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
}

const SIZE    = parseInt(getArg('--size', '128'), 10);
const MODE    = getArg('--mode', 'cover');   // cover | contain | fill
const DRY_RUN = args.includes('--dry-run');

const DIRS = [
    path.join(__dirname, 'public/assets/characters'),
    path.join(__dirname, 'public/assets/techniques'),
];

// ─── Ensure sharp is available ────────────────────────────────────────────────
const require = createRequire(import.meta.url);

function ensureSharp() {
    try {
        require.resolve('sharp');
        return;
    } catch {
        console.log('📦  sharp not found — installing locally...');
        execSync('npm install sharp --save-dev', { stdio: 'inherit', cwd: __dirname });
        console.log('✅  sharp installed\n');
    }
}

// ─── Format bytes ─────────────────────────────────────────────────────────────
function fmt(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// ─── Resize one file ──────────────────────────────────────────────────────────
async function resizeFile(sharp, filePath) {
    const fs = await import('fs/promises');
    const { size: sizeBefore } = await stat(filePath);

    // Read entire file into memory first to avoid Windows file-lock on in-place overwrite
    const inputBuffer = await fs.readFile(filePath);

    const meta = await sharp(inputBuffer).metadata();
    const alreadyOptimal = meta.width === SIZE && meta.height === SIZE;

    const label = path.relative(__dirname, filePath).replace(/\\/g, '/');

    if (alreadyOptimal) {
        console.log(`  ⏭  ${label}  (already ${SIZE}x${SIZE})`);
        return { saved: 0, skipped: true };
    }

    if (DRY_RUN) {
        console.log(`  🔍  ${label}  ${meta.width}x${meta.height} → ${SIZE}x${SIZE}  [dry-run]`);
        return { saved: 0, skipped: false };
    }

    let pipeline = sharp(inputBuffer);

    if (MODE === 'fill') {
        // Stretch to exact size (may distort)
        pipeline = pipeline.resize(SIZE, SIZE, { fit: 'fill' });
    } else if (MODE === 'contain') {
        // Fit inside, add transparent padding to reach square
        pipeline = pipeline.resize(SIZE, SIZE, {
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 },
        });
    } else {
        // Default: cover — crop from center to fill square
        pipeline = pipeline.resize(SIZE, SIZE, { fit: 'cover', position: 'centre' });
    }

    const buffer = await pipeline.png({ compressionLevel: 9, palette: false }).toBuffer();
    await fs.writeFile(filePath, buffer);

    const { size: sizeAfter } = await stat(filePath);
    const saved = sizeBefore - sizeAfter;
    const pct = ((saved / sizeBefore) * 100).toFixed(1);
    const arrow = saved > 0 ? '↓' : '↑';

    console.log(
        `  ✔  ${label}  ${meta.width}x${meta.height} → ${SIZE}x${SIZE}` +
        `  ${fmt(sizeBefore)} ${arrow} ${fmt(sizeAfter)}` +
        (saved !== 0 ? `  (${saved > 0 ? '-' : '+'}${Math.abs(pct)}%)` : '')
    );

    return { saved, skipped: false };
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
    ensureSharp();
    const { default: sharp } = await import('sharp');

    const modeLabel = DRY_RUN ? ' [DRY RUN]' : '';
    console.log(`\n🎨  Dragon Ball Arena — Asset Optimizer${modeLabel}`);
    console.log(`    Target: ${SIZE}x${SIZE}px  |  Mode: ${MODE}\n`);

    let totalFiles = 0;
    let totalSaved = 0;
    let totalSkipped = 0;

    for (const dir of DIRS) {
        let files;
        try {
            files = (await readdir(dir)).filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f));
        } catch {
            console.warn(`  ⚠  Directory not found: ${dir}`);
            continue;
        }

        console.log(`📁  ${path.relative(__dirname, dir).replace(/\\/g, '/')}/  (${files.length} files)`);

        for (const file of files) {
            const result = await resizeFile(sharp, path.join(dir, file));
            totalFiles++;
            totalSaved += result.saved;
            if (result.skipped) totalSkipped++;
        }

        console.log();
    }

    // ─── Summary ──────────────────────────────────────────────────────────────
    console.log('─'.repeat(60));
    console.log(`📊  Summary`);
    console.log(`    Files processed : ${totalFiles}`);
    console.log(`    Already optimal : ${totalSkipped}`);
    console.log(`    Resized         : ${totalFiles - totalSkipped}`);
    if (!DRY_RUN && totalSaved !== 0) {
        const sign = totalSaved > 0 ? '-' : '+';
        console.log(`    Space ${totalSaved > 0 ? 'saved' : 'added'} : ${sign}${fmt(Math.abs(totalSaved))}`);
    }
    if (DRY_RUN) {
        console.log('\n    Run without --dry-run to apply changes.');
    }
    console.log();
}

main().catch(err => {
    console.error('\n❌  Error:', err.message);
    process.exit(1);
});
