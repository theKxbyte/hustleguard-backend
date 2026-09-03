// controllers/dashboardController.js
import Product from '../models/Product.js';
import Sale from '../models/Sale.js';
import mongoose from 'mongoose';

// ============================================================
// @desc    Get dashboard statistics
// @route   GET /api/dashboard/stats
// @access  Private
// ============================================================
export const getDashboardStats = async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Calculate Inventory Value from Product.stock
    const products = await Product.find({
      owner: userId,
      isActive: true,
      stock: { $gt: 0 }
    });

    let inventoryValue = 0;
    let totalStockInBase = 0;

    for (const product of products) {
      const baseUnit = product.units.find(u => u.isBase === true);
      if (baseUnit) {
        const unitCost = baseUnit.buyPrice || 0;
        inventoryValue += product.stock * unitCost;
        totalStockInBase += product.stock;
      }
    }

    // 2. Calculate Weekly Sales
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const weeklySalesResult = await Sale.aggregate([
      {
        $match: {
          owner: new mongoose.Types.ObjectId(userId),
          saleDate: { $gte: weekStart, $lt: weekEnd },
          isActive: true,
          paymentStatus: { $ne: 'refunded' }
        }
      },
      {
        $group: {
          _id: null,
          totalSales: { $sum: '$total' },
          totalProfit: { $sum: '$totalProfit' },
          totalDiscount: { $sum: '$discount' },
          transactionCount: { $sum: 1 }
        }
      }
    ]);

    const weeklySales = weeklySalesResult.length > 0 ? weeklySalesResult[0].totalSales : 0;
    const weeklyGrossProfit = weeklySalesResult.length > 0 ? weeklySalesResult[0].totalProfit : 0;
    const weeklyDiscount = weeklySalesResult.length > 0 ? weeklySalesResult[0].totalDiscount : 0;
    const weeklyTransactions = weeklySalesResult.length > 0 ? weeklySalesResult[0].transactionCount : 0;

    // 3. Calculate Monthly Sales
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const monthlySalesResult = await Sale.aggregate([
      {
        $match: {
          owner: new mongoose.Types.ObjectId(userId),
          saleDate: { $gte: monthStart },
          isActive: true,
          paymentStatus: { $ne: 'refunded' }
        }
      },
      {
        $group: {
          _id: null,
          totalSales: { $sum: '$total' },
          totalProfit: { $sum: '$totalProfit' }
        }
      }
    ]);

    const monthlySales = monthlySalesResult.length > 0 ? monthlySalesResult[0].totalSales : 0;
    const monthlyProfit = monthlySalesResult.length > 0 ? monthlySalesResult[0].totalProfit : 0;

    // 4. Get Low Stock Count
    const lowStockCount = await Product.countDocuments({
      owner: userId,
      isActive: true,
      stock: { $gt: 0, $lte: '$minStockAlert' }
    });

    // 5. Get Out of Stock Count
    const outOfStockCount = await Product.countDocuments({
      owner: userId,
      isActive: true,
      stock: 0
    });

    // 6. Calculate Average Daily Sales (last 7 days)
    const dailySales = await Sale.aggregate([
      {
        $match: {
          owner: new mongoose.Types.ObjectId(userId),
          saleDate: { $gte: weekStart, $lt: weekEnd },
          isActive: true,
          paymentStatus: { $ne: 'refunded' }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$saleDate' } },
          dayTotal: { $sum: '$total' },
          dayProfit: { $sum: '$totalProfit' }
        }
      },
      {
        $group: {
          _id: null,
          averageDailySales: { $avg: '$dayTotal' },
          averageDailyProfit: { $avg: '$dayProfit' }
        }
      }
    ]);

    const averageDailySales = dailySales.length > 0 ? dailySales[0].averageDailySales : 0;
    const averageDailyProfit = dailySales.length > 0 ? dailySales[0].averageDailyProfit : 0;

    res.status(200).json({
      success: true,
      data: {
        inventoryValue,
        totalStockInBase,
        weeklySales,
        weeklyGrossProfit,
        weeklyDiscount,
        weeklyTransactions,
        monthlySales,
        monthlyProfit,
        averageDailySales,
        averageDailyProfit,
        lowStockCount,
        outOfStockCount,
        currency: 'KES'
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// ============================================================
// @desc    Get inventory value
// @route   GET /api/dashboard/inventory-value
// @access  Private
// ============================================================
export const getInventoryValue = async (req, res) => {
  try {
    const userId = req.user.id;

    const products = await Product.find({
      owner: userId,
      isActive: true,
      stock: { $gt: 0 }
    });

    let inventoryValue = 0;
    let totalStockInBase = 0;

    for (const product of products) {
      const baseUnit = product.units.find(u => u.isBase === true);
      if (baseUnit) {
        const unitCost = baseUnit.buyPrice || 0;
        inventoryValue += product.stock * unitCost;
        totalStockInBase += product.stock;
      }
    }

    res.status(200).json({
      success: true,
      data: {
        inventoryValue,
        totalStockInBase,
        currency: 'KES'
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// ============================================================
// @desc    Get inventory value by category
// @route   GET /api/dashboard/inventory-by-category
// @access  Private
// ============================================================
export const getInventoryByCategory = async (req, res) => {
  try {
    const userId = req.user.id;

    const products = await Product.find({
      owner: userId,
      isActive: true,
      stock: { $gt: 0 }
    });

    const categories = {};
    let totalInventory = 0;

    for (const product of products) {
      const baseUnit = product.units.find(u => u.isBase === true);
      if (!baseUnit) continue;

      const unitCost = baseUnit.buyPrice || 0;
      const value = product.stock * unitCost;
      totalInventory += value;

      if (!categories[product.category]) {
        categories[product.category] = {
          category: product.category,
          totalValue: 0,
          totalQuantity: 0,
          productCount: 0,
          products: []
        };
      }

      categories[product.category].totalValue += value;
      categories[product.category].totalQuantity += product.stock;
      categories[product.category].productCount += 1;
      categories[product.category].products.push(product._id);
    }

    const result = Object.values(categories).map(cat => ({
      ...cat,
      percentage: totalInventory > 0 ? (cat.totalValue / totalInventory) * 100 : 0,
      products: undefined
    }));

    res.status(200).json({
      success: true,
      data: {
        categories: result.sort((a, b) => b.totalValue - a.totalValue),
        totalInventory,
        currency: 'KES'
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// ============================================================
// @desc    Get weekly sales breakdown
// @route   GET /api/dashboard/weekly-sales
// @access  Private
// ============================================================
export const getWeeklySales = async (req, res) => {
  try {
    const userId = req.user.id;

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const dailyBreakdown = await Sale.aggregate([
      {
        $match: {
          owner: new mongoose.Types.ObjectId(userId),
          saleDate: { $gte: weekStart, $lt: weekEnd },
          isActive: true,
          paymentStatus: { $ne: 'refunded' }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$saleDate' } },
          day: { $first: '$saleDate' },
          totalSales: { $sum: '$total' },
          totalProfit: { $sum: '$totalProfit' },
          transactionCount: { $sum: 1 }
        }
      },
      {
        $project: {
          date: '$_id',
          dayOfWeek: { $dayOfWeek: '$day' },
          totalSales: 1,
          totalProfit: 1,
          transactionCount: 1
        }
      },
      { $sort: { date: 1 } }
    ]);

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const filledBreakdown = days.map((day, index) => {
      const dayData = dailyBreakdown.find(d => d.dayOfWeek === index + 1);
      return {
        day,
        date: dayData ? dayData.date : null,
        totalSales: dayData ? dayData.totalSales : 0,
        totalProfit: dayData ? dayData.totalProfit : 0,
        transactionCount: dayData ? dayData.transactionCount : 0
      };
    });

    const totalWeeklySales = filledBreakdown.reduce((sum, d) => sum + d.totalSales, 0);
    const totalWeeklyProfit = filledBreakdown.reduce((sum, d) => sum + d.totalProfit, 0);

    res.status(200).json({
      success: true,
      data: {
        breakdown: filledBreakdown,
        totalSales: totalWeeklySales,
        totalProfit: totalWeeklyProfit,
        transactionCount: filledBreakdown.reduce((sum, d) => sum + d.transactionCount, 0),
        currency: 'KES'
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// ============================================================
// @desc    Get weekly gross profit
// @route   GET /api/dashboard/weekly-profit
// @access  Private
// ============================================================
export const getWeeklyGrossProfit = async (req, res) => {
  try {
    const userId = req.user.id;

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const result = await Sale.aggregate([
      {
        $match: {
          owner: new mongoose.Types.ObjectId(userId),
          saleDate: { $gte: weekStart, $lt: weekEnd },
          isActive: true,
          paymentStatus: { $ne: 'refunded' }
        }
      },
      {
        $group: {
          _id: null,
          totalProfit: { $sum: '$totalProfit' },
          totalSales: { $sum: '$total' },
          totalCost: { $sum: { $subtract: ['$total', '$totalProfit'] } }
        }
      }
    ]);

    const weeklyGrossProfit = result.length > 0 ? result[0].totalProfit : 0;
    const weeklySales = result.length > 0 ? result[0].totalSales : 0;
    const weeklyCost = result.length > 0 ? result[0].totalCost : 0;
    const profitMargin = weeklySales > 0 ? (weeklyGrossProfit / weeklySales) * 100 : 0;

    res.status(200).json({
      success: true,
      data: {
        weeklyGrossProfit,
        weeklySales,
        weeklyCost,
        profitMargin,
        currency: 'KES'
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// ============================================================
// @desc    Get monthly sales
// @route   GET /api/dashboard/monthly-sales
// @access  Private
// ============================================================
export const getMonthlySales = async (req, res) => {
  try {
    const userId = req.user.id;
    const { year, month } = req.query;

    const targetYear = parseInt(year) || new Date().getFullYear();
    const targetMonth = parseInt(month) || new Date().getMonth() + 1;

    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 1);

    const result = await Sale.aggregate([
      {
        $match: {
          owner: new mongoose.Types.ObjectId(userId),
          saleDate: { $gte: startDate, $lt: endDate },
          isActive: true,
          paymentStatus: { $ne: 'refunded' }
        }
      },
      {
        $group: {
          _id: null,
          totalSales: { $sum: '$total' },
          totalProfit: { $sum: '$totalProfit' },
          totalDiscount: { $sum: '$discount' },
          transactionCount: { $sum: 1 }
        }
      }
    ]);

    const monthlySales = result.length > 0 ? result[0].totalSales : 0;
    const monthlyProfit = result.length > 0 ? result[0].totalProfit : 0;
    const monthlyDiscount = result.length > 0 ? result[0].totalDiscount : 0;
    const monthlyTransactions = result.length > 0 ? result[0].transactionCount : 0;

    res.status(200).json({
      success: true,
      data: {
        year: targetYear,
        month: targetMonth,
        totalSales: monthlySales,
        totalProfit: monthlyProfit,
        totalDiscount: monthlyDiscount,
        transactionCount: monthlyTransactions,
        currency: 'KES'
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// ============================================================
// @desc    Get top selling products
// @route   GET /api/dashboard/top-products
// @access  Private
// ============================================================
export const getTopProducts = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 10, days = 30 } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    startDate.setHours(0, 0, 0, 0);

    const result = await Sale.aggregate([
      {
        $match: {
          owner: new mongoose.Types.ObjectId(userId),
          saleDate: { $gte: startDate },
          isActive: true,
          paymentStatus: { $ne: 'refunded' }
        }
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.productId',
          productName: { $first: '$items.productName' },
          totalQuantitySold: { $sum: '$items.quantityInBase' },
          totalRevenue: { $sum: '$items.totalPrice' },
          totalProfit: { $sum: '$items.profit' },
          transactionCount: { $sum: 1 }
        }
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: parseInt(limit) },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          productId: '$_id',
          productName: 1,
          category: '$product.category',
          totalQuantitySold: 1,
          totalRevenue: 1,
          totalProfit: 1,
          transactionCount: 1,
          profitMargin: {
            $cond: [
              { $gt: ['$totalRevenue', 0] },
              { $multiply: [{ $divide: ['$totalProfit', '$totalRevenue'] }, 100] },
              0
            ]
          }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: result,
      currency: 'KES'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// ============================================================
// @desc    Get sales summary for date range
// @route   POST /api/dashboard/sales-summary
// @access  Private
// ============================================================
export const getSalesSummary = async (req, res) => {
  try {
    const userId = req.user.id;
    const { startDate, endDate } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Please provide startDate and endDate'
      });
    }

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const result = await Sale.aggregate([
      {
        $match: {
          owner: new mongoose.Types.ObjectId(userId),
          saleDate: { $gte: start, $lte: end },
          isActive: true,
          paymentStatus: { $ne: 'refunded' }
        }
      },
      {
        $group: {
          _id: null,
          totalSales: { $sum: '$total' },
          totalProfit: { $sum: '$totalProfit' },
          totalDiscount: { $sum: '$discount' },
          transactionCount: { $sum: 1 },
          averageTransactionValue: { $avg: '$total' }
        }
      }
    ]);

    const summary = result.length > 0 ? result[0] : {
      totalSales: 0,
      totalProfit: 0,
      totalDiscount: 0,
      transactionCount: 0,
      averageTransactionValue: 0
    };

    res.status(200).json({
      success: true,
      data: {
        ...summary,
        startDate: start,
        endDate: end,
        currency: 'KES'
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};