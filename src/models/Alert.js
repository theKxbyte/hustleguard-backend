// models/Alert.js
import mongoose from 'mongoose';

const alertSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['low_stock', 'out_of_stock', 'dead_stock', 'price_change', 'supplier_price_change', 'stock_expiry']
  },
  severity: {
    type: String,
    required: true,
    enum: ['info', 'warning', 'critical'],
    default: 'warning'
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  
  // Product reference (still works)
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  },
  productName: {
    type: String,
    trim: true
  },
  
  // NEW: Stock-specific fields
  stockBatch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StockBatch'  // For batch-specific alerts (expiry, etc.)
  },
  currentStockInBase: {
    type: Number,
    default: 0
  },
  minStockThreshold: {
    type: Number,
    default: 0
  },
  
  // Unit details (for UOM-specific alerts)
  unitName: {
    type: String,
    trim: true
  },
  unitLabel: {
    type: String,
    trim: true
  },
  quantityInUnit: {
    type: Number
  },
  
  // Old/New values
  oldValue: {
    type: mongoose.Schema.Types.Mixed
  },
  newValue: {
    type: mongoose.Schema.Types.Mixed
  },
  
  // Status
  isRead: {
    type: Boolean,
    default: false
  },
  isResolved: {
    type: Boolean,
    default: false
  },
  resolvedAt: {
    type: Date
  },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  resolutionNote: {
    type: String,
    trim: true
  },
  
  // Metadata
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Indexes
alertSchema.index({ owner: 1, isRead: 1 });
alertSchema.index({ owner: 1, createdAt: -1 });
alertSchema.index({ owner: 1, type: 1 });
alertSchema.index({ owner: 1, severity: 1 });
alertSchema.index({ product: 1, isResolved: 1 });
alertSchema.index({ stockBatch: 1 });

// Virtuals
alertSchema.virtual('timeAgo').get(function() {
  const diff = Date.now() - this.createdAt.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
});

// Methods
alertSchema.methods.resolve = async function(userId, note = '') {
  this.isResolved = true;
  this.resolvedAt = new Date();
  this.resolvedBy = userId;
  if (note) this.resolutionNote = note;
  return this.save();
};

alertSchema.methods.markAsRead = function() {
  this.isRead = true;
  return this.save();
};

// Statics
alertSchema.statics.getUnresolvedCount = async function(ownerId) {
  return this.countDocuments({
    owner: ownerId,
    isResolved: false,
    isRead: false
  });
};

const Alert = mongoose.model('Alert', alertSchema);
export default Alert;