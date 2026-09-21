// models/StockCount.js
import mongoose from 'mongoose';

// ============================================================
// STOCK COUNT ITEM SCHEMA (Embedded)
// One row per product in a reconciliation.
// ============================================================
const stockCountItemSchema = new mongoose.Schema({
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

  // Snapshot of pricing at time of count (never drifts)
  sellingPrice: { type: Number, default: 0, min: 0 },
  buyingPrice:  { type: Number, default: 0, min: 0 },
  baseUnitLabel: { type: String, trim: true },

  // Inputs
  openingStock:   { type: Number, required: true, min: 0 },  // from last confirmed count
  stockAdded:     { type: Number, default: 0, min: 0 },      // sum of 'received' movements
  expectedStock:  { type: Number, required: true, min: 0 },  // opening + added
  physicalStock:  { type: Number, default: null, min: 0 },  // null = not counted yet

  // Adjustments (owner-entered)
  adjustments: [{
    reason: {
      type: String,
      enum: ['damaged', 'expired', 'lost', 'personal', 'other'],
      required: true
    },
    quantity: { type: Number, required: true, min: 0 }
  }],
  adjustmentsTotal: { type: Number, default: 0, min: 0 },

  // POS side
  posRecordedQty: { type: Number, default: 0, min: 0 },

  // Calculated
  estimatedSold:   { type: Number, default: 0 },  // may be negative if variance
  unrecordedSold:  { type: Number, default: 0 },
  estimatedRevenue: { type: Number, default: 0 },
  estimatedProfit:  { type: Number, default: 0 },

  // physical - expected. Positive = overage, negative = shortfall.
  variance: { type: Number, default: 0 }
});



// ============================================================
// MAIN STOCK COUNT SCHEMA
// A reconciliation snapshot for a period. Once confirmed, frozen.
// ============================================================
const stockCountSchema = new mongoose.Schema({
  // Period
  periodStart: { type: Date, required: true },
  periodEnd:   { type: Date, required: true },

  // draft = in progress; confirmed = official snapshot; cancelled = discarded
  status: {
    type: String,
    enum: ['draft', 'confirmed', 'cancelled'],
    default: 'draft'
  },

  // Items
  items: [stockCountItemSchema],

  // Totals
  totals: {
    productsCounted:      { type: Number, default: 0 },
    estimatedUnitsSold:   { type: Number, default: 0 },
    posRecordedUnits:     { type: Number, default: 0 },
    unrecordedUnits:      { type: Number, default: 0 },
    estimatedSalesValue:  { type: Number, default: 0 },
    estimatedProfit:      { type: Number, default: 0 },
    totalAdjustments:     { type: Number, default: 0 },
    totalVariance:        { type: Number, default: 0 }
  },

  // Notes
  notes: {
    type: String,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  },

  // Confirmation
  confirmedAt: { type: Date, default: null },
  confirmedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  isActive: { type: Boolean, default: true },

  // Ownership
  owner: {
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
stockCountSchema.index({ owner: 1, status: 1, periodEnd: -1 });
stockCountSchema.index({ owner: 1, periodStart: -1 });
stockCountSchema.index({ owner: 1, confirmedAt: -1 });

// ============================================================
// Methods
// ============================================================

// Recompute totals from items (call before save/confirm)
stockCountSchema.methods.recalculateTotals = function() {
  const t = {
    productsCounted: 0,
    estimatedUnitsSold: 0,
    posRecordedUnits: 0,
    unrecordedUnits: 0,
    estimatedSalesValue: 0,
    estimatedProfit: 0,
    totalAdjustments: 0,
    totalVariance: 0
  };

  for (const item of this.items) {
    t.productsCounted     += 1;
    t.estimatedUnitsSold  += item.estimatedSold  || 0;
    t.posRecordedUnits    += item.posRecordedQty || 0;
    t.unrecordedUnits     += item.unrecordedSold || 0;
    t.estimatedSalesValue += item.estimatedRevenue || 0;
    t.estimatedProfit     += item.estimatedProfit  || 0;
    t.totalAdjustments    += item.adjustmentsTotal || 0;
    t.totalVariance       += item.variance || 0;
  }

  this.totals = t;
  return this;
};

// Mark confirmed
stockCountSchema.methods.confirm = function(userId) {
  this.status = 'confirmed';
  this.confirmedAt = new Date();
  this.confirmedBy = userId;
  return this;
};

// ============================================================
// Statics
// ============================================================

// Most recent confirmed count for an owner (used to seed next opening)
stockCountSchema.statics.getLatestConfirmed = async function(ownerId) {
  return this.findOne({
    owner: ownerId,
    status: 'confirmed',
    isActive: true
  }).sort({ periodEnd: -1 });
};
// Latest draft for a user
stockCountSchema.statics.getLatestDraft = async function(ownerId) {
  return this.findOne({
    owner: ownerId,
    status: 'draft',
    isActive: true
  }).sort({ createdAt: -1 });
};
const StockCount = mongoose.model('StockCount', stockCountSchema);
export default StockCount;