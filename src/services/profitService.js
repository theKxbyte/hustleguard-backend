import Sale from '../models/Sale.js';
import Expense from '../models/Expense.js';
import WeeklyStockReport from '../models/WeeklyStockReport.js';
import mongoose from 'mongoose';

// ============================================================
// Calculate weekly profit
// ============================================================
export const calculateWeeklyProfit = async (ownerId, startDate, endDate) => {
  // Get sales for the week
  const sales = await Sale.find({
    owner: ownerId,
    saleDate: { $gte: startDate, $lte: endDate },
    isActive: true,
    paymentStatus: 'paid'
  }).lean();

  // Get stock report for the week (for COGS)
  const stockReport = await WeeklyStockReport.findOne({
    owner: ownerId,
    weekStartDate: startDate,
    weekEndDate: endDate
  }).lean();

  // Get expenses for the week
  const expenses = await Expense.find({
    owner: ownerId,
    expenseDate: { $gte: startDate, $lte: endDate },
    isActive: true
  }).lean();

  // Calculate sales totals
  let totalSales = 0;
  let totalSalesCount = 0;
  let totalCostOfGoodsSold = 0;
  let totalProfit = 0;

  for (const sale of sales) {
    totalSales += sale.total || 0;
    totalSalesCount += 1;
    totalCostOfGoodsSold += sale.totalCost || 0;
    totalProfit += sale.totalProfit || 0;
  }

  // If no stock report, calculate COGS from sales
  if (!stockReport) {
    totalCostOfGoodsSold = 0;
    for (const sale of sales) {
      totalCostOfGoodsSold += sale.items.reduce((sum, item) => sum + (item.totalCost || 0), 0);
    }
  }

  // Calculate expenses
  let totalExpenses = 0;
  const expensesByCategory = {};
  for (const expense of expenses) {
    totalExpenses += expense.amount || 0;
    const category = expense.category || 'other';
    if (!expensesByCategory[category]) {
      expensesByCategory[category] = 0;
    }
    expensesByCategory[category] += expense.amount || 0;
  }

  // Calculate profit metrics
  const grossProfit = totalSales - totalCostOfGoodsSold;
  const netProfit = grossProfit - totalExpenses;
  const grossProfitMargin = totalSales > 0 ? (grossProfit / totalSales) * 100 : 0;
  const netProfitMargin = totalSales > 0 ? (netProfit / totalSales) * 100 : 0;

  return {
    period: {
      startDate,
      endDate
    },
    sales: {
      total: totalSales,
      count: totalSalesCount,
      average: totalSalesCount > 0 ? totalSales / totalSalesCount : 0
    },
    costOfGoodsSold: totalCostOfGoodsSold,
    expenses: {
      total: totalExpenses,
      byCategory: expensesByCategory,
      count: expenses.length
    },
    profit: {
      grossProfit,
      grossProfitMargin,
      netProfit,
      netProfitMargin,
      profitPerSale: totalSalesCount > 0 ? netProfit / totalSalesCount : 0
    },
    summary: {
      revenue: totalSales,
      costs: totalCostOfGoodsSold + totalExpenses,
      profit: netProfit
    }
  };
};

