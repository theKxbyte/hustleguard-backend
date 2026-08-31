import mongoose from 'mongoose';

const physicalCountSchema = new mongoose.Schema({
  // Product being counted
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
  
  // Unit details
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
  physicalQuantity: {
    type: Number,
    required: true,
    min: [0, 'Physical quantity must be positive']
  },
  physicalQuantityInBase: {
    type: Number,
    required: true,
    min: [0, 'Physical quantity in base must be positive']
  },
  
  systemQuantity: {
    type: Number,
    required: true,
    min: [0, 'System quantity must be positive']
  },
  systemQuantityInBase: {
    type: Number,
    required: true,
    min: [0, 'System quantity in base must be positive']
  },
  
  // Variance
  variance: {
    type: Number,
    required: true
  },
  varianceInBase: {
    type: Number,
    required: true
  },
  varianceType: {
    type: String,
    enum: ['over', 'under', 'none'],
    required: true,
    default: 'none'
  },
  
  // Stock value
  costPerUnit: {
    type: Number,
    required: true,
    min: [0, 'Cost per unit must be positive']
  },
  physicalValue: {
    type: Number,
    required: true,
    min: [0, 'Physical value must be positive']
  },
  systemValue: {
    type: Number,
    required: true,
    min: [0, 'System value must be positive']
  },
  varianceValue: {
    type: Number,
    required: true
  },
  
  // Adjustment details
  adjustmentReason: {
    type: String,
    enum: ['count_difference', 'damage', 'theft', 'spoilage', 'other'],
    default: 'count_difference'
  },
  adjustmentNote: {
    type: String,
    trim: true,
    maxlength: [500, 'Note cannot exceed 500 characters']
  },
  
  // Who counted
  countedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  countedByName: {
    type: String,
    trim: true
  },
  
  // Tracking
  countDate: {
    type: Date,
    default: Date.now
  },
  isAdjusted: {
    type: Boolean,
    default: false
  },
  adjustedAt: {
    type: Date
  },
  
  // Reference to report
  reportId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WeeklyStockReport'
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
physicalCountSchema.index({ owner: 1, countDate: -1 });
physicalCountSchema.index({ owner: 1, productId: 1 });
physicalCountSchema.index({ owner: 1, reportId: 1 });
physicalCountSchema.index({ owner: 1, varianceType: 1 });

// Methods
physicalCountSchema.methods.calculateVariance = function() {
  this.systemQuantityInBase = this.systemQuantity * this.unit.conversion;
  this.physicalQuantityInBase = this.physicalQuantity * this.unit.conversion;
  
  this.varianceInBase = this.physicalQuantityInBase - this.systemQuantityInBase;
  this.variance = this.physicalQuantity - this.systemQuantity;
  
  this.systemValue = this.systemQuantity * this.costPerUnit;
  this.physicalValue = this.physicalQuantity * this.costPerUnit;
  this.varianceValue = this.variance * this.costPerUnit;
  
  if (this.varianceInBase > 0) {
    this.varianceType = 'over';
  } else if (this.varianceInBase < 0) {
    this.varianceType = 'under';
  } else {
    this.varianceType = 'none';
  }
  
  return this;
};

// Statics - Get variance summary for date range
physicalCountSchema.statics.getVarianceSummary = async function(ownerId, startDate, endDate) {
  const match = {
    owner: ownerId,
    countDate: { $gte: startDate, $lte: endDate }
  };
  
  const result = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalOverVariance: {
          $sum: {
            $cond: [{ $gt: ['$varianceInBase', 0] }, '$varianceInBase', 0]
          }
        },
        totalUnderVariance: {
          $sum: {
            $cond: [{ $lt: ['$varianceInBase', 0] }, '$varianceInBase', 0]
          }
        },
        totalVarianceValue: { $sum: '$varianceValue' },
        count: { $sum: 1 }
      }
    }
  ]);
  
  return result.length > 0 ? result[0] : {
    totalOverVariance: 0,
    totalUnderVariance: 0,
    totalVarianceValue: 0,
    count: 0
  };
};

const PhysicalCount = mongoose.model('PhysicalCount', physicalCountSchema);
export default PhysicalCount;