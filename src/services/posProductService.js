import Product from '../models/Product.js';

// @desc    Search products for POS with optimized query
export const searchPosProducts = async (filters) => {
  const { query, category, limit, offset, includeOutOfStock, ownerId } = filters;

  // Build query with only what's needed for POS
  const queryObj = { 
    owner: ownerId,
    isActive: true 
  };

  // Only show in-stock products unless explicitly requested
  if (!includeOutOfStock) {
    queryObj.quantity = { $gt: 0 };
  }

  // Handle search query
  if (query && query.trim() !== '') {
    const searchTerm = query.trim();
    // Check if it's a number (likely barcode)
    if (/^[0-9]+$/.test(searchTerm)) {
      queryObj.$or = [
        { barcode: searchTerm },
        { name: { $regex: searchTerm, $options: 'i' } }
      ];
    } else {
      queryObj.$or = [
        { name: { $regex: searchTerm, $options: 'i' } },
        { category: { $regex: searchTerm, $options: 'i' } }
      ];
    }
  }

  // Add category filter
  if (category && category !== 'all') {
    queryObj.category = category;
  }

  // Execute query with minimal fields for POS
  const products = await Product.find(queryObj)
    .select('name sellingPrice quantity barcode category unit minStockAlert')
    .lean() // Returns plain JS objects for better performance
    .limit(limit)
    .skip(offset)
    .sort({ name: 1 }); // Sort by name for better UX

  // Get total count for pagination
  const total = await Product.countDocuments(queryObj);

  // Add computed fields for POS
  const enrichedProducts = products.map(product => ({
    ...product,
    isLowStock: product.quantity <= product.minStockAlert,
    isOutOfStock: product.quantity === 0,
    displayPrice: product.sellingPrice.toFixed(2),
    stockStatus: product.quantity === 0 ? 'out_of_stock' :
                 product.quantity <= product.minStockAlert ? 'low_stock' : 'in_stock'
  }));

  return {
    products: enrichedProducts,
    total,
    hasMore: offset + limit < total
  };
};

// @desc    Get product by barcode with caching
export const getProductByBarcode = async (barcode, ownerId) => {
  // Check if barcode is provided
  if (!barcode) return null;

  const product = await Product.findOne({
    barcode: barcode,
    owner: ownerId,
    isActive: true
  })
  .select('name sellingPrice quantity barcode category unit minStockAlert description')
  .lean();

  if (!product) return null;

  // Add computed fields
  return {
    ...product,
    isLowStock: product.quantity <= product.minStockAlert,
    isOutOfStock: product.quantity === 0,
    displayPrice: product.sellingPrice.toFixed(2),
    stockStatus: product.quantity === 0 ? 'out_of_stock' :
                 product.quantity <= product.minStockAlert ? 'low_stock' : 'in_stock'
  };
};

// @desc    Get multiple products by IDs
export const getProductsBatch = async (productIds, ownerId) => {
  const products = await Product.find({
    _id: { $in: productIds },
    owner: ownerId,
    isActive: true
  })
  .select('name sellingPrice quantity barcode category unit minStockAlert')
  .lean();

  // Return in the same order as requested
  const productMap = {};
  products.forEach(product => {
    productMap[product._id.toString()] = {
      ...product,
      isLowStock: product.quantity <= product.minStockAlert,
      isOutOfStock: product.quantity === 0,
      displayPrice: product.sellingPrice.toFixed(2)
    };
  });

  return productIds.map(id => productMap[id.toString()] || null);
};

// @desc    Get product suggestions for autocomplete
export const getProductSuggestions = async (query, ownerId, limit = 10) => {
  if (!query || query.trim() === '') {
    return [];
  }

  const searchTerm = query.trim();
  
  const products = await Product.find({
    owner: ownerId,
    isActive: true,
    quantity: { $gt: 0 }, // Only suggest in-stock items
    $or: [
      { name: { $regex: searchTerm, $options: 'i' } },
      { barcode: searchTerm }
    ]
  })
  .select('name sellingPrice barcode quantity')
  .lean()
  .limit(limit);

  return products.map(product => ({
    id: product._id,
    name: product.name,
    sellingPrice: product.sellingPrice,
    barcode: product.barcode,
    quantity: product.quantity,
    display: `${product.name} (${product.quantity} in stock)`
  }));
};