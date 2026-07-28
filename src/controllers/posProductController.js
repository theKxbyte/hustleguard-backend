import * as posProductService from '../services/posProductService.js';

// @desc    Search products for POS (optimized for cashier use)
// @route   GET /api/pos/products/search
// @access  Private
export const searchPosProducts = async (req, res) => {
  try {
    const { 
      query,           // search by name, barcode, or category
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

// @desc    Get product by barcode (optimized for scanning)
// @route   GET /api/pos/products/barcode/:barcode
// @access  Private
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

// @desc    Get multiple products by IDs (for cart loading)
// @route   POST /api/pos/products/batch
// @access  Private
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

// @desc    Get quick product suggestions (for autocomplete)
// @route   GET /api/pos/products/suggestions
// @access  Private
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