// scripts/seedStock.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from '../src/models/Product.js';
import Category from '../src/models/Category.js';
import StockBatch from '../src/models/StockBatch.js';
import User from '../src/models/User.js';

dotenv.config();

const seedStock = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB Connected');

    // Get John's user ID
    const user = await User.findOne({ email: 'john@shop.com' });
    if (!user) {
      console.log('User not found. Please register first.');
      process.exit(1);
    }

    const ownerId = user._id;

    // Create Categories
    const categories = await Category.insertMany([
      {
        name: 'Electronics',
        description: 'Electronic devices and accessories',
        color: '#3B82F6',
        icon: '📱',
        owner: ownerId
      },
      {
        name: 'Accessories',
        description: 'Phone and gadget accessories',
        color: '#8B5CF6',
        icon: '🎧',
        owner: ownerId
      },
      {
        name: 'Computers',
        description: 'Laptops and computer equipment',
        color: '#10B981',
        icon: '💻',
        owner: ownerId
      }
    ]);

    console.log('Categories created:', categories.length);

    // Create Products with variants
    const products = await Product.insertMany([
      {
        name: 'iPhone 15 Pro',
        description: 'Apple iPhone 15 Pro 128GB',
        category: categories[0].name,
        baseUnit: { name: 'piece', label: 'Pcs' },
        sellUnits: [
          { name: 'piece', label: 'Pcs', conversion: 1, isBase: true, sellPrice: 85000, buyPrice: 75000, isActive: true }
        ],
        stockUnits: [
          { name: 'piece', label: 'Pcs', conversion: 1, isBase: true, buyPrice: 75000, isActive: true },
          { name: 'box', label: 'Box', conversion: 10, isBase: false, buyPrice: 700000, isActive: true }
        ],
        buyingPrice: 75000,
        sellingPrice: 85000,
        quantity: 0,
        unit: 'piece',
        minStockAlert: 3,
        supplier: 'Apple Distributors',
        isActive: true,
        owner: ownerId
      },
      {
        name: 'Samsung Galaxy S24',
        description: 'Samsung Galaxy S24 256GB',
        category: categories[0].name,
        baseUnit: { name: 'piece', label: 'Pcs' },
        sellUnits: [
          { name: 'piece', label: 'Pcs', conversion: 1, isBase: true, sellPrice: 72000, buyPrice: 65000, isActive: true }
        ],
        stockUnits: [
          { name: 'piece', label: 'Pcs', conversion: 1, isBase: true, buyPrice: 65000, isActive: true },
          { name: 'box', label: 'Box', conversion: 10, isBase: false, buyPrice: 620000, isActive: true }
        ],
        buyingPrice: 65000,
        sellingPrice: 72000,
        quantity: 0,
        unit: 'piece',
        minStockAlert: 3,
        supplier: 'Samsung Kenya',
        isActive: true,
        owner: ownerId
      },
      {
        name: 'AirPods Pro',
        description: 'Apple AirPods Pro 2nd Gen',
        category: categories[1].name,
        baseUnit: { name: 'piece', label: 'Pcs' },
        sellUnits: [
          { name: 'piece', label: 'Pcs', conversion: 1, isBase: true, sellPrice: 25000, buyPrice: 22000, isActive: true }
        ],
        stockUnits: [
          { name: 'piece', label: 'Pcs', conversion: 1, isBase: true, buyPrice: 22000, isActive: true },
          { name: 'box', label: 'Box', conversion: 6, isBase: false, buyPrice: 120000, isActive: true }
        ],
        buyingPrice: 22000,
        sellingPrice: 25000,
        quantity: 0,
        unit: 'piece',
        minStockAlert: 5,
        supplier: 'Apple Distributors',
        isActive: true,
        owner: ownerId
      },
      {
        name: 'MacBook Air M3',
        description: 'Apple MacBook Air M3 13-inch 256GB',
        category: categories[2].name,
        baseUnit: { name: 'piece', label: 'Pcs' },
        sellUnits: [
          { name: 'piece', label: 'Pcs', conversion: 1, isBase: true, sellPrice: 145000, buyPrice: 130000, isActive: true }
        ],
        stockUnits: [
          { name: 'piece', label: 'Pcs', conversion: 1, isBase: true, buyPrice: 130000, isActive: true }
        ],
        buyingPrice: 130000,
        sellingPrice: 145000,
        quantity: 0,
        unit: 'piece',
        minStockAlert: 2,
        supplier: 'Apple Distributors',
        isActive: true,
        owner: ownerId
      },
      {
        name: 'Samsung Galaxy Buds',
        description: 'Samsung Galaxy Buds FE',
        category: categories[1].name,
        baseUnit: { name: 'piece', label: 'Pcs' },
        sellUnits: [
          { name: 'piece', label: 'Pcs', conversion: 1, isBase: true, sellPrice: 18000, buyPrice: 15000, isActive: true }
        ],
        stockUnits: [
          { name: 'piece', label: 'Pcs', conversion: 1, isBase: true, buyPrice: 15000, isActive: true },
          { name: 'box', label: 'Box', conversion: 10, isBase: false, buyPrice: 140000, isActive: true }
        ],
        buyingPrice: 15000,
        sellingPrice: 18000,
        quantity: 0,
        unit: 'piece',
        minStockAlert: 5,
        supplier: 'Samsung Kenya',
        isActive: true,
        owner: ownerId
      }
    ]);

    console.log('Products created:', products.length);

    // Create Stock Batches with variants (some with bundles, some with loose)
    const stockBatches = await StockBatch.insertMany([
      // iPhone 15 Pro - 15 pieces (1 box + 5 loose)
      {
        productId: products[0]._id,
        unit: { name: 'piece', label: 'Pcs', conversion: 1 },
        quantity: 10, // 1 box (10 pieces)
        quantityInBase: 10,
        looseQuantity: 5,
        looseInBase: 5,
        bundleSize: 10,
        buyPrice: 75000,
        totalCost: 1125000, // 15 * 75000
        batchNumber: 'IP15-001',
        supplierName: 'Apple Distributors',
        receivedAt: new Date('2026-08-15'),
        remainingQuantity: 10,
        remainingInBase: 10,
        remainingLoose: 5,
        remainingLooseInBase: 5,
        isActive: true,
        owner: ownerId
      },
      // iPhone 15 Pro - 5 pieces (loose only)
      {
        productId: products[0]._id,
        unit: { name: 'piece', label: 'Pcs', conversion: 1 },
        quantity: 0,
        quantityInBase: 0,
        looseQuantity: 5,
        looseInBase: 5,
        bundleSize: 10,
        buyPrice: 76000,
        totalCost: 380000, // 5 * 76000
        batchNumber: 'IP15-002',
        supplierName: 'Apple Distributors',
        receivedAt: new Date('2026-09-01'),
        remainingQuantity: 0,
        remainingInBase: 0,
        remainingLoose: 5,
        remainingLooseInBase: 5,
        isActive: true,
        owner: ownerId
      },
      // Samsung Galaxy S24 - 12 pieces
      {
        productId: products[1]._id,
        unit: { name: 'piece', label: 'Pcs', conversion: 1 },
        quantity: 10,
        quantityInBase: 10,
        looseQuantity: 2,
        looseInBase: 2,
        bundleSize: 10,
        buyPrice: 65000,
        totalCost: 780000, // 12 * 65000
        batchNumber: 'SG24-001',
        supplierName: 'Samsung Kenya',
        receivedAt: new Date('2026-08-20'),
        remainingQuantity: 10,
        remainingInBase: 10,
        remainingLoose: 2,
        remainingLooseInBase: 2,
        isActive: true,
        owner: ownerId
      },
      // AirPods Pro - 12 pieces (2 boxes)
      {
        productId: products[2]._id,
        unit: { name: 'piece', label: 'Pcs', conversion: 1 },
        quantity: 12, // 2 boxes (6 each)
        quantityInBase: 12,
        looseQuantity: 0,
        looseInBase: 0,
        bundleSize: 6,
        buyPrice: 22000,
        totalCost: 264000, // 12 * 22000
        batchNumber: 'AP-001',
        supplierName: 'Apple Distributors',
        receivedAt: new Date('2026-08-25'),
        remainingQuantity: 12,
        remainingInBase: 12,
        remainingLoose: 0,
        remainingLooseInBase: 0,
        isActive: true,
        owner: ownerId
      },
      // MacBook Air M3 - 5 pieces
      {
        productId: products[3]._id,
        unit: { name: 'piece', label: 'Pcs', conversion: 1 },
        quantity: 5,
        quantityInBase: 5,
        looseQuantity: 0,
        looseInBase: 0,
        bundleSize: 0,
        buyPrice: 130000,
        totalCost: 650000, // 5 * 130000
        batchNumber: 'MBA-001',
        supplierName: 'Apple Distributors',
        receivedAt: new Date('2026-09-05'),
        remainingQuantity: 5,
        remainingInBase: 5,
        remainingLoose: 0,
        remainingLooseInBase: 0,
        isActive: true,
        owner: ownerId
      },
      // Samsung Galaxy Buds - 20 pieces (2 boxes)
      {
        productId: products[4]._id,
        unit: { name: 'piece', label: 'Pcs', conversion: 1 },
        quantity: 20, // 2 boxes (10 each)
        quantityInBase: 20,
        looseQuantity: 0,
        looseInBase: 0,
        bundleSize: 10,
        buyPrice: 15000,
        totalCost: 300000, // 20 * 15000
        batchNumber: 'SGB-001',
        supplierName: 'Samsung Kenya',
        receivedAt: new Date('2026-08-28'),
        remainingQuantity: 20,
        remainingInBase: 20,
        remainingLoose: 0,
        remainingLooseInBase: 0,
        isActive: true,
        owner: ownerId
      }
    ]);

    console.log('Stock batches created:', stockBatches.length);

    // Update product quantities
    for (const batch of stockBatches) {
      const product = await Product.findById(batch.productId);
      product.quantity += batch.remainingQuantity + batch.remainingLoose;
      await product.save();
    }

    console.log('Product quantities updated');

    // Summary
    console.log('\n=== SEED COMPLETE ===');
    console.log(`Categories: ${categories.length}`);
    console.log(`Products: ${products.length}`);
    console.log(`Stock Batches: ${stockBatches.length}`);
    
    // Show stock summary
    for (const product of products) {
      const batches = await StockBatch.find({ productId: product._id });
      const totalStock = batches.reduce((sum, b) => sum + b.remainingQuantity + b.remainingLoose, 0);
      console.log(`${product.name}: ${totalStock} units`);
    }

    process.exit(0);

  } catch (error) {
    console.error('Error seeding stock:', error);
    process.exit(1);
  }
};

seedStock();