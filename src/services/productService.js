// services/productService.js - UPDATED with UOM + StockBatch
import Product from '../models/Product.js';
import StockBatch from '../models/StockBatch.js';
import mongoose from 'mongoose';

// ============================================================
// Create product with UOM configuration
// ============================================================
export const createProduct = async (productData, userId) => {
  // Validate UOM configuration
  if (!productData.baseUnit || !productData.baseUnit.name) {
    throw new Error('Base unit is required');
  }

  // Validate sell units
  if (productData.sellUnits && productData.sellUnits.length > 0) {
    for (const unit of productData.sellUnits) {
      if (!unit.name || !unit.conversion || unit.conversion <= 0) {
        throw new Error(`Invalid sell unit: ${unit.name || 'unnamed'}`);
      }
      // Ensure base unit exists in sell units
      if (unit.isBase && unit.name !== productData.baseUnit.name) {
        throw new Error(`Base unit "${productData.baseUnit.name}" must match the base unit in sell units`);
      }
    }
  }

  // Validate stock units
  if (productData.stockUnits && productData.stockUnits.length > 0) {
    for (const unit of productData.stockUnits) {
      if (!unit.name || !unit.conversion || unit.conversion <= 0) {
        throw new Error(`Invalid stock unit: ${unit.name || 'unnamed'}`);
      }
    }
  }

  // Ensure base unit is in sellUnits if not provided
  if (productData.sellUnits && productData.sellUnits.length > 0) {
    const hasBase = productData.sellUnits.some(u => u.isBase);
    if (!hasBase) {
      productData.sellUnits.push({
        name: productData.baseUnit.name,
        label: productData.baseUnit.label || productData.baseUnit.name,
        conversion: 1,
        isBase: true,
        sellPrice: productData.sellingPrice || 0,
        isActive: true
      });
    }
  }

  // Ensure base unit is in stockUnits if not provided
  if (productData.stockUnits && productData.stockUnits.length > 0) {
    const hasBase = productData.stockUnits.some(u => u.isBase);
    if (!hasBase) {
      productData.stockUnits.push({
        name: productData.baseUnit.name,
        label: productData.baseUnit.label || productData.baseUnit.name,
        conversion: 1,
        isBase: true,
        buyPrice: productData.buyingPrice || 0,
        isActive: true
      });
    }
  }

  // Set legacy fields for backward compatibility
  const baseSellUnit = productData.sellUnits?.find(u => u.isBase) || 
                       productData.sellUnits?.[0];
  const baseStockUnit = productData.stockUnits?.find(u => u.isBase) || 
                        productData.stockUnits?.[0];

  const product = await Product.create({
    ...productData,
    // Legacy fields
    unit: productData.baseUnit.name,
    buyingPrice: baseStockUnit?.buyPrice || 0,
    sellingPrice: baseSellUnit?.sellPrice || 0,
    quantity: 0, // Stock is tracked in StockBatch
    owner: userId
  });

  return product;
};

// ============================================================
// Get all products for a user with stock info
// ============================================================
export const getProducts = async (userId, filters = {}) => {
  const query = { owner: userId };

  if (filters.category) {
    query.category = filters.category;
  }

  if (filters.isActive !== undefined) {
    query.isActive = filters.isActive;
  }

  // Search by name or barcode
  if (filters.search) {
    const searchTerm = filters.search.trim();
    query.$or = [
      { name: { $regex: searchTerm, $options: 'i' } },
      { 'sellUnits.barcode': searchTerm },
      { 'stockUnits.barcode': searchTerm }
    ];
  }

  const products = await Product.find(query)
    .sort({ createdAt: -1 })
    .lean();

  // Get stock info for all products
  const productIds = products.map(p => p._id);
  const stockData = await getStockForProducts(productIds, userId);

  // Enrich products with stock info
  const enrichedProducts = products.map(product => {
    const stock = stockData[product._id.toString()] || { totalInBase: 0, batches: [] };
    return {
      ...product,
      totalStock: stock.totalInBase,
      stockBatches: stock.batches,
      isLowStock: stock.totalInBase <= product.minStockAlert && stock.totalInBase > 0,
      isOutOfStock: stock.totalInBase <= 0
    };
  });

  return enrichedProducts;
};

