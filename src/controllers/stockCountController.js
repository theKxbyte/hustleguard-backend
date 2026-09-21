import * as stockCountService from '../services/stockCountService.js';

export const createDraft = async (req, res) => {
  try {
    const stockCount = await stockCountService.createDraft(req.user._id, req.body);
    res.status(201).json({ success: true, stockCount });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const updateDraft = async (req, res) => {
  try {
    const stockCount = await stockCountService.updateDraft(req.params.id, req.user._id, req.body);
    res.status(200).json({ success: true, stockCount });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const countSingleItem = async (req, res) => {
  try {
    const stockCount = await stockCountService.countSingleItem(req.params.id, req.user._id, req.body);
    res.status(200).json({ success: true, stockCount });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const confirmCount = async (req, res) => {
  try {
    const stockCount = await stockCountService.confirmCount(req.params.id, req.user._id);
    res.status(200).json({ success: true, stockCount });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const cancelDraft = async (req, res) => {
  try {
    const stockCount = await stockCountService.cancelDraft(req.params.id, req.user._id);
    res.status(200).json({ success: true, stockCount });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getHistory = async (req, res) => {
  try {
    const result = await stockCountService.getHistory(req.user._id, req.query);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getLatestConfirmed = async (req, res) => {
  try {
    const stockCount = await stockCountService.getLatestConfirmed(req.user._id);
    res.status(200).json({ success: true, stockCount });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getLatestDraft = async (req, res) => {
  try {
    const stockCount = await stockCountService.getLatestDraft(req.user._id);
    res.status(200).json({ success: true, stockCount });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getCountById = async (req, res) => {
  try {
    const stockCount = await stockCountService.getCountById(req.params.id, req.user._id);
    res.status(200).json({ success: true, stockCount });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};