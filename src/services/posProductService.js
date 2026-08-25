// services/posProductService.js
import Product from '../models/Product.js';
import StockBatch from '../models/StockBatch.js';
import Sale from '../models/Sale.js';
import mongoose from 'mongoose';

// ============================================================
// Search products for POS with UOM and stock info
// ============================================================
export const searchPosProducts = async (filters) => {
  const { 
    query, 
    category, 
    limit = 20, 
    offset = 0, 
    includeOutOfStock = false,
    includeUnits = false,
    ownerId 
  } = filters;

  const queryObj = { 
    owner: ownerId,
    isActive: true 
  };

  if (category && category !== 'all') {
    queryObj.category = category;
  }

  if (query && query.trim() !== '') {
    const searchTerm = query.trim();
    if (/^[0-9]+$/.test(searchTerm)) {
      queryObj.$or = [
        { 'sellUnits.barcode': searchTerm },
        { 'stockUnits.barcode': searchTerm },
        { name: { $regex: searchTerm, $options: 'i' } }
      ];
    } else {
      queryObj.$or = [
        { name: { $regex: searchTerm, $options: 'i' } },
        { category: { $regex: searchTerm, $options: 'i' } }
      ];
    }
  }

  let products = await Product.find(queryObj)
    .select('name description category baseUnit sellUnits stockUnits minStockAlert isActive')
    .lean()
    .limit(limit)
    .skip(offset)
    .sort({ name: 1 });

  const total = await Product.countDocuments(queryObj);

  const productIds = products.map(p => p._id);
  const stockData = await getStockForProducts(productIds, ownerId);

  const enrichedProducts = [];
  for (const product of products) {
    const stock = stockData[product._id.toString()] || { totalInBase: 0, batches: [], totalLooseInBase: 0 };
    const totalStock = (stock.totalInBase || 0) + (stock.totalLooseInBase || 0);
    
    if (!includeOutOfStock && totalStock <= 0) {
      continue;
    }

    const sellUnitsWithStock = product.sellUnits?.map(unit => {
      const availableInUnit = totalStock / unit.conversion;
      return {
        ...unit,
        availableStock: totalStock,
        availableUnits: availableInUnit,
        inStock: totalStock > 0 && availableInUnit >= 0.001,
        canSell: totalStock > 0
      };
    }) || [];

    const stockBreakdown = {
      totalInBase: totalStock,
      batches: stock.batches.map(b => ({
        unit: b.unit,
        quantity: b.remainingQuantity,
        quantityInBase: b.remainingInBase,
        looseQuantity: b.remainingLoose || 0,
        looseInBase: b.remainingLooseInBase || 0,
        bundleSize: b.bundleSize || 0,
        buyPrice: b.buyPrice,
        expiryDate: b.expiryDate
      }))
    };

    enrichedProducts.push({
      _id: product._id,
      name: product.name,
      description: product.description,
      category: product.category,
      baseUnit: product.baseUnit,
      sellUnits: includeUnits ? sellUnitsWithStock : undefined,
      stockUnits: product.stockUnits,
      stockBreakdown: includeUnits ? stockBreakdown : undefined,
      totalStock: totalStock,
      minStockAlert: product.minStockAlert,
      isLowStock: totalStock <= product.minStockAlert && totalStock > 0,
      isOutOfStock: totalStock <= 0,
      stockStatus: totalStock <= 0 ? 'out_of_stock' :
                   totalStock <= product.minStockAlert ? 'low_stock' : 'in_stock',
      isActive: product.isActive
    });
  }

  return {
    products: enrichedProducts,
    total,
    hasMore: offset + limit < total
  };
};

// ============================================================
// Get product by barcode (search across all units)
// ============================================================
export const getProductByBarcode = async (barcode, ownerId) => {
  if (!barcode) return null;

  const product = await Product.findOne({
    owner: ownerId,
    isActive: true,
    $or: [
      { 'sellUnits.barcode': barcode },
      { 'stockUnits.barcode': barcode }
    ]
  })
  .select('name description category baseUnit sellUnits stockUnits minStockAlert')
  .lean();

  if (!product) return null;

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
    ...product,
    matchedUnit,
    unitType
  };
};

