// models/Product.js - UPDATED SCHEMA
import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a product name'],
    trim: true,
    maxlength: [100, 'Product name cannot be more than 100 characters']
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot be more than 500 characters']
  },
  category: {
    type: String,
    required: [true, 'Please add a category'],
    trim: true,
    enum: ['Electronics', 'Clothing', 'Food', 'Beverages', 'Health', 'Beauty', 'Home', 'Sports', 'Toys', 'Books', 'Other']
  },
  barcode: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    match: [/^[0-9]+$/, 'Barcode must contain only numbers'],
    maxlength: [20, 'Barcode cannot be more than 20 characters']
  },
  buyingPrice: {
    type: Number,
    required: [true, 'Please add a buying price'],
    min: [0, 'Buying price must be a positive number']
  },
  sellingPrice: {
    type: Number,
    required: [true, 'Please add a selling price'],
    min: [0, 'Selling price must be a positive number']
    // REMOVED the validate property - we'll handle this in the service
  },
  quantity: {
    type: Number,
    required: [true, 'Please add quantity'],
    min: [0, 'Quantity must be a positive number'],
    default: 0
  },
  minStockAlert: {
    type: Number,
    default: 5,
    min: [0, 'Minimum stock alert must be a positive number']
  },
  unit: {
    type: String,
    required: [true, 'Please add a unit of measurement'],
    trim: true,
    enum: ['pcs', 'kg', 'g', 'ml', 'L', 'pack', 'box', 'dozen', 'pair', 'set', 'roll', 'meter', 'cm', 'inch', 'other'],
    default: 'pcs'
  },
  supplier: {
    type: String,
    trim: true
  },
  supplierPrice: {
    type: Number,
    min: [0, 'Supplier price must be a positive number']
  },
  lastRestockDate: {
    type: Date
  },
  isActive: {
    type: Boolean,
    default: true
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Indexes for better performance
productSchema.index({ owner: 1, name: 1 });
productSchema.index({ owner: 1, category: 1 });
productSchema.index({ owner: 1, quantity: 1 });
productSchema.index({ barcode: 1 });

// Virtual: Calculate profit per unit
productSchema.virtual('profitPerUnit').get(function() {
  return this.sellingPrice - this.buyingPrice;
});

// Virtual: Total stock value
productSchema.virtual('stockValue').get(function() {
  return this.quantity * this.buyingPrice;
});

// Method: Check if product is low stock
productSchema.methods.isLowStock = function() {
  return this.quantity <= this.minStockAlert;
};

// Method: Check if product is out of stock
productSchema.methods.isOutOfStock = function() {
  return this.quantity === 0;
};

// Method: Update stock
productSchema.methods.updateStock = function(quantityChange) {
  this.quantity += quantityChange;
  if (this.quantity < 0) this.quantity = 0;
  return this.save();
};

const Product = mongoose.model('Product', productSchema);
export default Product;