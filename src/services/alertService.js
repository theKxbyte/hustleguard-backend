import Alert from '../models/Alert.js';
import Product from '../models/Product.js';
import Sale from '../models/Sale.js';

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
  
  const alerts = await Alert.find(query)
    .sort({ createdAt: -1 })
    .limit(filters.limit || 50);
  
  return alerts;
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
export const markAsResolved = async (alertId, userId) => {
  const alert = await Alert.findOne({ _id: alertId, owner: userId });
  if (!alert) {
    throw new Error('Alert not found');
  }
  
  alert.isResolved = true;
  alert.resolvedAt = new Date();
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

// Delete an alert
export const deleteAlert = async (alertId, userId) => {
  const alert = await Alert.findOne({ _id: alertId, owner: userId });
  if (!alert) {
    throw new Error('Alert not found');
  }
  
  await alert.deleteOne();
  return { message: 'Alert deleted successfully' };
};

// --- Auto Alert Generators ---

// Check for low stock alerts
export const checkLowStockAlerts = async (userId) => {
  const products = await Product.find({
    owner: userId,
    isActive: true,
    $expr: { $lte: ['$quantity', '$minStockAlert'] }
  });
  
  const alerts = [];
  for (const product of products) {
    const existingAlert = await Alert.findOne({
      owner: userId,
      product: product._id,
      type: 'low_stock',
      isResolved: false
    });
    
    if (!existingAlert) {
      const alert = await createAlert({
        type: 'low_stock',
        severity: product.quantity === 0 ? 'critical' : 'warning',
        title: `Low Stock Alert: ${product.name}`,
        message: `${product.name} has only ${product.quantity} units remaining. Minimum stock level is ${product.minStockAlert}.`,
        product: product._id,
        productName: product.name,
        owner: userId
      });
      alerts.push(alert);
    }
  }
  
  return alerts;
};

// Check for out of stock alerts
export const checkOutOfStockAlerts = async (userId) => {
  const products = await Product.find({
    owner: userId,
    quantity: 0,
    isActive: true
  });
  
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
        owner: userId
      });
      alerts.push(alert);
    }
  }
  
  return alerts;
};

// Check for dead stock (products with no sales in 30 days)
export const checkDeadStockAlerts = async (userId) => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  // Get all products with stock
  const products = await Product.find({
    owner: userId,
    quantity: { $gt: 0 },
    isActive: true
  });
  
  const alerts = [];
  for (const product of products) {
    // Check if product had sales in last 30 days
    const recentSale = await Sale.findOne({
      owner: userId,
      product: product._id,
      saleDate: { $gte: thirtyDaysAgo }
    });
    
    if (!recentSale) {
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
          message: `${product.name} has not been sold in 30 days. Consider running a promotion or discount.`,
          product: product._id,
          productName: product.name,
          owner: userId
        });
        alerts.push(alert);
      }
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
    message: `Supplier price for ${product.name} changed from $${oldSupplierPrice} to $${newSupplierPrice} (${changePercentage.toFixed(1)}% change).`,
    product: product._id,
    productName: product.name,
    oldValue: oldSupplierPrice,
    newValue: newSupplierPrice,
    owner: userId
  });
  
  return alert;
};

// Run all stock checks
export const runAllStockChecks = async (userId) => {
  const lowStockAlerts = await checkLowStockAlerts(userId);
  const outOfStockAlerts = await checkOutOfStockAlerts(userId);
  const deadStockAlerts = await checkDeadStockAlerts(userId);
  
  return {
    lowStock: lowStockAlerts.length,
    outOfStock: outOfStockAlerts.length,
    deadStock: deadStockAlerts.length,
    total: lowStockAlerts.length + outOfStockAlerts.length + deadStockAlerts.length,
    alerts: [...lowStockAlerts, ...outOfStockAlerts, ...deadStockAlerts]
  };
};