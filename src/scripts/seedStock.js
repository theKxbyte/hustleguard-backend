// scripts/cleanDatabase.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from '../models/Product.js';
import StockBatch from '../models/StockBatch.js';
import Sale from '../models/Sale.js';
import Alert from '../models/Alert.js';

dotenv.config();

const cleanDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('📦 Connected to MongoDB');

    // ============================================================
    // Count before deletion
    // ============================================================
    const totalProducts = await Product.countDocuments();
    const totalStock = await StockBatch.countDocuments();
    const totalSales = await Sale.countDocuments();
    const totalAlerts = await Alert.countDocuments();

    console.log('📊 BEFORE CLEANUP:');
    console.log(`   Products: ${totalProducts}`);
    console.log(`   Stock Batches: ${totalStock}`);
    console.log(`   Sales: ${totalSales}`);
    console.log(`   Alerts: ${totalAlerts}`);
    console.log('');

    // ============================================================
    // Find products WITHOUT UOM (old format)
    // ============================================================
    const oldProducts = await Product.find({
      $or: [
        { sellUnits: { $exists: false } },
        { sellUnits: { $size: 0 } },
        { stockUnits: { $exists: false } },
        { stockUnits: { $size: 0 } },
        { baseUnit: { $exists: false } }
      ]
    });

    console.log(`🔍 Found ${oldProducts.length} products without UOM:`);
    oldProducts.forEach(p => {
      console.log(`   - ${p.name} (${p.category || 'No category'})`);
    });
    console.log('');

    if (oldProducts.length === 0) {
      console.log('✅ No old products found. Database is clean!');
      await mongoose.disconnect();
      return;
    }

    // ============================================================
    // Get IDs of old products
    // ============================================================
    const oldProductIds = oldProducts.map(p => p._id);

    // ============================================================
    // Delete related data first (stock, sales, alerts)
    // ============================================================
    console.log('🗑️  Deleting related data...');

    const stockResult = await StockBatch.deleteMany({
      productId: { $in: oldProductIds }
    });
    console.log(`   ✅ Deleted ${stockResult.deletedCount} stock batches`);

    const saleResult = await Sale.deleteMany({
      'items.productId': { $in: oldProductIds }
    });
    console.log(`   ✅ Deleted ${saleResult.deletedCount} sales`);

    const alertResult = await Alert.deleteMany({
      product: { $in: oldProductIds }
    });
    console.log(`   ✅ Deleted ${alertResult.deletedCount} alerts`);

    // ============================================================
    // Delete old products
    // ============================================================
    console.log('🗑️  Deleting old products...');
    const productResult = await Product.deleteMany({
      _id: { $in: oldProductIds }
    });
    console.log(`   ✅ Deleted ${productResult.deletedCount} products`);

    // ============================================================
    // Count after deletion
    // ============================================================
    const remainingProducts = await Product.countDocuments();
    const remainingStock = await StockBatch.countDocuments();
    const remainingSales = await Sale.countDocuments();
    const remainingAlerts = await Alert.countDocuments();

    console.log('');
    console.log('📊 AFTER CLEANUP:');
    console.log(`   Products: ${remainingProducts} (removed ${totalProducts - remainingProducts})`);
    console.log(`   Stock Batches: ${remainingStock} (removed ${totalStock - remainingStock})`);
    console.log(`   Sales: ${remainingSales} (removed ${totalSales - remainingSales})`);
    console.log(`   Alerts: ${remainingAlerts} (removed ${totalAlerts - remainingAlerts})`);

    console.log('');
    console.log('✅ CLEANUP COMPLETE!');

    // ============================================================
    // Show remaining products
    // ============================================================
    if (remainingProducts > 0) {
      const remaining = await Product.find({}).select('name category baseUnit');
      console.log('');
      console.log('📋 Remaining products:');
      remaining.forEach(p => {
        const base = p.baseUnit?.label || p.unit || 'No base unit';
        console.log(`   - ${p.name} (Base: ${base})`);
      });
    }

  } catch (error) {
    console.error('❌ Error cleaning database:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
};

cleanDatabase();