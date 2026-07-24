// services/productService.js - UPDATED
import Product from '../models/Product.js';

// Create product
export const createProduct = async (productData, userId) => {
  // Validate prices before creating
  if (productData.sellingPrice < productData.buyingPrice) {
    throw new Error(`Selling price (${productData.sellingPrice}) must be greater than or equal to buying price (${productData.buyingPrice})`);
  }
  
  const product = await Product.create({
    ...productData,
    owner: userId
  });
  return product;
};

// Get all products for a user
export const getProducts = async (userId, filters = {}) => {
  const query = { owner: userId, ...filters };
  
  if (filters.category) {
    query.category = filters.category;
  }
  
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

// Update product - FIXED with manual validation
export const updateProduct = async (productId, userId, updateData) => {
  // Find the product first
  const product = await Product.findOne({ 
    _id: productId, 
    owner: userId 
  });
  
  if (!product) {
    throw new Error('Product not found');
  }

  // Get the current values
  const currentBuyingPrice = product.buyingPrice;
  const currentSellingPrice = product.sellingPrice;
  
  // Determine final values (use new values if provided, otherwise keep current)
  const finalBuyingPrice = updateData.buyingPrice !== undefined 
    ? updateData.buyingPrice 
    : currentBuyingPrice;
    
  const finalSellingPrice = updateData.sellingPrice !== undefined 
    ? updateData.sellingPrice 
    : currentSellingPrice;

  // MANUAL VALIDATION: Check if selling price >= buying price
  if (finalSellingPrice < finalBuyingPrice) {
    throw new Error(`Selling price (${finalSellingPrice}) must be greater than or equal to buying price (${finalBuyingPrice})`);
  }

  // Update the product using findOneAndUpdate with the validated data
  const updatedProduct = await Product.findOneAndUpdate(
    { _id: productId, owner: userId },
    {
      $set: {
        name: updateData.name !== undefined ? updateData.name : product.name,
        category: updateData.category !== undefined ? updateData.category : product.category,
        buyingPrice: finalBuyingPrice,
        sellingPrice: finalSellingPrice,
        quantity: updateData.quantity !== undefined ? updateData.quantity : product.quantity,
        minStockAlert: updateData.minStockAlert !== undefined ? updateData.minStockAlert : product.minStockAlert,
        unit: updateData.unit !== undefined ? updateData.unit : product.unit,
        supplier: updateData.supplier !== undefined ? updateData.supplier : product.supplier,
        supplierPrice: updateData.supplierPrice !== undefined ? updateData.supplierPrice : product.supplierPrice,
        description: updateData.description !== undefined ? updateData.description : product.description,
        barcode: updateData.barcode !== undefined ? updateData.barcode : product.barcode
      }
    },
    { 
      new: true,
      runValidators: true
    }
  );
  
  if (!updatedProduct) {
    throw new Error('Product not found after update');
  }
  
  return updatedProduct;
};

// Alternative: Using save() method (even more reliable)
export const updateProductAlternative = async (productId, userId, updateData) => {
  const product = await Product.findOne({ 
    _id: productId, 
    owner: userId 
  });
  
  if (!product) {
    throw new Error('Product not found');
  }

  // Apply updates
  Object.keys(updateData).forEach(key => {
    product[key] = updateData[key];
  });

  // Manual validation before saving
  if (product.sellingPrice < product.buyingPrice) {
    throw new Error(`Selling price (${product.sellingPrice}) must be greater than or equal to buying price (${product.buyingPrice})`);
  }

  // Save with validation
  await product.save();
  return product;
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
  
  let priceChangeAlert = null;
  if (updateData.supplierPrice !== undefined && 
      updateData.supplierPrice !== product.supplierPrice) {
    const { checkSupplierPriceChanges } = await import('./alertService.js');
    priceChangeAlert = await checkSupplierPriceChanges(
      productId,
      userId,
      product.supplierPrice,
      updateData.supplierPrice
    );
  }
  
  const updatedProduct = await Product.findByIdAndUpdate(
    productId,
    updateData,
    { new: true, runValidators: true }
  );
  
  return { product: updatedProduct, priceChangeAlert };
};