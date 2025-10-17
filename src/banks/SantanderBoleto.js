const AbstractBoleto = require('../AbstractBoleto');
const { leftPad, onlyNumbers, modulo11 } = require('../utils');

/**
 * Classe para geração de boletos do Banco Santander (033)
 * Estende AbstractBoleto e implementa as especificidades do Santander
 */
class SantanderBoleto extends AbstractBoleto {
  constructor(data) {
    // Define o código do banco Santander
    data.bankCode = '033';
    super(data);
    
    // Dados específicos do Santander
    this.range = data.range || '101'; // Range padrão do Santander
    this.clientCode = data.clientCode; // Código do cliente no Santander
  }

  /**
   * Gera o nosso número específico do Santander
   * Formato: 10 dígitos com DV
   */
  generateOurNumber() {
    if (!this.ourNumber) {
      throw new Error('Nosso número deve ser informado para o Santander');
    }
    
    // Remove caracteres não numéricos
    const nossoNumero = onlyNumbers(this.ourNumber);
    
    // Garante que tenha no máximo 10 dígitos
    const nossoNumeroPadded = leftPad(nossoNumero, 12, '0');
    
    // Calcula o DV usando módulo 11
    const dv = modulo11(nossoNumeroPadded, { base: 9, remainderMode: 'banco' });
    
    return nossoNumeroPadded + dv;
  }

  /**
   * Gera o campo livre específico do Santander
   * Layout: 9 dígitos (agência + conta) + 1 dígito (carteira) + 10 dígitos (nosso número) + 1 dígito (DV) + 4 dígitos (zeros)
   * Total: 25 dígitos
   */
  generateFreeField() {
    if (!this.agency || !this.account || !this.wallet) {
      throw new Error('Agência, conta e carteira são obrigatórios para o Santander');
    }

    // Remove caracteres não numéricos
    // const agency = onlyNumbers(this.agency);
    // const account = onlyNumbers(this.account);
    const wallet = onlyNumbers(this.wallet);
    
    // Agência + conta (9 dígitos)
    const clientCode = leftPad(onlyNumbers(this.clientCode).substring(0, 7), 7, '0');
    
    // Carteira (1 dígito)
    const walletPadded = leftPad(wallet.substring(0, 3), 3, '0');
    
    // Nosso número com DV (11 dígitos)
    const nossoNumeroComDV = this.generateOurNumber();
    
    const freeField = '9' + clientCode + nossoNumeroComDV + '0' + walletPadded;
    
    // Garante que o campo livre tenha exatamente 25 dígitos
    return leftPad(freeField, 25, '0').slice(0, 25);
  }

  /**
   * Valida os dados específicos do Santander
   */
  validateSantanderData() {
    const required = ['agency', 'account', 'wallet', 'ourNumber'];
    for (const field of required) {
      if (!this[field]) {
        throw new Error(`Campo obrigatório para Santander não informado: ${field}`);
      }
    }
    
    // Valida formato da agência (4 dígitos)
    if (onlyNumbers(this.agency).length !== 4) {
      throw new Error('Agência deve ter 4 dígitos');
    }
    
    // Valida formato da conta (5 dígitos)
    if (onlyNumbers(this.account).length !== 5) {
      throw new Error('Conta deve ter 5 dígitos');
    }
    
    // Valida carteira (101, 102, 121, etc.)
    const validWallets = ['101', '102', '121', '150', '175'];
    if (!validWallets.includes(this.wallet)) {
      console.warn(`Carteira ${this.wallet} pode não ser válida para o Santander`);
    }
  }

  /**
   * Retorna informações específicas do Santander
   */
  getSantanderInfo() {
    return {
      bankCode: '033',
      bankName: 'Banco Santander (Brasil) S.A.',
      range: this.range,
      clientCode: this.clientCode,
      agency: this.agency,
      account: this.account,
      wallet: this.wallet,
      ourNumber: this.getOurNumber(),
      freeField: this.getFreeField(),
    };
  }

  /**
   * Sobrescreve o método toObject para incluir informações específicas do Santander
   */
  toObject() {
    const baseObject = super.toObject();
    return {
      ...baseObject,
      santander: this.getSantanderInfo(),
    };
  }
}

module.exports = SantanderBoleto;
