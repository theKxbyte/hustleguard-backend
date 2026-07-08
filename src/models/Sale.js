import mongoose from 'mongoose';

const saleSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'Please add a product']
  },
  quantity: {
    type: Number,
    required: [true, 'Please add quantity'],
    min: [1, 'Quantity must be at least 1']
  },
  sellingPrice: {
    type: Number,
    required: [true, 'Please add selling price'],
    min: [0, 'Selling price must be positive']
  },
  buyingPrice: {
    type: Number,
    required: [true, 'Please add buying price'],
    min: [0, 'Buying price must be positive']
  },
  profit: {
    type: Number,
    required: true
  },
  customer: {
    type: String,
    trim: true
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'mobile_money', 'bank_transfer', 'credit'],
    default: 'cash'
  },
  saleDate: {
    type: Date,
    default: Date.now
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  notes: {
    type: String,
    maxlength: [200, 'Notes cannot be more than 200 characters']
  }
}, {
  timestamps: true
});

// Indexes for performance
saleSchema.index({ owner: 1, saleDate: -1 });
saleSchema.index({ owner: 1, product: 1 });

// Virtual: Calculate total sale amount
saleSchema.virtual('totalAmount').get(function() {
  return this.quantity * this.sellingPrice;
});

const Sale = mongoose.model('Sale', saleSchema);
export default Sale;