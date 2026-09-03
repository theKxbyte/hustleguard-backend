// services/saleService.js - CLEAN VERSION
import Sale from '../models/Sale.js';
import Product from '../models/Product.js';
import mongoose from 'mongoose';

// ============================================================
// Record a sale
// ============================================================
export const recordSale = async (saleData, userId) => {
  const {
    items,
    customer,
    customerPhone,
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

  const saleItems = [];
  let subtotal = 0;
  let totalProfit = 0;

  // Group items by product to deduct once
  const itemsByProduct = {};
  for (const item of items) {
    const key = item.productId;
    if (!itemsByProduct[key]) {
      itemsByProduct[key] = [];
    }
    itemsByProduct[key].push(item);
  }

  // Process each product
  for (const [productId, productItems] of Object.entries(itemsByProduct)) {
    const product = await Product.findOne({
      _id: productId,
      owner: userId,
      isActive: true
    });

    if (!product) {
      throw new Error(`Product not found: ${productId}`);
    }

    let totalBaseQuantity = 0;
    let productSubtotal = 0;
    let productCost = 0;

    for (const item of productItems) {
      const { unitName, quantity } = item;

      const sellUnit = product.units.find(u => u.name === unitName && u.isActive !== false);
      if (!sellUnit) {
        throw new Error(`Unit "${unitName}" not found for product "${product.name}"`);
      }

      const quantityInBase = quantity * sellUnit.conversion;
      totalBaseQuantity += quantityInBase;

      const unitPrice = item.unitPrice || sellUnit.sellPrice || 0;
      const totalPrice = quantity * unitPrice;
      productSubtotal += totalPrice;

      // Cost based on average cost (simplified)
      const costPerUnit = sellUnit.buyPrice || 0;
      const totalCost = quantity * costPerUnit;
      productCost += totalCost;

      const saleItem = {
        productId: product._id,
        productName: product.name,
        unit: {
          name: sellUnit.name,
          label: sellUnit.label,
          conversion: sellUnit.conversion,
          isBase: sellUnit.isBase || false
        },
        quantity: quantity,
        quantityInBase: quantityInBase,
        unitPrice: unitPrice,
        totalPrice: totalPrice,
        costPerUnit: costPerUnit,
        totalCost: totalCost,
        profit: totalPrice - totalCost
      };

      saleItems.push(saleItem);
      subtotal += totalPrice;
      totalProfit += totalPrice - totalCost;
    }

    // Deduct stock once per product
    if (product.stock < totalBaseQuantity) {
      throw new Error(
        `Insufficient stock for ${product.name}. ` +
        `Available: ${product.stock}, Required: ${totalBaseQuantity}`
      );
    }

    product.stock -= totalBaseQuantity;
    await product.save();
  }

  // Calculate totals
  let totalAfterDiscount = subtotal;
  if (discount > 0) {
    if (discountType === 'percentage') {
      totalAfterDiscount = subtotal - (subtotal * discount / 100);
    } else {
      totalAfterDiscount = subtotal - discount;
    }
  }

  const tax = (totalAfterDiscount * taxRate) / 100;
  const total = totalAfterDiscount + tax;

  // Create sale
  const sale = await Sale.create({
    items: saleItems,
    subtotal,
    discount,
    discountType,
    tax,
    taxRate,
    total,
    totalProfit,
    customer,
    customerPhone,
    paymentMethod,
    paymentStatus,
    amountPaid: amountPaid || total,
    changeDue: (amountPaid || total) > total ? (amountPaid || total) - total : 0,
    notes,
    owner: userId,
    saleDate: new Date()
  });

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
    .populate('items.productId', 'name units category')
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
  }).populate('items.productId', 'name units category');

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
  }).populate('items.productId', 'name units category');

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

  const [todaySales, weekSales, monthSales, topProducts, paymentBreakdown] = await Promise.all([
    Sale.find({ owner: userId, saleDate: { $gte: today }, isActive: true, paymentStatus: { $ne: 'refunded' } }),
    Sale.find({ owner: userId, saleDate: { $gte: firstOfWeek }, isActive: true, paymentStatus: { $ne: 'refunded' } }),
    Sale.find({ owner: userId, saleDate: { $gte: firstOfMonth }, isActive: true, paymentStatus: { $ne: 'refunded' } }),
    Sale.aggregate([
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
    ]),
    Sale.aggregate([
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
    ])
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
// Delete sale (void)
// ============================================================
export const deleteSale = async (saleId, userId) => {
  const sale = await Sale.findOne({
    _id: saleId,
    owner: userId
  });

  if (!sale) {
    throw new Error('Sale not found');
  }

  // Restore stock for each product
  const itemsByProduct = {};
  for (const item of sale.items) {
    const key = item.productId.toString();
    if (!itemsByProduct[key]) {
      itemsByProduct[key] = 0;
    }
    itemsByProduct[key] += item.quantityInBase;
  }

  for (const [productId, quantityInBase] of Object.entries(itemsByProduct)) {
    const product = await Product.findOne({
      _id: productId,
      owner: userId
    });

    if (product) {
      product.stock += quantityInBase;
      await product.save();
    }
  }

  sale.isActive = false;
  await sale.save();

  return { message: 'Sale voided successfully' };
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
        unit: '$items.unit',
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
    period: { startDate: start, endDate: end },
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