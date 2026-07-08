import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Product from '../models/Product.js';
import Sale from '../models/Sale.js';

dotenv.config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI);

// Test scenarios
const scenarios = {
  // Scenario 1: New Shop Owner Setup
  newShopOwner: async (userId) => {
    console.log('\n📋 SCENARIO 1: New Shop Owner Setup');
    console.log('-----------------------------------');
    
    // Create products
    const products = await Product.create([
      {
        name: 'Bread',
        category: 'Food',
        buyingPrice: 50,
        sellingPrice: 80,
        quantity: 100,
        minStockAlert: 20,
        owner: userId
      },
      {
        name: 'Milk',
        category: 'Food',
        buyingPrice: 70,
        sellingPrice: 120,
        quantity: 50,
        minStockAlert: 15,
        owner: userId
      },
      {
        name: 'Sugar',
        category: 'Food',
        buyingPrice: 120,
        sellingPrice: 180,
        quantity: 30,
        minStockAlert: 10,
        owner: userId
      }
    ]);
    
    console.log(`✅ Created ${products.length} products`);
    
    // Record first sales
    const sale1 = await Sale.create({
      product: products[0]._id,
      quantity: 5,
      sellingPrice: 80,
      buyingPrice: 50,
      profit: 150,
      customer: 'Walk-in',
      paymentMethod: 'cash',
      owner: userId
    });
    
    const sale2 = await Sale.create({
      product: products[1]._id,
      quantity: 3,
      sellingPrice: 120,
      buyingPrice: 70,
      profit: 150,
      customer: 'M-Pesa',
      paymentMethod: 'mobile_money',
      owner: userId
    });
    
    console.log(`✅ Recorded ${2} sales`);
    
    return { products, sales: [sale1, sale2] };
  },
  
  // Scenario 2: Low Stock Alert
  lowStockScenario: async (userId) => {
    console.log('\n📋 SCENARIO 2: Low Stock Alert');
    console.log('-------------------------------');
    
    // Create product with low stock
    const product = await Product.create({
      name: 'Milk (Low Stock)',
      category: 'Food',
      buyingPrice: 70,
      sellingPrice: 120,
      quantity: 3,
      minStockAlert: 10,
      owner: userId
    });
    
    console.log(`✅ Created product with ${product.quantity} units (min: ${product.minStockAlert})`);
    
    // Run alert check
    const alertService = await import('../services/alertService.js');
    const alerts = await alertService.checkLowStockAlerts(userId);
    
    console.log(`🔔 Created ${alerts.length} low stock alert(s)`);
    
    return { product, alerts };
  },
  
// Scenario 3: Out of Stock Crisis
outOfStockScenario: async (userId) => {
  console.log('\n📋 SCENARIO 3: Out of Stock Crisis');
  console.log('----------------------------------');
  
  // Create product with zero stock
  const product = await Product.create({
    name: 'Best Seller Item',
    category: 'Electronics',
    buyingPrice: 200,
    sellingPrice: 350,
    quantity: 0,
    minStockAlert: 5,
    owner: userId
  });
  
  console.log(`✅ Created product with ${product.quantity} units`);
  
  // Try to sell (should fail)
  try {
    // The sale service should check stock and throw an error
    const saleService = await import('../services/saleService.js');
    await saleService.recordSale({
      productId: product._id,
      quantity: 1,
      sellingPrice: 350,
      customer: 'Test Customer',
      paymentMethod: 'cash'
    }, userId);
    console.log('⚠️  Sale succeeded (should have failed!)');
  } catch (error) {
    if (error.message.includes('Insufficient stock')) {
      console.log('❌ Sale blocked: "Insufficient stock" - ✅ Working correctly');
    } else {
      console.log(`⚠️  Sale failed with unexpected error: ${error.message}`);
    }
  }
  
  // Run alert check
  const alertService = await import('../services/alertService.js');
  const alerts = await alertService.checkOutOfStockAlerts(userId);
  
  console.log(`🔔 Created ${alerts.length} out of stock alert(s)`);
  
  return { product, alerts };
},
  
  // Scenario 4: Dead Stock Detection
  deadStockScenario: async (userId) => {
    console.log('\n📋 SCENARIO 4: Dead Stock Detection');
    console.log('----------------------------------');
    
    // Create product with stock but no sales
    const product = await Product.create({
      name: 'Old Inventory Item',
      category: 'Home',
      buyingPrice: 100,
      sellingPrice: 180,
      quantity: 20,
      minStockAlert: 5,
      owner: userId,
      lastRestockDate: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000) // 45 days ago
    });
    
    console.log(`✅ Created product with ${product.quantity} units, no sales in 45 days`);
    
    // Run alert check
    const alertService = await import('../services/alertService.js');
    const alerts = await alertService.checkDeadStockAlerts(userId);
    
    console.log(`🔔 Created ${alerts.length} dead stock alert(s)`);
    
    return { product, alerts };
  },
  
  // Scenario 5: High Volume Sales Day
  highVolumeSales: async (userId) => {
    console.log('\n📋 SCENARIO 5: High Volume Sales Day');
    console.log('-----------------------------------');
    
    // Create products
    const products = await Product.create([
      {
        name: 'Popular Item A',
        category: 'Electronics',
        buyingPrice: 50,
        sellingPrice: 90,
        quantity: 100,
        minStockAlert: 20,
        owner: userId
      },
      {
        name: 'Popular Item B',
        category: 'Electronics',
        buyingPrice: 30,
        sellingPrice: 60,
        quantity: 80,
        minStockAlert: 15,
        owner: userId
      }
    ]);
    
    // Record 20 sales in one day
    const sales = [];
    for (let i = 0; i < 20; i++) {
      const product = products[i % 2];
      const quantity = Math.floor(Math.random() * 3) + 1;
      
      sales.push({
        product: product._id,
        quantity: quantity,
        sellingPrice: product.sellingPrice,
        buyingPrice: product.buyingPrice,
        profit: (product.sellingPrice - product.buyingPrice) * quantity,
        customer: `Customer ${i + 1}`,
        paymentMethod: ['cash', 'mobile_money'][i % 2],
        owner: userId,
        saleDate: new Date()
      });
    }
    
    await Sale.create(sales);
    console.log(`✅ Recorded ${sales.length} sales in one day`);
    
    return { products, sales };
  },
  
  // Scenario 6: Supplier Price Change
  supplierPriceChange: async (userId) => {
    console.log('\n📋 SCENARIO 6: Supplier Price Change');
    console.log('-----------------------------------');
    
    // Create product
    const product = await Product.create({
      name: 'Supplier Item',
      category: 'Other',
      buyingPrice: 100,
      sellingPrice: 180,
      quantity: 30,
      minStockAlert: 10,
      supplier: 'Main Supplier',
      supplierPrice: 80,
      owner: userId
    });
    
    console.log(`✅ Created product with supplier price: ${product.supplierPrice}`);
    
    // Update supplier price (triggers alert)
    const alertService = await import('../services/alertService.js');
    const alert = await alertService.checkSupplierPriceChanges(
      product._id,
      userId,
      80, // old price
      95  // new price
    );
    
    if (alert) {
      console.log(`🔔 Supplier price change alert created: ${alert.title}`);
      console.log(`   Old: $80 → New: $95 (${((95-80)/80 * 100).toFixed(1)}% increase)`);
    }
    
    return { product, alert };
  }
};

