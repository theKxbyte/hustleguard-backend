// services/productService.js - COMPLETE with UOM + StockBatch + Loose Quantity
import Product from '../models/Product.js';
import StockBatch from '../models/StockBatch.js';
import mongoose from 'mongoose';

// ============================================================
// Create product with UOM configuration
// ============================================================
export const createProduct = async (productData, userId) => {
  if (!productData.baseUnit || !productData.baseUnit.name) {
    throw new Error('Base unit is required');
  }

  if (productData.sellUnits && productData.sellUnits.length > 0) {
    for (const unit of productData.sellUnits) {
      if (!unit.name || !unit.conversion || unit.conversion <= 0) {
        throw new Error(`Invalid sell unit: ${unit.name || 'unnamed'}`);
      }
      if (unit.isBase && unit.name !== productData.baseUnit.name) {
        throw new Error(`Base unit "${productData.baseUnit.name}" must match the base unit in sell units`);
      }
    }
  }

  if (productData.stockUnits && productData.stockUnits.length > 0) {
    for (const unit of productData.stockUnits) {
      if (!unit.name || !unit.conversion || unit.conversion <= 0) {
        throw new Error(`Invalid stock unit: ${unit.name || 'unnamed'}`);
      }
    }
  }

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

  const baseSellUnit = productData.sellUnits?.find(u => u.isBase) || 
                       productData.sellUnits?.[0];
  const baseStockUnit = productData.stockUnits?.find(u => u.isBase) || 
                        productData.stockUnits?.[0];

  const product = await Product.create({
    ...productData,
    unit: productData.baseUnit.name,
    buyingPrice: baseStockUnit?.buyPrice || 0,
    sellingPrice: baseSellUnit?.sellPrice || 0,
    quantity: 0,
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

  const productIds = products.map(p => p._id);
  const stockData = await getStockForProducts(productIds, userId);

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

  const stock = await getStockForProduct(productId, userId);
  
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

  if (updateData.baseUnit && updateData.baseUnit.name !== product.baseUnit.name) {
    const stockCheck = await StockBatch.findOne({
      productId: product._id,
      owner: userId,
      $or: [
        { remainingQuantity: { $gt: 0 } },
        { remainingLoose: { $gt: 0 } }
      ]
    });
    if (stockCheck) {
      throw new Error('Cannot change base unit while stock exists. Please sell or convert existing stock first.');
    }
  }

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
// Delete product - FORCE DELETE (removes product + all stock)
// ============================================================
export const deleteProduct = async (productId, userId) => {
  const product = await Product.findOne({
    _id: productId,
    owner: userId
  });

  if (!product) {
    throw new Error('Product not found');
  }

  await StockBatch.deleteMany({
    productId: product._id,
    owner: userId
  });

  await product.deleteOne();

  return { message: 'Product and all stock deleted' };
};

// ============================================================
// Get low stock products (using StockBatch) - INCLUDES LOOSE
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
    { $unwind: { path: '$stock', preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: '$_id',
        name: { $first: '$name' },
        description: { $first: '$description' },
        category: { $first: '$category' },
        baseUnit: { $first: '$baseUnit' },
        minStockAlert: { $first: '$minStockAlert' },
        totalStock: {
          $sum: {
            $add: [
              { $ifNull: ['$stock.remainingInBase', 0] },
              { $ifNull: ['$stock.remainingLooseInBase', 0] }
            ]
          }
        },
        stockBatches: { $push: '$stock' }
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
        stockBatches: 1
      }
    }
  ]);

  return products;
};

