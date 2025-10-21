const path = require('path');
const { SantanderBoleto } = require('..');

async function run() {
  try {
    // Dados do boleto Santander
    const boletoData = {
      // Dados básicos
      dueDate: new Date('2025-11-17'),
      amount: 495000, // R$ 150,00 (em centavos)
      ourNumber: '20148', // Nosso número (será formatado para 10 dígitos + DV)
      documentNumber: 'NF-001234',
      especieDocumento: 'DM',
      aceite: 'N',
      processDate: new Date('2025-10-10'),
      
      // Dados específicos do Santander
      agency: '742', // 4 dígitos
      account: '07424734942', // 5 dígitos
      wallet: '101', // Carteira (101, 102, 121, 150, 175)
      range: '101', // Range padrão
      clientCode: '3824527', // Código do cliente no Santander
      
      // Dados do beneficiário
      beneficiary: {
        name: 'SISTEMA CLUBE DE COMUNICAÇÃO LTDA',
        document: '46.665.188/0001-98',
        bankBranch: '0742',
        bankAccount: '73494',
        address: 'Av. Nove de Julho, 606',
        addressComplement: '14025-000 - Ribeirão Preto/SP',
        logoPath: '/Users/valerioguimaraes/Development/web/simac-4.0-api/assets/logo-clube.png',
      },
      
      // Dados do pagador
      payer: {
        name: 'João da Silva',
        document: '11.043.798/0001-75',
        address: 'Rua do Cliente, 456',
        addressComplement: 'CEP: 20000-000 - Rio de Janeiro/RJ',
      },
      
      // Informações adicionais
      placeOfPayment: 'Pagável em qualquer banco até o vencimento',
      instructions: [
        'Não receber após 30 dias do vencimento.',
        'Em caso de dúvidas, contate o beneficiário.',
        'Multa de 2% após o vencimento.',
      ],
    };

    // Cria a instância do boleto Santander
    const boleto = new SantanderBoleto(boletoData);

    // Exibe informações do boleto
    console.log('=== BOLETO SANTANDER ===');
    console.log('Banco:', boleto.bankInfo.name);
    console.log('Nosso Número:', boleto.getOurNumber());
    console.log('Campo Livre:', boleto.getFreeField());
    console.log('Código de Barras:', boleto.getBarcode());
    console.log('Linha Digitável:', boleto.getDigitableLine());
    console.log('');

    // Informações específicas do Santander
    console.log('=== INFORMAÇÕES SANTANDER ===');
    const santanderInfo = boleto.getSantanderInfo();
    console.log('Agência:', santanderInfo.agency);
    console.log('Conta:', santanderInfo.account);
    console.log('Carteira:', santanderInfo.wallet);
    console.log('Range:', santanderInfo.range);
    console.log('Código Cliente:', santanderInfo.clientCode);
    console.log('');

    // Gera o PDF
    const filePath = path.join(__dirname, 'boleto-santander.pdf');
    const result = boleto.generatePDF({ filePath });
    
    console.log('=== PDF GERADO ===');
    console.log('Arquivo:', filePath);
    console.log('Código de Barras:', result.barcode);
    console.log('Linha Digitável:', result.digitableLine);
    console.log('');

    // Exibe o objeto completo
    console.log('=== OBJETO COMPLETO ===');
    console.log(JSON.stringify(boleto.toObject(), null, 2));

  } catch (error) {
    console.error('Erro ao gerar boleto:', error.message);
    console.error(error.stack);
  }
}

run();
