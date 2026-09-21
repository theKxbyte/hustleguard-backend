import mongoose from 'mongoose';
import StockCount from '../models/StockCount.js';
import Product from '../models/Product.js';
import Sale from '../models/Sale.js';
import StockMovement from '../models/StockMovement.js';

const sumPosRecorded = async (ownerId, productId, startDate, endDate) => {
  const result = await Sale.aggregate([
    {
      $match: {
        owner: new mongoose.Types.ObjectId(ownerId),
        saleDate: { $gte: startDate, $lte: endDate },
        isActive: true,
        paymentStatus: { $ne: 'refunded' }
      }
    },
    { $unwind: '$items' },
    { $match: { 'items.productId': new mongoose.Types.ObjectId(productId) } },
    { $group: { _id: null, total: { $sum: '$items.quantityInBase' } } }
  ]);
  return result.length > 0 ? result[0].total : 0;
};

// Pull the freshest 'received' total so expectedStock reflects any stock
// logged after the draft was created (not the stale draft-creation snapshot)
const refreshStockAdded = async (item, ownerId, periodStart) => {
  item.stockAdded = await StockMovement.sumByType(
    ownerId, item.productId, 'received', periodStart, new Date()
  );
  item.expectedStock = item.openingStock + item.stockAdded;
};

const recalcItem = (item) => {
  item.expectedStock = item.openingStock + item.stockAdded;
  item.adjustmentsTotal = (item.adjustments || []).reduce((sum, a) => sum + a.quantity, 0);

  if (item.physicalStock === null || item.physicalStock === undefined) {
    item.estimatedSold = 0;
    item.unrecordedSold = 0;
    item.estimatedRevenue = 0;
    item.estimatedProfit = 0;
    item.variance = 0;
    return item;
  }

  item.estimatedSold = item.expectedStock - item.physicalStock - item.adjustmentsTotal;
  item.unrecordedSold = item.estimatedSold - item.posRecordedQty;
  item.estimatedRevenue = item.estimatedSold * item.sellingPrice;
  item.estimatedProfit = item.estimatedSold * (item.sellingPrice - item.buyingPrice);
  item.variance = item.physicalStock - item.expectedStock;

  return item;
};

// Physical count can never exceed expected stock — an overage means stock
// arrived that was never logged via Receive Stock. Block it there instead.
const assertNoOverage = (item, physicalStock) => {
  if (physicalStock > item.expectedStock) {
    throw new Error(
      `Physical count (${physicalStock}) for "${item.productName}" exceeds expected stock ` +
      `(${item.expectedStock}). Log the incoming stock via Receive Stock first, then recount.`
    );
  }
};

const buildItem = async (product, ownerId, openingStock, periodStart, periodEnd) => {
  const baseUnit = product.getBaseUnit ? product.getBaseUnit() : product.units.find(u => u.isBase);

  const stockAdded = await StockMovement.sumByType(
    ownerId, product._id, 'received', periodStart, periodEnd
  );
  const posRecordedQty = await sumPosRecorded(ownerId, product._id, periodStart, periodEnd);

  return {
    productId: product._id,
    productName: product.name,
    sellingPrice: baseUnit?.sellPrice || 0,
    buyingPrice: baseUnit?.buyPrice || 0,
    baseUnitLabel: baseUnit?.label || baseUnit?.name || 'Unit',
    openingStock,
    stockAdded,
    expectedStock: openingStock + stockAdded,
    physicalStock: null,
    adjustments: [],
    adjustmentsTotal: 0,
    posRecordedQty,
    estimatedSold: 0,
    unrecordedSold: 0,
    estimatedRevenue: 0,
    estimatedProfit: 0,
    variance: 0
  };
};

export const createDraft = async (userId, data = {}) => {
  const existingDraft = await StockCount.getLatestDraft(userId);
  if (existingDraft) {
    throw new Error('A draft stock count already exists. Confirm or cancel it before starting a new one.');
  }

  const latestConfirmed = await StockCount.getLatestConfirmed(userId);
  const periodStart = latestConfirmed ? latestConfirmed.periodEnd : new Date();
  const periodEnd = data.periodEnd ? new Date(data.periodEnd) : new Date();

  const products = await Product.find({ owner: userId, isActive: true });

  const confirmedItemMap = {};
  if (latestConfirmed) {
    latestConfirmed.items.forEach(i => {
      confirmedItemMap[i.productId.toString()] = i.physicalStock;
    });
  }

  const items = [];
  for (const product of products) {
    const pid = product._id.toString();
    const openingStock = latestConfirmed
      ? (confirmedItemMap[pid] ?? product.stock)
      : product.stock;

    items.push(await buildItem(product, userId, openingStock, periodStart, periodEnd));
  }

  const stockCount = await StockCount.create({
    periodStart,
    periodEnd,
    status: 'draft',
    items,
    notes: data.notes || '',
    owner: userId
  });

  stockCount.recalculateTotals();
  await stockCount.save();

  return stockCount;
};

