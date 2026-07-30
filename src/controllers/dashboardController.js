// controllers/dashboardController.js
import Product from '../models/Product.js';
import Sale from '../models/Sale.js';
import mongoose from 'mongoose';

// @desc    Get dashboard statistics (Inventory Value, Weekly Sales, Weekly Gross Profit)
// @route   GET /api/dashboard/stats
// @access  Private
export const getDashboardStats = async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Calculate Current Inventory Value
    const inventoryResult = await Product.aggregate([
      {
        $match: {
          owner: new mongoose.Types.ObjectId(userId),
          isActive: true
        }
      },
      {
        $group: {
          _id: null,
          totalValue: {
            $sum: { $multiply: ['$quantity', '$buyingPrice'] }
          }
        }
      }
    ]);

    const inventoryValue = inventoryResult.length > 0 ? inventoryResult[0].totalValue : 0;

    // 2. Calculate Weekly Sales
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Start of week (Sunday)
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const weeklySalesResult = await Sale.aggregate([
      {
        $match: {
          owner: new mongoose.Types.ObjectId(userId),
          saleDate: {
            $gte: weekStart,
            $lt: weekEnd
          }
        }
      },
      {
        $group: {
          _id: null,
          totalSales: {
            $sum: { $multiply: ['$quantity', '$sellingPrice'] }
          },
          totalProfit: {
            $sum: '$profit'
          }
        }
      }
    ]);

    const weeklySales = weeklySalesResult.length > 0 ? weeklySalesResult[0].totalSales : 0;
    const weeklyGrossProfit = weeklySalesResult.length > 0 ? weeklySalesResult[0].totalProfit : 0;

    res.status(200).json({
      success: true,
      data: {
        inventoryValue: inventoryValue,
        weeklySales: weeklySales,
        weeklyGrossProfit: weeklyGrossProfit,
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

// @desc    Get inventory value only
// @route   GET /api/dashboard/inventory-value
// @access  Private
export const getInventoryValue = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await Product.aggregate([
      {
        $match: {
          owner: new mongoose.Types.ObjectId(userId),
          isActive: true
        }
      },
      {
        $group: {
          _id: null,
          totalValue: {
            $sum: { $multiply: ['$quantity', '$buyingPrice'] }
          }
        }
      }
    ]);

    const inventoryValue = result.length > 0 ? result[0].totalValue : 0;

    res.status(200).json({
      success: true,
      data: {
        inventoryValue: inventoryValue,
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

// @desc    Get weekly sales
// @route   GET /api/dashboard/weekly-sales
// @access  Private
export const getWeeklySales = async (req, res) => {
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
          saleDate: {
            $gte: weekStart,
            $lt: weekEnd
          }
        }
      },
      {
        $group: {
          _id: null,
          totalSales: {
            $sum: { $multiply: ['$quantity', '$sellingPrice'] }
          }
        }
      }
    ]);

    const weeklySales = result.length > 0 ? result[0].totalSales : 0;

    res.status(200).json({
      success: true,
      data: {
        weeklySales: weeklySales,
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

// @desc    Get weekly gross profit
// @route   GET /api/dashboard/weekly-profit
// @access  Private
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
          saleDate: {
            $gte: weekStart,
            $lt: weekEnd
          }
        }
      },
      {
        $group: {
          _id: null,
          totalProfit: {
            $sum: '$profit'
          }
        }
      }
    ]);

    const weeklyGrossProfit = result.length > 0 ? result[0].totalProfit : 0;

    res.status(200).json({
      success: true,
      data: {
        weeklyGrossProfit: weeklyGrossProfit,
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