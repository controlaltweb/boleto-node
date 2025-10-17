const { SicrediBoleto } = require('..');

// Exemplo simples de boleto Sicredi
const boleto = new SicrediBoleto({
  dueDate: new Date('2024-12-31'),
  amount: 20000, // R$ 200,00
  ourNumber: '123456789',
  agency: '1234',
  account: '56789',
  wallet: '1',
  posto: '11',
  byte: '2',
  clientCode: '12345',
  beneficiary: {
    name: 'Cooperativa Sicredi',
    document: '12.345.678/0001-00',
  },
  payer: {
    name: 'Associado Exemplo',
    document: '123.456.789-09',
  },
});

console.log('=== BOLETO SICREDI ===');
console.log('Nosso Número:', boleto.getOurNumber());
console.log('Linha Digitável:', boleto.getDigitableLine());
console.log('Código de Barras:', boleto.getBarcode());

// Gera PDF
const result = boleto.generatePDF({ filePath: 'boleto-sicredi-simples.pdf' });
console.log('PDF gerado com sucesso!');
