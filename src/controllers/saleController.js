import * as saleService from '../services/saleService.js';

// @desc    Record a sale
// @route   POST /api/sales
// @access  Private
export const recordSale = async (req, res) => {
  try {
    const sale = await saleService.recordSale(req.body, req.user.id);
    res.status(201).json({
      success: true,
      data: sale
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get all sales
// @route   GET /api/sales
// @access  Private
export const getSales = async (req, res) => {
  try {
    const { startDate, endDate, productId, limit } = req.query;
    const filters = { startDate, endDate, productId, limit };
    
    const sales = await saleService.getSales(req.user.id, filters);
    res.status(200).json({
      success: true,
      count: sales.length,
      data: sales
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get daily sales
// @route   GET /api/sales/daily
// @access  Private
export const getDailySales = async (req, res) => {
  try {
    const { date } = req.query;
    const dailySales = await saleService.getDailySales(req.user.id, date);
    res.status(200).json({
      success: true,
      data: dailySales
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get sales statistics
// @route   GET /api/sales/stats
// @access  Private
export const getSalesStats = async (req, res) => {
  try {
    const stats = await saleService.getSalesStats(req.user.id);
    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};