const fs = require('fs');
const PDFDocument = require('pdfkit');
const moment = require('moment');
const { buildBarcode, buildDigitableLine } = require('./barcode');
const { getBankInfo, getBankLogoPath, getCodigoBancoComDv } = require('./utils');
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
// Conversion factor: 1 mm = 2.834645669 points
const mmToPt = 2.834645669;

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
  let code = onlyNumbers(digits);
  if (code.length % 2 !== 0) {
    code = '0' + code;
  }

  // Start pattern: narrow bar, narrow space, narrow bar, narrow space
  doc.rect(x, y, moduleWidth * NARROW, height).fill();
  x += moduleWidth * NARROW;
  x += moduleWidth * NARROW; // narrow space
  doc.rect(x, y, moduleWidth * NARROW, height).fill();
  x += moduleWidth * NARROW;
  x += moduleWidth * NARROW; // narrow space

  // Data
  for (let i = 0; i < code.length; i += 2) {
    const d1 = parseInt(code[i]);
    const d2 = parseInt(code[i + 1]);
    const modules = computeITFModulesForPair(d1, d2);

    for (let j = 0; j < modules.length; j += 2) {
      const barWidth = modules[j] * moduleWidth;
      const spaceWidth = modules[j + 1] * moduleWidth;

      if (barWidth > 0) {
        doc.rect(x, y, barWidth, height).fill();
      }
      x += barWidth + spaceWidth;
    }
  }

  // Stop pattern: wide bar, narrow space, narrow bar
  doc.rect(x, y, moduleWidth * WIDE, height).fill();
  x += moduleWidth * WIDE;
  x += moduleWidth * NARROW; // narrow space
  doc.rect(x, y, moduleWidth * NARROW, height).fill();
}

function formatCurrency(cents) {
  const v = (Number(cents || 0) / 100).toFixed(2);
  return v.replace('.', ',');
}

