import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Product from '../models/Product.js';
import Sale from '../models/Sale.js';
import { recordSale } from '../services/saleService.js';

dotenv.config();

mongoose.connect(process.env.MONGODB_URI);

const testStockUpdate = async () => {
  try {
    console.log('🧪 Testing Stock Update Directly');
    console.log('================================');
    
    // Get user
    const user = await User.findOne({ email: 'john@shop.com' });
    if (!user) {
      console.log('❌ User not found');
      process.exit(1);
    }
    
    // Create product
    const product = await Product.create({
      name: 'Stock Test Product',
      category: 'Electronics',
      buyingPrice: 50,
      sellingPrice: 80,
      quantity: 10,
      minStockAlert: 3,
      owner: user._id
    });
    
    console.log(`✅ Product created with stock: ${product.quantity}`);
    console.log(`   Product ID: ${product._id}`);
    
    // Record sale using service
    console.log('\n📝 Recording sale via service...');
    const sale = await recordSale({
      productId: product._id,
      quantity: 2,
      sellingPrice: 80,
      customer: 'Test Customer',
      paymentMethod: 'cash'
    }, user._id);
    
    console.log(`✅ Sale recorded: ${sale._id}`);
    
    // Check product stock
    const updatedProduct = await Product.findById(product._id);
    console.log(`📦 Product stock after sale: ${updatedProduct.quantity}`);
    console.log(`   Expected: 8`);
    
    if (updatedProduct.quantity === 8) {
      console.log('✅ Stock update successful!');
    } else {
      console.log('❌ Stock update failed!');
    }
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

testStockUpdate();