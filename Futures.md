// Future: User can have multiple shops
const userSchema = {
  shops: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shop'
  }]
}

// Each product belongs to a shop AND owner
const productSchema = {
  shop: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shop',
    required: true
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}


// Employees can view but not delete
const employeeSchema = {
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop' },
  permissions: ['view', 'edit', 'sell']
}

