// controllers/saleController.js - Updated with new methods
import * as saleService from '../services/saleService.js';

// ============================================================
// @desc    Record a new sale (multi-item)
// @route   POST /api/sales
// @access  Private
// ============================================================
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

// ============================================================
// @desc    Get all sales with filters
// @route   GET /api/sales
// @access  Private
// ============================================================
export const getSales = async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      productId, 
      paymentStatus,
      invoiceNumber,
      customer,
      limit = 100,
      offset = 0
    } = req.query;

    const filters = {
      startDate,
      endDate,
      productId,
      paymentStatus,
      invoiceNumber,
      customer,
      limit: parseInt(limit),
      offset: parseInt(offset)
    };

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

// ============================================================
// @desc    Get single sale by ID
// @route   GET /api/sales/:id
// @access  Private
// ============================================================
export const getSale = async (req, res) => {
  try {
    const sale = await saleService.getSaleById(req.params.id, req.user.id);
    res.status(200).json({
      success: true,
      data: sale
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      message: error.message
    });
  }
};

// ============================================================
// @desc    Get sale by invoice number
// @route   GET /api/sales/invoice/:invoiceNumber
// @access  Private
// ============================================================
export const getSaleByInvoice = async (req, res) => {
  try {
    const sale = await saleService.getSaleByInvoice(
      req.params.invoiceNumber,
      req.user.id
    );
    res.status(200).json({
      success: true,
      data: sale
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      message: error.message
    });
  }
};

// ============================================================
// @desc    Get daily sales summary
// @route   GET /api/sales/daily
// @access  Private
// ============================================================
export const getDailySales = async (req, res) => {
  try {
    const { date } = req.query;
    const result = await saleService.getDailySales(req.user.id, date);
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// ============================================================
// @desc    Get sales statistics
// @route   GET /api/sales/stats
// @access  Private
// ============================================================
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

// ============================================================
// @desc    Get sales by product
// @route   GET /api/sales/product/:productId
// @access  Private
// ============================================================
export const getSalesByProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const { startDate, endDate } = req.query;

    const sales = await saleService.getSalesByProduct(
      productId,
      req.user.id,
      startDate,
      endDate
    );

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

// ============================================================
// @desc    Get sales summary for date range
// @route   POST /api/sales/summary
// @access  Private
// ============================================================
export const getSalesSummary = async (req, res) => {
  try {
    const { startDate, endDate } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Please provide startDate and endDate'
      });
    }

    const summary = await saleService.getSalesSummary(
      req.user.id,
      startDate,
      endDate
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
// @desc    Update payment status
// @route   PUT /api/sales/:id/payment
// @access  Private
// ============================================================
export const updatePaymentStatus = async (req, res) => {
  try {
    const { paymentStatus, amountPaid } = req.body;

    if (!paymentStatus) {
      return res.status(400).json({
        success: false,
        message: 'Please provide paymentStatus'
      });
    }

    const sale = await saleService.updatePaymentStatus(
      req.params.id,
      req.user.id,
      paymentStatus,
      amountPaid
    );

    res.status(200).json({
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

// ============================================================
// @desc    Delete/void a sale
// @route   DELETE /api/sales/:id
// @access  Private
// ============================================================
export const deleteSale = async (req, res) => {
  try {
    const result = await saleService.deleteSale(req.params.id, req.user.id);
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      message: error.message
    });
  }
};