// Run all scenarios
const runAllScenarios = async () => {
  try {
    // Wait for connection
    await mongoose.connection;
    
    // Get first user
    const user = await User.findOne({ email: 'john@shop.com' });
    if (!user) {
      console.log('❌ No user found. Run seeder first: npm run seed');
      process.exit(1);
    }
    
    console.log(`\n🎯 Running Test Scenarios for: ${user.name}`);
    console.log('============================================');
    
    // Run scenarios
    await scenarios.newShopOwner(user._id);
    await scenarios.lowStockScenario(user._id);
    await scenarios.outOfStockScenario(user._id);
    await scenarios.deadStockScenario(user._id);
    await scenarios.highVolumeSales(user._id);
    await scenarios.supplierPriceChange(user._id);
    
    console.log('\n✅ All test scenarios completed!');
    console.log('\n📊 Check the following:');
    console.log('   1. Alerts created');
    console.log('   2. Stock levels updated');
    console.log('   3. Sales recorded');
    console.log('   4. Profit calculations');
    console.log('   5. Error handling');
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
};

// Run specific scenario
const runScenario = async (scenarioName) => {
  try {
    await mongoose.connection;
    
    const user = await User.findOne({ email: 'john@shop.com' });
    if (!user) {
      console.log('❌ No user found. Run seeder first: npm run seed');
      process.exit(1);
    }
    
    if (scenarios[scenarioName]) {
      await scenarios[scenarioName](user._id);
      console.log(`\n✅ Scenario "${scenarioName}" completed!`);
    } else {
      console.log(`❌ Scenario "${scenarioName}" not found`);
      console.log('Available scenarios:', Object.keys(scenarios).join(', '));
    }
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
};

// Handle connection events
mongoose.connection.on('connected', () => {
  console.log('✅ MongoDB connected');
});

mongoose.connection.on('error', (err) => {
  console.error(`❌ MongoDB connection error: ${err.message}`);
  process.exit(1);
});

// Command line arguments
const args = process.argv.slice(2);
if (args[0] === '--scenario' && args[1]) {
  runScenario(args[1]);
} else {
  runAllScenarios();
}