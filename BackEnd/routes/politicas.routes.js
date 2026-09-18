const express = require('express');
const {
  getPoliticas,
  getPoliticaById,
  createPolitica,
  updatePolitica,
  deletePolitica,
} = require('../controllers/politicas.controller');

const router = express.Router();

router.get('/', getPoliticas);
router.get('/:id', getPoliticaById);
router.post('/', createPolitica);
router.put('/:id', updatePolitica);
router.delete('/:id', deletePolitica);

module.exports = router;
