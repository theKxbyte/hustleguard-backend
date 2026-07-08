import * as productService from '../services/productService.js';

// @desc    Create product
// @route   POST /api/products
// @access  Private
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

// @desc    Get all products
// @route   GET /api/products
// @access  Private
export const getProducts = async (req, res) => {
  try {
    const { category, isActive } = req.query;
    const filters = {};
    if (category) filters.category = category;
    if (isActive !== undefined) filters.isActive = isActive === 'true';
    
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

// @desc    Get single product
// @route   GET /api/products/:id
// @access  Private
export const getProduct = async (req, res) => {
  try {
    const product = await productService.getProductById(req.params.id, req.user.id);
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

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private
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

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Private
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

// @desc    Get low stock products
// @route   GET /api/products/low-stock
// @access  Private
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

// @desc    Get out of stock products
// @route   GET /api/products/out-of-stock
// @access  Private
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

// @desc    Update product stock
// @route   PATCH /api/products/:id/stock
// @access  Private
export const updateProductStock = async (req, res) => {
  try {
    const { quantityChange } = req.body;
    
    if (!quantityChange) {
      return res.status(400).json({
        success: false,
        message: 'Please provide quantity change'
      });
    }
    
    const product = await productService.updateStock(
      req.params.id,
      req.user.id,
      quantityChange
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