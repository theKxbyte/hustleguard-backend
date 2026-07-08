import * as alertService from '../services/alertService.js';

// @desc    Get all alerts
// @route   GET /api/alerts
// @access  Private
export const getAlerts = async (req, res) => {
  try {
    const { type, severity, isRead, isResolved, limit } = req.query;
    const filters = { type, severity, isRead, isResolved, limit };
    
    const alerts = await alertService.getAlerts(req.user.id, filters);
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

// @desc    Get unread alerts count
// @route   GET /api/alerts/unread/count
// @access  Private
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

// @desc    Mark alert as read
// @route   PUT /api/alerts/:id/read
// @access  Private
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

// @desc    Mark alert as resolved
// @route   PUT /api/alerts/:id/resolve
// @access  Private
export const markAsResolved = async (req, res) => {
  try {
    const alert = await alertService.markAsResolved(req.params.id, req.user.id);
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

// @desc    Mark all alerts as read
// @route   PUT /api/alerts/read-all
// @access  Private
export const markAllAsRead = async (req, res) => {
  try {
    const result = await alertService.markAllAsRead(req.user.id);
    res.status(200).json({
      success: true,
      data: {
        message: `${result.modifiedCount} alerts marked as read`
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Delete alert
// @route   DELETE /api/alerts/:id
// @access  Private
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

// @desc    Run all stock checks
// @route   POST /api/alerts/check-stock
// @access  Private
export const runStockChecks = async (req, res) => {
  try {
    const result = await alertService.runAllStockChecks(req.user.id);
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