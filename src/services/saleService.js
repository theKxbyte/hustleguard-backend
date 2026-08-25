// services/saleService.js - UPDATED with UOM + Multi-item Support + Loose Quantity
import Sale from '../models/Sale.js';
import Product from '../models/Product.js';
import StockBatch from '../models/StockBatch.js';
import mongoose from 'mongoose';

// ============================================================
// Record a sale (multi-item with UOM support)
// ============================================================
export const recordSale = async (saleData, userId) => {
  const {
    items,
    customer,
    customerPhone,
    customerEmail,
    discount = 0,
    discountType = 'fixed',
    taxRate = 0,
    paymentMethod = 'cash',
    paymentStatus = 'paid',
    amountPaid,
    notes
  } = saleData;

  if (!items || items.length === 0) {
    throw new Error('At least one item is required');
  }

  console.log(`📝 Recording sale with ${items.length} items`);

  const saleItems = [];
  let subtotal = 0;
  let totalProfit = 0;
  const stockDeductions = [];

  for (const item of items) {
    const { productId, unitName, quantity } = item;

    const product = await Product.findOne({
      _id: productId,
      owner: userId,
      isActive: true
    });

    if (!product) {
      throw new Error(`Product not found: ${productId}`);
    }

    const sellUnit = product.sellUnits?.find(u => u.name === unitName && u.isActive !== false);
    if (!sellUnit) {
      throw new Error(`Unit "${unitName}" not found for product "${product.name}"`);
    }

    const stock = await getStockForProduct(productId, userId);
    const requestedInBase = quantity * sellUnit.conversion;

    if (stock.totalInBase < requestedInBase) {
      throw new Error(
        `Insufficient stock for ${product.name} in ${unitName}. ` +
        `Available: ${stock.totalInBase} ${product.baseUnit.label}, ` +
        `Required: ${requestedInBase} ${product.baseUnit.label}`
      );
    }

    const unitPrice = item.unitPrice || sellUnit.sellPrice || 0;
    const totalPrice = quantity * unitPrice;

    const costInfo = await calculateCost(productId, userId, requestedInBase);
    const totalCost = costInfo.totalCost;
    const costPerBaseUnit = costInfo.averageCost;
    const profit = totalPrice - totalCost;

    const deductions = await deductStockFIFO(
      productId,
      userId,
      requestedInBase,
      sellUnit
    );

    // Auto-convert loose to bundles after deduction
    await autoConvertLooseToBundles(productId, userId);

    const saleItem = {
      productId: product._id,
      productName: product.name,
      unitSold: {
        name: sellUnit.name,
        label: sellUnit.label,
        conversion: sellUnit.conversion,
        isBase: sellUnit.isBase || false
      },
      quantity: quantity,
      quantityInBase: requestedInBase,
      unitPrice: unitPrice,
      totalPrice: totalPrice,
      costPerBaseUnit: costPerBaseUnit,
      totalCost: totalCost,
      profit: profit,
      stockDeductions: deductions
    };

    saleItems.push(saleItem);
    subtotal += totalPrice;
    totalProfit += profit;
    stockDeductions.push(...deductions);

    console.log(`✅ ${product.name}: ${quantity} ${sellUnit.label} sold (${requestedInBase} ${product.baseUnit.label})`);
  }

  let totalAfterDiscount = subtotal;
  if (discount > 0) {
    if (discountType === 'percentage') {
      const discountAmount = (subtotal * discount) / 100;
      totalAfterDiscount = subtotal - discountAmount;
    } else {
      totalAfterDiscount = subtotal - discount;
    }
  }

  const tax = (totalAfterDiscount * taxRate) / 100;
  const total = totalAfterDiscount + tax;

  const sale = await Sale.create({
    items: saleItems,
    subtotal: subtotal,
    discount: discount,
    discountType: discountType,
    tax: tax,
    taxRate: taxRate,
    total: total,
    totalProfit: totalProfit,
    customer: customer,
    customerPhone: customerPhone,
    customerEmail: customerEmail,
    paymentMethod: paymentMethod,
    paymentStatus: paymentStatus,
    amountPaid: amountPaid || total,
    changeDue: (amountPaid || total) > total ? (amountPaid || total) - total : 0,
    notes: notes,
    userId: userId,
    owner: userId,
    saleDate: new Date()
  });

  for (const item of saleItems) {
    const totalStock = await getTotalStockForProduct(item.productId, userId);
    await Product.findByIdAndUpdate(
      item.productId,
      { quantity: totalStock }
    );
  }

  console.log(`✅ Sale recorded: ${sale.invoiceNumber} | Total: ${total} | Profit: ${totalProfit}`);

  return sale;
};

