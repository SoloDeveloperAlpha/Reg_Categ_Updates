const express = require('express');
const {
  getMinutas,
  getMinutaById,
  createMinuta,
  updateMinuta,
  deleteMinuta,
} = require('../controllers/minutas.controller');

const router = express.Router();
const { requerirEdicion } = require('../middleware/auth.middleware');

router.get('/', getMinutas);
router.get('/:id', getMinutaById);
router.post('/', requerirEdicion, createMinuta);
router.put('/:id', requerirEdicion, updateMinuta);
router.delete('/:id', requerirEdicion, deleteMinuta);

module.exports = router;
