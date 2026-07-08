import Product from '../models/Product.js';

// Create product
export const createProduct = async (productData, userId) => {
  const product = await Product.create({
    ...productData,
    owner: userId
  });
  return product;
};

// Get all products for a user
export const getProducts = async (userId, filters = {}) => {
  const query = { owner: userId, ...filters };
  
  // If category filter provided
  if (filters.category) {
    query.category = filters.category;
  }
  
  // If active filter provided
  if (filters.isActive !== undefined) {
    query.isActive = filters.isActive;
  }
  
  const products = await Product.find(query).sort({ createdAt: -1 });
  return products;
};

// Get single product
export const getProductById = async (productId, userId) => {
  const product = await Product.findOne({ 
    _id: productId, 
    owner: userId 
  });
  
  if (!product) {
    throw new Error('Product not found');
  }
  
  return product;
};

// Update product
export const updateProduct = async (productId, userId, updateData) => {
  const product = await Product.findOne({ 
    _id: productId, 
    owner: userId 
  });
  
  if (!product) {
    throw new Error('Product not found');
  }
  
  // If updating selling price, validate it's >= buying price
  if (updateData.sellingPrice && updateData.sellingPrice < (updateData.buyingPrice || product.buyingPrice)) {
    throw new Error('Selling price must be greater than or equal to buying price');
  }
  
  // Update product
  const updatedProduct = await Product.findByIdAndUpdate(
    productId,
    updateData,
    { new: true, runValidators: true }
  );
  
  return updatedProduct;
};

// Delete product
export const deleteProduct = async (productId, userId) => {
  const product = await Product.findOne({ 
    _id: productId, 
    owner: userId 
  });
  
  if (!product) {
    throw new Error('Product not found');
  }
  
  await product.deleteOne();
  return { message: 'Product deleted successfully' };
};

// Get low stock products
export const getLowStockProducts = async (userId) => {
  const products = await Product.find({ 
    owner: userId,
    $expr: { 
      $lte: ['$quantity', '$minStockAlert'] 
    }
  });
  return products;
};

// Get out of stock products
export const getOutOfStockProducts = async (userId) => {
  const products = await Product.find({ 
    owner: userId,
    quantity: 0 
  });
  return products;
};

// Update stock
export const updateStock = async (productId, userId, quantityChange) => {
  const product = await getProductById(productId, userId);
  await product.updateStock(quantityChange);
  return product;
};

// Update product with price change detection
export const updateProductWithPriceCheck = async (productId, userId, updateData) => {
  const product = await Product.findOne({ 
    _id: productId, 
    owner: userId 
  });
  
  if (!product) {
    throw new Error('Product not found');
  }
  
  // Check for supplier price change
  let priceChangeAlert = null;
  if (updateData.supplierPrice !== undefined && 
      updateData.supplierPrice !== product.supplierPrice) {
    // Import alert service and create price change alert
    const { checkSupplierPriceChanges } = await import('./alertService.js');
    priceChangeAlert = await checkSupplierPriceChanges(
      productId,
      userId,
      product.supplierPrice,
      updateData.supplierPrice
    );
  }
  
  // Update product
  const updatedProduct = await Product.findByIdAndUpdate(
    productId,
    updateData,
    { new: true, runValidators: true }
  );
  
  return { product: updatedProduct, priceChangeAlert };
};