// ============================================================
// Get profit summary for date range
// ============================================================
export const getProfitSummary = async (ownerId, startDate, endDate) => {
  // Get weekly reports in range
  const reports = await WeeklyStockReport.find({
    owner: ownerId,
    weekStartDate: { $gte: startDate },
    weekEndDate: { $lte: endDate },
    status: { $in: ['finalized', 'pending_review'] }
  }).sort({ weekStartDate: 1 }).lean();

  if (reports.length === 0) {
    // Calculate from raw data
    return await calculateWeeklyProfit(ownerId, startDate, endDate);
  }

  // Aggregate from reports
  let totalSales = 0;
  let totalCOGS = 0;
  let totalGrossProfit = 0;
  let totalExpenses = 0;
  let totalNetProfit = 0;
  let weeks = [];

  for (const report of reports) {
    totalSales += report.profit?.totalSales || 0;
    totalCOGS += report.profit?.totalCostOfGoodsSold || 0;
    totalGrossProfit += report.profit?.grossProfit || 0;
    totalExpenses += report.profit?.totalExpenses || 0;
    totalNetProfit += report.profit?.netProfit || 0;
    weeks.push({
      week: report.weekNumber,
      year: report.year,
      sales: report.profit?.totalSales || 0,
      grossProfit: report.profit?.grossProfit || 0,
      netProfit: report.profit?.netProfit || 0
    });
  }

  return {
    period: { startDate, endDate },
    total: {
      sales: totalSales,
      costOfGoodsSold: totalCOGS,
      grossProfit: totalGrossProfit,
      expenses: totalExpenses,
      netProfit: totalNetProfit,
      grossProfitMargin: totalSales > 0 ? (totalGrossProfit / totalSales) * 100 : 0,
      netProfitMargin: totalSales > 0 ? (totalNetProfit / totalSales) * 100 : 0
    },
    weeks,
    average: {
      weeklySales: weeks.length > 0 ? totalSales / weeks.length : 0,
      weeklyProfit: weeks.length > 0 ? totalNetProfit / weeks.length : 0
    }
  };
};

// ============================================================
// Get profit by category
// ============================================================
export const getProfitByCategory = async (ownerId, startDate, endDate) => {
  const match = {
    owner: new mongoose.Types.ObjectId(ownerId),
    isActive: true,
    paymentStatus: 'paid'
  };

  if (startDate && endDate) {
    match.saleDate = { $gte: startDate, $lte: endDate };
  }

  const result = await Sale.aggregate([
    { $match: match },
    { $unwind: '$items' },
    {
      $lookup: {
        from: 'products',
        localField: 'items.productId',
        foreignField: '_id',
        as: 'productInfo'
      }
    },
    { $unwind: { path: '$productInfo', preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: '$productInfo.category',
        totalSales: { $sum: '$items.totalPrice' },
        totalCost: { $sum: '$items.totalCost' },
        totalProfit: { $sum: '$items.profit' },
        quantity: { $sum: '$items.quantityInBase' },
        count: { $sum: 1 }
      }
    },
    {
      $project: {
        category: { $ifNull: ['$_id', 'Uncategorized'] },
        totalSales: 1,
        totalCost: 1,
        totalProfit: 1,
        quantity: 1,
        count: 1,
        margin: {
          $cond: [
            { $gt: ['$totalSales', 0] },
            { $multiply: [{ $divide: ['$totalProfit', '$totalSales'] }, 100] },
            0
          ]
        }
      }
    },
    { $sort: { totalProfit: -1 } }
  ]);

  return result;
};

// ============================================================
// Get profit trends
// ============================================================
export const getProfitTrends = async (ownerId, period = 'weekly', weeks = 12) => {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - (weeks * 7));

  const reports = await WeeklyStockReport.find({
    owner: ownerId,
    weekStartDate: { $gte: startDate },
    weekEndDate: { $lte: endDate },
    status: { $in: ['finalized', 'pending_review'] }
  }).sort({ weekStartDate: 1 }).lean();

  if (reports.length === 0) {
    return {
      labels: [],
      datasets: {
        sales: [],
        grossProfit: [],
        netProfit: [],
        expenses: []
      }
    };
  }

  const labels = reports.map(r => 
    `Week ${r.weekNumber}, ${r.year}`
  );

  const datasets = {
    sales: reports.map(r => r.profit?.totalSales || 0),
    grossProfit: reports.map(r => r.profit?.grossProfit || 0),
    netProfit: reports.map(r => r.profit?.netProfit || 0),
    expenses: reports.map(r => r.profit?.totalExpenses || 0)
  };

  return {
    labels,
    datasets
  };
};