// ============================================================
// Get single product with stock info
// ============================================================
export const getProductById = async (productId, userId, includeStock = true) => {
  const product = await Product.findOne({
    _id: productId,
    owner: userId
  }).lean();

  if (!product) {
    throw new Error('Product not found');
  }

  if (!includeStock) {
    return product;
  }

  // Get stock info
  const stock = await getStockForProduct(productId, userId);
  
  // Get sell units with availability
  const sellUnitsWithStock = product.sellUnits?.map(unit => {
    const availableInUnit = stock.totalInBase / unit.conversion;
    return {
      ...unit,
      availableStock: stock.totalInBase,
      availableUnits: availableInUnit,
      inStock: stock.totalInBase > 0 && availableInUnit >= 0.001
    };
  }) || [];

  return {
    ...product,
    totalStock: stock.totalInBase,
    stockBatches: stock.batches,
    sellUnits: sellUnitsWithStock,
    isLowStock: stock.totalInBase <= product.minStockAlert && stock.totalInBase > 0,
    isOutOfStock: stock.totalInBase <= 0
  };
};

// ============================================================
// Update product with UOM support
// ============================================================
export const updateProduct = async (productId, userId, updateData) => {
  const product = await Product.findOne({
    _id: productId,
    owner: userId
  });

  if (!product) {
    throw new Error('Product not found');
  }

  // Validate UOM updates
  if (updateData.sellUnits) {
    for (const unit of updateData.sellUnits) {
      if (!unit.name || !unit.conversion || unit.conversion <= 0) {
        throw new Error(`Invalid sell unit: ${unit.name || 'unnamed'}`);
      }
    }
  }

  if (updateData.stockUnits) {
    for (const unit of updateData.stockUnits) {
      if (!unit.name || !unit.conversion || unit.conversion <= 0) {
        throw new Error(`Invalid stock unit: ${unit.name || 'unnamed'}`);
      }
    }
  }

  // If base unit changes, validate
  if (updateData.baseUnit && updateData.baseUnit.name !== product.baseUnit.name) {
    // Check if any stock exists in old base unit
    const stockCheck = await StockBatch.findOne({
      productId: product._id,
      owner: userId,
      remainingQuantity: { $gt: 0 }
    });
    if (stockCheck) {
      throw new Error('Cannot change base unit while stock exists. Please sell or convert existing stock first.');
    }
  }

  // Update legacy fields if needed
  if (updateData.sellUnits) {
    const baseSellUnit = updateData.sellUnits.find(u => u.isBase);
    if (baseSellUnit && baseSellUnit.sellPrice !== undefined) {
      updateData.sellingPrice = baseSellUnit.sellPrice;
    }
  }

  if (updateData.stockUnits) {
    const baseStockUnit = updateData.stockUnits.find(u => u.isBase);
    if (baseStockUnit && baseStockUnit.buyPrice !== undefined) {
      updateData.buyingPrice = baseStockUnit.buyPrice;
    }
  }

  if (updateData.baseUnit) {
    updateData.unit = updateData.baseUnit.name;
  }

  const updatedProduct = await Product.findOneAndUpdate(
    { _id: productId, owner: userId },
    { $set: updateData },
    { new: true, runValidators: true }
  );

  if (!updatedProduct) {
    throw new Error('Product not found after update');
  }

  return updatedProduct;
};

// ============================================================
// Delete product (check if stock exists)
// ============================================================
export const deleteProduct = async (productId, userId) => {
  const product = await Product.findOne({
    _id: productId,
    owner: userId
  });

  if (!product) {
    throw new Error('Product not found');
  }

  // Check if there's any stock remaining
  const stockCheck = await StockBatch.findOne({
    productId: product._id,
    owner: userId,
    remainingQuantity: { $gt: 0 }
  });

  if (stockCheck) {
    throw new Error('Cannot delete product with existing stock. Please sell or remove all stock first.');
  }

  // Soft delete by setting isActive to false
  product.isActive = false;
  await product.save();

  return { message: 'Product deactivated successfully' };
};

