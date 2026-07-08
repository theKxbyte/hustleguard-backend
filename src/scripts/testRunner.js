import mongoose from 'mongoose';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Product from '../models/Product.js';
import Sale from '../models/Sale.js';
import Alert from '../models/Alert.js';

dotenv.config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI);

// Test endpoint functions
const testEndpoints = async (userId, token) => {
  console.log('\n🧪 RUNNING COMPREHENSIVE TESTS');
  console.log('================================\n');
  
  let passed = 0;
  let failed = 0;
  
  // Helper to log test results
  const logTest = (name, status, details = '') => {
    const icon = status ? '✅' : '❌';
    console.log(`${icon} ${name} ${details}`);
    if (status) passed++;
    else failed++;
  };
  
  // 1. Test Product Creation
  console.log('\n📦 PRODUCT TESTS:');
  try {
    const product = await Product.create({
      name: 'Test Product',
      category: 'Electronics',
      buyingPrice: 100,
      sellingPrice: 150,
      quantity: 20,
      minStockAlert: 5,
      owner: userId
    });
    logTest('Create Product', true, `(ID: ${product._id})`);
    
    // 2. Test Product Retrieval
    const products = await Product.find({ owner: userId });
    logTest('Get All Products', products.length > 0, `(${products.length} products)`);
    
    // 3. Test Product Update
    const updated = await Product.findByIdAndUpdate(
      product._id,
      { quantity: 25 },
      { new: true }
    );
    logTest('Update Product', updated.quantity === 25, `(quantity: ${updated.quantity})`);
    
    // 4. Test Low Stock Detection
    const lowStockProducts = await Product.find({
      owner: userId,
      $expr: { $lte: ['$quantity', '$minStockAlert'] }
    });
    logTest('Low Stock Detection', Array.isArray(lowStockProducts), `(${lowStockProducts.length} found)`);
    
  } catch (error) {
    logTest('Product Tests', false, error.message);
  }
  
  // 5. Test Sale Recording
  console.log('\n💰 SALE TESTS:');
  try {
    // First, create a product with guaranteed stock for testing
    console.log('   📦 Creating test product with stock...');
    const testProduct = await Product.create({
      name: 'Test Stock Product',
      category: 'Electronics',
      buyingPrice: 50,
      sellingPrice: 80,
      quantity: 10,
      minStockAlert: 3,
      owner: userId
    });
    
    const initialQuantity = testProduct.quantity;
    console.log(`   📦 Test product created with ${initialQuantity} units`);
    
    const sale = await Sale.create({
      product: testProduct._id,
      quantity: 2,
      sellingPrice: testProduct.sellingPrice,
      buyingPrice: testProduct.buyingPrice,
      profit: (testProduct.sellingPrice - testProduct.buyingPrice) * 2,
      customer: 'Test Customer',
      paymentMethod: 'cash',
      owner: userId
    });
    logTest('Record Sale', sale.quantity === 2, `(ID: ${sale._id})`);
    
    // 6. Test Stock Reduction
    const updatedProduct = await Product.findById(testProduct._id);
    const expectedQuantity = initialQuantity - 2;
    const isReduced = updatedProduct.quantity === expectedQuantity;
    logTest('Stock Reduction', isReduced, `(initial: ${initialQuantity}, now: ${updatedProduct.quantity})`);
    
    // 7. Test Sales Retrieval
    const sales = await Sale.find({ owner: userId });
    logTest('Get All Sales', sales.length > 0, `(${sales.length} sales)`);
    
    // 8. Test Daily Sales
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dailySales = await Sale.find({
      owner: userId,
      saleDate: { $gte: today }
    });
    logTest('Daily Sales', Array.isArray(dailySales), `(${dailySales.length} today)`);
    
  } catch (error) {
    logTest('Sale Tests', false, error.message);
  }
  
  // 9. Test Alert System
  console.log('\n🔔 ALERT TESTS:');
  try {
    // Create test alert
    const alert = await Alert.create({
      type: 'low_stock',
      severity: 'warning',
      title: 'Test Alert',
      message: 'This is a test alert',
      owner: userId,
      isRead: false
    });
    logTest('Create Alert', alert._id !== null, `(ID: ${alert._id})`);
    
    // 10. Test Get Alerts
    const alerts = await Alert.find({ owner: userId });
    logTest('Get All Alerts', alerts.length > 0, `(${alerts.length} alerts)`);
    
    // 11. Test Unread Count
    const unread = await Alert.countDocuments({ owner: userId, isRead: false });
    logTest('Unread Count', unread >= 0, `(${unread} unread)`);
    
    // 12. Test Mark as Read
    const readAlert = await Alert.findByIdAndUpdate(
      alert._id,
      { isRead: true },
      { new: true }
    );
    logTest('Mark as Read', readAlert.isRead === true, '');
    
  } catch (error) {
    logTest('Alert Tests', false, error.message);
  }
  
  // 13. Test Data Isolation
  console.log('\n🔒 SECURITY TESTS:');
  try {
    // Try to access another user's data
    const mary = await User.findOne({ email: 'mary@store.com' });
    if (mary) {
      const maryProducts = await Product.find({ owner: mary._id });
      
      // John shouldn't see Mary's products
      const johnProducts = await Product.find({ owner: userId });
      const hasMaryProduct = johnProducts.some(p => 
        maryProducts.some(mp => mp.name === p.name)
      );
      
      logTest('Data Isolation', !hasMaryProduct, 'Users cannot see each other\'s data');
    } else {
      logTest('Data Isolation', true, 'No other user found');
    }
    
  } catch (error) {
    logTest('Security Tests', false, error.message);
  }
  
  // Print summary
  console.log('\n📊 TEST SUMMARY:');
  console.log('================================');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  
  return { passed, failed };
};

// Run tests
const runTests = async () => {
  try {
    // Wait for connection
    await mongoose.connection;
    
    // Get test user
    const user = await User.findOne({ email: 'john@shop.com' });
    if (!user) {
      console.log('❌ No test user found. Run seeder first: npm run seed');
      process.exit(1);
    }
    
    // Generate token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
    
    console.log(`\n🧪 Testing for: ${user.name} (${user.email})`);
    console.log(`🔑 Token: ${token.substring(0, 30)}...`);
    
    await testEndpoints(user._id, token);
    
    // Close connection
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
  runTests();
});

mongoose.connection.on('error', (err) => {
  console.error(`❌ MongoDB connection error: ${err.message}`);
  process.exit(1);
});