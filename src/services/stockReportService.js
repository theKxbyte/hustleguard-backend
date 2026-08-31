import WeeklyStockReport from '../models/WeeklyStockReport.js';
import Product from '../models/Product.js';
import StockBatch from '../models/StockBatch.js';
import Sale from '../models/Sale.js';
import PhysicalCount from '../models/PhysicalCount.js';
import mongoose from 'mongoose';

// ============================================================
// Generate weekly stock report
// ============================================================
export const generateWeeklyStockReport = async (ownerId, weekStartDate, weekEndDate) => {
  // Check if report already exists for this week
  const existingReport = await WeeklyStockReport.findOne({
    owner: ownerId,
    weekStartDate: weekStartDate,
    weekEndDate: weekEndDate
  });

  if (existingReport) {
    throw new Error('Report already exists for this week');
  }

  // Get all active products
  const products = await Product.find({
    owner: ownerId,
    isActive: true
  }).lean();

  // Get previous week's closing stock (as opening stock)
  const previousWeekEnd = new Date(weekStartDate);
  previousWeekEnd.setDate(previousWeekEnd.getDate() - 1);
  const previousWeekStart = new Date(previousWeekEnd);
  previousWeekStart.setDate(previousWeekStart.getDate() - 6);

  const previousReport = await WeeklyStockReport.findOne({
    owner: ownerId,
    weekEndDate: { $lte: previousWeekEnd },
    status: { $in: ['finalized', 'pending_review'] }
  }).sort({ weekEndDate: -1 });

  // Get sales for the week
  const sales = await Sale.find({
    owner: ownerId,
    saleDate: { $gte: weekStartDate, $lte: weekEndDate },
    isActive: true,
    paymentStatus: 'paid'
  }).lean();

  // Get stock received during the week (from StockBatch)
  const stockReceived = await StockBatch.find({
    owner: ownerId,
    receivedAt: { $gte: weekStartDate, $lte: weekEndDate },
    isActive: true
  }).lean();

  // Get physical counts for the week
  const physicalCounts = await PhysicalCount.find({
    owner: ownerId,
    countDate: { $gte: weekStartDate, $lte: weekEndDate }
  }).lean();

  // Build report items
  const reportItems = [];
  let totalOpeningValue = 0;
  let totalReceivedValue = 0;
  let totalSoldValue = 0;
  let totalClosingValue = 0;
  let totalVarianceValue = 0;

  for (const product of products) {
    // Get opening stock from previous report
    let openingQuantity = 0;
    let openingValue = 0;
    let costPerUnit = 0;

    if (previousReport) {
      const previousItem = previousReport.items.find(
        item => item.productId.toString() === product._id.toString()
      );
      if (previousItem) {
        openingQuantity = previousItem.closingQuantity;
        openingValue = previousItem.closingValue;
        costPerUnit = previousItem.costPerUnit || product.buyingPrice || 0;
      }
    }

    // If no previous report, use current stock as opening
    if (openingQuantity === 0) {
      const currentStock = await getCurrentStock(product._id, ownerId);
      openingQuantity = currentStock.totalInBase;
      openingValue = openingQuantity * (product.buyingPrice || 0);
      costPerUnit = product.buyingPrice || 0;
    }

    // Calculate quantity sold
    const productSales = sales.filter(sale => 
      sale.items.some(item => item.productId.toString() === product._id.toString())
    );
    let quantitySold = 0;
    let soldValue = 0;
    for (const sale of productSales) {
      for (const item of sale.items) {
        if (item.productId.toString() === product._id.toString()) {
          quantitySold += item.quantityInBase || 0;
          soldValue += item.totalPrice || 0;
        }
      }
    }

    // Calculate quantity received
    const productReceived = stockReceived.filter(
      batch => batch.productId.toString() === product._id.toString()
    );
    let quantityReceived = 0;
    let receivedValue = 0;
    for (const batch of productReceived) {
      quantityReceived += batch.quantityInBase || 0;
      receivedValue += batch.totalCost || 0;
    }

    // Calculate closing stock (opening + received - sold)
    const closingQuantity = openingQuantity + quantityReceived - quantitySold;
    const closingValue = closingQuantity * costPerUnit;

    // Check if there's a physical count
    const physicalCount = physicalCounts.find(
      count => count.productId.toString() === product._id.toString()
    );
    let physicalQuantity = 0;
    let physicalValue = 0;
    let variance = 0;
    let varianceValue = 0;
    let varianceType = 'none';

    if (physicalCount) {
      physicalQuantity = physicalCount.physicalQuantityInBase;
      physicalValue = physicalCount.physicalValue;
      variance = physicalQuantity - closingQuantity;
      varianceValue = variance * costPerUnit;
      varianceType = variance > 0 ? 'over' : variance < 0 ? 'under' : 'none';
      totalVarianceValue += varianceValue;
    }

    // Get unit info
    const unit = product.baseUnit || { name: 'unit', label: 'Unit', conversion: 1 };

    reportItems.push({
      productId: product._id,
      productName: product.name,
      category: product.category,
      unit: {
        name: unit.name || 'unit',
        label: unit.label || 'Unit',
        conversion: unit.conversion || 1
      },
      openingQuantity: openingQuantity,
      openingQuantityInBase: openingQuantity,
      openingValue: openingValue,
      quantityReceived: quantityReceived,
      quantityReceivedInBase: quantityReceived,
      receivedValue: receivedValue,
      quantitySold: quantitySold,
      quantitySoldInBase: quantitySold,
      soldValue: soldValue,
      quantityAdjusted: 0,
      quantityAdjustedInBase: 0,
      adjustmentValue: 0,
      adjustmentReason: 'other',
      closingQuantity: closingQuantity,
      closingQuantityInBase: closingQuantity,
      closingValue: closingValue,
      physicalCount: physicalQuantity,
      physicalCountInBase: physicalQuantity,
      physicalValue: physicalValue,
      hasPhysicalCount: !!physicalCount,
      variance: variance,
      varianceInBase: variance,
      varianceValue: varianceValue,
      varianceType: varianceType,
      costPerUnit: costPerUnit
    });

    totalOpeningValue += openingValue;
    totalReceivedValue += receivedValue;
    totalSoldValue += soldValue;
    totalClosingValue += closingValue;
  }

  // Create report
  const weekNumber = getWeekNumber(weekStartDate);
  const year = weekStartDate.getFullYear();

  const report = new WeeklyStockReport({
    weekStartDate,
    weekEndDate,
    weekNumber,
    year,
    items: reportItems,
    summary: {
      totalOpeningValue,
      totalReceivedValue,
      totalSoldValue,
      totalAdjustmentValue: 0,
      totalClosingValue,
      totalVarianceValue,
      totalItems: reportItems.length,
      itemsWithVariance: reportItems.filter(item => item.variance !== 0).length
    },
    status: 'draft',
    generatedBy: ownerId,
    owner: ownerId
  });

  // Calculate profit
  const cogs = totalOpeningValue + totalReceivedValue - totalClosingValue;
  const grossProfit = totalSoldValue - cogs;
  report.profit = {
    totalSales: totalSoldValue,
    totalCostOfGoodsSold: cogs,
    grossProfit: grossProfit,
    grossProfitMargin: totalSoldValue > 0 ? (grossProfit / totalSoldValue) * 100 : 0,
    totalExpenses: 0,
    netProfit: grossProfit,
    netProfitMargin: totalSoldValue > 0 ? (grossProfit / totalSoldValue) * 100 : 0
  };

  await report.save();
  return report;
};

