// models/Category.js
import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a category name'],
    unique: true,
    trim: true,
    maxlength: [50, 'Category name cannot be more than 50 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [200, 'Description cannot be more than 200 characters']
  },
  color: {
    type: String,
    default: '#6B7280'
  },
  icon: {
    type: String,
    default: '📦'
  },
  productCount: {
    type: Number,
    default: 0
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
categorySchema.index({ owner: 1, name: 1 }, { unique: true });
categorySchema.index({ owner: 1, isActive: 1 });

// Virtual: Check if category can be deleted
categorySchema.virtual('canDelete').get(function() {
  return this.productCount === 0;
});

// Methods
categorySchema.methods.incrementProductCount = async function() {
  this.productCount += 1;
  return this.save();
};

categorySchema.methods.decrementProductCount = async function() {
  if (this.productCount > 0) {
    this.productCount -= 1;
    return this.save();
  }
  return this;
};

const Category = mongoose.model('Category', categorySchema);
export default Category;