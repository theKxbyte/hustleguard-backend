import * as profitService from '../services/profitService.js';

// ============================================================
// @desc    Calculate weekly profit
// @route   POST /api/reports/profit/weekly
// @access  Private
// ============================================================
export const calculateWeeklyProfit = async (req, res) => {
  try {
    const { weekStartDate, weekEndDate } = req.body;
    
    if (!weekStartDate || !weekEndDate) {
      return res.status(400).json({
        success: false,
        message: 'Please provide weekStartDate and weekEndDate'
      });
    }

    const profitData = await profitService.calculateWeeklyProfit(
      req.user.id,
      new Date(weekStartDate),
      new Date(weekEndDate)
    );

    res.status(200).json({
      success: true,
      data: profitData
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// ============================================================
// @desc    Get profit & loss summary for date range
// @route   POST /api/reports/profit/summary
// @access  Private
// ============================================================
export const getProfitSummary = async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Please provide startDate and endDate'
      });
    }

    const summary = await profitService.getProfitSummary(
      req.user.id,
      new Date(startDate),
      new Date(endDate)
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
// @desc    Get profit by category
// @route   GET /api/reports/profit/by-category
// @access  Private
// ============================================================
export const getProfitByCategory = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const profitByCategory = await profitService.getProfitByCategory(
      req.user.id,
      startDate ? new Date(startDate) : null,
      endDate ? new Date(endDate) : null
    );

    res.status(200).json({
      success: true,
      data: profitByCategory
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// ============================================================
// @desc    Get profit trends (weekly/monthly)
// @route   GET /api/reports/profit/trends
// @access  Private
// ============================================================
export const getProfitTrends = async (req, res) => {
  try {
    const { period = 'weekly', weeks = 12 } = req.query;
    
    const trends = await profitService.getProfitTrends(
      req.user.id,
      period,
      parseInt(weeks)
    );

    res.status(200).json({
      success: true,
      data: trends
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};