export const updateDraft = async (id, userId, data = {}) => {
  const stockCount = await StockCount.findOne({ _id: id, owner: userId, isActive: true });
  if (!stockCount) throw new Error('Stock count not found');
  if (stockCount.status !== 'draft') throw new Error('Only draft stock counts can be updated');

  if (data.notes !== undefined) stockCount.notes = data.notes;
  if (data.periodEnd) stockCount.periodEnd = new Date(data.periodEnd);

  if (Array.isArray(data.items)) {
    for (const update of data.items) {
      const item = stockCount.items.id(update._id) ||
        stockCount.items.find(i => i.productId.toString() === update.productId);
      if (!item) continue;

      if (update.physicalStock !== undefined) {
        await refreshStockAdded(item, userId, stockCount.periodStart);
        assertNoOverage(item, update.physicalStock);
        item.physicalStock = update.physicalStock;
      }
      if (Array.isArray(update.adjustments)) item.adjustments = update.adjustments;

      recalcItem(item);
    }
  }

  stockCount.recalculateTotals();
  await stockCount.save();

  return stockCount;
};

export const countSingleItem = async (id, userId, { productId, physicalStock, adjustments }) => {
  const stockCount = await StockCount.findOne({ _id: id, owner: userId, isActive: true });
  if (!stockCount) throw new Error('Stock count not found');
  if (stockCount.status !== 'draft') throw new Error('Only draft stock counts can be updated');

  const item = stockCount.items.find(i => i.productId.toString() === productId.toString());
  if (!item) throw new Error('Product not found in this stock count');

  if (physicalStock !== undefined) {
    await refreshStockAdded(item, userId, stockCount.periodStart);
    assertNoOverage(item, physicalStock);
    item.physicalStock = physicalStock;
  }
  if (Array.isArray(adjustments)) item.adjustments = adjustments;

  recalcItem(item);
  stockCount.recalculateTotals();
  await stockCount.save();

  return stockCount;
};

export const confirmCount = async (id, userId) => {
  const stockCount = await StockCount.findOne({ _id: id, owner: userId, isActive: true });
  if (!stockCount) throw new Error('Stock count not found');
  if (stockCount.status !== 'draft') throw new Error('Only draft stock counts can be confirmed');

  const countedItems = stockCount.items.filter(
    i => i.physicalStock !== null && i.physicalStock !== undefined
  );
  if (countedItems.length === 0) {
    throw new Error('Count at least one product before confirming');
  }

  stockCount.periodEnd = new Date();

  // Refresh received + POS-recorded figures up to the final periodEnd, then recalc
  for (const item of stockCount.items) {
    item.stockAdded = await StockMovement.sumByType(
      userId, item.productId, 'received', stockCount.periodStart, stockCount.periodEnd
    );
    item.posRecordedQty = await sumPosRecorded(
      userId, item.productId, stockCount.periodStart, stockCount.periodEnd
    );
    recalcItem(item);
  }

  // Defensive re-check: a fresh expectedStock recompute at confirm time could
  // still surface an overage the count-time check didn't catch
  const overages = stockCount.items.filter(
    i => i.physicalStock !== null && i.physicalStock !== undefined && i.physicalStock > i.expectedStock
  );
  if (overages.length > 0) {
    const names = overages.map(i => i.productName).join(', ');
    throw new Error(
      `${overages.length} product(s) still show an overage (${names}). ` +
      `Log the incoming stock via Receive Stock and recount before confirming.`
    );
  }

  stockCount.recalculateTotals();
  stockCount.confirm(userId);
  await stockCount.save();

  // Sync only counted products' stock to their physical count.
  // Uncounted products are left untouched and will fall back to
  // current stock as their opening in the next draft (see createDraft).
  for (const item of stockCount.items) {
    if (item.physicalStock === null || item.physicalStock === undefined) continue;

    const product = await Product.findOne({ _id: item.productId, owner: userId });
    if (!product) continue;

    const variance = item.physicalStock - product.stock;
    product.stock = item.physicalStock;
    await product.save();

    if (variance !== 0) {
      await StockMovement.create({
        productId: product._id,
        productName: product.name,
        type: 'count',
        quantityInBase: Math.abs(variance),
        notes: `Stock count reconciliation: ${variance > 0 ? 'overage' : 'shortfall'} of ${Math.abs(variance)}`,
        movementDate: stockCount.periodEnd,
        refModel: 'StockCount',
        refId: stockCount._id,
        owner: userId,
        createdBy: userId
      });
    }
  }

  return stockCount;
};

export const cancelDraft = async (id, userId) => {
  const stockCount = await StockCount.findOne({ _id: id, owner: userId, isActive: true });
  if (!stockCount) throw new Error('Stock count not found');
  if (stockCount.status !== 'draft') throw new Error('Only draft stock counts can be cancelled');

  stockCount.status = 'cancelled';
  await stockCount.save();

  return stockCount;
};

export const getHistory = async (userId, filters = {}) => {
  const query = { owner: userId, isActive: true };
  if (filters.status) query.status = filters.status;

  const page = parseInt(filters.page) || 1;
  const limit = parseInt(filters.limit) || 20;

  const [counts, total] = await Promise.all([
    StockCount.find(query)
      .sort({ periodEnd: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    StockCount.countDocuments(query)
  ]);

  return { counts, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
};

export const getLatestConfirmed = async (userId) => StockCount.getLatestConfirmed(userId);
export const getLatestDraft = async (userId) => StockCount.getLatestDraft(userId);

export const getCountById = async (id, userId) => {
  const stockCount = await StockCount.findOne({ _id: id, owner: userId, isActive: true }).lean();
  if (!stockCount) throw new Error('Stock count not found');
  return stockCount;
};