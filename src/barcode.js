const { leftPad, modulo10, modulo11, onlyNumbers } = require('./utils');

// Build 44-digit barcode according to FEBRABAN layout
// Fields: bank(3) currency(1) DV(1) dueFactor(4) amount(10) freeField(25)
function buildBarcode({ bankCode, currencyCode = '9', dueFactor, amount, freeField }) {
  const bank = leftPad(onlyNumbers(bankCode), 3, '0');
  const currency = String(currencyCode || '9');
  const fator = leftPad(onlyNumbers(dueFactor), 4, '0');
  const valor = leftPad(onlyNumbers(amount), 10, '0');
  const livre = onlyNumbers(freeField).slice(0, 25).padEnd(25, '0');
  const withoutDV = bank + currency + fator + valor + livre;
  const dv = String(modulo11(withoutDV, { base: 9, remainderMode: 'banco' }));
  return bank + currency + dv + fator + valor + livre;
}

// Build "linha digitável" (47 digits) split into 5 fields with modulo 10 DVs
function buildDigitableLine(barcode44) {
  const b = onlyNumbers(barcode44);
  if (b.length !== 44) throw new Error('Barcode must have 44 digits');
  const bank = b.slice(0, 3);
  const currency = b.slice(3, 4);
  const dvGeral = b.slice(4, 5); // not used in fields, appears as 4th block
  const fator = b.slice(5, 9);
  const valor = b.slice(9, 19);
  const campoLivre = b.slice(19); // 25

  // Fields
  const campo1 = bank + currency + campoLivre.slice(0, 5);
  const campo1DV = modulo10(campo1);
  const campo1Fmt = campo1.slice(0, 5) + '.' + campo1.slice(5) + String(campo1DV);

  const campo2 = campoLivre.slice(5, 15);
  const campo2DV = modulo10(campo2);
  const campo2Fmt = campo2.slice(0, 5) + '.' + campo2.slice(5) + String(campo2DV);

  const campo3 = campoLivre.slice(15, 25);
  const campo3DV = modulo10(campo3);
  const campo3Fmt = campo3.slice(0, 5) + '.' + campo3.slice(5) + String(campo3DV);

  const campo4 = dvGeral;
  const campo5 = fator + valor;

  return `${campo1Fmt} ${campo2Fmt} ${campo3Fmt} ${campo4} ${campo5}`;
}

module.exports = {
  buildBarcode,
  buildDigitableLine,
};


