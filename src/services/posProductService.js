// services/posProductService.js
import Product from '../models/Product.js';
import Sale from '../models/Sale.js';
import mongoose from 'mongoose';

// ============================================================
// Search products for POS
// ============================================================
export const searchPosProducts = async (filters) => {
  const { 
    query, 
    category, 
    limit = 20, 
    offset = 0, 
    includeOutOfStock = false,
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
        { 'units.barcode': searchTerm },
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
    .select('name description category units minStockAlert stock isActive')
    .lean()
    .limit(limit)
    .skip(offset)
    .sort({ name: 1 });

  const total = await Product.countDocuments(queryObj);

  const enrichedProducts = [];
  for (const product of products) {
    const totalStock = product.stock || 0;
    
    if (!includeOutOfStock && totalStock <= 0) {
      continue;
    }

    const sellUnits = product.units?.filter(u => u.isActive !== false) || [];
    const sellUnitsWithStock = sellUnits.map(unit => {
      const availableInUnit = totalStock / unit.conversion;
      return {
        ...unit,
        availableStock: totalStock,
        availableUnits: availableInUnit,
        inStock: totalStock > 0 && availableInUnit >= 0.001,
        canSell: totalStock > 0,
        maxQuantity: Math.floor(availableInUnit)
      };
    });

    enrichedProducts.push({
      _id: product._id,
      name: product.name,
      description: product.description,
      category: product.category,
      units: product.units,
      sellUnits: sellUnitsWithStock,
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
// Get product by barcode
// ============================================================
export const getProductByBarcode = async (barcode, ownerId) => {
  if (!barcode) return null;

  const product = await Product.findOne({
    owner: ownerId,
    isActive: true,
    'units.barcode': barcode
  })
  .select('name description category units minStockAlert stock')
  .lean();

  if (!product) return null;

  const matchedUnit = product.units?.find(u => u.barcode === barcode);

  return {
    ...product,
    matchedUnit
  };
};

// ============================================================
// Get product with sell units and stock info
// ============================================================
export const getProductWithSellUnits = async (product, ownerId) => {
  const totalStock = product.stock || 0;
  
  const sellUnits = product.units?.filter(u => u.isActive !== false) || [];
  const sellUnitsWithStock = sellUnits.map(unit => {
    const availableInUnit = totalStock / unit.conversion;
    return {
      ...unit,
      availableStock: totalStock,
      availableUnits: availableInUnit,
      inStock: totalStock > 0 && availableInUnit >= 0.001,
      canSell: totalStock > 0,
      maxQuantity: Math.floor(availableInUnit)
    };
  });

  return {
    ...product,
    sellUnits: sellUnitsWithStock,
    totalStock: totalStock,
    isLowStock: totalStock <= product.minStockAlert && totalStock > 0,
    isOutOfStock: totalStock <= 0
  };
};

// ============================================================
// Get multiple products by IDs
// ============================================================
export const getProductsBatch = async (productIds, ownerId) => {
  const products = await Product.find({
    _id: { $in: productIds },
    owner: ownerId,
    isActive: true
  })
  .select('name description category units minStockAlert stock')
  .lean();

  const productMap = {};

  for (const product of products) {
    const totalStock = product.stock || 0;
    
    const sellUnits = product.units?.filter(u => u.isActive !== false) || [];
    const sellUnitsWithStock = sellUnits.map(unit => ({
      ...unit,
      availableStock: totalStock,
      availableUnits: totalStock / unit.conversion,
      inStock: totalStock > 0
    }));

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
      { 'units.barcode': searchTerm }
    ]
  })
  .select('name units stock')
  .lean()
  .limit(limit);

  return products.map(product => {
    const totalStock = product.stock || 0;
    const sellUnits = product.units?.filter(u => u.isActive !== false) || [];
    const primaryUnit = sellUnits[0] || { name: 'unit', label: 'Unit' };

    return {
      id: product._id,
      name: product.name,
      primaryUnit: primaryUnit,
      sellingPrice: primaryUnit.sellPrice || 0,
      availableStock: totalStock,
      inStock: totalStock > 0,
      display: `${product.name} (${totalStock} ${primaryUnit.label || 'units'} available)`,
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
  .select('name units minStockAlert stock')
  .lean();

  if (!product) {
    throw new Error('Product not found');
  }

  const totalStock = product.stock || 0;

  const sellUnits = product.units?.filter(u => u.isActive !== false) || [];
  const sellUnitsWithStock = sellUnits.map(unit => {
    const availableInUnit = totalStock / unit.conversion;
    return {
      ...unit,
      availableStock: totalStock,
      availableUnits: availableInUnit,
      inStock: totalStock > 0 && availableInUnit >= 0.001,
      maxQuantity: Math.floor(availableInUnit)
    };
  });

  return {
    productId: product._id,
    productName: product.name,
    totalStock: totalStock,
    units: sellUnitsWithStock,
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
  .select('name units stock')
  .lean();

  if (!product) {
    throw new Error('Product not found');
  }

  const unit = product.units?.find(u => u.name === unitName && u.isActive !== false);

  if (!unit) {
    return {
      productId,
      productName: product.name,
      unitName,
      isAvailable: false,
      error: `Unit "${unitName}" not found for this product`
    };
  }

  const totalStock = product.stock || 0;
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
    totalPrice: (unit.sellPrice || 0) * quantity
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
      { 'units.barcode': searchTerm }
    ]
  })
  .select('name description category units minStockAlert stock')
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
    .select('name units stock')
    .limit(limit)
    .lean();

    return products;
  }

  const productIds = recentSales.map(item => item._id);
  const products = await Product.find({
    _id: { $in: productIds },
    owner: ownerId,
    isActive: true
  })
  .select('name units stock')
  .lean();

  const productMap = {};
  products.forEach(p => {
    productMap[p._id.toString()] = p;
  });

  return recentSales.map(item => {
    const product = productMap[item._id.toString()];
    if (!product) return null;
    return {
      ...product,
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
  .select('name units stock')
  .lean();

  if (!product) {
    return null;
  }

  const unit = product.units?.find(u => u.name === unitName && u.isActive !== false);

  if (!unit) {
    return null;
  }

  const totalStock = product.stock || 0;

  return {
    productId: product._id,
    productName: product.name,
    unitName: unit.name,
    unitLabel: unit.label,
    conversion: unit.conversion,
    sellPrice: unit.sellPrice || 0,
    buyPrice: unit.buyPrice || 0,
    availableStock: totalStock,
    availableUnits: totalStock / unit.conversion,
    inStock: totalStock > 0
  };
};