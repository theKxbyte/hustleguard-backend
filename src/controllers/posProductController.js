// controllers/posProductController.js
import * as posProductService from '../services/posProductService.js';

// ============================================================
// @desc    Search products for POS
// @route   GET /api/pos/products/search
// @access  Private
// ============================================================
export const searchPosProducts = async (req, res) => {
  try {
    const { 
      query,
      category,
      limit = 20,
      offset = 0,
      includeOutOfStock = false
    } = req.query;

    const result = await posProductService.searchPosProducts({
      query,
      category,
      limit: parseInt(limit),
      offset: parseInt(offset),
      includeOutOfStock: includeOutOfStock === 'true',
      ownerId: req.user.id
    });

    res.status(200).json({
      success: true,
      data: result.products,
      pagination: {
        total: result.total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: result.hasMore
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// ============================================================
// @desc    Get product by barcode
// @route   GET /api/pos/products/barcode/:barcode
// @access  Private
// ============================================================
export const getProductByBarcode = async (req, res) => {
  try {
    const { barcode } = req.params;

    const product = await posProductService.getProductByBarcode(
      barcode,
      req.user.id
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found with this barcode'
      });
    }

    res.status(200).json({
      success: true,
      data: product
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// ============================================================
// @desc    Get multiple products by IDs
// @route   POST /api/pos/products/batch
// @access  Private
// ============================================================
export const getProductsBatch = async (req, res) => {
  try {
    const { productIds } = req.body;

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an array of product IDs'
      });
    }

    const products = await posProductService.getProductsBatch(
      productIds,
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

// ============================================================
// @desc    Get quick product suggestions
// @route   GET /api/pos/products/suggestions
// @access  Private
// ============================================================
export const getProductSuggestions = async (req, res) => {
  try {
    const { query, limit = 10 } = req.query;

    const suggestions = await posProductService.getProductSuggestions(
      query,
      req.user.id,
      parseInt(limit)
    );

    res.status(200).json({
      success: true,
      data: suggestions
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// ============================================================
// @desc    Get product stock for POS
// @route   GET /api/pos/products/:id/stock
// @access  Private
// ============================================================
export const getPosProductStock = async (req, res) => {
  try {
    const stockInfo = await posProductService.getPosProductStock(
      req.params.id,
      req.user.id
    );

    res.status(200).json({
      success: true,
      data: stockInfo
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// ============================================================
// @desc    Check if product can be sold in a specific unit
// @route   GET /api/pos/products/:id/check-unit/:unitName
// @access  Private
// ============================================================
export const checkUnitAvailability = async (req, res) => {
  try {
    const { id, unitName } = req.params;
    const { quantity = 1 } = req.query;

    const result = await posProductService.checkUnitAvailability(
      id,
      req.user.id,
      unitName,
      parseFloat(quantity)
    );

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
// @desc    Quick scan product
// @route   GET /api/pos/products/quick-scan
// @access  Private
// ============================================================
export const quickScanProduct = async (req, res) => {
  try {
    const { input } = req.query;

    if (!input) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a search input'
      });
    }

    const product = await posProductService.quickScanProduct(
      input,
      req.user.id
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.status(200).json({
      success: true,
      data: product
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// ============================================================
// @desc    Get recent products
// @route   GET /api/pos/products/recent
// @access  Private
// ============================================================
export const getRecentProducts = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const products = await posProductService.getRecentProducts(
      req.user.id,
      parseInt(limit)
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

// ============================================================
// @desc    Get product unit price
// @route   GET /api/pos/products/:id/price/:unitName
// @access  Private
// ============================================================
export const getProductUnitPrice = async (req, res) => {
  try {
    const { id, unitName } = req.params;

    const priceInfo = await posProductService.getProductUnitPrice(
      id,
      req.user.id,
      unitName
    );

    if (!priceInfo) {
      return res.status(404).json({
        success: false,
        message: `Unit "${unitName}" not found for this product`
      });
    }

    res.status(200).json({
      success: true,
      data: priceInfo
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};