// ============================================================
// Get all weekly stock reports
// ============================================================
export const getWeeklyStockReports = async (ownerId, filters = {}) => {
  const { limit = 50, offset = 0, status, year } = filters;

  const query = { owner: ownerId };
  if (status) query.status = status;
  if (year) query.year = parseInt(year);

  const reports = await WeeklyStockReport.find(query)
    .sort({ weekStartDate: -1 })
    .limit(limit)
    .skip(offset)
    .lean();

  return reports;
};

// ============================================================
// Get single weekly stock report by ID
// ============================================================
export const getWeeklyStockReportById = async (reportId, ownerId) => {
  const report = await WeeklyStockReport.findOne({
    _id: reportId,
    owner: ownerId
  }).lean();

  if (!report) {
    throw new Error('Report not found');
  }

  return report;
};

// ============================================================
// Finalize weekly stock report
// ============================================================
export const finalizeWeeklyStockReport = async (reportId, userId) => {
  const report = await WeeklyStockReport.findOne({
    _id: reportId,
    owner: userId
  });

  if (!report) {
    throw new Error('Report not found');
  }

  if (report.status === 'finalized') {
    throw new Error('Report is already finalized');
  }

  report.finalize(userId);
  await report.save();

  return report;
};

// ============================================================
// Get stock value summary
// ============================================================
export const getStockValueSummary = async (ownerId) => {
  const products = await Product.find({
    owner: ownerId,
    isActive: true
  }).lean();

  let totalStockValue = 0;
  let totalItems = 0;
  const categories = {};

  for (const product of products) {
    const stock = await getCurrentStock(product._id, ownerId);
    const totalInBase = stock.totalInBase || 0;
    const costPerUnit = product.buyingPrice || 0;
    const value = totalInBase * costPerUnit;

    totalStockValue += value;
    totalItems += 1;

    const category = product.category || 'Uncategorized';
    if (!categories[category]) {
      categories[category] = { value: 0, count: 0 };
    }
    categories[category].value += value;
    categories[category].count += 1;
  }

  return {
    totalStockValue,
    totalItems,
    categories,
    averageValuePerItem: totalItems > 0 ? totalStockValue / totalItems : 0
  };
};

// ============================================================
// HELPER: Get current stock for a product
// ============================================================
const getCurrentStock = async (productId, ownerId) => {
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
        },
        totalValue: {
          $sum: { $multiply: ['$buyPrice', { $add: ['$remainingInBase', '$remainingLooseInBase'] }] }
        }
      }
    }
  ]);

  return result.length > 0 ? result[0] : { totalInBase: 0, totalValue: 0 };
};

// ============================================================
// HELPER: Get week number
// ============================================================
const getWeekNumber = (date) => {
  const d = new Date(date);
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const days = Math.floor((d - yearStart) / (24 * 60 * 60 * 1000));
  return Math.ceil((days + 1) / 7);
};