// ============================================================
// Get sales with filters
// ============================================================
export const getSales = async (userId, filters = {}) => {
  const query = { owner: userId };

  if (filters.startDate) {
    query.saleDate = { ...query.saleDate, $gte: new Date(filters.startDate) };
  }
  if (filters.endDate) {
    query.saleDate = { ...query.saleDate, $lte: new Date(filters.endDate) };
  }
  if (filters.productId) {
    query['items.productId'] = filters.productId;
  }
  if (filters.paymentStatus) {
    query.paymentStatus = filters.paymentStatus;
  }
  if (filters.invoiceNumber) {
    query.invoiceNumber = filters.invoiceNumber;
  }
  if (filters.customer) {
    query.customer = { $regex: filters.customer, $options: 'i' };
  }

  const sales = await Sale.find(query)
    .populate('items.productId', 'name baseUnit category')
    .sort({ saleDate: -1 })
    .limit(filters.limit || 100)
    .skip(filters.offset || 0);

  return sales;
};

// ============================================================
// Get single sale by ID
// ============================================================
export const getSaleById = async (saleId, userId) => {
  const sale = await Sale.findOne({
    _id: saleId,
    owner: userId
  }).populate('items.productId', 'name baseUnit category sellUnits stockUnits');

  if (!sale) {
    throw new Error('Sale not found');
  }

  return sale;
};

// ============================================================
// Get sale by invoice number
// ============================================================
export const getSaleByInvoice = async (invoiceNumber, userId) => {
  const sale = await Sale.findOne({
    invoiceNumber: invoiceNumber,
    owner: userId
  }).populate('items.productId', 'name baseUnit category');

  if (!sale) {
    throw new Error('Sale not found');
  }

  return sale;
};

// ============================================================
// Get daily sales summary
// ============================================================
export const getDailySales = async (userId, date) => {
  const startOfDay = new Date(date || Date.now());
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setHours(23, 59, 59, 999);

  const sales = await Sale.find({
    owner: userId,
    saleDate: { $gte: startOfDay, $lte: endOfDay },
    isActive: true,
    paymentStatus: { $ne: 'refunded' }
  });

  const totalRevenue = sales.reduce((sum, sale) => sum + sale.total, 0);
  const totalProfit = sales.reduce((sum, sale) => sum + sale.totalProfit, 0);

  return {
    date: startOfDay,
    totalSales: sales.length,
    totalRevenue,
    totalProfit,
    averageTransactionValue: sales.length > 0 ? totalRevenue / sales.length : 0,
    sales
  };
};

// ============================================================
// Get sales statistics
// ============================================================
export const getSalesStats = async (userId) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const firstOfWeek = new Date(today);
  firstOfWeek.setDate(today.getDate() - today.getDay());

  const todaySales = await Sale.find({
    owner: userId,
    saleDate: { $gte: today },
    isActive: true,
    paymentStatus: { $ne: 'refunded' }
  });

  const weekSales = await Sale.find({
    owner: userId,
    saleDate: { $gte: firstOfWeek },
    isActive: true,
    paymentStatus: { $ne: 'refunded' }
  });

  const monthSales = await Sale.find({
    owner: userId,
    saleDate: { $gte: firstOfMonth },
    isActive: true,
    paymentStatus: { $ne: 'refunded' }
  });

  const topProducts = await Sale.aggregate([
    { $match: { owner: new mongoose.Types.ObjectId(userId), isActive: true } },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.productId',
        productName: { $first: '$items.productName' },
        totalSold: { $sum: '$items.quantityInBase' },
        totalRevenue: { $sum: '$items.totalPrice' },
        totalProfit: { $sum: '$items.profit' },
        transactionCount: { $sum: 1 }
      }
    },
    { $sort: { totalSold: -1 } },
    { $limit: 5 },
    {
      $lookup: {
        from: 'products',
        localField: '_id',
        foreignField: '_id',
        as: 'product'
      }
    },
    { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } }
  ]);

  const paymentBreakdown = await Sale.aggregate([
    {
      $match: {
        owner: new mongoose.Types.ObjectId(userId),
        isActive: true,
        paymentStatus: { $ne: 'refunded' }
      }
    },
    {
      $group: {
        _id: '$paymentMethod',
        count: { $sum: 1 },
        totalRevenue: { $sum: '$total' }
      }
    }
  ]);

  return {
    today: {
      totalSales: todaySales.length,
      totalRevenue: todaySales.reduce((sum, s) => sum + s.total, 0),
      totalProfit: todaySales.reduce((sum, s) => sum + s.totalProfit, 0)
    },
    week: {
      totalSales: weekSales.length,
      totalRevenue: weekSales.reduce((sum, s) => sum + s.total, 0),
      totalProfit: weekSales.reduce((sum, s) => sum + s.totalProfit, 0)
    },
    month: {
      totalSales: monthSales.length,
      totalRevenue: monthSales.reduce((sum, s) => sum + s.total, 0),
      totalProfit: monthSales.reduce((sum, s) => sum + s.totalProfit, 0)
    },
    topProducts,
    paymentBreakdown
  };
};

