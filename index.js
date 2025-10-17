const { generateBoletoPDF } = require('./src/pdf');
const { buildBarcode, buildDigitableLine } = require('./src/barcode');
const utils = require('./src/utils');
const AbstractBoleto = require('./src/AbstractBoleto');
const SantanderBoleto = require('./src/banks/SantanderBoleto');
const SicrediBoleto = require('./src/banks/SicrediBoleto');

module.exports = {
  // Classes principais
  AbstractBoleto,
  SantanderBoleto,
  SicrediBoleto,
  
  // Funções utilitárias (mantidas para compatibilidade)
  generateBoletoPDF,
  buildBarcode,
  buildDigitableLine,
  utils,
};