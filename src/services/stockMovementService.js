import StockMovement from '../models/StockMovement.js';
import Product from '../models/Product.js';

export const receiveStock = async (userId, data) => {
  const { productId, quantity, unitName, buyingPrice, supplier, notes, movementDate } = data;

  if (!quantity || quantity <= 0) throw new Error('Quantity must be greater than 0');

  const product = await Product.findOne({ _id: productId, owner: userId });
  if (!product) throw new Error('Product not found');

  let quantityInBase = quantity;
  let unitSnapshot = null;

  if (unitName) {
    const unit = product.getUnit(unitName);
    if (!unit) throw new Error(`Unit "${unitName}" not found on this product`);
    quantityInBase = quantity * unit.conversion;
    unitSnapshot = { name: unit.name, label: unit.label, conversion: unit.conversion };
  }

  const movement = await StockMovement.create({
    productId: product._id,
    productName: product.name,
    type: 'received',
    quantityInBase,
    unit: unitSnapshot,
    quantityEntered: quantity,
    buyingPrice: buyingPrice ?? null,
    supplier: supplier || '',
    notes: notes || '',
    movementDate: movementDate ? new Date(movementDate) : new Date(),
    refModel: 'Product',
    refId: product._id,
    owner: userId,
    createdBy: userId
  });

  product.stock += quantityInBase;

  if (buyingPrice !== undefined && buyingPrice !== null) {
    const baseUnit = product.getBaseUnit();
    if (baseUnit) baseUnit.buyPrice = buyingPrice;
  }

  await product.save();

  return { product, movement };
};

export const recordAdjustment = async (userId, data) => {
  const { productId, quantity, reason, notes, movementDate } = data;

  if (!quantity || quantity <= 0) throw new Error('Quantity must be greater than 0');
  if (!reason) throw new Error('Reason is required for an adjustment');

  const product = await Product.findOne({ _id: productId, owner: userId });
  if (!product) throw new Error('Product not found');

  if (product.stock < quantity) {
    throw new Error(`Cannot adjust ${quantity} — only ${product.stock} in stock`);
  }

  const movement = await StockMovement.create({
    productId: product._id,
    productName: product.name,
    type: 'adjustment',
    reason,
    quantityInBase: quantity,
    quantityEntered: quantity,
    notes: notes || '',
    movementDate: movementDate ? new Date(movementDate) : new Date(),
    refModel: 'Product',
    refId: product._id,
    owner: userId,
    createdBy: userId
  });

  product.stock -= quantity;
  await product.save();

  return { product, movement };
};

export const listMovements = async (userId, filters = {}) => {
  const query = { owner: userId, isActive: true };

  if (filters.productId) query.productId = filters.productId;
  if (filters.type) query.type = filters.type;
  if (filters.reason) query.reason = filters.reason;

  if (filters.startDate || filters.endDate) {
    query.movementDate = {};
    if (filters.startDate) query.movementDate.$gte = new Date(filters.startDate);
    if (filters.endDate) query.movementDate.$lte = new Date(filters.endDate);
  }

  const page = parseInt(filters.page) || 1;
  const limit = parseInt(filters.limit) || 50;

  const [movements, total] = await Promise.all([
    StockMovement.find(query)
      .sort({ movementDate: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    StockMovement.countDocuments(query)
  ]);

  return {
    movements,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) }
  };
};

export const reverseMovement = async (id, userId) => {
  const movement = await StockMovement.findOne({ _id: id, owner: userId, isActive: true });
  if (!movement) throw new Error('Movement not found');

  if (movement.type === 'count' || movement.type === 'opening') {
    throw new Error(`A "${movement.type}" movement cannot be reversed directly`);
  }

  const product = await Product.findOne({ _id: movement.productId, owner: userId });
  if (!product) throw new Error('Product not found');

  if (movement.type === 'received') {
    if (product.stock < movement.quantityInBase) {
      throw new Error('Cannot reverse — stock would go negative');
    }
    product.stock -= movement.quantityInBase;
  } else if (movement.type === 'adjustment') {
    product.stock += movement.quantityInBase;
  }

  movement.isActive = false;
  await Promise.all([movement.save(), product.save()]);

  return movement;
};