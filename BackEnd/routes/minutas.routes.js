const express = require('express');
const {
  getMinutas,
  getMinutaById,
  createMinuta,
  updateMinuta,
  deleteMinuta,
} = require('../controllers/minutas.controller');

const router = express.Router();

router.get('/', getMinutas);
router.get('/:id', getMinutaById);
router.post('/', createMinuta);
router.put('/:id', updateMinuta);
router.delete('/:id', deleteMinuta);

module.exports = router;