function formatDocument(document) {
  if (!document) return '';
  const clean = document.replace(/\D/g, '');
  if (clean.length === 11) {
    // CPF
    return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  } else if (clean.length === 14) {
    // CNPJ
    return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  return document;
}

function drawDashedLine(doc, x, y, width, dashLength = 3, gapLength = 2) {
  let currentX = x;
  while (currentX < x + width) {
    doc.moveTo(currentX, y).lineTo(Math.min(currentX + dashLength, x + width), y);
    currentX += dashLength + gapLength;
  }
  doc.stroke();
}

function drawCell(doc, x, y, width, height, label, text, options = {}) {
  const {
    fontSize = 8,
    font = 'Helvetica',
    bold = false,
    align = 'left',
    border = true,
    fill = false,
    fillColor = '#f0f0f0',
  } = options;


  // Draw border
  if (border) {
    doc.rect(x, y, width, height + height / 2).lineWidth(0.5).stroke();
  }

  // Fill background
  if (fill) {
    doc.rect(x, y, width, height + height / 2).fill(fillColor);
  }


  // Draw label
  const labelFontSize = fontSize - 2;
  const labelY = y + 5;
  const labelX = x + 2; // Small padding
  doc.font(font).fontSize(labelFontSize);
  doc.text(label, labelX, labelY);

  // Draw text
  const fontName = bold ? font + '-Bold' : font;
  doc.font(fontName).fontSize(fontSize);

  const textY = labelY + labelFontSize + 4;
  const textX = x + 2; // Small padding

  if (align === 'center') {
    doc.text(text, x, textY, { width: width, align: 'center' });
  } else if (align === 'right') {
    doc.text(text, x, textY, { width: width - 2, align: 'right' });
  } else {
    doc.text(text, textX, textY);
  }
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

function generateBoletoPDF(boleto, options) {
  const { filePath, stream } = options || {};
  const doc = new PDFDocument({ size: 'A4', margin: 0 });
  let outStream = stream;
  if (!outStream) {
    if (!filePath) throw new Error('Provide filePath or stream');
    outStream = fs.createWriteStream(filePath);
  }
  doc.pipe(outStream);

  const dueFactor = dateToFatorVencimento(boleto.dueDate);
  const amountStr = amountToBoleto(boleto.amount);
  const barcode44 = boleto.barcode;
  const linhaDigitavel = boleto.digitableLine;

  const bankLogoPath = getBankLogoPath(boleto.bankCode);

  // Constants matching Pdf.php exactly (converted to points)
  const desc = 4 * mmToPt; // tamanho célula descrição
  const cell = 6 * mmToPt; // tamanho célula dado
  const fdes = 6; // tamanho fonte descrição (already in points)
  const fcel = 9; // tamanho fonte célula (already in points)

  // Page setup - matching Pdf.php constructor (converted to points)
  const pageWidth = 180 * mmToPt; // A4 width minus margins (210 - 10 - 10)
  const startX = 15 * mmToPt; // Left margin (SetLeftMargin(20))
  let currentY = 15 * mmToPt; // Top margin (SetTopMargin(15))

  // Instructions section (instrucoes method)
  // doc.font('Helvetica').fontSize(fcel);
  // doc.text('Instruções de Impressão', startX, currentY, { align: 'center', width: pageWidth });
  // currentY += 5 * mmToPt;

  // doc.fontSize(fdes);
  // const instructions = [
  //   '- Imprima em impressora jato de tinta (ink jet) ou laser em qualidade normal ou alta (Não use modo econômico).',
  //   '- Utilize folha A4 (210 x 297 mm) ou Carta (216 x 279 mm) e margens mínimas à esquerda e à direita do formulário.',
  //   '- Corte na linha indicada. Não rasure, risque, fure ou dobre a região onde se encontra o código de barras.',
  //   '- Caso não apareça o código de barras no final, clique em F5 para atualizar esta tela.',
  //   '- Caso tenha problemas ao imprimir, copie a seqüencia numérica abaixo e pague no caixa eletrônico ou no internet banking:',
  // ];
  // instructions.forEach(instruction => {
  //   doc.text(instruction, startX, currentY, { width: pageWidth });
  //   currentY += desc;
  // });
  // currentY += 4 * mmToPt;

  // Linha Digitável
  // doc.fontSize(fcel);
  // doc.text('Linha Digitável: ', startX, currentY);
  // doc.font('Helvetica-Bold');
  // doc.text(linhaDigitavel, startX + 25 * mmToPt, currentY);
  // currentY += cell;

  // doc.font('Helvetica');
  // doc.text('Número: ', startX, currentY);
  // doc.font('Helvetica-Bold');
  // doc.text(boleto.documentNumber || '', startX + 25 * mmToPt, currentY);
  // currentY += cell;

  // doc.font('Helvetica');
  // doc.text('Valor: ', startX, currentY);
  // doc.font('Helvetica-Bold');
  // doc.text('R$ ' + formatCurrency(boleto.amount), startX + 25 * mmToPt, currentY);
  // currentY += cell;

  // Traço "Recibo do Pagador"
  // currentY += 3 * mmToPt;
  doc.font('Helvetica').fontSize(fdes);
  doc.text('Recibo do Pagador', startX, currentY, { align: 'right', width: pageWidth });
  currentY += 4 * mmToPt;
  drawDashedLine(doc, startX, currentY, pageWidth);
  currentY += 4 * mmToPt;

  // Logo da empresa (logoEmpresa method)
  currentY += 2 * mmToPt;
  doc.fontSize(fdes);

  // Logo do beneficiário
  if (boleto.beneficiary?.logoPath && fs.existsSync(boleto.beneficiary?.logoPath)) {
    try {
      const beneficiaryLogoPath = fs.readFileSync(boleto.beneficiary?.logoPath);
      doc.image(beneficiaryLogoPath, startX, currentY, { height: 12 * mmToPt });
    } catch (e) {
      // Fallback if logo fails
    }
  }

  // Beneficiário info
  doc.text(boleto.beneficiary?.name || '', startX + 56 * mmToPt, currentY);
  currentY += desc;
  doc.text(formatDocument(boleto.beneficiary?.document || ''), startX + 56 * mmToPt, currentY);
  currentY += desc;
  doc.text(boleto.beneficiary?.address || '', startX + 56 * mmToPt, currentY);
  currentY += desc;
  doc.text(boleto.beneficiary?.addressComplement || '', startX + 56 * mmToPt, currentY);
  currentY += 6 * mmToPt;

  // Topo section (Topo method)
  // Logo do banco
  if (bankLogoPath && fs.existsSync(bankLogoPath)) {
    try {
      doc.image(bankLogoPath, startX, currentY, { height: 7 * mmToPt });
    } catch (e) {
      console.error('Error loading bank logo:', e);
      // Fallback if logo fails
    }
  }
  currentY += 2 * mmToPt;

  // Código do banco com DV (15mm)
  doc.font('Helvetica-Bold').fontSize(15);
  doc.text(getCodigoBancoComDv(boleto.bankCode), startX + 30 * mmToPt, currentY + 0 * mmToPt, { align: 'left' });
  // Draw line
  doc.moveTo(startX + 28 * mmToPt, currentY - 2 * mmToPt);
  doc.lineWidth(2).lineTo(startX + 28 * mmToPt, currentY + 5 * mmToPt);
  doc.moveTo(startX + 45 * mmToPt, currentY - 2 * mmToPt);
  doc.lineWidth(2).lineTo(startX + 45 * mmToPt, currentY + 5 * mmToPt);

  doc.font('Helvetica-Bold').fontSize(12);
  doc.text(boleto.digitableLine, startX + 45 * mmToPt, currentY, { align: 'right', width: pageWidth - 45 * mmToPt });

  currentY += 3 * mmToPt;

  // Tabela Beneficiário
  currentY += desc;
  doc.font('Helvetica-Bold').fontSize(fcel);
  drawCell(doc, startX, currentY, 75 * mmToPt, cell, 'Beneficiário', boleto.beneficiary?.name || '', { fontSize: fcel, bold: true });
  drawCell(doc, startX + 75 * mmToPt, currentY, 35 * mmToPt, cell, 'Ag./Cód. do benef.', boleto.beneficiary?.bankBranch || '', { fontSize: fcel, bold: true });
  drawCell(doc, startX + 100 * mmToPt, currentY, 10 * mmToPt, cell, 'Espécie', 'R$', { fontSize: fcel, bold: true });
  drawCell(doc, startX + 110 * mmToPt, currentY, 10 * mmToPt, cell, 'Quant.', '', { fontSize: fcel, bold: true });
  drawCell(doc, startX + 120 * mmToPt, currentY, 60 * mmToPt, cell, 'Nosso Número', boleto.ourNumber || '', { fontSize: fcel, bold: true, align: 'right' });
  currentY += cell + 3 * mmToPt;

  // Tabela Documento
  drawCell(doc, startX, currentY, 40 * mmToPt, cell, 'Número do Documento', boleto.documentNumber || '', { fontSize: fcel, bold: true });
  drawCell(doc, startX + 40 * mmToPt, currentY, 50 * mmToPt, cell, 'CPF/CNPJ', formatDocument(boleto.beneficiary?.document || ''), { fontSize: fcel, bold: true });
  drawCell(doc, startX + 90 * mmToPt, currentY, 40 * mmToPt, cell, 'Vencimento', moment(boleto.dueDate).utc().format('DD/MM/YYYY'), { fontSize: fcel, bold: true });
  drawCell(doc, startX + 130 * mmToPt, currentY, 50 * mmToPt, cell, 'Vencimento', 'R$ ' + formatCurrency(boleto.amount), { fontSize: fcel, bold: true, align: 'right' });
  currentY += cell + 3 * mmToPt;

  // Tabela Valores
  // doc.font('Helvetica').fontSize(fdes);
  // drawCell(doc, startX, currentY, 40 * mmToPt, desc, '(-) Descontos/Abatimentos', { fontSize: fdes, border: false });
  // drawCell(doc, startX + 40 * mmToPt, currentY, 30 * mmToPt, desc, '(-) Outras Deduções', { fontSize: fdes, border: false });
  // drawCell(doc, startX + 70 * mmToPt, currentY, 30 * mmToPt, desc, '(+) Mora Multa', { fontSize: fdes, border: false });
  // drawCell(doc, startX + 100 * mmToPt, currentY, 30 * mmToPt, desc, '(+) Acréscimos', { fontSize: fdes, border: false });
  // drawCell(doc, startX + 130 * mmToPt, currentY, 50 * mmToPt, desc, '(=) Valor Cobrado', { fontSize: fdes, border: false });

  drawCell(doc, startX, currentY, 40 * mmToPt, cell, '(-) Descontos/Abatimentos', '', { fontSize: fcel, bold: true });
  drawCell(doc, startX + 40 * mmToPt, currentY, 30 * mmToPt, cell, '(-) Outras Deduções', '', { fontSize: fcel, bold: true });
  drawCell(doc, startX + 70 * mmToPt, currentY, 30 * mmToPt, cell, '(+) Mora Multa', '', { fontSize: fcel, bold: true });
  drawCell(doc, startX + 100 * mmToPt, currentY, 30 * mmToPt, cell, '(+) Acréscimos', '', { fontSize: fcel, bold: true });
  drawCell(doc, startX + 130 * mmToPt, currentY, 50 * mmToPt, cell, '(=) Valor Cobrado', 'R$ ' + formatCurrency(boleto.amount), { fontSize: fcel, bold: true, align: 'right' });
  currentY += cell + 3 * mmToPt;


  // Pagador
  drawCell(doc, startX, currentY, pageWidth, cell, 'Pagador', boleto.payer?.name + ' - ' + boleto.payer?.document || '', { fontSize: fcel, bold: true });
  currentY += cell + 4 * mmToPt;

  // Demonstrativo
  doc.font('Helvetica').fontSize(fdes);
  doc.text('Demonstrativo', startX, currentY);
  doc.text('Autenticação mecânica', startX + 100 * mmToPt, currentY, { align: 'right', width: pageWidth - 100 * mmToPt });
  currentY += 4 * mmToPt;

  // Traço "Corte na linha pontilhada"
  currentY += 26 * mmToPt;
  doc.font('Helvetica').fontSize(fdes);
  doc.text('Corte na linha pontilhada', startX, currentY, { align: 'right', width: pageWidth });
  currentY += 4 * mmToPt;
  drawDashedLine(doc, startX, currentY, pageWidth);
  currentY += 10 * mmToPt;

  // Bottom section (Bottom method)
  // Logo do banco
  if (bankLogoPath && fs.existsSync(bankLogoPath)) {
    try {
      doc.image(bankLogoPath, startX, currentY, { height: 7 * mmToPt });
    } catch (e) {
      console.error('Error loading bank logo:', e);
      // Fallback if logo fails
    }
  }
  currentY += 2 * mmToPt;

  // Código do banco com DV (15mm)
  doc.font('Helvetica-Bold').fontSize(15);
  doc.text(getCodigoBancoComDv(boleto.bankCode), startX + 30 * mmToPt, currentY + 0 * mmToPt, { align: 'left' });
  // Draw line
  doc.moveTo(startX + 28 * mmToPt, currentY - 2 * mmToPt);
  doc.lineWidth(2).lineTo(startX + 28 * mmToPt, currentY + 5 * mmToPt);
  doc.moveTo(startX + 45 * mmToPt, currentY - 2 * mmToPt);
  doc.lineWidth(2).lineTo(startX + 45 * mmToPt, currentY + 5 * mmToPt);

  doc.font('Helvetica-Bold').fontSize(12);
  doc.text(boleto.digitableLine, startX + 45 * mmToPt, currentY, { align: 'right', width: pageWidth - 45 * mmToPt });
  currentY += cell + 3 * mmToPt;


  // Local de pagamento
  drawCell(doc, startX, currentY, 140 * mmToPt, cell, 'Local de pagamento', boleto.placeOfPayment || '', { fontSize: fcel, bold: true });
  drawCell(doc, startX + 140 * mmToPt, currentY, 40 * mmToPt, cell, 'Vencimento', moment(boleto.dueDate).utc().format('DD/MM/YYYY'), { fontSize: fcel, bold: true, align: 'right' });
  currentY += cell + 3 * mmToPt;

  // Beneficiário

  drawCell(doc, startX, currentY, 140 * mmToPt, cell, 'Beneficiário', boleto.beneficiary?.nameDocumento || boleto.beneficiary?.name || '', { fontSize: fcel, bold: true });
  drawCell(doc, startX + 140 * mmToPt, currentY, 40 * mmToPt, cell, 'Agência/Código beneficiário', boleto.beneficiary?.bankBranch || '', { fontSize: fcel, bold: true, align: 'right' });
  currentY += cell + 3 * mmToPt;

  // Data do documento
  drawCell(doc, startX, currentY, 30 * mmToPt, cell, 'Data do documento', moment().utc().format('DD/MM/YYYY'), { fontSize: fcel, bold: true });
  drawCell(doc, startX + 30 * mmToPt, currentY, 45 * mmToPt, cell, 'Número do documento', boleto.documentNumber || '', { fontSize: fcel, bold: true });
  drawCell(doc, startX + 75 * mmToPt, currentY, 20 * mmToPt, cell, 'Espécie Doc.', boleto.especieDocumento || '', { fontSize: fcel, bold: true });
  drawCell(doc, startX + 95 * mmToPt, currentY, 20 * mmToPt, cell, 'Aceite', boleto.aceite || '', { fontSize: fcel, bold: true });
  drawCell(doc, startX + 115 * mmToPt, currentY, 25 * mmToPt, cell, 'Data processamento', moment(boleto.processDate).utc().format('DD/MM/YYYY'), { fontSize: fcel, bold: true });
  drawCell(doc, startX + 140 * mmToPt, currentY, 40 * mmToPt, cell, 'Nosso número', boleto.ourNumber || '', { fontSize: fcel, bold: true, align: 'right' });
  currentY += cell + 3 * mmToPt;

  // Uso do Banco / Carteira
  drawCell(doc, startX, currentY, 75 * mmToPt, cell, 'Carteira', 'COBRANÇA SIMPLES', { fontSize: fcel, bold: true });
  drawCell(doc, startX + 75 * mmToPt, currentY, 12 * mmToPt, cell, 'Espécie', 'R$', { fontSize: fcel, bold: true });
  drawCell(doc, startX + 87 * mmToPt, currentY, 28 * mmToPt, cell, 'Quantidade', '', { fontSize: fcel, bold: true });
  drawCell(doc, startX + 115 * mmToPt, currentY, 25 * mmToPt, cell, 'Valor Documento', '', { fontSize: fcel, bold: true });
  drawCell(doc, startX + 140 * mmToPt, currentY, 40 * mmToPt, cell, 'Valor Documento', 'R$ ' + formatCurrency(boleto.amount), { fontSize: fcel, bold: true, align: 'right' });
  currentY += cell + 3 * mmToPt;

  // Instruções demonstrativo
  drawCell(doc, startX, currentY, 140 * mmToPt, cell * 5, 'Instruções de responsabilidade do beneficiário.', boleto.instructions?.join('\n'), { fontSize: fcel, bold: true });
  drawCell(doc, startX + 140 * mmToPt, currentY, 40 * mmToPt, cell, '(-) Desconto / Abatimentos', '', { fontSize: fcel, bold: true });
  currentY += cell + 3 * mmToPt;
  drawCell(doc, startX + 140 * mmToPt, currentY, 40 * mmToPt, cell, '(-) Outras deduções', '', { fontSize: fcel, bold: true });
  currentY += cell + 3 * mmToPt;
  drawCell(doc, startX + 140 * mmToPt, currentY, 40 * mmToPt, cell, '(+) Mora / Multa', '', { fontSize: fcel, bold: true });
  currentY += cell + 3 * mmToPt;
  drawCell(doc, startX + 140 * mmToPt, currentY, 40 * mmToPt, cell, '(+) Outros acréscimos', '', { fontSize: fcel, bold: true });
  currentY += cell + 3 * mmToPt;
  drawCell(doc, startX + 140 * mmToPt, currentY, 40 * mmToPt, cell, '(=) Valor cobrado', 'R$ ' + formatCurrency(boleto.amount), { fontSize: fcel, bold: true, align: 'right' });
  currentY += cell + 3 * mmToPt;


  // Pagador
  const pagador = boleto.payer?.name + ' - ' + boleto.payer?.document + '\n' + boleto.payer?.address + '\n' + boleto.payer?.addressComplement;
  drawCell(doc, startX, currentY, pageWidth, cell * 3, 'Pagador', pagador, { fontSize: fcel, bold: true });
  currentY += cell * 5;

  // Beneficiário Final
  doc.font('Helvetica').fontSize(fdes);
  doc.text('Beneficiário Final', startX, currentY);
  doc.text('', startX + 20 * mmToPt, currentY);
  doc.text('Autenticação mecânica - Ficha de Compensação', startX + 118 * mmToPt, currentY, { align: 'right', width: pageWidth - 118 * mmToPt });

  currentY += desc;

  // Código de barras (codigoBarras method)
  currentY += 3 * mmToPt;
  currentY += 15 * mmToPt; // Space for barcode
  drawITFBarcode(doc, barcode44, startX, currentY - 15 * mmToPt, 17 * mmToPt, 0.9);

  doc.end();

  return {
    barcode: barcode44,
    digitableLine: linhaDigitavel
  };
}

module.exports = {
  generateBoletoPDF
};