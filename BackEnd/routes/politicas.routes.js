const express = require('express');
const {
  getPoliticas,
  getPoliticaById,
  createPolitica,
  updatePolitica,
  deletePolitica,
} = require('../controllers/politicas.controller');

const router = express.Router();
const { requerirEdicion } = require('../middleware/auth.middleware');

router.get('/', getPoliticas);
router.get('/:id', getPoliticaById);
router.post('/', requerirEdicion, createPolitica);
router.put('/:id', requerirEdicion, updatePolitica);
router.delete('/:id', requerirEdicion, deletePolitica);

module.exports = router;
