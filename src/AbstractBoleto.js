const { buildBarcode, buildDigitableLine } = require('./barcode');
const { generateBoletoPDF } = require('./pdf');
const { getBankInfo, leftPad, onlyNumbers, dateToFatorVencimento, amountToBoleto } = require('./utils');
const moment = require('moment');

/**
 * Classe base abstrata para geração de boletos bancários
 * Baseada na estrutura da lib laravel-boleto
 */
class AbstractBoleto {
  constructor(data) {
    this.validateData(data);
    
    // Dados básicos do boleto
    this.bankCode = data.bankCode;
    this.currencyCode = data.currencyCode || '9';
    this.dueDate = moment(data.dueDate).toDate();
    this.processDate = moment(data.processDate).toDate() || new Date();
    this.amount = data.amount; // em centavos
    this.ourNumber = data.ourNumber;
    this.documentNumber = data.documentNumber;
    this.especieDocumento = data.especieDocumento || 'DM';
    this.aceite = data.aceite || 'N';
    
    // Dados do beneficiário
    this.beneficiary = data.beneficiary || {};
    
    // Dados do pagador
    this.payer = data.payer || {};
    
    // Informações adicionais
    this.placeOfPayment = data.placeOfPayment || 'Pagável em qualquer banco até o vencimento';
    this.instructions = data.instructions || [];
    
    // Dados específicos do banco (agência, conta, carteira)
    this.agency = data.agency;
    this.account = data.account;
    this.wallet = data.wallet;
    
    // Campos calculados
    this._barcode = null;
    this._digitableLine = null;
    this._freeField = null;
    
    // Informações do banco
    this.bankInfo = getBankInfo(this.bankCode);
  }

  /**
   * Valida os dados obrigatórios
   */
  validateData(data) {
    const required = ['bankCode', 'dueDate', 'amount', 'ourNumber'];
    for (const field of required) {
      if (!data[field]) {
        throw new Error(`Campo obrigatório não informado: ${field}`);
      }
    }
  }

  /**
   * Gera o nosso número específico do banco
   * Deve ser implementado pelas classes filhas
   */
  generateOurNumber() {
    throw new Error('Método generateOurNumber deve ser implementado pela classe filha');
  }

  /**
   * Gera o campo livre específico do banco
   * Deve ser implementado pelas classes filhas
   */
  generateFreeField() {
    throw new Error('Método generateFreeField deve ser implementado pela classe filha');
  }

  /**
   * Retorna o nosso número formatado
   */
  getOurNumber() {
    if (!this._ourNumber) {
      this._ourNumber = this.generateOurNumber();
    }
    return this._ourNumber;
  }

  /**
   * Retorna o campo livre formatado
   */
  getFreeField() {
    if (!this._freeField) {
      this._freeField = this.generateFreeField();
    }
    return this._freeField;
  }

  /**
   * Gera o código de barras de 44 dígitos
   */
  getBarcode() {
    if (!this._barcode) {
      const dueFactor = dateToFatorVencimento(this.dueDate);
      const amountStr = amountToBoleto(this.amount);
      
      this._barcode = buildBarcode({
        bankCode: this.bankCode,
        currencyCode: this.currencyCode,
        dueFactor,
        amount: amountStr,
        freeField: this.getFreeField(),
      });
    }
    return this._barcode;
  }

  /**
   * Gera a linha digitável de 47 dígitos
   */
  getDigitableLine() {
    if (!this._digitableLine) {
      this._digitableLine = buildDigitableLine(this.getBarcode());
    }
    return this._digitableLine;
  }

  /**
   * Gera o PDF do boleto
   */
  generatePDF(options = {}) {
    const boletoData = {
      bankCode: this.bankCode,
      currencyCode: this.currencyCode,
      dueDate: this.dueDate,
      amount: this.amount,
      freeField: this.getFreeField(),
      barcode: this.getBarcode(),
      digitableLine: this.getDigitableLine(),
      payer: this.payer,
      beneficiary: this.beneficiary,
      ourNumber: this.getOurNumber(),
      documentNumber: this.documentNumber,
      placeOfPayment: this.placeOfPayment,
      instructions: this.instructions,
      especieDocumento: this.especieDocumento,
      aceite: this.aceite,
      processDate: this.processDate,
    };

    return generateBoletoPDF(boletoData, options);
  }

  /**
   * Retorna os dados do boleto em formato de objeto
   */
  toObject() {
    return {
      bankCode: this.bankCode,
      bankName: this.bankInfo.name,
      currencyCode: this.currencyCode,
      dueDate: this.dueDate,
      amount: this.amount,
      ourNumber: this.getOurNumber(),
      documentNumber: this.documentNumber,
      barcode: this.getBarcode(),
      digitableLine: this.getDigitableLine(),
      freeField: this.getFreeField(),
      payer: this.payer,
      beneficiary: this.beneficiary,
      placeOfPayment: this.placeOfPayment,
      instructions: this.instructions,
    };
  }

  /**
   * Retorna os dados do boleto em formato JSON
   */
  toJSON() {
    return JSON.stringify(this.toObject(), null, 2);
  }
}

module.exports = AbstractBoleto;
