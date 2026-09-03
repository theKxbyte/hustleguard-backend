import * as expenseService from '../services/expenseService.js';

// ============================================================
// @desc    Create expense
// @route   POST /api/expenses
// @access  Private
// ============================================================
export const createExpense = async (req, res) => {
  try {
    const expense = await expenseService.createExpense(req.body, req.user.id);
    
    res.status(201).json({
      success: true,
      data: expense
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// ============================================================
// @desc    Get all expenses
// @route   GET /api/expenses
// @access  Private
// ============================================================
export const getExpenses = async (req, res) => {
  try {
    const { startDate, endDate, category, limit = 100, offset = 0 } = req.query;
    
    const expenses = await expenseService.getExpenses(
      req.user.id,
      { startDate, endDate, category, limit: parseInt(limit), offset: parseInt(offset) }
    );

    res.status(200).json({
      success: true,
      data: expenses
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// ============================================================
// @desc    Get expense by ID
// @route   GET /api/expenses/:id
// @access  Private
// ============================================================
export const getExpenseById = async (req, res) => {
  try {
    const expense = await expenseService.getExpenseById(req.params.id, req.user.id);
    
    res.status(200).json({
      success: true,
      data: expense
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      message: error.message
    });
  }
};

// ============================================================
// @desc    Get expense summary
// @route   GET /api/expenses/summary
// @access  Private
// ============================================================
export const getExpenseSummary = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const summary = await expenseService.getExpenseSummary(
      req.user.id,
      startDate ? new Date(startDate) : null,
      endDate ? new Date(endDate) : null
    );

    res.status(200).json({
      success: true,
      data: summary
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// ============================================================
// @desc    Update expense
// @route   PUT /api/expenses/:id
// @access  Private
// ============================================================
export const updateExpense = async (req, res) => {
  try {
    const expense = await expenseService.updateExpense(
      req.params.id,
      req.body,
      req.user.id
    );
    
    res.status(200).json({
      success: true,
      data: expense
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// ============================================================
// @desc    Delete expense
// @route   DELETE /api/expenses/:id
// @access  Private
// ============================================================
export const deleteExpense = async (req, res) => {
  try {
    await expenseService.deleteExpense(req.params.id, req.user.id);
    
    res.status(200).json({
      success: true,
      message: 'Expense deleted successfully'
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      message: error.message
    });
  }
}; 