const path = require('path');
const { SicrediBoleto } = require('..');

async function run() {
  try {
    // Dados do boleto Sicredi
    const boletoData = {
      // Dados básicos
      dueDate: new Date('2025-11-20'),
      amount: 320000, // R$ 250,00 (em centavos)
      ourNumber: '082806', // Nosso número (será formatado para 9 dígitos + DV)
      documentNumber: 'NF-002345',
      
      // Dados específicos do Sicredi
      agency: '0737', // 4 dígitos
      account: '30684', // 5 dígitos
      wallet: '1', // Carteira (1 ou 3)
      posto: '42', // Posto do beneficiário (2 dígitos)
      byte: '2', // Byte de identificação (1 dígito, padrão '2' para cobrança com registro)
      clientCode: '30684', // Código do cliente (5 dígitos)
      
      // Dados do beneficiário
      beneficiary: {
        name: 'SISTEMA CLUBE DE COMUNICAÇÃO LTDA',
        document: '46.665.188/0001-98',
        bankBranch: '0737', //0737	306846
        bankAccount: '30684-6',
        address: 'Av. Nove de Julho, 606 - Ribeirão Preto/SP',
      },
      
      // Dados do pagador
      payer: {
        name: 'Maria da Silva',
        document: '987.654.321-00',
        address: 'Rua do Associado, 456 - Caxias do Sul/RS',
      },
      
      // Informações adicionais
      placeOfPayment: 'Pagável em qualquer banco até o vencimento',
      instructions: [
        'Não receber após 30 dias do vencimento.',
        'Em caso de dúvidas, contate a cooperativa.',
        'Multa de 2% após o vencimento.',
        'Juros de 1% ao mês.',
      ],
    };

    // Cria a instância do boleto Sicredi
    const boleto = new SicrediBoleto(boletoData);

    // Exibe informações do boleto
    console.log('=== BOLETO SICREDI ===');
    console.log('Banco:', boleto.bankInfo.name);
    console.log('Nosso Número:', boleto.getOurNumber());
    console.log('Campo Livre:', boleto.getFreeField());
    console.log('Código de Barras:', boleto.getBarcode());
    console.log('Linha Digitável:', boleto.getDigitableLine());
    console.log('');

    // Informações específicas do Sicredi
    console.log('=== INFORMAÇÕES SICREDI ===');
    const sicrediInfo = boleto.getSicrediInfo();
    console.log('Agência:', sicrediInfo.agency);
    console.log('Conta:', sicrediInfo.account);
    console.log('Carteira:', sicrediInfo.wallet);
    console.log('Posto:', sicrediInfo.posto);
    console.log('Byte:', sicrediInfo.byte);
    console.log('Código Cliente:', sicrediInfo.clientCode);
    console.log('');

    // Gera o PDF
    const filePath = path.join(__dirname, 'boleto-sicredi.pdf');
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
