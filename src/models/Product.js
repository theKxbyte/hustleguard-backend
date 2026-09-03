// models/Product.js
import mongoose from 'mongoose';

const unitSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  label: {
    type: String,
    required: true,
    trim: true
  },
  conversion: {
    type: Number,
    required: true,
    min: [0.001, 'Conversion must be greater than 0']
  },
  isBase: {
    type: Boolean,
    default: false
  },
  sellPrice: {
    type: Number,
    min: [0, 'Sell price must be a positive number'],
    default: 0
  },
  buyPrice: {
    type: Number,
    min: [0, 'Buy price must be a positive number'],
    default: 0
  },
  barcode: {
    type: String,
    trim: true,
    sparse: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
});

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
    trim: true
  },
  
  // Units - all units for this product
  units: [unitSchema],
  
  // Stock - always in base unit
  stock: {
    type: Number,
    default: 0,
    min: [0, 'Stock must be a positive number']
  },
  
  minStockAlert: {
    type: Number,
    default: 5,
    min: [0, 'Minimum stock alert must be a positive number']
  },
  
  supplier: {
    type: String,
    trim: true
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

// Indexes
productSchema.index({ owner: 1, name: 1 });
productSchema.index({ owner: 1, category: 1 });

// Methods
productSchema.methods.getBaseUnit = function() {
  return this.units.find(u => u.isBase === true);
};

productSchema.methods.getUnit = function(unitName) {
  return this.units.find(u => u.name === unitName && u.isActive);
};

productSchema.methods.getConversion = function(unitName) {
  const unit = this.getUnit(unitName);
  return unit ? unit.conversion : null;
};

productSchema.methods.isLowStock = function() {
  return this.stock <= this.minStockAlert;
};

productSchema.methods.isOutOfStock = function() {
  return this.stock === 0;
};

// Calculate base quantity from unit quantity
productSchema.methods.toBaseQuantity = function(unitName, quantity) {
  const unit = this.getUnit(unitName);
  if (!unit) throw new Error('Unit not found');
  return quantity * unit.conversion;
};

const Product = mongoose.model('Product', productSchema);
export default Product;