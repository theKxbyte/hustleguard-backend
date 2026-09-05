// controllers/stockMonitorController.js
import * as stockMonitorService from '../services/stockMonitorService.js';

export const getTodayStockSnapshot = async (req, res) => {
  try {
    const data = await stockMonitorService.getTodayStockSnapshot(req.user.id);
    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};