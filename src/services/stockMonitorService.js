import Product from '../models/Product.js';
import Sale from '../models/Sale.js';
import StockCount from '../models/StockCount.js';
import StockMovement from '../models/StockMovement.js';
import mongoose from 'mongoose';

export const getTodayStockSnapshot = async (userId) => {
  const today = new Date();
  const startOfDay = new Date(today);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(today);
  endOfDay.setHours(23, 59, 59, 999);

  const products = await Product.find({ owner: userId, isActive: true }).lean();
  const ownerObjectId = new mongoose.Types.ObjectId(userId);

  const salesToday = await Sale.aggregate([
    {
      $match: {
        owner: ownerObjectId,
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
  const salesMap = {};
  salesToday.forEach(s => {
    salesMap[s._id.toString()] = { totalSold: s.totalSold, lastSale: s.lastSale };
  });

  // Ledger movements today — used only to reconstruct the midnight baseline
  // for the summary card, never for the per-product row.
  const [receivedToday, adjustedToday, countToday] = await Promise.all([
    StockMovement.aggregate([
      { $match: { owner: ownerObjectId, type: 'received', isActive: true, movementDate: { $gte: startOfDay, $lte: endOfDay } } },
      { $group: { _id: '$productId', total: { $sum: '$quantityInBase' } } }
    ]),
    StockMovement.aggregate([
      { $match: { owner: ownerObjectId, type: 'adjustment', isActive: true, movementDate: { $gte: startOfDay, $lte: endOfDay } } },
      { $group: { _id: '$productId', total: { $sum: '$quantityInBase' } } }
    ]),
    StockMovement.aggregate([
      { $match: { owner: ownerObjectId, type: 'count', isActive: true, movementDate: { $gte: startOfDay, $lte: endOfDay } } },
      { $group: { _id: '$productId', total: { $sum: '$quantityInBase' } } }
    ])
  ]);
  const receivedMap = {};
  receivedToday.forEach(r => { receivedMap[r._id.toString()] = r.total; });
  const adjustedMap = {};
  adjustedToday.forEach(a => { adjustedMap[a._id.toString()] = a.total; });
  const countMap = {};
  countToday.forEach(c => { countMap[c._id.toString()] = c.total; });

  // Row-level opening: last confirmed count's physical, falling back to
  // current stock for products that count never touched. "—" only when
  // no confirmed count has ever existed at all.
  const latestConfirmed = await StockCount.getLatestConfirmed(userId);
  const openingMap = {};
  if (latestConfirmed) {
    latestConfirmed.items.forEach(i => {
      if (i.physicalStock !== null && i.physicalStock !== undefined) {
        openingMap[i.productId.toString()] = i.physicalStock;
      }
    });
  }

  let totalOpeningOfDay = 0;

  const productsWithStock = products.map(product => {
    const pid = product._id.toString();
    const saleData = salesMap[pid] || { totalSold: 0, lastSale: null };
    const baseUnit = product.units?.find(u => u.isBase);

    const openingStock = latestConfirmed
      ? (openingMap[pid] !== undefined ? openingMap[pid] : product.stock)
      : null;

    // Reverse today's movements to reconstruct stock as it stood at midnight.
    // received/count are always reductions to reverse the opposite way of
    // sold/adjustment — all four get added back except received, which gets subtracted.
    const received = receivedMap[pid] || 0;
    const adjusted = adjustedMap[pid] || 0;
    const countReduction = countMap[pid] || 0;
    const openingOfDay = product.stock - received + saleData.totalSold + adjusted + countReduction;

    totalOpeningOfDay += openingOfDay;

    return {
      _id: product._id,
      name: product.name,
      category: product.category,
      openingStock,
      soldToday: saleData.totalSold,
      currentStock: product.stock,
      minStockAlert: product.minStockAlert,
      baseUnit: baseUnit?.label || baseUnit?.name || 'Unit',
      lastSale: saleData.lastSale
    };
  });

  productsWithStock.sort((a, b) => b.soldToday - a.soldToday);

  const summary = {
    totalOpeningStock: totalOpeningOfDay, // pinned to midnight, not affected by today's count confirms
    totalSoldToday: productsWithStock.reduce((sum, p) => sum + p.soldToday, 0),
    totalCurrentStock: productsWithStock.reduce((sum, p) => sum + p.currentStock, 0),
    totalProducts: productsWithStock.length,
    productsWithSales: productsWithStock.filter(p => p.soldToday > 0).length
  };

  return { date: today, products: productsWithStock, summary };
};

// Lightweight check for the monitor's "Count Stock" banner
export const getMonitorMeta = async (userId) => {
  const [draft, latestConfirmed] = await Promise.all([
    StockCount.getLatestDraft(userId),
    StockCount.getLatestConfirmed(userId)
  ]);

  return {
    hasDraft: !!draft,
    draftId: draft?._id || null,
    hasConfirmedCount: !!latestConfirmed,
    lastConfirmedId: latestConfirmed?._id || null,
    lastConfirmedAt: latestConfirmed?.confirmedAt || null
  };
};