import Expense from '../models/Expense.js';

// ============================================================
// Create expense
// ============================================================
export const createExpense = async (data, userId) => {
  const expense = new Expense({
    ...data,
    userId: userId,
    owner: userId
  });

  await expense.save();
  return expense;
};

// ============================================================
// Get expenses with filters
// ============================================================
export const getExpenses = async (ownerId, filters = {}) => {
  const { startDate, endDate, category, limit = 100, offset = 0 } = filters;

  const query = { owner: ownerId, isActive: true };
  if (startDate && endDate) {
    query.expenseDate = { $gte: new Date(startDate), $lte: new Date(endDate) };
  }
  if (category) query.category = category;

  const expenses = await Expense.find(query)
    .sort({ expenseDate: -1 })
    .limit(limit)
    .skip(offset)
    .lean();

  const total = await Expense.countDocuments(query);

  return {
    expenses,
    total,
    hasMore: offset + limit < total
  };
};

// ============================================================
// Get expense by ID
// ============================================================
export const getExpenseById = async (expenseId, ownerId) => {
  const expense = await Expense.findOne({
    _id: expenseId,
    owner: ownerId
  }).lean();

  if (!expense) {
    throw new Error('Expense not found');
  }

  return expense;
};

// ============================================================
// Get expense summary
// ============================================================
export const getExpenseSummary = async (ownerId, startDate, endDate) => {
  const match = {
    owner: ownerId,
    isActive: true
  };

  if (startDate && endDate) {
    match.expenseDate = { $gte: startDate, $lte: endDate };
  }

  const result = await Expense.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalAmount: { $sum: '$amount' },
        count: { $sum: 1 },
        averageAmount: { $avg: '$amount' },
        minAmount: { $min: '$amount' },
        maxAmount: { $max: '$amount' }
      }
    }
  ]);

  // Get by category
  const byCategory = await Expense.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$category',
        totalAmount: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    },
    { $sort: { totalAmount: -1 } }
  ]);

  return {
    summary: result.length > 0 ? result[0] : {
      totalAmount: 0,
      count: 0,
      averageAmount: 0,
      minAmount: 0,
      maxAmount: 0
    },
    byCategory
  };
};

// ============================================================
// Update expense
// ============================================================
export const updateExpense = async (expenseId, data, ownerId) => {
  const expense = await Expense.findOne({
    _id: expenseId,
    owner: ownerId
  });

  if (!expense) {
    throw new Error('Expense not found');
  }

  Object.keys(data).forEach(key => {
    if (key !== '_id' && key !== 'owner' && key !== 'userId') {
      expense[key] = data[key];
    }
  });

  await expense.save();
  return expense;
};

// ============================================================
// Delete expense
// ============================================================
export const deleteExpense = async (expenseId, ownerId) => {
  const expense = await Expense.findOne({
    _id: expenseId,
    owner: ownerId
  });

  if (!expense) {
    throw new Error('Expense not found');
  }

  expense.isActive = false;
  await expense.save();

  return { success: true };
}; 