// ============================================================
// Get product with sell units and stock info
// ============================================================
export const getProductWithSellUnits = async (product, ownerId) => {
  const stock = await getStockForProduct(product._id, ownerId);
  const totalStock = (stock.totalInBase || 0) + (stock.totalLooseInBase || 0);
  
  const sellUnitsWithStock = product.sellUnits?.map(unit => {
    const availableInUnit = totalStock / unit.conversion;
    return {
      ...unit,
      availableStock: totalStock,
      availableUnits: availableInUnit,
      inStock: totalStock > 0 && availableInUnit >= 0.001,
      canSell: totalStock > 0,
      maxQuantity: Math.floor(availableInUnit)
    };
  }) || [];

  return {
    ...product,
    sellUnits: sellUnitsWithStock,
    totalStock: totalStock,
    stockBatches: stock.batches,
    isLowStock: totalStock <= product.minStockAlert && totalStock > 0,
    isOutOfStock: totalStock <= 0
  };
};

// ============================================================
// Get multiple products by IDs
// ============================================================
export const getProductsBatch = async (productIds, ownerId, includeUnits = false) => {
  const products = await Product.find({
    _id: { $in: productIds },
    owner: ownerId,
    isActive: true
  })
  .select('name description category baseUnit sellUnits stockUnits minStockAlert')
  .lean();

  const productMap = {};
  const stockData = await getStockForProducts(productIds, ownerId);

  for (const product of products) {
    const stock = stockData[product._id.toString()] || { totalInBase: 0, batches: [], totalLooseInBase: 0 };
    const totalStock = (stock.totalInBase || 0) + (stock.totalLooseInBase || 0);
    
    const sellUnitsWithStock = includeUnits ? product.sellUnits?.map(unit => ({
      ...unit,
      availableStock: totalStock,
      availableUnits: totalStock / unit.conversion,
      inStock: totalStock > 0
    })) : undefined;

    productMap[product._id.toString()] = {
      ...product,
      sellUnits: sellUnitsWithStock,
      totalStock: totalStock,
      isLowStock: totalStock <= product.minStockAlert && totalStock > 0,
      isOutOfStock: totalStock <= 0
    };
  }

  return productIds.map(id => productMap[id.toString()] || null);
};

// ============================================================
// Get product suggestions for autocomplete
// ============================================================
export const getProductSuggestions = async (query, ownerId, limit = 10) => {
  if (!query || query.trim() === '') {
    return [];
  }

  const searchTerm = query.trim();
  
  const products = await Product.find({
    owner: ownerId,
    isActive: true,
    $or: [
      { name: { $regex: searchTerm, $options: 'i' } },
      { 'sellUnits.barcode': searchTerm },
      { 'stockUnits.barcode': searchTerm }
    ]
  })
  .select('name baseUnit sellUnits stockUnits')
  .lean()
  .limit(limit);

  const productIds = products.map(p => p._id);
  const stockData = await getStockForProducts(productIds, ownerId);

  return products.map(product => {
    const stock = stockData[product._id.toString()] || { totalInBase: 0, totalLooseInBase: 0 };
    const totalStock = (stock.totalInBase || 0) + (stock.totalLooseInBase || 0);
    const sellUnits = product.sellUnits?.filter(u => u.isActive) || [];
    const primaryUnit = sellUnits[0] || product.stockUnits?.[0] || { name: 'unit', label: 'Unit' };

    return {
      id: product._id,
      name: product.name,
      baseUnit: product.baseUnit,
      primaryUnit: primaryUnit,
      sellingPrice: primaryUnit.sellPrice || 0,
      availableStock: totalStock,
      inStock: totalStock > 0,
      display: `${product.name} (${totalStock} ${product.baseUnit?.label || 'units'} available)`,
      quickAdd: {
        unit: primaryUnit.name,
        price: primaryUnit.sellPrice || 0,
        inStock: totalStock > 0
      }
    };
  });
};