// ============================================================
// Get low stock products (using StockBatch)
// ============================================================
export const getLowStockProducts = async (userId) => {
  const products = await Product.aggregate([
    { $match: { owner: new mongoose.Types.ObjectId(userId), isActive: true } },
    {
      $lookup: {
        from: 'stockbatches',
        localField: '_id',
        foreignField: 'productId',
        as: 'stock'
      }
    },
    {
      $addFields: {
        totalStock: { $sum: '$stock.remainingInBase' }
      }
    },
    {
      $match: {
        $expr: { $and: [
          { $gt: ['$totalStock', 0] },
          { $lte: ['$totalStock', '$minStockAlert'] }
        ]}
      }
    },
    {
      $project: {
        name: 1,
        description: 1,
        category: 1,
        baseUnit: 1,
        totalStock: 1,
        minStockAlert: 1,
        stockBatches: '$stock'
      }
    }
  ]);

  return products;
};

// ============================================================
// Get out of stock products (using StockBatch)
// ============================================================
export const getOutOfStockProducts = async (userId) => {
  const products = await Product.aggregate([
    { $match: { owner: new mongoose.Types.ObjectId(userId), isActive: true } },
    {
      $lookup: {
        from: 'stockbatches',
        localField: '_id',
        foreignField: 'productId',
        as: 'stock'
      }
    },
    {
      $addFields: {
        totalStock: { $sum: '$stock.remainingInBase' }
      }
    },
    {
      $match: {
        $expr: { $eq: ['$totalStock', 0] }
      }
    },
    {
      $project: {
        name: 1,
        description: 1,
        category: 1,
        baseUnit: 1,
        totalStock: 1,
        minStockAlert: 1
      }
    }
  ]);

  return products;
};

// ============================================================
// Add stock to product (create StockBatch)
// ============================================================
export const addStock = async (data) => {
  const { productId, ownerId, unitName, quantity, buyPrice, batchNumber, supplier, expiryDate } = data;

  const product = await Product.findOne({
    _id: productId,
    owner: ownerId,
    isActive: true
  });

  if (!product) {
    throw new Error('Product not found');
  }

  // Find the stock unit
  const stockUnit = product.stockUnits.find(u => u.name === unitName && u.isActive !== false);
  if (!stockUnit) {
    throw new Error(`Unit "${unitName}" not found in product's stock units`);
  }

  const quantityInBase = quantity * stockUnit.conversion;
  const totalCost = quantity * buyPrice;

  // Create stock batch
  const stockBatch = await StockBatch.create({
    productId: product._id,
    unit: {
      name: stockUnit.name,
      label: stockUnit.label,
      conversion: stockUnit.conversion
    },
    quantity: quantity,
    quantityInBase: quantityInBase,
    buyPrice: buyPrice,
    totalCost: totalCost,
    batchNumber: batchNumber,
    supplierName: supplier,
    expiryDate: expiryDate,
    remainingQuantity: quantity,
    remainingInBase: quantityInBase,
    owner: ownerId
  });

  // Update legacy product quantity for backward compatibility
  const totalStock = await getTotalStockForProduct(productId, ownerId);
  product.quantity = totalStock;
  product.lastRestockDate = new Date();
  await product.save();

  return stockBatch;
};

// ============================================================
// Get product stock breakdown
// ============================================================
export const getProductStock = async (productId, userId) => {
  const product = await Product.findOne({
    _id: productId,
    owner: userId,
    isActive: true
  });

  if (!product) {
    throw new Error('Product not found');
  }

  const stock = await getStockForProduct(productId, userId);

  // Get stock by unit type
  const stockByUnit = {};
  stock.batches.forEach(batch => {
    const key = batch.unit.name;
    if (!stockByUnit[key]) {
      stockByUnit[key] = {
        unit: batch.unit,
        totalQuantity: 0,
        totalQuantityInBase: 0,
        batches: []
      };
    }
    stockByUnit[key].totalQuantity += batch.remainingQuantity;
    stockByUnit[key].totalQuantityInBase += batch.remainingInBase;
    stockByUnit[key].batches.push(batch);
  });

  return {
    productId: product._id,
    productName: product.name,
    baseUnit: product.baseUnit,
    totalInBase: stock.totalInBase,
    byUnit: Object.values(stockByUnit),
    batches: stock.batches
  };
};

