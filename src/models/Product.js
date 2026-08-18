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
  buyPrice: {
    type: Number,
    min: [0, 'Buy price must be a positive number'],
    default: 0
  },
  sellPrice: {
    type: Number,
    min: [0, 'Sell price must be a positive number'],
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
  
  // UOM Configuration
  baseUnit: {
    name: {
      type: String,
      required: [true, 'Please add a base unit name'],
      trim: true
    },
    label: {
      type: String,
      required: [true, 'Please add a base unit label'],
      trim: true
    }
  },
  
  sellUnits: [unitSchema],
  stockUnits: [unitSchema],
  
  // Legacy fields (kept for backward compatibility)
  buyingPrice: {
    type: Number,
    min: [0, 'Buying price must be a positive number'],
    default: 0
  },
  sellingPrice: {
    type: Number,
    min: [0, 'Selling price must be a positive number'],
    default: 0
  },
  quantity: {
    type: Number,
    default: 0,
    min: [0, 'Quantity must be a positive number']
  },
  unit: {
    type: String,
    trim: true
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

// Indexes
productSchema.index({ owner: 1, name: 1 });
productSchema.index({ owner: 1, category: 1 });
productSchema.index({ owner: 1, 'baseUnit.name': 1 });

// Methods
productSchema.methods.isValidSellUnit = function(unitName) {
  return this.sellUnits.some(u => u.name === unitName && u.isActive);
};

productSchema.methods.getSellUnit = function(unitName) {
  return this.sellUnits.find(u => u.name === unitName && u.isActive);
};

productSchema.methods.getStockUnit = function(unitName) {
  return this.stockUnits.find(u => u.name === unitName && u.isActive);
};

productSchema.methods.getConversion = function(unitName) {
  const allUnits = [...this.sellUnits, ...this.stockUnits];
  const unit = allUnits.find(u => u.name === unitName);
  return unit ? unit.conversion : null;
};

productSchema.methods.isLowStock = function() {
  return this.quantity <= this.minStockAlert;
};

productSchema.methods.isOutOfStock = function() {
  return this.quantity === 0;
};

const Product = mongoose.model('Product', productSchema);
export default Product;