// models/Sale.js
import mongoose from 'mongoose';

// ============================================================
// SALE ITEM SCHEMA (Embedded)
// ============================================================
const saleItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'Please add a product']
  },
  productName: {
    type: String,
    required: true,
    trim: true
  },
  
  // Unit sold in (snapshot from Product)
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
    },
    isBase: {
      type: Boolean,
      default: false
    }
  },
  
  // Quantities
  quantity: {
    type: Number,
    required: [true, 'Please add quantity'],
    min: [0.001, 'Quantity must be greater than 0']
  },
  quantityInBase: {
    type: Number,
    required: true,
    min: [0.001, 'Quantity in base must be greater than 0']
  },
  
  // Pricing
  unitPrice: {
    type: Number,
    required: [true, 'Please add selling price'],
    min: [0, 'Selling price must be positive']
  },
  totalPrice: {
    type: Number,
    required: true,
    min: [0, 'Total price must be positive']
  },
  
  // Cost & Profit (optional - for reporting)
  costPerUnit: {
    type: Number,
    default: 0,
    min: [0, 'Cost per unit must be positive']
  },
  totalCost: {
    type: Number,
    default: 0,
    min: [0, 'Total cost must be positive']
  },
  profit: {
    type: Number,
    default: 0
  }
});

// ============================================================
// MAIN SALE SCHEMA
// ============================================================
const saleSchema = new mongoose.Schema({
  // Invoice / Reference
  invoiceNumber: {
    type: String,
    unique: true,
    trim: true,
    sparse: true
  },
  
  // Customer
  customer: {
    type: String,
    trim: true
  },
  customerPhone: {
    type: String,
    trim: true
  },
  
  // Sale Items
  items: [saleItemSchema],
  
  // Totals
  subtotal: {
    type: Number,
    required: true,
    default: 0,
    min: [0, 'Subtotal must be positive']
  },
  discount: {
    type: Number,
    default: 0,
    min: [0, 'Discount must be positive']
  },
  discountType: {
    type: String,
    enum: ['fixed', 'percentage'],
    default: 'fixed'
  },
  tax: {
    type: Number,
    default: 0,
    min: [0, 'Tax must be positive']
  },
  taxRate: {
    type: Number,
    default: 0,
    min: [0, 'Tax rate must be positive']
  },
  total: {
    type: Number,
    required: true,
    default: 0,
    min: [0, 'Total must be positive']
  },
  totalProfit: {
    type: Number,
    default: 0
  },
  
  // Payment
  paymentMethod: {
    type: String,
    enum: ['cash', 'mpesa', 'bank_transfer', 'credit', 'other'],
    default: 'cash'
  },
  paymentStatus: {
    type: String,
    enum: ['paid', 'pending', 'partial', 'refunded'],
    default: 'paid'
  },
  amountPaid: {
    type: Number,
    default: 0,
    min: [0, 'Amount paid must be positive']
  },
  changeDue: {
    type: Number,
    default: 0,
    min: [0, 'Change due must be positive']
  },
  
  // Metadata
  saleDate: {
    type: Date,
    default: Date.now
  },
  notes: {
    type: String,
    maxlength: [500, 'Notes cannot be more than 500 characters']
  },
  
  isActive: {
    type: Boolean,
    default: true
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
saleSchema.index({ invoiceNumber: 1 });
saleSchema.index({ owner: 1, saleDate: -1 });
saleSchema.index({ owner: 1, customer: 1 });
saleSchema.index({ 'items.productId': 1 });

// Pre-save: Generate invoice number
saleSchema.pre('save', async function(next) {
  if (!this.invoiceNumber) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const count = await mongoose.model('Sale').countDocuments({ owner: this.owner });
    this.invoiceNumber = `INV-${year}${month}${day}-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

// Methods
saleSchema.methods.calculateTotals = function() {
  this.subtotal = this.items.reduce((sum, item) => sum + item.totalPrice, 0);
  this.totalProfit = this.items.reduce((sum, item) => sum + (item.profit || 0), 0);
  
  let totalAfterDiscount = this.subtotal;
  if (this.discount > 0) {
    if (this.discountType === 'percentage') {
      totalAfterDiscount = this.subtotal - (this.subtotal * this.discount / 100);
    } else {
      totalAfterDiscount = this.subtotal - this.discount;
    }
  }
  
  this.tax = totalAfterDiscount * this.taxRate / 100;
  this.total = totalAfterDiscount + this.tax;
  
  return this;
};

// Check if fully paid
saleSchema.methods.isFullyPaid = function() {
  return this.paymentStatus === 'paid' || this.amountPaid >= this.total;
};

// Get total quantity sold in base units
saleSchema.methods.getTotalQuantityInBase = function() {
  return this.items.reduce((sum, item) => sum + item.quantityInBase, 0);
};

// Statics
saleSchema.statics.getSalesSummary = async function(ownerId, startDate, endDate) {
  const match = {
    owner: ownerId,
    saleDate: { $gte: startDate, $lte: endDate },
    isActive: true
  };
  
  const result = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalSales: { $sum: 1 },
        totalRevenue: { $sum: '$total' },
        totalProfit: { $sum: '$totalProfit' },
        averageSaleValue: { $avg: '$total' }
      }
    }
  ]);
  
  return result.length > 0 ? result[0] : {
    totalSales: 0,
    totalRevenue: 0,
    totalProfit: 0,
    averageSaleValue: 0
  };
};

const Sale = mongoose.model('Sale', saleSchema);
export default Sale;