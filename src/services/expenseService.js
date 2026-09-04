// services/expenseService.js
import Expense from '../models/Expense.js';

// ============================================================
// Get expense summary - FIXED
// ============================================================
export const getExpenseSummary = async (ownerId, startDate, endDate) => {
  // Build the query
  const query = { 
    owner: ownerId, 
    isActive: true 
  };

  // If dates are provided, filter by date
  if (startDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    query.expenseDate = { ...query.expenseDate, $gte: start };
  }
  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    query.expenseDate = { ...query.expenseDate, $lte: end };
  }

  console.log('📊 Expense Summary Query:', JSON.stringify(query));

  // Get all expenses matching the query
  const expenses = await Expense.find(query).lean();

  console.log('📊 Found expenses:', expenses.length);

  // Calculate summary
  const totalAmount = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const count = expenses.length;
  const averageAmount = count > 0 ? totalAmount / count : 0;
  const minAmount = count > 0 ? Math.min(...expenses.map(e => e.amount || 0)) : 0;
  const maxAmount = count > 0 ? Math.max(...expenses.map(e => e.amount || 0)) : 0;

  // Group by category
  const categoryMap = {};
  expenses.forEach(e => {
    const cat = e.category || 'other';
    if (!categoryMap[cat]) {
      categoryMap[cat] = { totalAmount: 0, count: 0 };
    }
    categoryMap[cat].totalAmount += e.amount || 0;
    categoryMap[cat].count += 1;
  });

  const byCategory = Object.keys(categoryMap).map(key => ({
    _id: key,
    totalAmount: categoryMap[key].totalAmount,
    count: categoryMap[key].count
  })).sort((a, b) => b.totalAmount - a.totalAmount);

  // Debug logs
  console.log('📊 Summary result:', { totalAmount, count, averageAmount, minAmount, maxAmount });
  console.log('📊 By category:', byCategory);

  return {
    summary: {
      totalAmount,
      count,
      averageAmount,
      minAmount,
      maxAmount
    },
    byCategory
  };
};

// ============================================================
// Create expense
// ============================================================
export const createExpense = async (data, userId) => {
  const expense = new Expense({
    ...data,
    userId: userId,
    owner: userId,
    isActive: true
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
  
  if (startDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    query.expenseDate = { ...query.expenseDate, $gte: start };
  }
  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    query.expenseDate = { ...query.expenseDate, $lte: end };
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

  // Update only allowed fields
  const allowedFields = ['description', 'amount', 'category', 'paymentMethod', 'reference', 'expenseDate', 'notes'];
  allowedFields.forEach(field => {
    if (data[field] !== undefined) {
      expense[field] = data[field];
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