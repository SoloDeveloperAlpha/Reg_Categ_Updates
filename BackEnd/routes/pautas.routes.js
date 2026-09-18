const express = require('express');
const {
  getPautas,
  getPautaById,
  createPauta,
  updatePauta,
  deletePauta,
} = require('../controllers/pautas.controller');

const router = express.Router();

router.get('/', getPautas);
router.get('/:id', getPautaById);
router.post('/', createPauta);
router.put('/:id', updatePauta);
router.delete('/:id', deletePauta);

module.exports = router;
