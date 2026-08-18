// controllers/alertController.js
import * as alertService from '../services/alertService.js';

// ============================================================
// @desc    Get all alerts
// @route   GET /api/alerts
// @access  Private
// ============================================================
export const getAlerts = async (req, res) => {
  try {
    const { 
      type, 
      severity, 
      isRead, 
      isResolved, 
      limit = 50,
      offset = 0,
      productId,
      startDate,
      endDate
    } = req.query;
    
    const filters = { 
      type, 
      severity, 
      isRead, 
      isResolved, 
      limit: parseInt(limit),
      offset: parseInt(offset),
      productId,
      startDate,
      endDate
    };
    
    const result = await alertService.getAlerts(req.user.id, filters);
    res.status(200).json({
      success: true,
      count: result.alerts.length,
      total: result.total,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: result.hasMore
      },
      data: result.alerts
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// ============================================================
// @desc    Get single alert by ID
// @route   GET /api/alerts/:id
// @access  Private
// ============================================================
export const getAlert = async (req, res) => {
  try {
    const alert = await alertService.getAlertById(req.params.id, req.user.id);
    
    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: alert
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      message: error.message
    });
  }
};

// ============================================================
// @desc    Get unread alerts count
// @route   GET /api/alerts/unread/count
// @access  Private
// ============================================================
export const getUnreadCount = async (req, res) => {
  try {
    const count = await alertService.getUnreadCount(req.user.id);
    res.status(200).json({
      success: true,
      data: { unreadCount: count }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// ============================================================
// @desc    Get alert summary counts by type/severity
// @route   GET /api/alerts/summary
// @access  Private
// ============================================================
export const getAlertSummary = async (req, res) => {
  try {
    const summary = await alertService.getAlertSummary(req.user.id);
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
// @desc    Mark alert as read
// @route   PUT /api/alerts/:id/read
// @access  Private
// ============================================================
export const markAsRead = async (req, res) => {
  try {
    const alert = await alertService.markAsRead(req.params.id, req.user.id);
    res.status(200).json({
      success: true,
      data: alert
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      message: error.message
    });
  }
};

// ============================================================
// @desc    Mark alert as resolved
// @route   PUT /api/alerts/:id/resolve
// @access  Private
// ============================================================
export const markAsResolved = async (req, res) => {
  try {
    const { resolutionNote } = req.body;
    const alert = await alertService.markAsResolved(
      req.params.id, 
      req.user.id,
      resolutionNote
    );
    res.status(200).json({
      success: true,
      data: alert
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      message: error.message
    });
  }
};

// ============================================================
// @desc    Mark all alerts as read
// @route   PUT /api/alerts/read-all
// @access  Private
// ============================================================
export const markAllAsRead = async (req, res) => {
  try {
    const result = await alertService.markAllAsRead(req.user.id);
    res.status(200).json({
      success: true,
      data: {
        message: `${result.modifiedCount} alerts marked as read`,
        modifiedCount: result.modifiedCount
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
// @desc    Mark all alerts as resolved
// @route   PUT /api/alerts/resolve-all
// @access  Private
// ============================================================
export const markAllAsResolved = async (req, res) => {
  try {
    const { resolutionNote } = req.body;
    const result = await alertService.markAllAsResolved(
      req.user.id,
      resolutionNote
    );
    res.status(200).json({
      success: true,
      data: {
        message: `${result.modifiedCount} alerts marked as resolved`,
        modifiedCount: result.modifiedCount
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
// @desc    Delete alert
// @route   DELETE /api/alerts/:id
// @access  Private
// ============================================================
export const deleteAlert = async (req, res) => {
  try {
    const result = await alertService.deleteAlert(req.params.id, req.user.id);
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
// @desc    Delete all resolved alerts
// @route   DELETE /api/alerts/resolved
// @access  Private
// ============================================================
export const deleteResolvedAlerts = async (req, res) => {
  try {
    const result = await alertService.deleteResolvedAlerts(req.user.id);
    res.status(200).json({
      success: true,
      data: {
        message: `${result.deletedCount} resolved alerts deleted`,
        deletedCount: result.deletedCount
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
// @desc    Run all stock checks (low, out, dead, expiry)
// @route   POST /api/alerts/check-stock
// @access  Private
// ============================================================
export const runStockChecks = async (req, res) => {
  try {
    const result = await alertService.runAllStockChecks(req.user.id);
    res.status(200).json({
      success: true,
      data: {
        message: `Stock checks completed: ${result.totalAlerts} alerts created/updated`,
        alerts: result,
        timestamp: new Date()
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
// @desc    Run specific stock check type
// @route   POST /api/alerts/check/:type
// @access  Private
// ============================================================
export const runStockCheckType = async (req, res) => {
  try {
    const { type } = req.params;
    
    const validTypes = ['low_stock', 'out_of_stock', 'dead_stock', 'stock_expiry'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `Invalid type. Must be one of: ${validTypes.join(', ')}`
      });
    }
    
    const result = await alertService.runStockCheckType(
      req.user.id,
      type
    );
    
    res.status(200).json({
      success: true,
      data: {
        message: `${type} check completed: ${result.alertsCreated} alerts created`,
        alerts: result,
        timestamp: new Date()
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
// @desc    Get alerts by product
// @route   GET /api/alerts/product/:productId
// @access  Private
// ============================================================
export const getAlertsByProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const { limit = 20 } = req.query;
    
    const alerts = await alertService.getAlertsByProduct(
      productId,
      req.user.id,
      parseInt(limit)
    );
    
    res.status(200).json({
      success: true,
      count: alerts.length,
      data: alerts
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};