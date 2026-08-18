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
  
  // Unit sold in (snapshot from Product UOM)
  unitSold: {
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
  
  // Cost & Profit
  costPerBaseUnit: {
    type: Number,
    required: true,
    min: [0, 'Cost per base unit must be positive']
  },
  totalCost: {
    type: Number,
    required: true,
    min: [0, 'Total cost must be positive']
  },
  profit: {
    type: Number,
    required: true,
    default: 0
  },
  
  // Stock deductions (track which batches were used)
  stockDeductions: [{
    batchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StockBatch'
    },
    unitName: String,
    quantityDeducted: Number,
    quantityInBaseDeducted: Number
  }]
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
  
  // ========== CUSTOMER ==========
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer'
  },
  customer: {
    type: String,
    trim: true
  },
  customerPhone: {
    type: String,
    trim: true
  },
  customerEmail: {
    type: String,
    trim: true,
    lowercase: true
  },
  
  // ========== SALE ITEMS ==========
  items: [saleItemSchema],
  
  // ========== TOTALS ==========
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
  
  // ========== PAYMENT ==========
  paymentMethod: {
    type: String,
    enum: ['cash', 'mobile_money', 'bank_transfer', 'credit', 'mpesa', 'other'],
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
  
  // ========== METADATA ==========
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
  
  // ========== OWNERSHIP ==========
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

// ============================================================
// INDEXES
// ============================================================
saleSchema.index({ invoiceNumber: 1 });
saleSchema.index({ owner: 1, saleDate: -1 });
saleSchema.index({ owner: 1, customer: 1 });
saleSchema.index({ 'items.productId': 1 });
saleSchema.index({ paymentStatus: 1 });
saleSchema.index({ saleDate: -1 });

// ============================================================
// MIDDLEWARE: Generate invoice number before save
// ============================================================
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

// ============================================================
// METHODS
// ============================================================

// Calculate all totals from items
saleSchema.methods.calculateTotals = function() {
  // Subtotal = sum of all item totals
  this.subtotal = this.items.reduce((sum, item) => sum + item.totalPrice, 0);
  
  // Total profit = sum of all item profits
  this.totalProfit = this.items.reduce((sum, item) => sum + (item.profit || 0), 0);
  
  // Apply discount
  let totalAfterDiscount = this.subtotal;
  if (this.discount > 0) {
    if (this.discountType === 'percentage') {
      const discountAmount = (this.subtotal * this.discount) / 100;
      totalAfterDiscount = this.subtotal - discountAmount;
    } else {
      totalAfterDiscount = this.subtotal - this.discount;
    }
  }
  
  // Apply tax
  this.tax = (totalAfterDiscount * this.taxRate) / 100;
  this.total = totalAfterDiscount + this.tax;
  
  return this;
};

// Check if sale is fully paid
saleSchema.methods.isFullyPaid = function() {
  return this.paymentStatus === 'paid' || this.amountPaid >= this.total;
};

// Check if sale has items
saleSchema.methods.hasItems = function() {
  return this.items && this.items.length > 0;
};

// Get total quantity of items sold (in base units)
saleSchema.methods.getTotalQuantityInBase = function() {
  return this.items.reduce((sum, item) => sum + item.quantityInBase, 0);
};

// ============================================================
// VIRTUALS
// ============================================================

// Total amount (alias for total)
saleSchema.virtual('totalAmount').get(function() {
  return this.total;
});

// Number of items in sale
saleSchema.virtual('itemCount').get(function() {
  return this.items ? this.items.length : 0;
});

// ============================================================
// STATICS
// ============================================================

// Get sales summary for a date range
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

// Get sales by product
saleSchema.statics.getSalesByProduct = async function(ownerId, productId, startDate, endDate) {
  const match = {
    owner: ownerId,
    'items.productId': productId,
    saleDate: { $gte: startDate, $lte: endDate },
    isActive: true
  };
  
  return this.aggregate([
    { $match: match },
    { $unwind: '$items' },
    { $match: { 'items.productId': productId } },
    {
      $group: {
        _id: '$items.productId',
        totalQuantity: { $sum: '$items.quantityInBase' },
        totalRevenue: { $sum: '$items.totalPrice' },
        totalCost: { $sum: '$items.totalCost' },
        totalProfit: { $sum: '$items.profit' },
        saleCount: { $sum: 1 }
      }
    }
  ]);
};

const Sale = mongoose.model('Sale', saleSchema);
export default Sale;