// controllers/alertController.js
import * as alertService from '../services/alertService.js';

export const getAlerts = async (req, res) => {
  try {
    const { type, severity, isRead, isResolved, limit = 50, offset = 0 } = req.query;
    
    const filters = { 
      type, 
      severity, 
      isRead, 
      isResolved, 
      limit: parseInt(limit),
      offset: parseInt(offset)
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

export const markAllAsResolved = async (req, res) => {
  try {
    const result = await alertService.markAllAsResolved(req.user.id);
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