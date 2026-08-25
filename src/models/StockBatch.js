// models/StockBatch.js
import mongoose from 'mongoose';

const stockBatchSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  
  // Unit this stock is in
  unit: {
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
    }
  },
  
  // ============================================================
  // MAIN QUANTITIES (Bundles/Full Units)
  // ============================================================
  quantity: {
    type: Number,
    required: true,
    min: [0, 'Quantity must be a positive number']
  },
  quantityInBase: {
    type: Number,
    required: true,
    min: [0, 'Quantity in base must be a positive number']
  },
  
  // ============================================================
  // LOOSE QUANTITY (Individual units outside bundles)
  // ============================================================
  looseQuantity: {
    type: Number,
    default: 0,
    min: [0, 'Loose quantity must be a positive number']
  },
  looseInBase: {
    type: Number,
    default: 0,
    min: [0, 'Loose in base must be a positive number']
  },
  
  // Bundle size (how many base units per bundle)
  bundleSize: {
    type: Number,
    default: 0,
    min: [0, 'Bundle size must be a positive number']
  },
  
  // ============================================================
  // COST
  // ============================================================
  buyPrice: {
    type: Number,
    required: true,
    min: [0, 'Buy price must be a positive number']
  },
  totalCost: {
    type: Number,
    required: true,
    min: [0, 'Total cost must be a positive number']
  },
  
  // ============================================================
  // TRACKING
  // ============================================================
  batchNumber: {
    type: String,
    trim: true
  },
  supplierId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier'
  },
  supplierName: {
    type: String,
    trim: true
  },
  expiryDate: {
    type: Date
  },
  receivedAt: {
    type: Date,
    default: Date.now
  },
  
  // ============================================================
  // REMAINING QUANTITIES
  // ============================================================
  // Remaining bundles/full units
  remainingQuantity: {
    type: Number,
    required: true,
    min: [0, 'Remaining quantity must be a positive number']
  },
  remainingInBase: {
    type: Number,
    required: true,
    min: [0, 'Remaining in base must be a positive number']
  },
  
  // Remaining loose units
  remainingLoose: {
    type: Number,
    default: 0,
    min: [0, 'Remaining loose must be a positive number']
  },
  remainingLooseInBase: {
    type: Number,
    default: 0,
    min: [0, 'Remaining loose in base must be a positive number']
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

// ============================================================
// INDEXES
// ============================================================
stockBatchSchema.index({ productId: 1, isActive: 1 });
stockBatchSchema.index({ productId: 1, expiryDate: 1 });
stockBatchSchema.index({ owner: 1, productId: 1 });
stockBatchSchema.index({ batchNumber: 1 });

// ============================================================
// VIRTUALS
// ============================================================

// Total remaining in base (bundles + loose)
stockBatchSchema.virtual('totalRemainingInBase').get(function() {
  return (this.remainingInBase || 0) + (this.remainingLooseInBase || 0);
});

// Total remaining in unit (bundles + loose)
stockBatchSchema.virtual('totalRemainingInUnit').get(function() {
  return (this.remainingQuantity || 0) + (this.remainingLoose || 0);
});

// Check if batch has any stock left
stockBatchSchema.virtual('hasStock').get(function() {
  return this.totalRemainingInBase > 0;
});

// ============================================================
// METHODS
// ============================================================

// Deduct from bundles only
stockBatchSchema.methods.deductBundles = function(quantity, quantityInBase) {
  this.quantity -= quantity;
  this.remainingQuantity -= quantity;
  this.quantityInBase -= quantityInBase;
  this.remainingInBase -= quantityInBase;
  
  if (this.quantity < 0) this.quantity = 0;
  if (this.remainingQuantity < 0) this.remainingQuantity = 0;
  if (this.quantityInBase < 0) this.quantityInBase = 0;
  if (this.remainingInBase < 0) this.remainingInBase = 0;
  
  return this.save();
};

// Deduct from loose only
stockBatchSchema.methods.deductLoose = function(quantity, quantityInBase) {
  this.looseQuantity -= quantity;
  this.remainingLoose -= quantity;
  this.looseInBase -= quantityInBase;
  this.remainingLooseInBase -= quantityInBase;
  
  if (this.looseQuantity < 0) this.looseQuantity = 0;
  if (this.remainingLoose < 0) this.remainingLoose = 0;
  if (this.looseInBase < 0) this.looseInBase = 0;
  if (this.remainingLooseInBase < 0) this.remainingLooseInBase = 0;
  
  return this.save();
};

// Deduct from both (flexible) - loose first, then bundles
stockBatchSchema.methods.deduct = function(quantity, quantityInBase) {
  // Try to deduct from loose first
  let remainingToDeduct = quantityInBase;
  let remainingInUnit = quantity;
  
  // Deduct from loose
  if (this.remainingLoose > 0) {
    const looseInBaseAvailable = this.remainingLooseInBase;
    const deductFromLoose = Math.min(remainingToDeduct, looseInBaseAvailable);
    const deductLooseUnits = deductFromLoose / this.unit.conversion;
    
    this.remainingLoose -= deductLooseUnits;
    this.remainingLooseInBase -= deductFromLoose;
    this.looseQuantity -= deductLooseUnits;
    this.looseInBase -= deductFromLoose;
    
    remainingToDeduct -= deductFromLoose;
    remainingInUnit -= deductLooseUnits;
  }
  
  // Deduct from bundles if still needed
  if (remainingToDeduct > 0 && this.remainingQuantity > 0) {
    const bundleInBaseAvailable = this.remainingInBase;
    const deductFromBundle = Math.min(remainingToDeduct, bundleInBaseAvailable);
    const deductBundleUnits = deductFromBundle / this.unit.conversion;
    
    this.remainingQuantity -= deductBundleUnits;
    this.remainingInBase -= deductFromBundle;
    this.quantity -= deductBundleUnits;
    this.quantityInBase -= deductFromBundle;
  }
  
  // Clean up any negative values
  if (this.quantity < 0) this.quantity = 0;
  if (this.remainingQuantity < 0) this.remainingQuantity = 0;
  if (this.quantityInBase < 0) this.quantityInBase = 0;
  if (this.remainingInBase < 0) this.remainingInBase = 0;
  if (this.looseQuantity < 0) this.looseQuantity = 0;
  if (this.remainingLoose < 0) this.remainingLoose = 0;
  if (this.looseInBase < 0) this.looseInBase = 0;
  if (this.remainingLooseInBase < 0) this.remainingLooseInBase = 0;
  
  return this.save();
};

// Auto-convert loose to bundles when threshold is met
stockBatchSchema.methods.autoConvertLooseToBundles = async function() {
  if (this.bundleSize <= 0 || this.remainingLoose < this.bundleSize) {
    return { converted: 0 };
  }
  
  const bundlesToAdd = Math.floor(this.remainingLoose / this.bundleSize);
  const looseRemaining = this.remainingLoose % this.bundleSize;
  
  // Add to bundles
  this.remainingQuantity += bundlesToAdd;
  this.remainingInBase += bundlesToAdd * this.bundleSize * this.unit.conversion;
  this.quantity += bundlesToAdd;
  this.quantityInBase += bundlesToAdd * this.bundleSize * this.unit.conversion;
  
  // Remove from loose
  this.remainingLoose = looseRemaining;
  this.remainingLooseInBase = looseRemaining * this.unit.conversion;
  this.looseQuantity = looseRemaining;
  this.looseInBase = looseRemaining * this.unit.conversion;
  
  await this.save();
  
  return { converted: bundlesToAdd };
};

// Check if batch is fully deducted
stockBatchSchema.methods.isFullyDeducted = function() {
  return this.totalRemainingInBase <= 0;
};

const StockBatch = mongoose.model('StockBatch', stockBatchSchema);
export default StockBatch;