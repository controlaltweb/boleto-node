const { SantanderBoleto } = require('..');

// Exemplo simples de boleto Santander
const boleto = new SantanderBoleto({
  dueDate: new Date('2024-12-31'),
  amount: 10000, // R$ 100,00
  ourNumber: '1234567890',
  agency: '1234',
  account: '56789',
  wallet: '101',
  beneficiary: {
    name: 'Empresa Exemplo',
    document: '12.345.678/0001-00',
  },
  payer: {
    name: 'Cliente Exemplo',
    document: '123.456.789-09',
  },
});

console.log('=== BOLETO SANTANDER ===');
console.log('Nosso Número:', boleto.getOurNumber());
console.log('Linha Digitável:', boleto.getDigitableLine());
console.log('Código de Barras:', boleto.getBarcode());

// Gera PDF
const result = boleto.generatePDF({ filePath: 'boleto-simples.pdf' });
console.log('PDF gerado com sucesso!');
