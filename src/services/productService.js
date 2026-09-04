// services/productService.js
import Product from '../models/Product.js';
import mongoose from 'mongoose';

// ============================================================
// @desc    Create product with initial stock
// @route   POST /api/products
// @access  Private
// ============================================================
export const createProduct = async (productData, userId) => {
  const { name, description, category, units, minStockAlert, supplier, initialStock } = productData;

  if (!units || units.length === 0) {
    throw new Error('At least one unit is required');
  }

  const baseUnit = units.find(u => u.isBase === true);
  if (!baseUnit) {
    throw new Error('Base unit is required (isBase: true)');
  }

  for (const unit of units) {
    if (!unit.name || !unit.conversion || unit.conversion <= 0) {
      throw new Error(`Invalid unit: ${unit.name || 'unnamed'}`);
    }
    if (unit.isBase && unit.conversion !== 1) {
      throw new Error('Base unit must have conversion of 1');
    }
  }

  const product = await Product.create({
    name: name.trim(),
    description: description?.trim() || '',
    category: category.trim(),
    units: units,
    stock: initialStock || 0,
    minStockAlert: minStockAlert || 5,
    supplier: supplier?.trim() || '',
    isActive: true,
    owner: userId
  });

  return product;
};

// ============================================================
// Get all products
// ============================================================
export const getProducts = async (userId, filters = {}) => {
  const query = { owner: userId };

  if (filters.category) query.category = filters.category;
  if (filters.isActive !== undefined) query.isActive = filters.isActive;

  if (filters.search) {
    const searchTerm = filters.search.trim();
    query.$or = [
      { name: { $regex: searchTerm, $options: 'i' } },
      { 'units.barcode': searchTerm }
    ];
  }

  const products = await Product.find(query)
    .sort({ createdAt: -1 })
    .lean();

  // Add computed fields
  const enrichedProducts = products.map(product => ({
    ...product,
    isLowStock: product.stock <= product.minStockAlert && product.stock > 0,
    isOutOfStock: product.stock === 0
  }));

  return enrichedProducts;
};

// ============================================================
// Get single product
// ============================================================
export const getProductById = async (productId, userId) => {
  const product = await Product.findOne({
    _id: productId,
    owner: userId
  }).lean();

  if (!product) {
    throw new Error('Product not found');
  }

  return {
    ...product,
    isLowStock: product.stock <= product.minStockAlert && product.stock > 0,
    isOutOfStock: product.stock === 0
  };
};

// ============================================================
// Update product
// ============================================================
export const updateProduct = async (productId, userId, updateData) => {
  const product = await Product.findOne({
    _id: productId,
    owner: userId
  });

  if (!product) {
    throw new Error('Product not found');
  }

  // If updating units, validate
  if (updateData.units) {
    const baseUnit = updateData.units.find(u => u.isBase === true);
    if (!baseUnit) {
      throw new Error('Base unit is required (isBase: true)');
    }
    for (const unit of updateData.units) {
      if (!unit.name || !unit.conversion || unit.conversion <= 0) {
        throw new Error(`Invalid unit: ${unit.name || 'unnamed'}`);
      }
    }
  }

  const updatedProduct = await Product.findOneAndUpdate(
    { _id: productId, owner: userId },
    { $set: updateData },
    { new: true, runValidators: true }
  );

  return updatedProduct;
};

// ============================================================
// Delete product
// ============================================================
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

// ============================================================
// Get low stock products
// ============================================================
export const getLowStockProducts = async (userId) => {
  const products = await Product.find({
    owner: userId,
    isActive: true,
    stock: { $gt: 0 }
  }).lean();

  // Filter in JavaScript
  return products.filter(p => p.stock <= p.minStockAlert);
};

// ============================================================
// Get out of stock products
// ============================================================
export const getOutOfStockProducts = async (userId) => {
  const products = await Product.find({
    owner: userId,
    isActive: true,
    stock: 0
  }).lean();

  return products;
};

// ============================================================
// Add stock to product
// ============================================================
export const addStock = async (productId, userId, quantity) => {
  const product = await Product.findOne({
    _id: productId,
    owner: userId
  });

  if (!product) {
    throw new Error('Product not found');
  }

  product.stock += quantity;
  await product.save();

  return product;
};

// ============================================================
// Get product by barcode
// ============================================================
export const getProductByBarcode = async (barcode, userId) => {
  const product = await Product.findOne({
    owner: userId,
    isActive: true,
    'units.barcode': barcode
  });

  if (!product) {
    throw new Error('Product not found with this barcode');
  }

  return product;
};

// ============================================================
// Bulk create products
// ============================================================
export const bulkCreateProducts = async (productsData, userId) => {
  const results = {
    success: [],
    failed: []
  };

  for (const data of productsData) {
    try {
      const product = await createProduct(data, userId);
      results.success.push(product);
    } catch (error) {
      results.failed.push({
        productData: data,
        error: error.message
      });
    }
  }

  return results;
};

// ============================================================
// Get stock alerts summary
// ============================================================
export const getStockAlerts = async (userId) => {
  const lowStock = await getLowStockProducts(userId);
  const outOfStock = await getOutOfStockProducts(userId);

  return {
    lowStock: lowStock.length,
    outOfStock: outOfStock.length,
    details: {
      lowStockProducts: lowStock,
      outOfStockProducts: outOfStock
    }
  };
};