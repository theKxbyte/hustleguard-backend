import PhysicalCount from '../models/PhysicalCount.js';
import Product from '../models/Product.js';
import StockBatch from '../models/StockBatch.js';
import mongoose from 'mongoose';

// ============================================================
// Record physical count
// ============================================================
export const recordPhysicalCount = async (data, userId) => {
  const { productId, physicalQuantity, unitName, countedBy, ...rest } = data;

  // Get product
  const product = await Product.findOne({
    _id: productId,
    owner: userId,
    isActive: true
  }).lean();

  if (!product) {
    throw new Error('Product not found');
  }

  // Get unit conversion
  const allUnits = [...(product.sellUnits || []), ...(product.stockUnits || [])];
  const unit = allUnits.find(u => u.name === unitName && u.isActive !== false);

  if (!unit) {
    throw new Error(`Unit "${unitName}" not found for this product`);
  }

  // Get system stock
  const systemStock = await getSystemStock(productId, userId);

  // Create physical count
  const physicalCount = new PhysicalCount({
    productId,
    productName: product.name,
    unit: {
      name: unit.name,
      label: unit.label,
      conversion: unit.conversion
    },
    physicalQuantity: physicalQuantity,
    physicalQuantityInBase: physicalQuantity * unit.conversion,
    systemQuantity: systemStock.totalInBase,
    systemQuantityInBase: systemStock.totalInBase,
    costPerUnit: unit.buyPrice || product.buyingPrice || 0,
    countedBy: countedBy || userId,
    countedByName: data.countedByName || 'System',
    owner: userId,
    ...rest
  });

  physicalCount.calculateVariance();
  await physicalCount.save();

  return physicalCount;
};

// ============================================================
// Get physical counts with filters
// ============================================================
export const getPhysicalCounts = async (ownerId, filters = {}) => {
  const { startDate, endDate, productId, limit = 100, offset = 0 } = filters;

  const query = { owner: ownerId };
  if (startDate && endDate) {
    query.countDate = { $gte: new Date(startDate), $lte: new Date(endDate) };
  }
  if (productId) query.productId = productId;

  const counts = await PhysicalCount.find(query)
    .populate('productId', 'name category')
    .sort({ countDate: -1 })
    .limit(limit)
    .skip(offset)
    .lean();

  const total = await PhysicalCount.countDocuments(query);

  return {
    counts,
    total,
    hasMore: offset + limit < total
  };
};

// ============================================================
// Get variance summary
// ============================================================
export const getVarianceSummary = async (ownerId, startDate, endDate) => {
  const match = { owner: ownerId };
  if (startDate && endDate) {
    match.countDate = { $gte: startDate, $lte: endDate };
  }

  const result = await PhysicalCount.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalOverVariance: {
          $sum: {
            $cond: [{ $gt: ['$varianceInBase', 0] }, '$varianceInBase', 0]
          }
        },
        totalUnderVariance: {
          $sum: {
            $cond: [{ $lt: ['$varianceInBase', 0] }, '$varianceInBase', 0]
          }
        },
        totalVarianceValue: { $sum: '$varianceValue' },
        count: { $sum: 1 },
        productsWithVariance: {
          $addToSet: {
            $cond: [{ $ne: ['$varianceInBase', 0] }, '$productId', null]
          }
        }
      }
    }
  ]);

  if (result.length === 0) {
    return {
      totalOverVariance: 0,
      totalUnderVariance: 0,
      totalVarianceValue: 0,
      count: 0,
      productsWithVariance: 0
    };
  }

  return {
    ...result[0],
    productsWithVariance: result[0].productsWithVariance.filter(id => id !== null).length,
    netVariance: result[0].totalOverVariance + result[0].totalUnderVariance
  };
};

// ============================================================
// Get products needing physical count
// ============================================================
export const getProductsNeedingCount = async (ownerId) => {
  // Get all active products
  const products = await Product.find({
    owner: ownerId,
    isActive: true
  }).select('_id name category').lean();

  // Get last count date for each product
  const lastCounts = await PhysicalCount.aggregate([
    { $match: { owner: new mongoose.Types.ObjectId(ownerId) } },
    { $sort: { countDate: -1 } },
    {
      $group: {
        _id: '$productId',
        lastCountDate: { $first: '$countDate' },
        lastVariance: { $first: '$varianceInBase' }
      }
    }
  ]);

  const lastCountMap = {};
  lastCounts.forEach(item => {
    lastCountMap[item._id.toString()] = {
      lastCountDate: item.lastCountDate,
      lastVariance: item.lastVariance
    };
  });

  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  return products.map(product => {
    const lastCount = lastCountMap[product._id.toString()];
    const needsCount = !lastCount || lastCount.lastCountDate < thirtyDaysAgo;

    return {
      productId: product._id,
      productName: product.name,
      category: product.category,
      lastCountDate: lastCount?.lastCountDate || null,
      lastVariance: lastCount?.lastVariance || 0,
      needsCount,
      daysSinceLastCount: lastCount 
        ? Math.floor((now - lastCount.lastCountDate) / (1000 * 60 * 60 * 24))
        : null
    };
  });
};

// ============================================================
// HELPER: Get system stock
// ============================================================
const getSystemStock = async (productId, ownerId) => {
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
        totalInBase: {
          $sum: { $add: ['$remainingInBase', '$remainingLooseInBase'] }
        }
      }
    }
  ]);

  return result.length > 0 ? result[0] : { totalInBase: 0 };
};