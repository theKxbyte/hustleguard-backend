import * as stockMovementService from '../services/stockMovementService.js';

export const receiveStock = async (req, res) => {
  try {
    const { product, movement } = await stockMovementService.receiveStock(req.user._id, req.body);
    res.status(201).json({ success: true, product, movement });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const recordAdjustment = async (req, res) => {
  try {
    const { product, movement } = await stockMovementService.recordAdjustment(req.user._id, req.body);
    res.status(201).json({ success: true, product, movement });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const listMovements = async (req, res) => {
  try {
    const result = await stockMovementService.listMovements(req.user._id, req.query);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const reverseMovement = async (req, res) => {
  try {
    const movement = await stockMovementService.reverseMovement(req.params.id, req.user._id);
    res.status(200).json({ success: true, movement });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};