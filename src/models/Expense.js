import mongoose from 'mongoose';

const expenseSchema = new mongoose.Schema({
  // Expense details
  description: {
    type: String,
    required: [true, 'Please add a description'],
    trim: true,
    maxlength: [200, 'Description cannot exceed 200 characters']
  },
  amount: {
    type: Number,
    required: [true, 'Please add an amount'],
    min: [0, 'Amount must be positive']
  },
  category: {
    type: String,
    required: [true, 'Please add a category'],
    enum: [
      'rent', 'utilities', 'salaries', 'transport',
      'supplies', 'marketing', 'maintenance', 'tax',
      'insurance', 'licenses', 'equipment', 'other'
    ],
    default: 'other'
  },
  categoryLabel: {
    type: String,
    trim: true
  },
  
  // Payment
  paymentMethod: {
    type: String,
    enum: ['cash', 'bank_transfer', 'mobile_money', 'mpesa', 'other'],
    default: 'cash'
  },
  paymentReference: {
    type: String,
    trim: true
  },
  
  // Date tracking
  expenseDate: {
    type: Date,
    default: Date.now
  },
  isRecurring: {
    type: Boolean,
    default: false
  },
  recurrenceFrequency: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'],
    required: function() { return this.isRecurring; }
  },
  
  // Receipt/Attachment
  receiptUrl: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  },
  
  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Ownership
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
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
expenseSchema.index({ owner: 1, expenseDate: -1 });
expenseSchema.index({ owner: 1, category: 1 });
expenseSchema.index({ owner: 1, expenseDate: 1 });
expenseSchema.index({ owner: 1, isActive: 1 });

// Statics - Get expenses summary for date range
expenseSchema.statics.getExpensesSummary = async function(ownerId, startDate, endDate) {
  const match = {
    owner: ownerId,
    expenseDate: { $gte: startDate, $lte: endDate },
    isActive: true
  };
  
  const result = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalExpenses: { $sum: 1 },
        totalAmount: { $sum: '$amount' }
      }
    }
  ]);
  
  return result.length > 0 ? result[0] : {
    totalExpenses: 0,
    totalAmount: 0
  };
};

// Statics - Get expenses by category
expenseSchema.statics.getExpensesByCategory = async function(ownerId, startDate, endDate) {
  const match = {
    owner: ownerId,
    expenseDate: { $gte: startDate, $lte: endDate },
    isActive: true
  };
  
  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$category',
        totalAmount: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    },
    { $sort: { totalAmount: -1 } }
  ]);
};

// Middleware - Auto set userId to owner if not set
expenseSchema.pre('save', function(next) {
  if (!this.userId) {
    this.userId = this.owner;
  }
  next();
});

const Expense = mongoose.model('Expense', expenseSchema);
export default Expense;