// models/Alert.js
import mongoose from 'mongoose';

const alertSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['low_stock', 'out_of_stock'],
    default: 'low_stock'
  },
  severity: {
    type: String,
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
  
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  productName: {
    type: String,
    trim: true
  },
  currentStock: {
    type: Number,
    default: 0
  },
  threshold: {
    type: Number,
    default: 0
  },
  
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
alertSchema.index({ productId: 1, isResolved: 1 });

// Methods
alertSchema.methods.markAsRead = function() {
  this.isRead = true;
  return this.save();
};

alertSchema.methods.resolve = function() {
  this.isResolved = true;
  this.resolvedAt = new Date();
  return this.save();
};

// Statics
alertSchema.statics.getUnresolvedCount = async function(ownerId) {
  return this.countDocuments({
    owner: ownerId,
    isResolved: false
  });
};

const Alert = mongoose.model('Alert', alertSchema);
export default Alert;