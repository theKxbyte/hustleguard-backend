// controllers/categoryController.js
import Category from '../models/Category.js';
import Product from '../models/Product.js';

export const getCategories = async (req, res) => {
  try {
    const categories = await Category.find({
      owner: req.user.id,
      isActive: true
    }).sort({ name: 1 });

    res.status(200).json({
      success: true,
      count: categories.length,
      data: categories
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

export const getCategory = async (req, res) => {
  try {
    const category = await Category.findOne({
      _id: req.params.id,
      owner: req.user.id
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    res.status(200).json({
      success: true,
      data: category
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

export const createCategory = async (req, res) => {
  try {
    const { name, description, color, icon } = req.body;

    const existing = await Category.findOne({
      name: { $regex: new RegExp(`^${name}$`, 'i') },
      owner: req.user.id
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Category already exists'
      });
    }

    const category = await Category.create({
      name: name.trim(),
      description: description?.trim() || '',
      color: color || '#6B7280',
      icon: icon || '📦',
      owner: req.user.id
    });

    res.status(201).json({
      success: true,
      data: category
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

export const updateCategory = async (req, res) => {
  try {
    const { name, description, color, icon } = req.body;

    const category = await Category.findOne({
      _id: req.params.id,
      owner: req.user.id
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    if (name && name !== category.name) {
      const existing = await Category.findOne({
        name: { $regex: new RegExp(`^${name}$`, 'i') },
        owner: req.user.id,
        _id: { $ne: category._id }
      });

      if (existing) {
        return res.status(400).json({
          success: false,
          message: 'Category name already exists'
        });
      }
    }

    category.name = name?.trim() || category.name;
    category.description = description?.trim() || category.description;
    category.color = color || category.color;
    category.icon = icon || category.icon;

    await category.save();

    res.status(200).json({
      success: true,
      data: category
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

export const deleteCategory = async (req, res) => {
  try {
    const category = await Category.findOne({
      _id: req.params.id,
      owner: req.user.id
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    const productCount = await Product.countDocuments({
      category: category.name,
      owner: req.user.id,
      isActive: true
    });

    if (productCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete category with ${productCount} products. Remove or reassign products first.`
      });
    }

    await category.deleteOne();

    res.status(200).json({
      success: true,
      data: { message: 'Category deleted successfully' }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

export const getCategoryProducts = async (req, res) => {
  try {
    const category = await Category.findOne({
      _id: req.params.id,
      owner: req.user.id
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    const products = await Product.find({
      category: category.name,
      owner: req.user.id,
      isActive: true
    })
    .select('name description stock units category minStockAlert')
    .limit(50);

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