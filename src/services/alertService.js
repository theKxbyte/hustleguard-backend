// services/alertService.js
import Alert from '../models/Alert.js';
import Product from '../models/Product.js';
import StockBatch from '../models/StockBatch.js';
import Sale from '../models/Sale.js';
import mongoose from 'mongoose';

// ============================================================
// CRUD Operations
// ============================================================

// Create an alert
export const createAlert = async (alertData) => {
  const alert = await Alert.create(alertData);
  return alert;
};

// Get all alerts for a user
export const getAlerts = async (userId, filters = {}) => {
  const query = { owner: userId };
  
  if (filters.type) query.type = filters.type;
  if (filters.severity) query.severity = filters.severity;
  if (filters.isRead !== undefined) query.isRead = filters.isRead === 'true';
  if (filters.isResolved !== undefined) query.isResolved = filters.isResolved === 'true';
  if (filters.productId) query.product = filters.productId;
  
  // Date range
  if (filters.startDate || filters.endDate) {
    query.createdAt = {};
    if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
    if (filters.endDate) query.createdAt.$lte = new Date(filters.endDate);
  }
  
  const total = await Alert.countDocuments(query);
  
  const alerts = await Alert.find(query)
    .populate('product', 'name baseUnit category')
    .populate('stockBatch', 'unit quantity expiryDate')
    .sort({ createdAt: -1 })
    .skip(filters.offset || 0)
    .limit(filters.limit || 50);
  
  return {
    alerts,
    total,
    hasMore: (filters.offset || 0) + alerts.length < total
  };
};

// Get single alert by ID
export const getAlertById = async (alertId, userId) => {
  const alert = await Alert.findOne({ _id: alertId, owner: userId })
    .populate('product', 'name baseUnit category')
    .populate('stockBatch', 'unit quantity expiryDate');
  return alert;
};

// Get unread alerts count
export const getUnreadCount = async (userId) => {
  const count = await Alert.countDocuments({
    owner: userId,
    isRead: false,
    isResolved: false
  });
  return count;
};

// Get alert summary
export const getAlertSummary = async (userId) => {
  const [byType, bySeverity, totals] = await Promise.all([
    Alert.aggregate([
      { $match: { owner: new mongoose.Types.ObjectId(userId) } },
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]),
    Alert.aggregate([
      { $match: { owner: new mongoose.Types.ObjectId(userId) } },
      { $group: { _id: '$severity', count: { $sum: 1 } } }
    ]),
    Alert.aggregate([
      { $match: { owner: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          unread: { $sum: { $cond: [{ $eq: ['$isRead', false] }, 1, 0] } },
          resolved: { $sum: { $cond: [{ $eq: ['$isResolved', true] }, 1, 0] } }
        }
      }
    ])
  ]);

  const byTypeObj = {};
  byType.forEach(item => { byTypeObj[item._id] = item.count; });

  const bySeverityObj = {};
  bySeverity.forEach(item => { bySeverityObj[item._id] = item.count; });

  return {
    totals: totals[0] || { total: 0, unread: 0, resolved: 0 },
    byType: byTypeObj,
    bySeverity: bySeverityObj
  };
};

// Mark alert as read
export const markAsRead = async (alertId, userId) => {
  const alert = await Alert.findOne({ _id: alertId, owner: userId });
  if (!alert) {
    throw new Error('Alert not found');
  }
  
  alert.isRead = true;
  await alert.save();
  return alert;
};

// Mark alert as resolved
export const markAsResolved = async (alertId, userId, resolutionNote = '') => {
  const alert = await Alert.findOne({ _id: alertId, owner: userId });
  if (!alert) {
    throw new Error('Alert not found');
  }
  
  alert.isResolved = true;
  alert.resolvedAt = new Date();
  alert.resolvedBy = userId;
  if (resolutionNote) alert.resolutionNote = resolutionNote;
  await alert.save();
  return alert;
};

// Mark all alerts as read
export const markAllAsRead = async (userId) => {
  const result = await Alert.updateMany(
    { owner: userId, isRead: false },
    { isRead: true }
  );
  return result;
};

// Mark all alerts as resolved
export const markAllAsResolved = async (userId, resolutionNote = '') => {
  const result = await Alert.updateMany(
    { owner: userId, isResolved: false },
    { 
      isResolved: true, 
      resolvedAt: new Date(),
      $set: resolutionNote ? { resolutionNote } : {}
    }
  );
  return result;
};

// Delete an alert
export const deleteAlert = async (alertId, userId) => {
  const alert = await Alert.findOne({ _id: alertId, owner: userId });
  if (!alert) {
    throw new Error('Alert not found');
  }
  
  await alert.deleteOne();
  return { message: 'Alert deleted successfully' };
};