// ============================================================
// Convert stock from one unit to another
// ============================================================
export const convertStock = async (data) => {
  const { productId, ownerId, fromUnit, toUnit, quantity } = data;

  const product = await Product.findOne({
    _id: productId,
    owner: ownerId,
    isActive: true
  });

  if (!product) {
    throw new Error('Product not found');
  }

  // Find units
  const fromStockUnit = product.stockUnits.find(u => u.name === fromUnit && u.isActive !== false);
  const toStockUnit = product.stockUnits.find(u => u.name === toUnit && u.isActive !== false);

  if (!fromStockUnit) {
    throw new Error(`Source unit "${fromUnit}" not found`);
  }
  if (!toStockUnit) {
    throw new Error(`Target unit "${toUnit}" not found`);
  }

  const fromQuantityInBase = quantity * fromStockUnit.conversion;
  const toQuantity = fromQuantityInBase / toStockUnit.conversion;

  // Check if we have enough stock in source unit
  const sourceBatches = await StockBatch.find({
    productId: product._id,
    owner: ownerId,
    'unit.name': fromUnit,
    remainingQuantity: { $gt: 0 },
    isActive: true
  }).sort({ createdAt: 1 }); // FIFO

  let totalAvailable = 0;
  for (const batch of sourceBatches) {
    totalAvailable += batch.remainingQuantity;
  }

  if (totalAvailable < quantity) {
    throw new Error(`Insufficient stock in ${fromUnit}. Available: ${totalAvailable}, Required: ${quantity}`);
  }

  // Deduct from source (FIFO)
  let remainingToDeduct = quantity;
  const deductions = [];

  for (const batch of sourceBatches) {
    if (remainingToDeduct <= 0) break;

    const deductQuantity = Math.min(batch.remainingQuantity, remainingToDeduct);
    const deductInBase = deductQuantity * fromStockUnit.conversion;

    batch.remainingQuantity -= deductQuantity;
    batch.remainingInBase -= deductInBase;
    await batch.save();

    deductions.push({
      batchId: batch._id,
      deductQuantity,
      deductInBase
    });

    remainingToDeduct -= deductQuantity;
  }

  // Add to target unit (single batch)
  // Calculate average cost from source
  let totalCost = 0;
  for (const deduction of deductions) {
    const batch = sourceBatches.find(b => b._id.toString() === deduction.batchId.toString());
    if (batch) {
      totalCost += (deduction.deductQuantity / fromStockUnit.conversion) * batch.buyPrice * fromStockUnit.conversion;
    }
  }

  const avgBuyPrice = totalCost / fromQuantityInBase;

  const newBatch = await StockBatch.create({
    productId: product._id,
    unit: {
      name: toStockUnit.name,
      label: toStockUnit.label,
      conversion: toStockUnit.conversion
    },
    quantity: toQuantity,
    quantityInBase: fromQuantityInBase,
    buyPrice: avgBuyPrice * toStockUnit.conversion,
    totalCost: avgBuyPrice * fromQuantityInBase,
    batchNumber: `CONV-${Date.now()}`,
    remainingQuantity: toQuantity,
    remainingInBase: fromQuantityInBase,
    owner: ownerId
  });

  // Update legacy product quantity
  const totalStock = await getTotalStockForProduct(productId, ownerId);
  product.quantity = totalStock;
  await product.save();

  return {
    from: {
      unit: fromUnit,
      deducted: quantity,
      quantityInBase: fromQuantityInBase,
      batchesAffected: deductions.length
    },
    to: {
      unit: toUnit,
      added: toQuantity,
      quantityInBase: fromQuantityInBase,
      batchId: newBatch._id
    }
  };
};