// ============================================================
// Delete sale (and restore stock)
// ============================================================
export const deleteSale = async (saleId, userId) => {
  const sale = await Sale.findOne({
    _id: saleId,
    owner: userId
  });

  if (!sale) {
    throw new Error('Sale not found');
  }

  for (const item of sale.items) {
    if (item.stockDeductions && item.stockDeductions.length > 0) {
      for (const deduction of item.stockDeductions) {
        const batch = await StockBatch.findById(deduction.batchId);
        if (batch) {
          // Restore to the correct field based on source
          if (deduction.source === 'loose') {
            batch.remainingLoose += deduction.quantityDeducted;
            batch.remainingLooseInBase += deduction.quantityInBaseDeducted;
          } else {
            batch.remainingQuantity += deduction.quantityDeducted;
            batch.remainingInBase += deduction.quantityInBaseDeducted;
          }
          await batch.save();
        }
      }
    } else {
      await restoreStockFallback(item, userId);
    }

    const totalStock = await getTotalStockForProduct(item.productId, userId);
    await Product.findByIdAndUpdate(
      item.productId,
      { quantity: totalStock }
    );
  }

  sale.isActive = false;
  await sale.save();

  return { message: 'Sale deleted successfully' };
};

// ============================================================
// Update payment status
// ============================================================
export const updatePaymentStatus = async (saleId, userId, paymentStatus, amountPaid) => {
  const sale = await Sale.findOne({
    _id: saleId,
    owner: userId
  });

  if (!sale) {
    throw new Error('Sale not found');
  }

  sale.paymentStatus = paymentStatus;
  if (amountPaid !== undefined) {
    sale.amountPaid = amountPaid;
    sale.changeDue = amountPaid > sale.total ? amountPaid - sale.total : 0;
  }

  await sale.save();
  return sale;
};

// ============================================================
// Get sales by product
// ============================================================
export const getSalesByProduct = async (productId, userId, startDate, endDate) => {
  const match = {
    owner: userId,
    'items.productId': productId,
    isActive: true,
    paymentStatus: { $ne: 'refunded' }
  };

  if (startDate) {
    match.saleDate = { ...match.saleDate, $gte: new Date(startDate) };
  }
  if (endDate) {
    match.saleDate = { ...match.saleDate, $lte: new Date(endDate) };
  }

  const sales = await Sale.aggregate([
    { $match: match },
    { $unwind: '$items' },
    { $match: { 'items.productId': productId } },
    {
      $project: {
        invoiceNumber: 1,
        saleDate: 1,
        customer: 1,
        productName: '$items.productName',
        unitSold: '$items.unitSold',
        quantity: '$items.quantity',
        quantityInBase: '$items.quantityInBase',
        unitPrice: '$items.unitPrice',
        totalPrice: '$items.totalPrice',
        profit: '$items.profit'
      }
    },
    { $sort: { saleDate: -1 } }
  ]);

  return sales;
};