// Delete all resolved alerts
export const deleteResolvedAlerts = async (userId) => {
  const result = await Alert.deleteMany({
    owner: userId,
    isResolved: true
  });
  return result;
};

// Get alerts by product
export const getAlertsByProduct = async (productId, userId, limit = 20) => {
  const alerts = await Alert.find({
    owner: userId,
    product: productId
  })
    .sort({ createdAt: -1 })
    .limit(limit);
  return alerts;
};

// ============================================================
// Auto Alert Generators (Updated)
// ============================================================

// Check for low stock alerts (using StockBatch)
export const checkLowStockAlerts = async (userId) => {
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
    }
  ]);

  const alerts = [];
  for (const product of products) {
    const existingAlert = await Alert.findOne({
      owner: userId,
      product: product._id,
      type: 'low_stock',
      isResolved: false
    });
    
    if (!existingAlert) {
      const severity = product.totalStock === 0 ? 'critical' : 'warning';
      const alert = await createAlert({
        type: 'low_stock',
        severity,
        title: `Low Stock Alert: ${product.name}`,
        message: `${product.name} has ${product.totalStock} ${product.baseUnit?.label || 'units'} remaining. Minimum stock level is ${product.minStockAlert}.`,
        product: product._id,
        productName: product.name,
        currentStockInBase: product.totalStock,
        minStockThreshold: product.minStockAlert,
        unitName: product.baseUnit?.name || 'unit',
        unitLabel: product.baseUnit?.label || 'Unit',
        owner: userId
      });
      alerts.push(alert);
    }
  }
  
  return alerts;
};

// Check for out of stock alerts (using StockBatch)
export const checkOutOfStockAlerts = async (userId) => {
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
    }
  ]);

  const alerts = [];
  for (const product of products) {
    const existingAlert = await Alert.findOne({
      owner: userId,
      product: product._id,
      type: 'out_of_stock',
      isResolved: false
    });
    
    if (!existingAlert) {
      const alert = await createAlert({
        type: 'out_of_stock',
        severity: 'critical',
        title: `Out of Stock: ${product.name}`,
        message: `${product.name} is completely out of stock. Please restock immediately.`,
        product: product._id,
        productName: product.name,
        currentStockInBase: 0,
        minStockThreshold: product.minStockAlert,
        owner: userId
      });
      alerts.push(alert);
    }
  }
  
  return alerts;
};

// Check for dead stock (products with no sales in X days)
export const checkDeadStockAlerts = async (userId, days = 30) => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

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
        $expr: { $gt: ['$totalStock', 0] }
      }
    },
    {
      $lookup: {
        from: 'sales',
        let: { productId: '$_id' },
        pipeline: [
          { $match: { 
            owner: new mongoose.Types.ObjectId(userId),
            'items.productId': { $exists: true },
            saleDate: { $gte: cutoffDate }
          }},
          { $unwind: '$items' },
          { $match: { 
            $expr: { $eq: ['$items.productId', '$$productId'] }
          }},
          { $limit: 1 }
        ],
        as: 'recentSales'
      }
    },
    {
      $match: {
        recentSales: { $size: 0 }
      }
    }
  ]);

  const alerts = [];
  for (const product of products) {
    const existingAlert = await Alert.findOne({
      owner: userId,
      product: product._id,
      type: 'dead_stock',
      isResolved: false
    });
    
    if (!existingAlert) {
      const alert = await createAlert({
        type: 'dead_stock',
        severity: 'warning',
        title: `Dead Stock Alert: ${product.name}`,
        message: `${product.name} has ${product.totalStock} ${product.baseUnit?.label || 'units'} in stock but no sales in the last ${days} days. Consider running a promotion.`,
        product: product._id,
        productName: product.name,
        currentStockInBase: product.totalStock,
        unitName: product.baseUnit?.name || 'unit',
        unitLabel: product.baseUnit?.label || 'Unit',
        owner: userId
      });
      alerts.push(alert);
    }
  }
  
  return alerts;
};

