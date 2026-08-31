import * as physicalCountService from '../services/physicalCountService.js';

// ============================================================
// @desc    Record physical count
// @route   POST /api/physical-counts
// @access  Private
// ============================================================
export const recordPhysicalCount = async (req, res) => {
  try {
    const count = await physicalCountService.recordPhysicalCount(
      req.body,
      req.user.id
    );
    
    res.status(201).json({
      success: true,
      data: count
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// ============================================================
// @desc    Get all physical counts
// @route   GET /api/physical-counts
// @access  Private
// ============================================================
export const getPhysicalCounts = async (req, res) => {
  try {
    const { startDate, endDate, productId, limit = 100, offset = 0 } = req.query;
    
    const counts = await physicalCountService.getPhysicalCounts(
      req.user.id,
      { startDate, endDate, productId, limit: parseInt(limit), offset: parseInt(offset) }
    );

    res.status(200).json({
      success: true,
      data: counts
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// ============================================================
// @desc    Get variance summary
// @route   GET /api/physical-counts/variance-summary
// @access  Private
// ============================================================
export const getVarianceSummary = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const summary = await physicalCountService.getVarianceSummary(
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
// @desc    Get products needing physical count
// @route   GET /api/physical-counts/needing-count
// @access  Private
// ============================================================
export const getProductsNeedingCount = async (req, res) => {
  try {
    const products = await physicalCountService.getProductsNeedingCount(
      req.user.id
    );

    res.status(200).json({
      success: true,
      data: products
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};