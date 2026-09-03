// models/Expense.js
import mongoose from 'mongoose';

const expenseSchema = new mongoose.Schema({
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
    enum: ['rent', 'utilities', 'salaries', 'transport', 'supplies', 'marketing', 'maintenance', 'tax', 'insurance', 'equipment', 'other'],
    default: 'other'
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'mpesa', 'bank_transfer', 'other'],
    default: 'cash'
  },
  reference: {
    type: String,
    trim: true
  },
  expenseDate: {
    type: Date,
    default: Date.now
  },
  notes: {
    type: String,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  },
  receiptUrl: {
    type: String,
    trim: true
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
expenseSchema.index({ owner: 1, expenseDate: -1 });
expenseSchema.index({ owner: 1, category: 1 });

// Statics
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

const Expense = mongoose.model('Expense', expenseSchema);
export default Expense;