# node-boleto

Gerador de Boleto Bancário em PDF para Node.js, inspirado em convenções FEBRABAN e na organização do projeto em PHP [Laravel Boleto](https://github.com/controlaltweb/laravel-boleto).

O PDF é gerado com PDFKit e o código de barras no padrão Interleaved 2 of 5 (ITF) é desenhado programaticamente. A linha digitável e o dígito verificador do código de barras são calculados via módulo 10 e módulo 11.

- **PDF**: PDFKit
- **Cód. de barras**: ITF (Interleaved 2 of 5)
- **Linha digitável**: 5 campos com DV (módulo 10)
- **DV geral do código de barras**: módulo 11 (convenção bancária)
- **Logos de bancos**: SVG via `svg-to-pdfkit`, baseados no repositório público [Bancos em SVG](https://github.com/Tgentil/Bancos-em-SVG)

Atenção: o campo livre (25 dígitos) é específico por banco/carteira. Esta biblioteca fornece um gerador genérico; para produção, implemente a montagem do `freeField` de acordo com o layout do seu banco.

## Instalação

```bash
npm install node-boleto
```

Dependências principais:
- `pdfkit`
- `svg-to-pdfkit`
- `moment`

## Uso rápido

```javascript
const { generateBoletoPDF } = require('node-boleto');

generateBoletoPDF({
  bankCode: '341',           // Itaú
  currencyCode: '9',         // Real
  dueDate: new Date(),
  amount: 123456,            // em centavos. Ex.: 123456 => R$ 1.234,56
  freeField: '0000000000000000000000000', // 25 dígitos (APENAS EXEMPLO)
  payer: { name: 'Fulano', document: '123.456.789-09', address: 'Rua Exemplo, 100' },
  beneficiary: { name: 'ACME', document: '12.345.678/0001-00', bankBranch: '1234-5', bankAccount: '67890-1' },
  ourNumber: '12345678901',
  documentNumber: 'NF 12345',
  placeOfPayment: 'Pagável em qualquer banco até o vencimento',
  instructions: ['Não receber após 30 dias do vencimento.'],
}, { filePath: './boleto.pdf' });
```

O PDF será salvo em `./boleto.pdf`. A função também retorna `{ barcode, digitableLine }`.

## Exemplo no repositório

```bash
node examples/simple.js
```

## API

### generateBoletoPDF(data, options)
Gera o PDF do boleto e retorna dados calculados.

- `data`
  - `bankCode` (string, 3 dígitos): código do banco (ex.: `001`, `104`, `237`, `341`)
  - `currencyCode` (string, default `9`): código da moeda (9 = Real)
  - `dueDate` (Date|string): data de vencimento
  - `amount` (number): valor em centavos
  - `freeField` (string, 25 dígitos): campo livre conforme layout do banco
  - `payer` (objeto opcional): `{ name, document, address }`
  - `beneficiary` (objeto opcional): `{ name, document, bankBranch, bankAccount }`
  - `ourNumber` (string opcional)
  - `documentNumber` (string opcional)
  - `placeOfPayment` (string opcional)
  - `instructions` (string[] opcional)

- `options`
  - `filePath` (string): caminho do arquivo de saída
  - `stream` (WritableStream): alternativa ao `filePath`

- Retorno
  - `{ barcode: string, digitableLine: string }`

### buildBarcode({ bankCode, currencyCode, dueFactor, amount, freeField })
Monta o código de barras (44 dígitos). Útil para cenários avançados.

### buildDigitableLine(barcode44)
Monta a linha digitável (47 dígitos formatados) a partir do código de barras de 44 dígitos.

### utils
- `modulo10(number)`
- `modulo11(number)`
- `dateToFatorVencimento(date)`
- `amountToBoleto(centAmount)`

## Logos de bancos

O cabeçalho do PDF exibe o código e o nome oficial do banco e tenta renderizar o logotipo SVG correspondente se o arquivo existir em `src/assets/banks/`.

- Mapeamento mínimo em `src/banks.js`. Ex.: `341` → `Itaú Unibanco S.A` → `Itaú Unibanco S.A.svg`
- SVGs podem ser obtidos do repositório público: [Bancos em SVG](https://github.com/Tgentil/Bancos-em-SVG)
- Caso o SVG não exista, um placeholder é usado.

Para adicionar novos bancos:
1. Baixe/adicione o SVG em `src/assets/banks/<Nome do Banco>.svg` (2500x2500 recomendado)
2. Inclua a entrada no `src/banks.js`:
```js
'999': { code: '999', name: 'Banco Exemplo', svg: 'Banco Exemplo.svg' }
```

## Observações importantes

- O campo livre (`freeField`, 25 dígitos) depende do banco/carteira e da contratação. Consulte a documentação do seu banco.
- Esta biblioteca não envia arquivos de remessa nem lê retorno; foca apenas na geração visual do boleto em PDF.
- Para regras completas de bancos, o projeto em PHP serve como referência de layouts e validações: [Laravel Boleto](https://github.com/controlaltweb/laravel-boleto).

## Licença

MIT

## Referências
- Laravel Boleto (PHP): `https://github.com/controlaltweb/laravel-boleto`
- Logos de Bancos em SVG: `https://github.com/Tgentil/Bancos-em-SVG`
