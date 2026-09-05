// services/stockMonitorService.js
import Product from '../models/Product.js';
import Sale from '../models/Sale.js';
import mongoose from 'mongoose';

export const getTodayStockSnapshot = async (userId) => {
  // Today's date range
  const today = new Date();
  const startOfDay = new Date(today);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(today);
  endOfDay.setHours(23, 59, 59, 999);

  // Get all active products
  const products = await Product.find({
    owner: userId,
    isActive: true
  }).lean();

  // Get today's sales aggregated by product
  const salesToday = await Sale.aggregate([
    {
      $match: {
        owner: new mongoose.Types.ObjectId(userId),
        saleDate: { $gte: startOfDay, $lte: endOfDay },
        isActive: true,
        paymentStatus: { $ne: 'refunded' }
      }
    },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.productId',
        totalSold: { $sum: '$items.quantityInBase' },
        lastSale: { $max: '$saleDate' }
      }
    }
  ]);

  // Create lookup map for sales
  const salesMap = {};
  salesToday.forEach(sale => {
    salesMap[sale._id.toString()] = {
      totalSold: sale.totalSold,
      lastSale: sale.lastSale
    };
  });

  // Build product list with stock data
  const productsWithStock = products.map(product => {
    const baseUnit = product.units?.find(u => u.isBase);
    const saleData = salesMap[product._id.toString()] || { totalSold: 0, lastSale: null };
    const openingStock = product.stock + saleData.totalSold; // Current stock + sold today
    
    return {
      _id: product._id,
      name: product.name,
      category: product.category,
      openingStock: openingStock,
      soldToday: saleData.totalSold,
      currentStock: product.stock,
      baseUnit: baseUnit?.label || baseUnit?.name || 'Unit',
      lastSale: saleData.lastSale
    };
  });

  // Sort by most sold today first
  productsWithStock.sort((a, b) => b.soldToday - a.soldToday);

  // Summary
  const summary = {
    totalOpeningStock: productsWithStock.reduce((sum, p) => sum + p.openingStock, 0),
    totalSoldToday: productsWithStock.reduce((sum, p) => sum + p.soldToday, 0),
    totalCurrentStock: productsWithStock.reduce((sum, p) => sum + p.currentStock, 0),
    totalProducts: productsWithStock.length,
    productsWithSales: productsWithStock.filter(p => p.soldToday > 0).length
  };

  return {
    date: today,
    products: productsWithStock,
    summary
  };
};