// ============================================================
// Get out of stock products (using StockBatch) - INCLUDES LOOSE
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
    { $unwind: { path: '$stock', preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: '$_id',
        name: { $first: '$name' },
        description: { $first: '$description' },
        category: { $first: '$category' },
        baseUnit: { $first: '$baseUnit' },
        minStockAlert: { $first: '$minStockAlert' },
        totalStock: {
          $sum: {
            $add: [
              { $ifNull: ['$stock.remainingInBase', 0] },
              { $ifNull: ['$stock.remainingLooseInBase', 0] }
            ]
          }
        }
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
// Add stock to product with LOOSE QUANTITY support
// ============================================================
export const addStock = async (data) => {
  const { 
    productId, 
    ownerId, 
    unitName, 
    quantity, 
    buyPrice, 
    batchNumber, 
    supplier, 
    expiryDate,
    useLoose = false,
    looseQuantity = 0,
    bundleSize = 0
  } = data;

  const product = await Product.findOne({
    _id: productId,
    owner: ownerId,
    isActive: true
  });

  if (!product) {
    throw new Error('Product not found');
  }

  const stockUnit = product.stockUnits.find(u => u.name === unitName && u.isActive !== false);
  if (!stockUnit) {
    throw new Error(`Unit "${unitName}" not found in product's stock units`);
  }

  // Parse values
  const bundles = parseFloat(quantity) || 0;
  const loose = parseFloat(looseQuantity) || 0;
  const size = parseInt(bundleSize) || 0;

  // Calculate total units
  let totalUnits;
  let bundleUnits;
  
  if (size > 0) {
    bundleUnits = bundles * size;
    totalUnits = bundleUnits + loose;
  } else {
    bundleUnits = bundles;
    totalUnits = bundles + loose;
  }

  const quantityInBase = totalUnits * stockUnit.conversion;
  const totalCost = totalUnits * parseFloat(buyPrice);

  const stockBatch = await StockBatch.create({
    productId: product._id,
    unit: {
      name: stockUnit.name,
      label: stockUnit.label,
      conversion: stockUnit.conversion
    },
    quantity: bundles,
    quantityInBase: bundleUnits * stockUnit.conversion,
    looseQuantity: loose,
    looseInBase: loose * stockUnit.conversion,
    bundleSize: size,
    buyPrice: parseFloat(buyPrice),
    totalCost: totalCost,
    batchNumber: batchNumber || `INITIAL-${Date.now()}`,
    supplierName: supplier || 'Initial Stock',
    expiryDate: expiryDate || null,
    remainingQuantity: bundles,
    remainingInBase: bundleUnits * stockUnit.conversion,
    remainingLoose: loose,
    remainingLooseInBase: loose * stockUnit.conversion,
    owner: ownerId
  });

  const totalStock = await getTotalStockForProduct(productId, ownerId);
  product.quantity = totalStock;
  product.lastRestockDate = new Date();
  await product.save();

  return stockBatch;
};

// ============================================================
// Get product stock breakdown (includes loose)
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

  const stockByUnit = {};
  stock.batches.forEach(batch => {
    const key = batch.unit.name;
    if (!stockByUnit[key]) {
      stockByUnit[key] = {
        unit: batch.unit,
        totalQuantity: 0,
        totalQuantityInBase: 0,
        totalLoose: 0,
        totalLooseInBase: 0,
        bundles: 0,
        batches: []
      };
    }
    stockByUnit[key].totalQuantity += batch.remainingQuantity || 0;
    stockByUnit[key].totalQuantityInBase += batch.remainingInBase || 0;
    stockByUnit[key].totalLoose += batch.remainingLoose || 0;
    stockByUnit[key].totalLooseInBase += batch.remainingLooseInBase || 0;
    stockByUnit[key].bundles += batch.remainingQuantity || 0;
    stockByUnit[key].batches.push(batch);
  });

  return {
    productId: product._id,
    productName: product.name,
    baseUnit: product.baseUnit,
    totalInBase: stock.totalInBase,
    totalLooseInBase: stock.totalLooseInBase || 0,
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

  const sourceBatches = await StockBatch.find({
    productId: product._id,
    owner: ownerId,
    'unit.name': fromUnit,
    isActive: true,
    $or: [
      { remainingQuantity: { $gt: 0 } },
      { remainingLoose: { $gt: 0 } }
    ]
  }).sort({ createdAt: 1 });

  let totalAvailable = 0;
  for (const batch of sourceBatches) {
    totalAvailable += batch.remainingQuantity || 0;
    totalAvailable += (batch.remainingLoose || 0) / fromStockUnit.conversion;
  }

  if (totalAvailable < quantity) {
    throw new Error(`Insufficient stock in ${fromUnit}. Available: ${totalAvailable}, Required: ${quantity}`);
  }

  let remainingToDeduct = quantity;
  const deductions = [];

  for (const batch of sourceBatches) {
    if (remainingToDeduct <= 0) break;

    if (batch.remainingQuantity > 0) {
      const deductQuantity = Math.min(batch.remainingQuantity, remainingToDeduct);
      const deductInBase = deductQuantity * fromStockUnit.conversion;

      batch.remainingQuantity -= deductQuantity;
      batch.remainingInBase -= deductInBase;
      await batch.save();

      deductions.push({
        batchId: batch._id,
        deductQuantity,
        deductInBase,
        source: 'bundle'
      });

      remainingToDeduct -= deductQuantity;
    }

    if (remainingToDeduct > 0 && batch.remainingLoose > 0) {
      const looseInUnits = batch.remainingLoose / fromStockUnit.conversion;
      const deductLoose = Math.min(looseInUnits, remainingToDeduct);
      const deductInBase = deductLoose * fromStockUnit.conversion;

      batch.remainingLoose -= deductLoose * fromStockUnit.conversion;
      batch.remainingLooseInBase -= deductInBase;
      await batch.save();

      deductions.push({
        batchId: batch._id,
        deductQuantity: deductLoose,
        deductInBase,
        source: 'loose'
      });

      remainingToDeduct -= deductLoose;
    }
  }

  let totalCost = 0;
  for (const deduction of deductions) {
    const batch = sourceBatches.find(b => b._id.toString() === deduction.batchId.toString());
    if (batch) {
      const unitCost = batch.buyPrice / fromStockUnit.conversion;
      totalCost += deduction.deductInBase * unitCost;
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
    remainingLoose: 0,
    remainingLooseInBase: 0,
    owner: ownerId
  });

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
// Delete stock batch
// ============================================================
export const deleteStockBatch = async (data) => {
  const { productId, batchId, ownerId } = data;

  const batch = await StockBatch.findOne({
    _id: batchId,
    productId: productId,
    owner: ownerId
  });

  if (!batch) {
    throw new Error('Stock batch not found');
  }

  batch.isActive = false;
  await batch.save();

  const totalStock = await StockBatch.aggregate([
    {
      $match: {
        productId: new mongoose.Types.ObjectId(productId),
        owner: ownerId,
        isActive: true,
        $or: [
          { remainingQuantity: { $gt: 0 } },
          { remainingLoose: { $gt: 0 } }
        ]
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: { $add: ['$remainingInBase', '$remainingLooseInBase'] } }
      }
    }
  ]);

  const quantity = totalStock.length > 0 ? totalStock[0].total : 0;
  await Product.findByIdAndUpdate(productId, { quantity });

  return { message: 'Stock batch deleted successfully' };
};

// ============================================================
// HELPERS
// ============================================================

const getStockForProducts = async (productIds, userId) => {
  if (!productIds || productIds.length === 0) return {};

  const result = await StockBatch.aggregate([
    {
      $match: {
        productId: { $in: productIds.map(id => new mongoose.Types.ObjectId(id)) },
        owner: new mongoose.Types.ObjectId(userId),
        isActive: true
      }
    },
    {
      $group: {
        _id: '$productId',
        totalInBase: { $sum: { $add: [{ $ifNull: ['$remainingInBase', 0] }, { $ifNull: ['$remainingLooseInBase', 0] }] } },
        batches: {
          $push: {
            _id: '$_id',
            unit: '$unit',
            remainingQuantity: '$remainingQuantity',
            remainingInBase: '$remainingInBase',
            remainingLoose: { $ifNull: ['$remainingLoose', 0] },
            remainingLooseInBase: { $ifNull: ['$remainingLooseInBase', 0] },
            bundleSize: { $ifNull: ['$bundleSize', 0] },
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

const getStockForProduct = async (productId, userId) => {
  const result = await StockBatch.aggregate([
    {
      $match: {
        productId: new mongoose.Types.ObjectId(productId),
        owner: new mongoose.Types.ObjectId(userId),
        isActive: true
      }
    },
    {
      $group: {
        _id: null,
        totalInBase: { 
          $sum: { 
            $add: [
              { $ifNull: ['$remainingInBase', 0] }, 
              { $ifNull: ['$remainingLooseInBase', 0] }
            ] 
          } 
        },
        totalLooseInBase: { 
          $sum: { $ifNull: ['$remainingLooseInBase', 0] } 
        },
        batches: {
          $push: {
            _id: '$_id',
            unit: '$unit',
            remainingQuantity: '$remainingQuantity',
            remainingInBase: '$remainingInBase',
            remainingLoose: { $ifNull: ['$remainingLoose', 0] },
            remainingLooseInBase: { $ifNull: ['$remainingLooseInBase', 0] },
            bundleSize: { $ifNull: ['$bundleSize', 0] },
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

  return result.length > 0 ? result[0] : { 
    totalInBase: 0, 
    totalLooseInBase: 0, 
    batches: [] 
  };
};

const getTotalStockForProduct = async (productId, userId) => {
  const result = await StockBatch.aggregate([
    {
      $match: {
        productId: new mongoose.Types.ObjectId(productId),
        owner: new mongoose.Types.ObjectId(userId),
        isActive: true
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: { $add: [{ $ifNull: ['$remainingInBase', 0] }, { $ifNull: ['$remainingLooseInBase', 0] }] } }
      }
    }
  ]);

  return result.length > 0 ? result[0].total : 0;
};

const getExpiringStock = async (userId, days = 30) => {
  const expiryThreshold = new Date();
  expiryThreshold.setDate(expiryThreshold.getDate() + days);

  const batches = await StockBatch.find({
    owner: userId,
    isActive: true,
    $or: [
      { remainingQuantity: { $gt: 0 } },
      { remainingLoose: { $gt: 0 } }
    ],
    expiryDate: { $ne: null, $lte: expiryThreshold }
  }).populate('productId', 'name baseUnit');

  return batches;
};