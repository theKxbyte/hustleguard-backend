import mongoose from 'mongoose';

const weeklyStockReportSchema = new mongoose.Schema({
  // Report period
  weekStartDate: {
    type: Date,
    required: true
  },
  weekEndDate: {
    type: Date,
    required: true
  },
  weekNumber: {
    type: Number,
    required: true
  },
  year: {
    type: Number,
    required: true
  },
  
  // Report items (embedded)
  items: [{
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
    category: {
      type: String,
      trim: true
    },
    
    // Unit details
    unit: {
      name: { type: String, required: true },
      label: { type: String, required: true },
      conversion: { type: Number, required: true }
    },
    
    // Opening stock (from previous week's closing)
    openingQuantity: {
      type: Number,
      required: true,
      min: 0
    },
    openingQuantityInBase: {
      type: Number,
      required: true,
      min: 0
    },
    openingValue: {
      type: Number,
      required: true,
      min: 0
    },
    
    // Additions during week
    quantityReceived: {
      type: Number,
      default: 0
    },
    quantityReceivedInBase: {
      type: Number,
      default: 0
    },
    receivedValue: {
      type: Number,
      default: 0
    },
    
    // Sales during week
    quantitySold: {
      type: Number,
      default: 0
    },
    quantitySoldInBase: {
      type: Number,
      default: 0
    },
    soldValue: {
      type: Number,
      default: 0
    },
    
    // Adjustments
    quantityAdjusted: {
      type: Number,
      default: 0
    },
    quantityAdjustedInBase: {
      type: Number,
      default: 0
    },
    adjustmentValue: {
      type: Number,
      default: 0
    },
    adjustmentReason: {
      type: String,
      enum: ['damage', 'theft', 'spoilage', 'return', 'other'],
      default: 'other'
    },
    
    // Closing stock (calculated)
    closingQuantity: {
      type: Number,
      required: true,
      min: 0
    },
    closingQuantityInBase: {
      type: Number,
      required: true,
      min: 0
    },
    closingValue: {
      type: Number,
      required: true,
      min: 0
    },
    
    // Physical count comparison
    physicalCount: {
      type: Number,
      default: 0
    },
    physicalCountInBase: {
      type: Number,
      default: 0
    },
    physicalValue: {
      type: Number,
      default: 0
    },
    hasPhysicalCount: {
      type: Boolean,
      default: false
    },
    
    // Variance
    variance: {
      type: Number,
      default: 0
    },
    varianceInBase: {
      type: Number,
      default: 0
    },
    varianceValue: {
      type: Number,
      default: 0
    },
    varianceType: {
      type: String,
      enum: ['over', 'under', 'none'],
      default: 'none'
    },
    
    // Cost per unit (snapshot)
    costPerUnit: {
      type: Number,
      required: true,
      min: 0
    }
  }],
  
  // Summary totals
  summary: {
    totalOpeningValue: { type: Number, default: 0 },
    totalReceivedValue: { type: Number, default: 0 },
    totalSoldValue: { type: Number, default: 0 },
    totalAdjustmentValue: { type: Number, default: 0 },
    totalClosingValue: { type: Number, default: 0 },
    totalVarianceValue: { type: Number, default: 0 },
    totalItems: { type: Number, default: 0 },
    itemsWithVariance: { type: Number, default: 0 }
  },
  
  // Profit calculation
  profit: {
    totalSales: { type: Number, default: 0 },
    totalCostOfGoodsSold: { type: Number, default: 0 },
    grossProfit: { type: Number, default: 0 },
    grossProfitMargin: { type: Number, default: 0 }, // percentage
    totalExpenses: { type: Number, default: 0 },
    netProfit: { type: Number, default: 0 },
    netProfitMargin: { type: Number, default: 0 } // percentage
  },
  
  // Status
  status: {
    type: String,
    enum: ['draft', 'pending_review', 'finalized', 'archived'],
    default: 'draft'
  },
  
  // Notes
  notes: {
    type: String,
    trim: true,
    maxlength: [1000, 'Notes cannot exceed 1000 characters']
  },
  
  // Who generated
  generatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  finalizedAt: {
    type: Date
  },
  finalizedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Ownership
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Indexes
weeklyStockReportSchema.index({ owner: 1, weekStartDate: -1 });
weeklyStockReportSchema.index({ owner: 1, weekNumber: 1, year: 1 });
weeklyStockReportSchema.index({ owner: 1, status: 1 });
weeklyStockReportSchema.index({ 'items.productId': 1 });

// Methods
weeklyStockReportSchema.methods.calculateSummary = function() {
  const summary = {
    totalOpeningValue: 0,
    totalReceivedValue: 0,
    totalSoldValue: 0,
    totalAdjustmentValue: 0,
    totalClosingValue: 0,
    totalVarianceValue: 0,
    totalItems: this.items.length,
    itemsWithVariance: 0
  };
  
  this.items.forEach(item => {
    summary.totalOpeningValue += item.openingValue || 0;
    summary.totalReceivedValue += item.receivedValue || 0;
    summary.totalSoldValue += (item.soldValue || 0);
    summary.totalAdjustmentValue += item.adjustmentValue || 0;
    summary.totalClosingValue += item.closingValue || 0;
    summary.totalVarianceValue += item.varianceValue || 0;
    
    if (item.variance !== 0) {
      summary.itemsWithVariance += 1;
    }
  });
  
  this.summary = summary;
  return this;
};

weeklyStockReportSchema.methods.calculateProfit = function() {
  // COGS = opening + received - closing
  const cogs = this.summary.totalOpeningValue + 
               this.summary.totalReceivedValue - 
               this.summary.totalClosingValue;
  
  // For COGS, also consider adjustments (losses)
  const adjustedCogs = cogs + this.summary.totalAdjustmentValue;
  
  // Gross profit = Sales - COGS
  const grossProfit = this.summary.totalSoldValue - adjustedCogs;
  const grossProfitMargin = this.summary.totalSoldValue > 0 
    ? (grossProfit / this.summary.totalSoldValue) * 100 
    : 0;
  
  this.profit.totalSales = this.summary.totalSoldValue;
  this.profit.totalCostOfGoodsSold = adjustedCogs;
  this.profit.grossProfit = grossProfit;
  this.profit.grossProfitMargin = grossProfitMargin;
  
  // Net profit will be set separately when expenses are added
  return this;
};

weeklyStockReportSchema.methods.setNetProfit = function(expenses) {
  this.profit.totalExpenses = expenses || 0;
  this.profit.netProfit = this.profit.grossProfit - this.profit.totalExpenses;
  this.profit.netProfitMargin = this.profit.grossProfit > 0 
    ? (this.profit.netProfit / this.profit.grossProfit) * 100 
    : 0;
  return this;
};

weeklyStockReportSchema.methods.finalize = function(userId) {
  this.status = 'finalized';
  this.finalizedAt = new Date();
  this.finalizedBy = userId;
  return this;
};

// Statics - Get report by date range
weeklyStockReportSchema.statics.getReportsByDateRange = async function(ownerId, startDate, endDate) {
  return this.find({
    owner: ownerId,
    weekStartDate: { $gte: startDate },
    weekEndDate: { $lte: endDate }
  }).sort({ weekStartDate: -1 });
};

// Statics - Get latest report
weeklyStockReportSchema.statics.getLatestReport = async function(ownerId) {
  return this.findOne({
    owner: ownerId,
    status: { $in: ['finalized', 'pending_review'] }
  }).sort({ weekStartDate: -1 });
};

const WeeklyStockReport = mongoose.model('WeeklyStockReport', weeklyStockReportSchema);
export default WeeklyStockReport;