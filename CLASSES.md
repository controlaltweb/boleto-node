# Classes de Boleto Bancário

Este documento descreve como usar as classes de boleto bancário baseadas na estrutura da lib laravel-boleto.

## Estrutura das Classes

### AbstractBoleto

Classe base abstrata que define a interface comum para todos os boletos bancários.

**Métodos principais:**
- `getOurNumber()` - Retorna o nosso número formatado
- `getBarcode()` - Gera o código de barras de 44 dígitos
- `getDigitableLine()` - Gera a linha digitável de 47 dígitos
- `generatePDF(options)` - Gera o PDF do boleto
- `toObject()` - Retorna os dados do boleto em formato de objeto
- `toJSON()` - Retorna os dados do boleto em formato JSON

### SantanderBoleto

Classe específica para boletos do Banco Santander (033) que estende `AbstractBoleto`.

**Especificidades do Santander:**
- Nosso número: 10 dígitos + DV (módulo 11)
- Campo livre: 9 dígitos (agência + conta) + 1 dígito (carteira) + 10 dígitos (nosso número) + 1 dígito (DV) + 4 dígitos (zeros)
- Carteiras válidas: 101, 102, 121, 150, 175

## Exemplo de Uso

### Boleto Santander

```javascript
const { SantanderBoleto } = require('boleto-node');

// Dados do boleto
const boletoData = {
  // Dados básicos
  dueDate: new Date('2024-12-31'),
  amount: 15000, // R$ 150,00 (em centavos)
  ourNumber: '1234567890',
  documentNumber: 'NF-001234',
  
  // Dados específicos do Santander
  agency: '1234', // 4 dígitos
  account: '56789', // 5 dígitos
  wallet: '101', // Carteira
  range: '101', // Range padrão
  clientCode: '1234567', // Código do cliente
  
  // Dados do beneficiário
  beneficiary: {
    name: 'ACME LTDA',
    document: '12.345.678/0001-00',
    address: 'Rua das Empresas, 123 - São Paulo/SP',
  },
  
  // Dados do pagador
  payer: {
    name: 'João da Silva',
    document: '123.456.789-09',
    address: 'Rua do Cliente, 456 - Rio de Janeiro/RJ',
  },
  
  // Informações adicionais
  placeOfPayment: 'Pagável em qualquer banco até o vencimento',
  instructions: [
    'Não receber após 30 dias do vencimento.',
    'Em caso de dúvidas, contate o beneficiário.',
  ],
};

// Cria a instância do boleto
const boleto = new SantanderBoleto(boletoData);

// Obtém informações do boleto
console.log('Nosso Número:', boleto.getOurNumber());
console.log('Código de Barras:', boleto.getBarcode());
console.log('Linha Digitável:', boleto.getDigitableLine());

// Gera o PDF
const result = boleto.generatePDF({ filePath: 'boleto.pdf' });
console.log('PDF gerado:', result);

// Obtém dados completos
const dados = boleto.toObject();
console.log('Dados completos:', dados);
```

## Dados Obrigatórios

### Para AbstractBoleto:
- `bankCode` - Código do banco
- `dueDate` - Data de vencimento
- `amount` - Valor em centavos
- `ourNumber` - Nosso número

### Para SantanderBoleto (além dos dados básicos):
- `agency` - Agência (4 dígitos)
- `account` - Conta (5 dígitos)
- `wallet` - Carteira (101, 102, 121, 150, 175)

## Validações

A classe `SantanderBoleto` inclui validações específicas:
- Agência deve ter exatamente 4 dígitos
- Conta deve ter exatamente 5 dígitos
- Carteira deve ser uma das válidas para o Santander
- Nosso número é obrigatório

## Extensibilidade

Para criar boletos de outros bancos, estenda a classe `AbstractBoleto` e implemente os métodos:
- `generateOurNumber()` - Geração específica do nosso número
- `generateFreeField()` - Geração específica do campo livre

Exemplo:

```javascript
class BancoBoleto extends AbstractBoleto {
  generateOurNumber() {
    // Implementação específica do banco
  }
  
  generateFreeField() {
    // Implementação específica do banco
  }
}
```

## Compatibilidade

As funções utilitárias originais (`generateBoletoPDF`, `buildBarcode`, `buildDigitableLine`) continuam disponíveis para manter compatibilidade com código existente.
