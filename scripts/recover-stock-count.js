// scripts/cleanup-and-restore.js
//
// One-time cleanup for HustleGuard.
//
// What it does:
//   1. Cancels ALL StockCount documents (confirmed + draft)
//   2. Disables ALL StockMovement documents tied to a StockCount
//   3. Restores Product.stock to the true values you specify below
//
// Usage:
//   1. Edit the RESTORE_STOCK map below
//   2. Leave APPLY = false, run: node scripts/cleanup-and-restore.js
//   3. Verify the dry-run looks right
//   4. Flip APPLY = true, run again

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

// ============================================================
// 👇 EDIT THIS BEFORE RUNNING
// ============================================================

const RESTORE_STOCK = {
  'Myra Henson': 200,        // 201 opening − 1 real sale
  'Samsung Galaxy S24': 47,  // unchanged
  'Sugar': 0                 // unchanged
};

// Flip to true to actually write changes
const APPLY = true;

// ============================================================

const MONGO_URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  process.env.DATABASE_URL;

if (!MONGO_URI) {
  console.error('❌ No Mongo URI found. Set MONGO_URI in .env');
  process.exit(1);
}

const rootImport = (relPath) =>
  import(pathToFileURL(path.resolve(__dirname, '..', relPath)).href);

async function main() {
  console.log('\n🧹  HustleGuard — Cleanup & Restore\n');
  console.log(`Mode: ${APPLY ? '⚠️  APPLY (will write)' : '🔍 DRY-RUN (no writes)'}\n`);

  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to Mongo\n');

  const { default: StockCount }    = await rootImport('src/models/StockCount.js');
  const { default: StockMovement } = await rootImport('src/models/StockMovement.js');
  const { default: Product }       = await rootImport('src/models/Product.js');

  // ----------------------------------------------------------
  // 1. Find every active count (any status, any period)
  // ----------------------------------------------------------
  const activeCounts = await StockCount.find({
    isActive: true,
    status: { $in: ['confirmed', 'draft'] }
  }).sort({ createdAt: -1 });

  const confirmedCount = activeCounts.filter(c => c.status === 'confirmed');
  const draftCount     = activeCounts.filter(c => c.status === 'draft');

  console.log('🔎 Counts found:');
  console.log(`   Confirmed: ${confirmedCount.length}`);
  confirmedCount.forEach(c => {
    console.log(`     [${c._id}]  ${c.periodStart.toISOString().slice(0,10)} → ${c.periodEnd.toISOString().slice(0,10)}  confirmedAt=${c.confirmedAt?.toISOString() || 'n/a'}`);
  });
  console.log(`   Draft:     ${draftCount.length}`);
  draftCount.forEach(d => {
    console.log(`     [${d._id}]  ${d.periodStart.toISOString().slice(0,10)} → ${d.periodEnd.toISOString().slice(0,10)}  createdAt=${d.createdAt?.toISOString() || 'n/a'}`);
  });
  console.log('');

  // ----------------------------------------------------------
  // 2. Cancel all counts + disable their movements
  // ----------------------------------------------------------
  if (activeCounts.length > 0) {
    if (APPLY) {
      const cancelRes = await StockCount.updateMany(
        { _id: { $in: activeCounts.map(c => c._id) } },
        { $set: { status: 'cancelled', isActive: false } }
      );
      console.log(`✅ Cancelled ${cancelRes.modifiedCount} count(s)`);

      const countIds = activeCounts.map(c => c._id);
      const movRes = await StockMovement.updateMany(
        { refModel: 'StockCount', refId: { $in: countIds } },
        { $set: { isActive: false } }
      );
      console.log(`✅ Disabled ${movRes.modifiedCount} count movement(s)`);
    } else {
      console.log(`🔍 [dry-run] Would cancel ${activeCounts.length} count(s)`);
      console.log(`🔍 [dry-run] Would disable count movements for those ${activeCounts.length} count(s)`);
    }
  } else {
    console.log('ℹ️  No active counts to cancel');
  }

  // ----------------------------------------------------------
  // 3. Restore Product.stock
  // ----------------------------------------------------------
  console.log('\n📦 Stock restoration:\n');

  const names = Object.keys(RESTORE_STOCK);
  const products = await Product.find({ name: { $in: names } });

  if (products.length === 0) {
    console.log('⚠️  No products matched. Check names in RESTORE_STOCK.\n');
  }

  for (const product of products) {
    const target = RESTORE_STOCK[product.name];
    const before = product.stock;
    const changed = before !== target;

    console.log(
      `   ${product.name.padEnd(28)} ` +
      `${String(before).padStart(6)} → ${String(target).padStart(6)}  ` +
      (changed ? '' : '(no change)')
    );

    if (changed && APPLY) {
      product.stock = target;
      await product.save();
    }
  }

  const matched = new Set(products.map(p => p.name));
  const missing = names.filter(n => !matched.has(n));
  if (missing.length > 0) {
    console.log(`\n⚠️  These names did not match any product:`);
    missing.forEach(n => console.log(`     - ${n}`));
  }

  // ----------------------------------------------------------
  // 4. Summary
  // ----------------------------------------------------------
  console.log('\n───────────────  SUMMARY  ───────────────');
  if (APPLY) {
    console.log('✅ Cleanup applied.');
    console.log('   Next steps:');
    console.log('     1. Reload Stock Monitor');
    console.log('     2. Header should say "No confirmed count yet"');
    console.log('     3. Opening / Sold columns should show "—"');
    console.log('     4. Start a fresh stock count');
    console.log('     5. Enter every product, then confirm');
  } else {
    console.log('🔍 Dry-run complete. No changes made.');
    console.log('   Flip APPLY = true and run again.');
  }
  console.log('─────────────────────────────────────────\n');

  await mongoose.disconnect();
  console.log('👋 Disconnected\n');
}

main().catch(err => {
  console.error('❌ Failed:', err);
  process.exit(1);
});