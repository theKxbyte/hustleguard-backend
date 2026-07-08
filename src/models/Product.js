import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a product name'],
    trim: true,
    maxlength: [100, 'Product name cannot be more than 100 characters']
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot be more than 500 characters']
  },
  category: {
    type: String,
    required: [true, 'Please add a category'],
    trim: true,
    enum: ['Electronics', 'Clothing', 'Food', 'Beverages', 'Health', 'Beauty', 'Home', 'Sports', 'Toys', 'Books', 'Other']
  },
  buyingPrice: {
    type: Number,
    required: [true, 'Please add a buying price'],
    min: [0, 'Buying price must be a positive number']
  },
  sellingPrice: {
    type: Number,
    required: [true, 'Please add a selling price'],
    min: [0, 'Selling price must be a positive number'],
    validate: {
      validator: function(value) {
        return value >= this.buyingPrice;
      },
      message: 'Selling price must be greater than or equal to buying price'
    }
  },
  quantity: {
    type: Number,
    required: [true, 'Please add quantity'],
    min: [0, 'Quantity must be a positive number'],
    default: 0
  },
  minStockAlert: {
    type: Number,
    default: 5,
    min: [0, 'Minimum stock alert must be a positive number']
  },
  supplier: {
    type: String,
    trim: true
  },
  supplierPrice: {
    type: Number,
    min: [0, 'Supplier price must be a positive number']
  },
  lastRestockDate: {
    type: Date
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

// Indexes for better performance
productSchema.index({ owner: 1, name: 1 });
productSchema.index({ owner: 1, category: 1 });
productSchema.index({ owner: 1, quantity: 1 });

// Virtual: Calculate profit per unit
productSchema.virtual('profitPerUnit').get(function() {
  return this.sellingPrice - this.buyingPrice;
});

// Virtual: Total stock value
productSchema.virtual('stockValue').get(function() {
  return this.quantity * this.buyingPrice;
});

// Method: Check if product is low stock
productSchema.methods.isLowStock = function() {
  return this.quantity <= this.minStockAlert;
};

// Method: Check if product is out of stock
productSchema.methods.isOutOfStock = function() {
  return this.quantity === 0;
};

// Method: Update stock
productSchema.methods.updateStock = function(quantityChange) {
  this.quantity += quantityChange;
  if (this.quantity < 0) this.quantity = 0;
  return this.save();
};

const Product = mongoose.model('Product', productSchema);
export default Product;