// ============================================================
// Get product by barcode (across all units)
// ============================================================
export const getProductByBarcode = async (barcode, userId) => {
  const product = await Product.findOne({
    owner: userId,
    isActive: true,
    $or: [
      { 'sellUnits.barcode': barcode },
      { 'stockUnits.barcode': barcode }
    ]
  });

  if (!product) {
    return null;
  }

  // Find which unit has this barcode
  let matchedUnit = null;
  let unitType = null;

  if (product.sellUnits) {
    matchedUnit = product.sellUnits.find(u => u.barcode === barcode);
    if (matchedUnit) unitType = 'sell';
  }

  if (!matchedUnit && product.stockUnits) {
    matchedUnit = product.stockUnits.find(u => u.barcode === barcode);
    if (matchedUnit) unitType = 'stock';
  }

  return {
    ...product.toObject(),
    matchedUnit,
    unitType
  };
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
// Get stock alerts
// ============================================================
export const getStockAlerts = async (userId) => {
  const [lowStock, outOfStock, expiringStock] = await Promise.all([
    getLowStockProducts(userId),
    getOutOfStockProducts(userId),
    getExpiringStock(userId)
  ]);

  return {
    lowStock: lowStock.length,
    outOfStock: outOfStock.length,
    expiringStock: expiringStock.length,
    details: {
      lowStockProducts: lowStock,
      outOfStockProducts: outOfStock,
      expiringStockBatches: expiringStock
    }
  };
};

// ============================================================
// Helper: Get stock for a single product
// ============================================================
const getStockForProduct = async (productId, userId) => {
  const result = await StockBatch.aggregate([
    {
      $match: {
        productId: new mongoose.Types.ObjectId(productId),
        owner: new mongoose.Types.ObjectId(userId),
        isActive: true,
        remainingQuantity: { $gt: 0 }
      }
    },
    {
      $group: {
        _id: null,
        totalInBase: { $sum: '$remainingInBase' },
        batches: {
          $push: {
            _id: '$_id',
            unit: '$unit',
            remainingQuantity: '$remainingQuantity',
            remainingInBase: '$remainingInBase',
            buyPrice: '$buyPrice',
            totalCost: '$totalCost',
            batchNumber: '$batchNumber',
            supplierName: '$supplierName',
            expiryDate: '$expiryDate',
            receivedAt: '$receivedAt'
          }
        }
      }
    }
  ]);

  return result.length > 0 ? result[0] : { totalInBase: 0, batches: [] };
};

// ============================================================
// Helper: Get stock for multiple products
// ============================================================
const getStockForProducts = async (productIds, userId) => {
  if (!productIds || productIds.length === 0) return {};

  const result = await StockBatch.aggregate([
    {
      $match: {
        productId: { $in: productIds.map(id => new mongoose.Types.ObjectId(id)) },
        owner: new mongoose.Types.ObjectId(userId),
        isActive: true,
        remainingQuantity: { $gt: 0 }
      }
    },
    {
      $group: {
        _id: '$productId',
        totalInBase: { $sum: '$remainingInBase' },
        batches: {
          $push: {
            _id: '$_id',
            unit: '$unit',
            remainingQuantity: '$remainingQuantity',
            remainingInBase: '$remainingInBase',
            buyPrice: '$buyPrice',
            expiryDate: '$expiryDate'
          }
        }
      }
    }
  ]);

  const stockMap = {};
  result.forEach(item => {
    stockMap[item._id.toString()] = {
      totalInBase: item.totalInBase,
      batches: item.batches
    };
  });

  return stockMap;
};

// ============================================================
// Helper: Get total stock for a product (legacy support)
// ============================================================
const getTotalStockForProduct = async (productId, userId) => {
  const result = await StockBatch.aggregate([
    {
      $match: {
        productId: new mongoose.Types.ObjectId(productId),
        owner: new mongoose.Types.ObjectId(userId),
        isActive: true,
        remainingQuantity: { $gt: 0 }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$remainingInBase' }
      }
    }
  ]);

  return result.length > 0 ? result[0].total : 0;
};

// ============================================================
// Helper: Get expiring stock
// ============================================================
const getExpiringStock = async (userId, days = 30) => {
  const expiryThreshold = new Date();
  expiryThreshold.setDate(expiryThreshold.getDate() + days);

  const batches = await StockBatch.find({
    owner: userId,
    isActive: true,
    remainingQuantity: { $gt: 0 },
    expiryDate: { $ne: null, $lte: expiryThreshold }
  }).populate('productId', 'name baseUnit');

  return batches;
};