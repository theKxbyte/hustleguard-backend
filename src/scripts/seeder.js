import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Product from '../models/Product.js';
import Sale from '../models/Sale.js';
import Alert from '../models/Alert.js';

dotenv.config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI);

// Test data
const users = [
  {
    name: 'John Shop Owner',
    email: 'john@shop.com',
    password: 'password123',
    shopName: 'John\'s Electronics',
    phone: '0712345678',
    role: 'owner'
  },
  {
    name: 'Mary Store Owner',
    email: 'mary@store.com',
    password: 'password123',
    shopName: 'Mary\'s General Store',
    phone: '0723456789',
    role: 'owner'
  }
];

const products = [
  {
    name: 'Laptop Pro',
    category: 'Electronics',
    buyingPrice: 500,
    sellingPrice: 750,
    quantity: 10,
    minStockAlert: 3,
    supplier: 'Tech World Ltd',
    supplierPrice: 450
  },
  {
    name: 'Wireless Mouse',
    category: 'Electronics',
    buyingPrice: 20,
    sellingPrice: 35,
    quantity: 50,
    minStockAlert: 10,
    supplier: 'Accessories Inc',
    supplierPrice: 18
  },
  {
    name: 'Smartphone X',
    category: 'Electronics',
    buyingPrice: 400,
    sellingPrice: 600,
    quantity: 5,
    minStockAlert: 5,
    supplier: 'Mobile Tech',
    supplierPrice: 380
  },
  {
    name: 'USB Cable',
    category: 'Electronics',
    buyingPrice: 5,
    sellingPrice: 12,
    quantity: 0,
    minStockAlert: 20,
    supplier: 'Cable Masters',
    supplierPrice: 4
  },
  {
    name: 'Office Chair',
    category: 'Home',
    buyingPrice: 80,
    sellingPrice: 150,
    quantity: 15,
    minStockAlert: 5,
    supplier: 'Furniture World',
    supplierPrice: 70
  },
  {
    name: 'Coffee Beans',
    category: 'Food',
    buyingPrice: 10,
    sellingPrice: 25,
    quantity: 30,
    minStockAlert: 8,
    supplier: 'Coffee Roasters',
    supplierPrice: 9
  },
  {
    name: 'Notebook Set',
    category: 'Other',
    buyingPrice: 3,
    sellingPrice: 8,
    quantity: 2,
    minStockAlert: 5,
    supplier: 'Stationery Co',
    supplierPrice: 2
  }
];

// Generate sales over last 30 days
const generateSales = (productIds, userId, days = 30) => {
  const sales = [];
  const now = new Date();
  
  for (let i = 0; i < 30; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    
    // Random number of sales per day (0-5)
    const numSales = Math.floor(Math.random() * 6);
    
    for (let j = 0; j < numSales; j++) {
      const productId = productIds[Math.floor(Math.random() * productIds.length)];
      const quantity = Math.floor(Math.random() * 3) + 1;
      const sellingPrice = 25 + Math.floor(Math.random() * 100);
      const buyingPrice = 15 + Math.floor(Math.random() * 50);
      
      sales.push({
        product: productId,
        quantity: quantity,
        sellingPrice: sellingPrice,
        buyingPrice: buyingPrice,
        profit: (sellingPrice - buyingPrice) * quantity,
        customer: ['John Customer', 'Jane Buyer', 'Peter Shopper', 'Mary Client', 'James Buyer'][Math.floor(Math.random() * 5)],
        paymentMethod: ['cash', 'mobile_money', 'bank_transfer', 'credit'][Math.floor(Math.random() * 4)],
        saleDate: date,
        owner: userId,
        notes: `Test sale ${j+1} on ${date.toDateString()}`
      });
    }
  }
  
  return sales;
};

// Import data
const importData = async () => {
  try {
    // Clear existing data
    await User.deleteMany();
    await Product.deleteMany();
    await Sale.deleteMany();
    await Alert.deleteMany();
    
    console.log('🗑️  Data cleared...');
    
    // Create users
    const createdUsers = await User.create(users);
    console.log(`✅ Created ${createdUsers.length} users`);
    
    // Get user IDs
    const john = createdUsers[0];
    const mary = createdUsers[1];
    
    // Create products for John
    const johnProducts = products.map(p => ({
      ...p,
      owner: john._id
    }));
    
    const createdJohnProducts = await Product.create(johnProducts);
    console.log(`✅ Created ${createdJohnProducts.length} products for John`);
    
    // Create products for Mary (similar but different)
    const maryProducts = products.map(p => ({
      ...p,
      name: p.name + ' (Mary\'s)',
      quantity: p.quantity + 20,
      owner: mary._id
    }));
    
    const createdMaryProducts = await Product.create(maryProducts);
    console.log(`✅ Created ${createdMaryProducts.length} products for Mary`);
    
    // Generate sales for John
    const johnProductIds = createdJohnProducts.map(p => p._id);
    const johnSales = generateSales(johnProductIds, john._id);
    await Sale.create(johnSales);
    console.log(`✅ Created ${johnSales.length} sales for John`);
    
    // Generate sales for Mary
    const maryProductIds = createdMaryProducts.map(p => p._id);
    const marySales = generateSales(maryProductIds, mary._id, 20);
    await Sale.create(marySales);
    console.log(`✅ Created ${marySales.length} sales for Mary`);
    
    // Trigger alert checks for John
    console.log('\n📊 Running Alert Checks...');
    
    // Import alert service dynamically
    const alertService = await import('../services/alertService.js');
    
    // Check low stock
    const lowStock = await alertService.checkLowStockAlerts(john._id);
    console.log(`🔔 Low stock alerts: ${lowStock.length}`);
    
    // Check out of stock
    const outOfStock = await alertService.checkOutOfStockAlerts(john._id);
    console.log(`🔔 Out of stock alerts: ${outOfStock.length}`);
    
    // Check dead stock
    const deadStock = await alertService.checkDeadStockAlerts(john._id);
    console.log(`🔔 Dead stock alerts: ${deadStock.length}`);
    
    console.log('\n✅ Database seeded successfully!');
    console.log('📊 Test Data Summary:');
    console.log(`   👤 Users: ${createdUsers.length}`);
    console.log(`   📦 Products: ${createdJohnProducts.length + createdMaryProducts.length}`);
    console.log(`   💰 Sales: ${johnSales.length + marySales.length}`);
    console.log(`   🔔 Alerts: ${lowStock.length + outOfStock.length + deadStock.length}`);
    
    console.log('\n🔑 Test Credentials:');
    console.log('   John: john@shop.com / password123');
    console.log('   Mary: mary@store.com / password123');
    
    process.exit();
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
};

// Delete all data
const deleteData = async () => {
  try {
    await User.deleteMany();
    await Product.deleteMany();
    await Sale.deleteMany();
    await Alert.deleteMany();
    
    console.log('🗑️  Data destroyed...');
    process.exit();
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
};

// Run seeder
if (process.argv[2] === '-d') {
  deleteData();
} else {
  importData();
}