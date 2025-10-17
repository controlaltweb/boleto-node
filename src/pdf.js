const fs = require('fs');
const PDFDocument = require('pdfkit');
const moment = require('moment');
const { buildBarcode, buildDigitableLine } = require('./barcode');
const { getBankInfo, getBankLogoPath } = require('./utils');
const SVGtoPDF = require('svg-to-pdfkit');
const { amountToBoleto, dateToFatorVencimento, leftPad, onlyNumbers } = require('./utils');

// ITF (Interleaved 2 of 5) encoding tables
const NARROW = 1;
const WIDE = 3;
const ITF_PATTERNS = {
  0: 'nnwwn',
  1: 'wnnnw',
  2: 'nwnnw',
  3: 'wwnnn',
  4: 'nnwnw',
  5: 'wnwnn',
  6: 'nwwnn',
  7: 'nnnww',
  8: 'wnnwn',
  9: 'nwnwn',
};

function computeITFModulesForPair(d1, d2) {
  const p1 = ITF_PATTERNS[d1];
  const p2 = ITF_PATTERNS[d2];
  const modules = [];
  for (let i = 0; i < 5; i++) {
    modules.push(p1[i] === 'n' ? NARROW : WIDE); // bar
    modules.push(p2[i] === 'n' ? NARROW : WIDE); // space
  }
  return modules;
}

function drawITFBarcode(doc, digits, x, y, height, moduleWidth) {
  // Start and stop patterns per ITF spec
  // Start: bar-space-bar-space = n n n n
  // Stop: bar-space-bar = w n n
  const code = onlyNumbers(digits);
  const data = code.length % 2 === 0 ? code : '0' + code;
  let cursorX = x;

  // Start pattern: narrow bar, narrow space, narrow bar, narrow space
  const startModules = [NARROW, NARROW, NARROW, NARROW];
  for (let i = 0; i < startModules.length; i++) {
    const width = startModules[i] * moduleWidth;
    if (i % 2 === 0) {
      doc.rect(cursorX, y, width, height).fill('#000');
      doc.fillColor('#000');
    }
    cursorX += width;
  }

  // Data modules
  for (let i = 0; i < data.length; i += 2) {
    const d1 = Number(data[i]);
    const d2 = Number(data[i + 1]);
    const pairModules = computeITFModulesForPair(d1, d2);
    for (let j = 0; j < pairModules.length; j++) {
      const width = pairModules[j] * moduleWidth;
      if (j % 2 === 0) {
        doc.rect(cursorX, y, width, height).fill('#000');
      }
      cursorX += width;
    }
  }

  // Stop pattern: wide bar, narrow space, narrow bar
  const stopModules = [WIDE, NARROW, NARROW];
  for (let i = 0; i < stopModules.length; i++) {
    const width = stopModules[i] * moduleWidth;
    if (i % 2 === 0) {
      doc.rect(cursorX, y, width, height).fill('#000');
    }
    cursorX += width;
  }

  return cursorX - x;
}

function formatCurrencyCents(cents) {
  const v = (Number(cents || 0) / 100).toFixed(2);
  // Brazilian format
  return 'R$ ' + v.replace('.', ',');
}

// Data interface (loosely):
// {
//   bankCode: '001',
//   currencyCode: '9',
//   dueDate: Date | string,
//   amount: number (in cents),
//   freeField: string (25 digits according to the bank layout),
//   payer: { name, document, address },
//   beneficiary: { name, document, bankBranch, bankAccount },
//   ourNumber: string,
//   documentNumber: string,
//   placeOfPayment: string,
//   instructions: [string]
// }

function generateBoletoPDF(data, options) {
  const { filePath, stream } = options || {};
  const doc = new PDFDocument({ size: 'A4', margin: 36 });
  let outStream = stream;
  if (!outStream) {
    if (!filePath) throw new Error('Provide filePath or stream');
    outStream = fs.createWriteStream(filePath);
  }
  doc.pipe(outStream);

  const dueFactor = dateToFatorVencimento(data.dueDate);
  const amountStr = amountToBoleto(data.amount);
  const barcode44 = buildBarcode({
    bankCode: data.bankCode,
    currencyCode: data.currencyCode || '9',
    dueFactor,
    amount: amountStr,
    freeField: data.freeField,
  });
  const linhaDigitavel = buildDigitableLine(barcode44);

  // Header with bank logo and name
  const bank = getBankInfo(data.bankCode);
  const bankLogoPath = getBankLogoPath(data.bankCode);
  doc.fontSize(14).text('Boleto Bancário', { align: 'left' });
  doc.moveDown(0.5);
  try {
    const svgContent = fs.readFileSync(bankLogoPath, 'utf8');
    // Render SVG at top-right
    const logoWidth = 100;
    SVGtoPDF(doc, svgContent, doc.page.width - doc.page.margins.right - logoWidth, doc.y - 14, { width: logoWidth });
  } catch (e) {
    // ignore logo errors, proceed without logo
  }
  doc.fontSize(11).text(`${bank.code} - ${bank.name}`);
  doc.moveDown(0.25);
  doc.fontSize(10).text(`Linha Digitável: ${linhaDigitavel}`);
  doc.moveDown(0.25);
  doc.text(`Banco: ${leftPad(data.bankCode, 3, '0')}  Moeda: ${data.currencyCode || '9'}`);
  doc.text(`Vencimento: ${moment(data.dueDate).format('DD/MM/YYYY')}  Valor: ${formatCurrencyCents(data.amount)}`);

  doc.moveDown(0.5);
  if (data.beneficiary) {
    const b = data.beneficiary;
    doc.text(`Beneficiário: ${b.name || ''}`);
    if (b.document) doc.text(`Documento: ${b.document}`);
    if (b.bankBranch || b.bankAccount) {
      doc.text(`Agência/Conta: ${(b.bankBranch || '')}/${(b.bankAccount || '')}`);
    }
  }

  doc.moveDown(0.5);
  if (data.payer) {
    const p = data.payer;
    doc.text(`Pagador: ${p.name || ''}`);
    if (p.document) doc.text(`Documento: ${p.document}`);
    if (p.address) doc.text(`Endereço: ${p.address}`);
  }

  if (data.placeOfPayment) {
    doc.moveDown(0.5);
    doc.text(`Local de Pagamento: ${data.placeOfPayment}`);
  }

  if (data.documentNumber) {
    doc.moveDown(0.5);
    doc.text(`Número do Documento: ${data.documentNumber}`);
  }

  if (data.ourNumber) {
    doc.text(`Nosso Número: ${data.ourNumber}`);
  }

  if (Array.isArray(data.instructions) && data.instructions.length) {
    doc.moveDown(0.5);
    doc.text('Instruções:');
    data.instructions.forEach((i) => doc.text(`- ${i}`));
  }

  // Barcode section at the bottom
  const barcodeHeight = 48;
  const moduleWidth = 1.2; // tune for printer/scanner
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const barcodeX = doc.page.margins.left;
  const barcodeY = doc.page.height - doc.page.margins.bottom - barcodeHeight - 40;

  doc.moveTo(barcodeX, barcodeY - 10).lineTo(barcodeX + pageWidth, barcodeY - 10).stroke();
  drawITFBarcode(doc, barcode44, barcodeX, barcodeY, barcodeHeight, moduleWidth);
  doc.fillColor('#000');
  doc.fontSize(9).text(barcode44, barcodeX, barcodeY + barcodeHeight + 6, { width: pageWidth, align: 'center' });

  doc.end();
  return { barcode: barcode44, digitableLine: linhaDigitavel };
}

module.exports = {
  generateBoletoPDF,
  drawITFBarcode,
};