// ============================================================
// Get POS product stock info
// ============================================================
export const getPosProductStock = async (productId, ownerId) => {
  const product = await Product.findOne({
    _id: productId,
    owner: ownerId,
    isActive: true
  })
  .select('name baseUnit sellUnits stockUnits minStockAlert')
  .lean();

  if (!product) {
    throw new Error('Product not found');
  }

  const stock = await getStockForProduct(productId, ownerId);
  const totalStock = (stock.totalInBase || 0) + (stock.totalLooseInBase || 0);

  const sellUnitsWithStock = product.sellUnits?.map(unit => {
    const availableInUnit = totalStock / unit.conversion;
    return {
      ...unit,
      availableStock: totalStock,
      availableUnits: availableInUnit,
      inStock: totalStock > 0 && availableInUnit >= 0.001,
      maxQuantity: Math.floor(availableInUnit)
    };
  }) || [];

  return {
    productId: product._id,
    productName: product.name,
    baseUnit: product.baseUnit,
    totalStock: totalStock,
    sellUnits: sellUnitsWithStock,
    stockBatches: stock.batches.map(b => ({
      unit: b.unit,
      quantity: b.remainingQuantity,
      quantityInBase: b.remainingInBase,
      looseQuantity: b.remainingLoose || 0,
      looseInBase: b.remainingLooseInBase || 0,
      bundleSize: b.bundleSize || 0,
      buyPrice: b.buyPrice,
      expiryDate: b.expiryDate
    })),
    isLowStock: totalStock <= product.minStockAlert && totalStock > 0,
    isOutOfStock: totalStock <= 0
  };
};

// ============================================================
// Check if a unit can fulfill an order
// ============================================================
export const checkUnitAvailability = async (productId, ownerId, unitName, quantity = 1) => {
  const product = await Product.findOne({
    _id: productId,
    owner: ownerId,
    isActive: true
  })
  .select('name baseUnit sellUnits stockUnits')
  .lean();

  if (!product) {
    throw new Error('Product not found');
  }

  const allUnits = [...(product.sellUnits || []), ...(product.stockUnits || [])];
  const unit = allUnits.find(u => u.name === unitName && u.isActive !== false);

  if (!unit) {
    return {
      productId,
      productName: product.name,
      unitName,
      isAvailable: false,
      error: `Unit "${unitName}" not found for this product`
    };
  }

  const stock = await getStockForProduct(productId, ownerId);
  const totalStock = (stock.totalInBase || 0) + (stock.totalLooseInBase || 0);
  const requestedInBase = quantity * unit.conversion;

  return {
    productId: product._id,
    productName: product.name,
    unitName: unit.name,
    unitLabel: unit.label,
    conversion: unit.conversion,
    requestedQuantity: quantity,
    requestedInBase: requestedInBase,
    availableInBase: totalStock,
    availableInUnit: totalStock / unit.conversion,
    isAvailable: totalStock >= requestedInBase,
    canFulfill: totalStock >= requestedInBase,
    maxQuantity: Math.floor(totalStock / unit.conversion),
    pricePerUnit: unit.sellPrice || 0,
    totalPrice: (unit.sellPrice || 0) * quantity,
    unitType: product.sellUnits?.some(u => u.name === unitName) ? 'sell' : 'stock'
  };
};

// ============================================================
// Quick scan - search by name or barcode
// ============================================================
export const quickScanProduct = async (input, ownerId) => {
  if (!input || input.trim() === '') return null;

  const searchTerm = input.trim();
  
  const product = await Product.findOne({
    owner: ownerId,
    isActive: true,
    $or: [
      { name: { $regex: `^${searchTerm}$`, $options: 'i' } },
      { name: { $regex: searchTerm, $options: 'i' } },
      { 'sellUnits.barcode': searchTerm },
      { 'stockUnits.barcode': searchTerm }
    ]
  })
  .select('name description category baseUnit sellUnits stockUnits minStockAlert')
  .lean();

  if (!product) return null;

  return product;
};