// Check for stock expiry alerts
export const checkStockExpiryAlerts = async (userId, days = 30) => {
  const expiryThreshold = new Date();
  expiryThreshold.setDate(expiryThreshold.getDate() + days);

  const batches = await StockBatch.find({
    owner: userId,
    isActive: true,
    remainingQuantity: { $gt: 0 },
    expiryDate: { $ne: null, $lte: expiryThreshold }
  }).populate('productId', 'name baseUnit');

  const alerts = [];
  for (const batch of batches) {
    const existingAlert = await Alert.findOne({
      owner: userId,
      stockBatch: batch._id,
      type: 'stock_expiry',
      isResolved: false
    });
    
    if (!existingAlert) {
      const daysUntilExpiry = Math.ceil(
        (batch.expiryDate - new Date()) / (1000 * 60 * 60 * 24)
      );
      
      const severity = daysUntilExpiry <= 7 ? 'critical' : 
                       daysUntilExpiry <= 14 ? 'warning' : 'info';
      
      const alert = await createAlert({
        type: 'stock_expiry',
        severity,
        title: `Stock Expiring: ${batch.productId.name}`,
        message: `${batch.quantity} ${batch.unit.label} (${batch.quantityInBase} ${batch.productId.baseUnit?.label || 'units'}) expires in ${daysUntilExpiry} days.`,
        product: batch.productId._id,
        productName: batch.productId.name,
        stockBatch: batch._id,
        currentStockInBase: batch.remainingInBase,
        unitName: batch.unit.name,
        unitLabel: batch.unit.label,
        quantityInUnit: batch.remainingQuantity,
        oldValue: null,
        newValue: null,
        owner: userId
      });
      alerts.push(alert);
    }
  }
  
  return alerts;
};

// Check for supplier price changes
export const checkSupplierPriceChanges = async (productId, userId, oldSupplierPrice, newSupplierPrice) => {
  const product = await Product.findOne({ _id: productId, owner: userId });
  if (!product) {
    throw new Error('Product not found');
  }
  
  // Only alert if price changed
  if (oldSupplierPrice === newSupplierPrice) return null;
  
  const changePercentage = ((newSupplierPrice - oldSupplierPrice) / oldSupplierPrice) * 100;
  const severity = Math.abs(changePercentage) > 20 ? 'critical' : 'warning';
  
  const alert = await createAlert({
    type: 'supplier_price_change',
    severity: severity,
    title: `Supplier Price Change: ${product.name}`,
    message: `Supplier price for ${product.name} changed from ${oldSupplierPrice} to ${newSupplierPrice} (${changePercentage.toFixed(1)}% change).`,
    product: product._id,
    productName: product.name,
    oldValue: oldSupplierPrice,
    newValue: newSupplierPrice,
    owner: userId
  });
  
  return alert;
};

// Check for price change alerts (selling price)
export const checkPriceChangeAlerts = async (productId, userId, oldSellPrice, newSellPrice) => {
  const product = await Product.findOne({ _id: productId, owner: userId });
  if (!product) {
    throw new Error('Product not found');
  }
  
  if (oldSellPrice === newSellPrice) return null;
  
  const changePercentage = ((newSellPrice - oldSellPrice) / oldSellPrice) * 100;
  const severity = Math.abs(changePercentage) > 25 ? 'warning' : 'info';
  
  const alert = await createAlert({
    type: 'price_change',
    severity: severity,
    title: `Price Change: ${product.name}`,
    message: `Selling price for ${product.name} changed from ${oldSellPrice} to ${newSellPrice} (${changePercentage.toFixed(1)}% change).`,
    product: product._id,
    productName: product.name,
    oldValue: oldSellPrice,
    newValue: newSellPrice,
    owner: userId
  });
  
  return alert;
};

// ============================================================
// Run specific stock check type
// ============================================================
export const runStockCheckType = async (userId, type) => {
  const checkMap = {
    'low_stock': checkLowStockAlerts,
    'out_of_stock': checkOutOfStockAlerts,
    'dead_stock': checkDeadStockAlerts,
    'stock_expiry': checkStockExpiryAlerts
  };
  
  const checkFn = checkMap[type];
  if (!checkFn) {
    throw new Error(`Unknown check type: ${type}`);
  }
  
  const alerts = await checkFn(userId);
  return {
    type,
    alertsCreated: alerts.length,
    alerts
  };
};

// ============================================================
// Run all stock checks
// ============================================================
export const runAllStockChecks = async (userId) => {
  const lowStockAlerts = await checkLowStockAlerts(userId);
  const outOfStockAlerts = await checkOutOfStockAlerts(userId);
  const deadStockAlerts = await checkDeadStockAlerts(userId);
  const expiryAlerts = await checkStockExpiryAlerts(userId);
  
  const allAlerts = [...lowStockAlerts, ...outOfStockAlerts, ...deadStockAlerts, ...expiryAlerts];
  
  return {
    lowStock: lowStockAlerts.length,
    outOfStock: outOfStockAlerts.length,
    deadStock: deadStockAlerts.length,
    stockExpiry: expiryAlerts.length,
    totalAlerts: allAlerts.length,
    alerts: allAlerts
  };
};