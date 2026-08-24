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
  
  // Quantities
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
  
  // Cost
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
  
  // Tracking
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
  
  // Remaining from this batch
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
stockBatchSchema.index({ productId: 1, isActive: 1 });
stockBatchSchema.index({ productId: 1, expiryDate: 1 });
stockBatchSchema.index({ owner: 1, productId: 1 });
stockBatchSchema.index({ batchNumber: 1 });

// Methods
stockBatchSchema.methods.deduct = function(quantity, quantityInBase) {
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

stockBatchSchema.methods.isFullyDeducted = function() {
  return this.remainingQuantity <= 0 || this.remainingInBase <= 0;
};

const StockBatch = mongoose.model('StockBatch', stockBatchSchema);
export default StockBatch;
