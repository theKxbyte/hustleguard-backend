import Sale from '../models/Sale.js';
import Product from '../models/Product.js';

// Record a sale
export const recordSale = async (saleData, userId) => {
  const { productId, quantity, sellingPrice, customer, paymentMethod, notes } = saleData;
  
  // Get product and verify ownership
  const product = await Product.findOne({ 
    _id: productId, 
    owner: userId 
  });
  
  if (!product) {
    throw new Error('Product not found');
  }
  
  // Check stock
  if (product.quantity < quantity) {
    throw new Error(`Insufficient stock. Available: ${product.quantity}`);
  }
  
  // Calculate profit
  const buyingPrice = product.buyingPrice;
  const profit = (sellingPrice - buyingPrice) * quantity;
  
  // Create sale
  const sale = await Sale.create({
    product: productId,
    quantity,
    sellingPrice,
    buyingPrice,
    profit,
    customer,
    paymentMethod,
    notes,
    owner: userId,
    saleDate: new Date()
  });
  
  // Update product stock
  product.quantity -= quantity;
  await product.save();
  
  return sale;
};

// Get sales with filters
export const getSales = async (userId, filters = {}) => {
  const query = { owner: userId };
  
  // Date filters
  if (filters.startDate) {
    query.saleDate = { ...query.saleDate, $gte: new Date(filters.startDate) };
  }
  if (filters.endDate) {
    query.saleDate = { ...query.saleDate, $lte: new Date(filters.endDate) };
  }
  
  // Product filter
  if (filters.productId) {
    query.product = filters.productId;
  }
  
  const sales = await Sale.find(query)
    .populate('product', 'name category')
    .sort({ saleDate: -1 })
    .limit(filters.limit || 100);
  
  return sales;
};

// Get daily sales summary
export const getDailySales = async (userId, date) => {
  const startOfDay = new Date(date || Date.now());
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(startOfDay);
  endOfDay.setHours(23, 59, 59, 999);
  
  const sales = await Sale.find({
    owner: userId,
    saleDate: { $gte: startOfDay, $lte: endOfDay }
  }).populate('product', 'name');
  
  const totalRevenue = sales.reduce((sum, sale) => sum + (sale.quantity * sale.sellingPrice), 0);
  const totalProfit = sales.reduce((sum, sale) => sum + sale.profit, 0);
  
  return {
    date: startOfDay,
    totalSales: sales.length,
    totalRevenue,
    totalProfit,
    sales
  };
};

// Get sales statistics
export const getSalesStats = async (userId) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Today's sales
  const todaySales = await Sale.find({
    owner: userId,
    saleDate: { $gte: today }
  });
  
  // This month's sales
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthSales = await Sale.find({
    owner: userId,
    saleDate: { $gte: firstOfMonth }
  });
  
  // Top selling products
  const topProducts = await Sale.aggregate([
    { $match: { owner: userId } },
    { $group: {
      _id: '$product',
      totalSold: { $sum: '$quantity' },
      totalRevenue: { $sum: { $multiply: ['$quantity', '$sellingPrice'] } },
      totalProfit: { $sum: '$profit' }
    }},
    { $sort: { totalSold: -1 } },
    { $limit: 5 },
    { $lookup: {
      from: 'products',
      localField: '_id',
      foreignField: '_id',
      as: 'product'
    }},
    { $unwind: '$product' }
  ]);
  
  return {
    today: {
      totalSales: todaySales.length,
      totalRevenue: todaySales.reduce((sum, s) => sum + (s.quantity * s.sellingPrice), 0),
      totalProfit: todaySales.reduce((sum, s) => sum + s.profit, 0)
    },
    month: {
      totalSales: monthSales.length,
      totalRevenue: monthSales.reduce((sum, s) => sum + (s.quantity * s.sellingPrice), 0),
      totalProfit: monthSales.reduce((sum, s) => sum + s.profit, 0)
    },
    topProducts
  };
};