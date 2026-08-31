import * as stockReportService from '../services/stockReportService.js';

// ============================================================
// @desc    Generate weekly stock report
// @route   POST /api/reports/stock/weekly
// @access  Private
// ============================================================
export const generateWeeklyStockReport = async (req, res) => {
  try {
    const { weekStartDate, weekEndDate } = req.body;
    
    if (!weekStartDate || !weekEndDate) {
      return res.status(400).json({
        success: false,
        message: 'Please provide weekStartDate and weekEndDate'
      });
    }

    const report = await stockReportService.generateWeeklyStockReport(
      req.user.id,
      new Date(weekStartDate),
      new Date(weekEndDate)
    );

    res.status(201).json({
      success: true,
      data: report
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// ============================================================
// @desc    Get all weekly stock reports
// @route   GET /api/reports/stock/weekly
// @access  Private
// ============================================================
export const getWeeklyStockReports = async (req, res) => {
  try {
    const { limit = 50, offset = 0, status, year } = req.query;
    
    const reports = await stockReportService.getWeeklyStockReports(
      req.user.id,
      { limit: parseInt(limit), offset: parseInt(offset), status, year }
    );

    res.status(200).json({
      success: true,
      data: reports
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// ============================================================
// @desc    Get single weekly stock report by ID
// @route   GET /api/reports/stock/weekly/:id
// @access  Private
// ============================================================
export const getWeeklyStockReportById = async (req, res) => {
  try {
    const report = await stockReportService.getWeeklyStockReportById(
      req.params.id,
      req.user.id
    );

    res.status(200).json({
      success: true,
      data: report
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      message: error.message
    });
  }
};

// ============================================================
// @desc    Finalize weekly stock report
// @route   PUT /api/reports/stock/weekly/:id/finalize
// @access  Private
// ============================================================
export const finalizeWeeklyStockReport = async (req, res) => {
  try {
    const report = await stockReportService.finalizeWeeklyStockReport(
      req.params.id,
      req.user.id
    );

    res.status(200).json({
      success: true,
      data: report
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// ============================================================
// @desc    Get stock value summary
// @route   GET /api/reports/stock/value
// @access  Private
// ============================================================
export const getStockValueSummary = async (req, res) => {
  try {
    const summary = await stockReportService.getStockValueSummary(req.user.id);
    
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