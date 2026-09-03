// services/alertService.js
import Alert from '../models/Alert.js';
import Product from '../models/Product.js';

// ============================================================
// CRUD Operations
// ============================================================

export const createAlert = async (alertData) => {
  const alert = await Alert.create(alertData);
  return alert;
};

export const getAlerts = async (userId, filters = {}) => {
  const query = { owner: userId };
  
  if (filters.type) query.type = filters.type;
  if (filters.severity) query.severity = filters.severity;
  if (filters.isRead !== undefined) query.isRead = filters.isRead === 'true';
  if (filters.isResolved !== undefined) query.isResolved = filters.isResolved === 'true';
  if (filters.productId) query.productId = filters.productId;
  
  if (filters.startDate || filters.endDate) {
    query.createdAt = {};
    if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
    if (filters.endDate) query.createdAt.$lte = new Date(filters.endDate);
  }
  
  const total = await Alert.countDocuments(query);
  
  const alerts = await Alert.find(query)
    .populate('productId', 'name category')
    .sort({ createdAt: -1 })
    .skip(filters.offset || 0)
    .limit(filters.limit || 50);
  
  return {
    alerts,
    total,
    hasMore: (filters.offset || 0) + alerts.length < total
  };
};

export const getAlertById = async (alertId, userId) => {
  const alert = await Alert.findOne({ _id: alertId, owner: userId })
    .populate('productId', 'name category');
  return alert;
};

export const getUnreadCount = async (userId) => {
  const count = await Alert.countDocuments({
    owner: userId,
    isRead: false,
    isResolved: false
  });
  return count;
};

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

export const markAsRead = async (alertId, userId) => {
  const alert = await Alert.findOne({ _id: alertId, owner: userId });
  if (!alert) throw new Error('Alert not found');
  
  alert.isRead = true;
  await alert.save();
  return alert;
};

export const markAsResolved = async (alertId, userId) => {
  const alert = await Alert.findOne({ _id: alertId, owner: userId });
  if (!alert) throw new Error('Alert not found');
  
  alert.isResolved = true;
  alert.resolvedAt = new Date();
  await alert.save();
  return alert;
};

export const markAllAsRead = async (userId) => {
  const result = await Alert.updateMany(
    { owner: userId, isRead: false },
    { isRead: true }
  );
  return result;
};

export const markAllAsResolved = async (userId) => {
  const result = await Alert.updateMany(
    { owner: userId, isResolved: false },
    { isResolved: true, resolvedAt: new Date() }
  );
  return result;
};

export const deleteAlert = async (alertId, userId) => {
  const alert = await Alert.findOne({ _id: alertId, owner: userId });
  if (!alert) throw new Error('Alert not found');
  
  await alert.deleteOne();
  return { message: 'Alert deleted successfully' };
};

export const deleteResolvedAlerts = async (userId) => {
  const result = await Alert.deleteMany({
    owner: userId,
    isResolved: true
  });
  return result;
};

// ============================================================
// Simple Stock Check (Using Product.stock)
// ============================================================

export const checkLowStockAlerts = async (userId) => {
  const products = await Product.find({
    owner: userId,
    isActive: true,
    stock: { $gt: 0, $lte: '$minStockAlert' }
  });

  const alerts = [];
  for (const product of products) {
    const existingAlert = await Alert.findOne({
      owner: userId,
      productId: product._id,
      type: 'low_stock',
      isResolved: false
    });
    
    if (!existingAlert) {
      const severity = product.stock === 0 ? 'critical' : 'warning';
      const alert = await createAlert({
        type: 'low_stock',
        severity,
        title: `Low Stock: ${product.name}`,
        message: `${product.name} has ${product.stock} units remaining. Minimum is ${product.minStockAlert}.`,
        productId: product._id,
        productName: product.name,
        currentStock: product.stock,
        threshold: product.minStockAlert,
        owner: userId
      });
      alerts.push(alert);
    }
  }
  
  return alerts;
};

export const checkOutOfStockAlerts = async (userId) => {
  const products = await Product.find({
    owner: userId,
    isActive: true,
    stock: 0
  });

  const alerts = [];
  for (const product of products) {
    const existingAlert = await Alert.findOne({
      owner: userId,
      productId: product._id,
      type: 'out_of_stock',
      isResolved: false
    });
    
    if (!existingAlert) {
      const alert = await createAlert({
        type: 'out_of_stock',
        severity: 'critical',
        title: `Out of Stock: ${product.name}`,
        message: `${product.name} is completely out of stock. Please restock.`,
        productId: product._id,
        productName: product.name,
        currentStock: 0,
        threshold: product.minStockAlert,
        owner: userId
      });
      alerts.push(alert);
    }
  }
  
  return alerts;
};

export const runAllStockChecks = async (userId) => {
  const lowStock = await checkLowStockAlerts(userId);
  const outOfStock = await checkOutOfStockAlerts(userId);
  
  return {
    lowStock: lowStock.length,
    outOfStock: outOfStock.length,
    totalAlerts: lowStock.length + outOfStock.length,
    alerts: [...lowStock, ...outOfStock]
  };
};