// ============================================================
// Get recent products (from sales)
// ============================================================
export const getRecentProducts = async (ownerId, limit = 10) => {
  const recentSales = await Sale.aggregate([
    { $match: { owner: new mongoose.Types.ObjectId(ownerId), isActive: true } },
    { $unwind: '$items' },
    { $group: { _id: '$items.productId', lastSold: { $max: '$saleDate' } } },
    { $sort: { lastSold: -1 } },
    { $limit: limit }
  ]);

  if (recentSales.length === 0) {
    const products = await Product.find({
      owner: ownerId,
      isActive: true
    })
    .select('name baseUnit sellUnits')
    .limit(limit)
    .lean();

    const productIds = products.map(p => p._id);
    const stockData = await getStockForProducts(productIds, ownerId);

    return products.map(p => ({
      ...p,
      totalStock: (stockData[p._id.toString()]?.totalInBase || 0) + (stockData[p._id.toString()]?.totalLooseInBase || 0)
    }));
  }

  const productIds = recentSales.map(item => item._id);
  const products = await Product.find({
    _id: { $in: productIds },
    owner: ownerId,
    isActive: true
  })
  .select('name baseUnit sellUnits stockUnits')
  .lean();

  const productMap = {};
  products.forEach(p => {
    productMap[p._id.toString()] = p;
  });

  const stockData = await getStockForProducts(productIds, ownerId);

  return recentSales.map(item => {
    const product = productMap[item._id.toString()];
    if (!product) return null;
    const stock = stockData[item._id.toString()] || { totalInBase: 0, totalLooseInBase: 0 };
    return {
      ...product,
      totalStock: (stock.totalInBase || 0) + (stock.totalLooseInBase || 0),
      lastSold: item.lastSold
    };
  }).filter(Boolean);
};

// ============================================================
// Get product unit price
// ============================================================
export const getProductUnitPrice = async (productId, ownerId, unitName) => {
  const product = await Product.findOne({
    _id: productId,
    owner: ownerId,
    isActive: true
  })
  .select('name baseUnit sellUnits stockUnits')
  .lean();

  if (!product) {
    return null;
  }

  let unit = product.sellUnits?.find(u => u.name === unitName && u.isActive !== false);
  let unitType = 'sell';

  if (!unit) {
    unit = product.stockUnits?.find(u => u.name === unitName && u.isActive !== false);
    unitType = 'stock';
  }

  if (!unit) {
    return null;
  }

  const stock = await getStockForProduct(productId, ownerId);
  const totalStock = (stock.totalInBase || 0) + (stock.totalLooseInBase || 0);

  return {
    productId: product._id,
    productName: product.name,
    unitName: unit.name,
    unitLabel: unit.label,
    conversion: unit.conversion,
    sellPrice: unit.sellPrice || 0,
    buyPrice: unit.buyPrice || 0,
    unitType,
    availableStock: totalStock,
    availableUnits: totalStock / unit.conversion,
    inStock: totalStock > 0
  };
};

// ============================================================
// HELPER: Get stock for a single product (INCLUDES LOOSE)
// ============================================================
const getStockForProduct = async (productId, ownerId) => {
  const result = await StockBatch.aggregate([
    {
      $match: {
        productId: new mongoose.Types.ObjectId(productId),
        owner: new mongoose.Types.ObjectId(ownerId),
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
        totalInBase: { $sum: '$remainingInBase' },
        totalLooseInBase: { $sum: '$remainingLooseInBase' },
        batches: {
          $push: {
            unit: '$unit',
            remainingQuantity: '$remainingQuantity',
            remainingInBase: '$remainingInBase',
            remainingLoose: '$remainingLoose',
            remainingLooseInBase: '$remainingLooseInBase',
            bundleSize: '$bundleSize',
            buyPrice: '$buyPrice',
            expiryDate: '$expiryDate'
          }
        }
      }
    }
  ]);

  return result.length > 0 ? result[0] : { totalInBase: 0, totalLooseInBase: 0, batches: [] };
};

// ============================================================
// HELPER: Get stock for multiple products (INCLUDES LOOSE)
// ============================================================
const getStockForProducts = async (productIds, ownerId) => {
  if (!productIds || productIds.length === 0) return {};

  const result = await StockBatch.aggregate([
    {
      $match: {
        productId: { $in: productIds.map(id => new mongoose.Types.ObjectId(id)) },
        owner: new mongoose.Types.ObjectId(ownerId),
        isActive: true,
        $or: [
          { remainingQuantity: { $gt: 0 } },
          { remainingLoose: { $gt: 0 } }
        ]
      }
    },
    {
      $group: {
        _id: '$productId',
        totalInBase: { 
          $sum: { 
            $add: [
              { $ifNull: ['$remainingInBase', 0] },
              { $ifNull: ['$remainingLooseInBase', 0] }
            ] 
          } 
        },
        batches: {
          $push: {
            _id: '$_id',
            unit: '$unit',
            remainingQuantity: '$remainingQuantity',
            remainingInBase: '$remainingInBase',
            remainingLoose: '$remainingLoose',
            remainingLooseInBase: '$remainingLooseInBase',
            bundleSize: '$bundleSize',
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