// ============================================================
// Get sales summary for date range
// ============================================================
export const getSalesSummary = async (userId, startDate, endDate) => {
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
        totalRevenue: { $sum: '$total' },
        totalProfit: { $sum: '$totalProfit' },
        totalDiscount: { $sum: '$discount' },
        totalTax: { $sum: '$tax' },
        transactionCount: { $sum: 1 },
        averageTransactionValue: { $avg: '$total' }
      }
    }
  ]);

  const dailyBreakdown = await Sale.aggregate([
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
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$saleDate' } },
        totalRevenue: { $sum: '$total' },
        totalProfit: { $sum: '$totalProfit' },
        transactionCount: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  return {
    period: {
      startDate: start,
      endDate: end
    },
    summary: result.length > 0 ? result[0] : {
      totalRevenue: 0,
      totalProfit: 0,
      totalDiscount: 0,
      totalTax: 0,
      transactionCount: 0,
      averageTransactionValue: 0
    },
    dailyBreakdown
  };
};

// ============================================================
// HELPER: Get stock for a product (includes loose)
// ============================================================
const getStockForProduct = async (productId, userId) => {
  const result = await StockBatch.aggregate([
    {
      $match: {
        productId: new mongoose.Types.ObjectId(productId),
        owner: new mongoose.Types.ObjectId(userId),
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
        totalInBase: { $sum: { $add: ['$remainingInBase', '$remainingLooseInBase'] } },
        batches: {
          $push: {
            _id: '$_id',
            unit: '$unit',
            remainingQuantity: '$remainingQuantity',
            remainingInBase: '$remainingInBase',
            remainingLoose: '$remainingLoose',
            remainingLooseInBase: '$remainingLooseInBase',
            bundleSize: '$bundleSize',
            buyPrice: '$buyPrice'
          }
        }
      }
    }
  ]);

  return result.length > 0 ? result[0] : { totalInBase: 0, batches: [] };
};

// ============================================================
// HELPER: Calculate cost using FIFO (includes loose)
// ============================================================
const calculateCost = async (productId, userId, quantityInBase) => {
  const batches = await StockBatch.find({
    productId: productId,
    owner: userId,
    isActive: true,
    $or: [
      { remainingQuantity: { $gt: 0 } },
      { remainingLoose: { $gt: 0 } }
    ]
  }).sort({ createdAt: 1 });

  let remaining = quantityInBase;
  let totalCost = 0;
  let usedBatches = [];

  for (const batch of batches) {
    if (remaining <= 0) break;

    // Check loose first
    let availableInBase = batch.remainingLooseInBase || 0;
    if (availableInBase > 0) {
      const usedInBase = Math.min(remaining, availableInBase);
      const costPerBase = batch.buyPrice / batch.unit.conversion;
      const cost = usedInBase * costPerBase;

      totalCost += cost;
      remaining -= usedInBase;

      usedBatches.push({
        batchId: batch._id,
        usedInBase: usedInBase,
        cost: cost,
        source: 'loose'
      });
    }

    // Then bundles
    if (remaining > 0) {
      availableInBase = batch.remainingInBase || 0;
      if (availableInBase > 0) {
        const usedInBase = Math.min(remaining, availableInBase);
        const costPerBase = batch.buyPrice / batch.unit.conversion;
        const cost = usedInBase * costPerBase;

        totalCost += cost;
        remaining -= usedInBase;

        usedBatches.push({
          batchId: batch._id,
          usedInBase: usedInBase,
          cost: cost,
          source: 'bundle'
        });
      }
    }
  }

  if (remaining > 0) {
    throw new Error(`Insufficient stock to cover cost calculation. Missing: ${remaining} base units`);
  }

  return {
    totalCost: totalCost,
    averageCost: totalCost / quantityInBase,
    usedBatches: usedBatches
  };
};

// ============================================================
// HELPER: Deduct stock using FIFO (loose first, then bundles)
// ============================================================
const deductStockFIFO = async (productId, userId, quantityInBase, sellUnit) => {
  const batches = await StockBatch.find({
    productId: productId,
    owner: userId,
    isActive: true,
    $or: [
      { remainingQuantity: { $gt: 0 } },
      { remainingLoose: { $gt: 0 } }
    ]
  }).sort({ createdAt: 1 });

  let remaining = quantityInBase;
  const deductions = [];

  for (const batch of batches) {
    if (remaining <= 0) break;

    // STEP 1: Deduct from loose first
    if (batch.remainingLoose > 0) {
      const availableInBase = batch.remainingLooseInBase || 0;
      const usedInBase = Math.min(remaining, availableInBase);
      const usedInUnit = usedInBase / sellUnit.conversion;

      // Deduct loose
      batch.remainingLoose -= usedInUnit;
      batch.remainingLooseInBase -= usedInBase;
      await batch.save();

      deductions.push({
        batchId: batch._id,
        unitName: batch.unit.name,
        quantityDeducted: usedInUnit,
        quantityInBaseDeducted: usedInBase,
        source: 'loose'
      });

      remaining -= usedInBase;
    }

    // STEP 2: Deduct from bundles if still needed
    if (remaining > 0 && batch.remainingQuantity > 0) {
      const availableInBase = batch.remainingInBase || 0;
      const usedInBase = Math.min(remaining, availableInBase);
      const usedInUnit = usedInBase / sellUnit.conversion;

      // Deduct bundles
      batch.remainingQuantity -= usedInUnit;
      batch.remainingInBase -= usedInBase;
      await batch.save();

      deductions.push({
        batchId: batch._id,
        unitName: batch.unit.name,
        quantityDeducted: usedInUnit,
        quantityInBaseDeducted: usedInBase,
        source: 'bundle'
      });

      remaining -= usedInBase;
    }
  }

  if (remaining > 0) {
    throw new Error(`Insufficient stock to deduct. Missing: ${remaining} base units`);
  }

  return deductions;
};

// ============================================================
// HELPER: Auto-convert loose to bundles
// ============================================================
const autoConvertLooseToBundles = async (productId, userId) => {
  const batches = await StockBatch.find({
    productId: productId,
    owner: userId,
    isActive: true,
    bundleSize: { $gt: 0 },
    remainingLoose: { $gt: 0 }
  });

  let totalConverted = 0;

  for (const batch of batches) {
    while (batch.remainingLoose >= batch.bundleSize) {
      const bundlesToAdd = Math.floor(batch.remainingLoose / batch.bundleSize);
      const looseRemaining = batch.remainingLoose % batch.bundleSize;

      // Add to bundles
      batch.remainingQuantity += bundlesToAdd;
      batch.remainingInBase += bundlesToAdd * batch.bundleSize * batch.unit.conversion;

      // Remove from loose
      batch.remainingLoose = looseRemaining;
      batch.remainingLooseInBase = looseRemaining * batch.unit.conversion;

      await batch.save();
      totalConverted += bundlesToAdd;
    }
  }

  if (totalConverted > 0) {
    console.log(`🔄 Auto-converted ${totalConverted} loose units to bundles for product ${productId}`);
  }

  return { converted: totalConverted };
};

// ============================================================
// HELPER: Get total stock for product (legacy - includes loose)
// ============================================================
const getTotalStockForProduct = async (productId, userId) => {
  const result = await StockBatch.aggregate([
    {
      $match: {
        productId: new mongoose.Types.ObjectId(productId),
        owner: new mongoose.Types.ObjectId(userId),
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
        total: { $sum: { $add: ['$remainingInBase', '$remainingLooseInBase'] } }
      }
    }
  ]);

  return result.length > 0 ? result[0].total : 0;
};

// ============================================================
// HELPER: Restore stock fallback
// ============================================================
const restoreStockFallback = async (item, userId) => {
  const batch = await StockBatch.findOne({
    productId: item.productId,
    owner: userId,
    isActive: true
  }).sort({ createdAt: -1 });

  if (batch) {
    batch.remainingQuantity += item.quantity;
    batch.remainingInBase += item.quantityInBase;
    await batch.save();
  } else {
    const product = await Product.findById(item.productId);
    if (product) {
      const baseUnit = product.baseUnit;
      await StockBatch.create({
        productId: item.productId,
        unit: {
          name: baseUnit.name,
          label: baseUnit.label,
          conversion: 1
        },
        quantity: item.quantity,
        quantityInBase: item.quantityInBase,
        buyPrice: item.costPerBaseUnit || 0,
        totalCost: (item.costPerBaseUnit || 0) * item.quantityInBase,
        batchNumber: `RESTORE-${Date.now()}`,
        remainingQuantity: item.quantity,
        remainingInBase: item.quantityInBase,
        remainingLoose: 0,
        remainingLooseInBase: 0,
        owner: userId
      });
    }
  }
};