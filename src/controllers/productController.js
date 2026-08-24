// controllers/productController.js
import * as productService from '../services/productService.js';
import StockBatch from '../models/StockBatch.js';
import Product from '../models/Product.js';
import mongoose from 'mongoose';

// ============================================================
// @desc    Create product with UOM configuration
// @route   POST /api/products
// @access  Private
// ============================================================
export const createProduct = async (req, res) => {
  try {
    const product = await productService.createProduct(req.body, req.user.id);
    res.status(201).json({
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
// @desc    Get all products
// @route   GET /api/products
// @access  Private
// ============================================================
export const getProducts = async (req, res) => {
  try {
    const { category, isActive, search } = req.query;
    const filters = {};
    if (category) filters.category = category;
    if (isActive !== undefined) filters.isActive = isActive === 'true';
    if (search) filters.search = search;
    
    const products = await productService.getProducts(req.user.id, filters);
    res.status(200).json({
      success: true,
      count: products.length,
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
// @desc    Get single product with stock details
// @route   GET /api/products/:id
// @access  Private
// ============================================================
export const getProduct = async (req, res) => {
  try {
    const includeStock = req.query.includeStock === 'true';
    const product = await productService.getProductById(
      req.params.id,
      req.user.id,
      includeStock
    );
    res.status(200).json({
      success: true,
      data: product
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      message: error.message
    });
  }
};

// ============================================================
// @desc    Update product (including UOM config)
// @route   PUT /api/products/:id
// @access  Private
// ============================================================
export const updateProduct = async (req, res) => {
  try {
    const product = await productService.updateProduct(
      req.params.id,
      req.user.id,
      req.body
    );
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
// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Private
// ============================================================
export const deleteProduct = async (req, res) => {
  try {
    const result = await productService.deleteProduct(req.params.id, req.user.id);
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

// ============================================================
// @desc    Get low stock products (using StockBatch)
// @route   GET /api/products/low-stock
// @access  Private
// ============================================================
export const getLowStock = async (req, res) => {
  try {
    const products = await productService.getLowStockProducts(req.user.id);
    res.status(200).json({
      success: true,
      count: products.length,
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
// @desc    Get out of stock products (using StockBatch)
// @route   GET /api/products/out-of-stock
// @access  Private
// ============================================================
export const getOutOfStock = async (req, res) => {
  try {
    const products = await productService.getOutOfStockProducts(req.user.id);
    res.status(200).json({
      success: true,
      count: products.length,
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
// @desc    Add stock to product (create StockBatch)
// @route   POST /api/products/:id/stock
// @access  Private
// ============================================================
export const addProductStock = async (req, res) => {
  try {
    const { unitName, quantity, buyPrice, batchNumber, supplier, expiryDate } = req.body;
    
    if (!unitName || !quantity || !buyPrice) {
      return res.status(400).json({
        success: false,
        message: 'Please provide unitName, quantity, and buyPrice'
      });
    }
    
    const stockBatch = await productService.addStock({
      productId: req.params.id,
      ownerId: req.user.id,
      unitName,
      quantity,
      buyPrice,
      batchNumber,
      supplier,
      expiryDate
    });
    
    res.status(201).json({
      success: true,
      data: stockBatch
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// ============================================================
// @desc    Get product stock breakdown
// @route   GET /api/products/:id/stock
// @access  Private
// ============================================================
export const getProductStock = async (req, res) => {
  try {
    const stock = await productService.getProductStock(req.params.id, req.user.id);
    res.status(200).json({
      success: true,
      data: stock
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// ============================================================
// @desc    Convert stock from one unit to another
// @route   POST /api/products/:id/convert
// @access  Private
// ============================================================
export const convertStock = async (req, res) => {
  try {
    const { fromUnit, toUnit, quantity } = req.body;
    
    if (!fromUnit || !toUnit || !quantity) {
      return res.status(400).json({
        success: false,
        message: 'Please provide fromUnit, toUnit, and quantity'
      });
    }
    
    const result = await productService.convertStock({
      productId: req.params.id,
      ownerId: req.user.id,
      fromUnit,
      toUnit,
      quantity
    });
    
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
// @desc    Get product by barcode
// @route   GET /api/products/barcode/:barcode
// @access  Private
// ============================================================
export const getProductByBarcode = async (req, res) => {
  try {
    const product = await productService.getProductByBarcode(
      req.params.barcode,
      req.user.id
    );
    res.status(200).json({
      success: true,
      data: product
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      message: error.message
    });
  }
};

// ============================================================
// @desc    Bulk import products
// @route   POST /api/products/bulk
// @access  Private
// ============================================================
export const bulkCreateProducts = async (req, res) => {
  try {
    const products = req.body.products || req.body;
    
    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an array of products'
      });
    }
    
    const result = await productService.bulkCreateProducts(products, req.user.id);
    res.status(201).json({
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
// @desc    Get stock alerts (low, out, dead)
// @route   GET /api/products/alerts
// @access  Private
// ============================================================
export const getStockAlerts = async (req, res) => {
  try {
    const alerts = await productService.getStockAlerts(req.user.id);
    res.status(200).json({
      success: true,
      data: alerts
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// ============================================================
// @desc    Delete stock batch
// @route   DELETE /api/products/:productId/stock/:batchId
// @access  Private
// ============================================================
export const deleteStockBatch = async (req, res) => {
  try {
    const { productId, batchId } = req.params;
    const userId = req.user.id;

    const result = await productService.deleteStockBatch({
      productId,
      batchId,
      ownerId: userId
    });

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

// controllers/productController.js
export const updateStockBatch = async (req, res) => {
  try {
    const { productId, batchId } = req.params;
    const { quantity } = req.body;
    const userId = req.user.id;

    if (quantity === undefined || quantity < 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid quantity (0 or greater)'
      });
    }

    const batch = await StockBatch.findOne({
      _id: batchId,
      productId: productId,
      owner: userId
    });

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Stock batch not found'
      });
    }

    // Update quantity
    const conversion = batch.unit.conversion || 1;
    batch.remainingQuantity = quantity;
    batch.remainingInBase = quantity * conversion;
    await batch.save();

    // Update product quantity
    const totalStock = await StockBatch.aggregate([
      {
        $match: {
          productId: new mongoose.Types.ObjectId(productId),
          owner: userId,
          isActive: true,
          remainingQuantity: { $gt: 0 }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$remainingInBase' }
        }
      }
    ]);

    await Product.findByIdAndUpdate(productId, { 
      quantity: totalStock.length > 0 ? totalStock[0].total : 0 
    });

    res.status(200).json({
      success: true,
      data: { message: 'Stock quantity updated successfully' }
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};