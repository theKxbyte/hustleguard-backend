// models/StockMovement.js
import mongoose from 'mongoose';

// ============================================================
// STOCK MOVEMENT SCHEMA
// Append-only ledger of every non-sale change to stock.
// Sales are NOT stored here — they live in the Sale model and
// are derived on read to avoid backfill and double-writes.
// ============================================================
const stockMovementSchema = new mongoose.Schema({
  // Product
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  productName: {
    type: String,
    required: true,
    trim: true
  },

  // What kind of movement this is
  type: {
    type: String,
    required: true,
    enum: ['received', 'adjustment', 'count', 'opening']
  },

  // Only used when type === 'adjustment'
  reason: {
    type: String,
    enum: ['damaged', 'expired', 'lost', 'personal', 'other', null],
    default: null
  },

  // Quantity in base units (always positive; direction implied by type)
  quantityInBase: {
    type: Number,
    required: true,
    min: [0, 'Quantity must be positive']
  },

  // How the user entered it (snapshot, like SaleItem.unit)
  unit: {
    name: { type: String, trim: true },
    label: { type: String, trim: true },
    conversion: { type: Number, min: 0.001 }
  },
  quantityEntered: {
    type: Number,
    min: 0
  },

  // Optional metadata for 'received'
  buyingPrice: {
    type: Number,
    min: 0,
    default: null
  },
  supplier: {
    type: String,
    trim: true,
    maxlength: [100, 'Supplier cannot exceed 100 characters']
  },

  // Free-form notes
  notes: {
    type: String,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  },

  // When the movement actually happened (may differ from createdAt)
  movementDate: {
    type: Date,
    default: Date.now
  },

  // Links back to source document if any
  refModel: {
    type: String,
    enum: ['StockCount', 'Product', null],
    default: null
  },
  refId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },

  isActive: {
    type: Boolean,
    default: true
  },

  // Ownership + audit
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// ============================================================
// Indexes
// ============================================================
stockMovementSchema.index({ owner: 1, productId: 1, movementDate: -1 });
stockMovementSchema.index({ owner: 1, type: 1, movementDate: -1 });
stockMovementSchema.index({ owner: 1, movementDate: -1 });

// ============================================================
// Statics
// ============================================================

// Sum quantityInBase for a product within a date range, for one type
stockMovementSchema.statics.sumByType = async function(ownerId, productId, type, startDate, endDate) {
  const match = {
    owner: new mongoose.Types.ObjectId(ownerId),
    productId: new mongoose.Types.ObjectId(productId),
    type,
    isActive: true,
    movementDate: { $gte: startDate, $lte: endDate }
  };

  const result = await this.aggregate([
    { $match: match },
    { $group: { _id: null, total: { $sum: '$quantityInBase' } } }
  ]);

  return result.length > 0 ? result[0].total : 0;
};

// Sum a specific adjustment reason for a product within a date range
stockMovementSchema.statics.sumAdjustment = async function(ownerId, productId, reason, startDate, endDate) {
  const match = {
    owner: new mongoose.Types.ObjectId(ownerId),
    productId: new mongoose.Types.ObjectId(productId),
    type: 'adjustment',
    isActive: true,
    movementDate: { $gte: startDate, $lte: endDate }
  };
  if (reason) match.reason = reason;

  const result = await this.aggregate([
    { $match: match },
    { $group: { _id: null, total: { $sum: '$quantityInBase' } } }
  ]);

  return result.length > 0 ? result[0].total : 0;
};

const StockMovement = mongoose.model('StockMovement', stockMovementSchema);
export default StockMovement;