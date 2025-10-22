const AbstractBoleto = require('../AbstractBoleto');
const { leftPad, onlyNumbers, modulo11 } = require('../utils');

/**
 * Classe para geração de boletos do Banco Sicredi (748)
 * Estende AbstractBoleto e implementa as especificidades do Sicredi
 */
class SicrediBoleto extends AbstractBoleto {
  constructor(data) {
    // Define o código do banco Sicredi
    data.bankCode = '748';
    super(data);
    
    // Dados específicos do Sicredi
    this.posto = data.posto; // Posto do beneficiário (2 dígitos)
    this.byte = data.byte || '2'; // Byte de identificação (1 dígito, padrão '2' para cobrança com registro)
    this.clientCode = data.clientCode; // Código do cliente (5 dígitos)
    this.withRegistry = data.withRegistry ?? 1; // 1 == with registry, 0 == without registry
    this.ourNumber = data.ourNumber ? leftPad(data.ourNumber.slice(-5), 5, '0') : '';
  }

  /**
   * Gera o nosso número específico do Sicredi
   * Formato: 9 dígitos com DV
   */
  generateOurNumber() {
    if (!this.ourNumber) {
      throw new Error('Nosso número deve ser informado para o Sicredi');
    }
    
    const year = this.dueDate.getFullYear().toString().substring(2);
    // Remove caracteres não numéricos
    const nossoNumero = onlyNumbers(this.ourNumber);
    
    const nossoNumeroPadded = leftPad(nossoNumero, 5, '0');
    
    
    // Calcula o DV usando módulo 11 específico do Sicredi
    const dv = this.calculateSicrediDV(nossoNumeroPadded, year);
    
    return year + this.byte + nossoNumeroPadded + dv;
  }

  /**
   * Calcula o dígito verificador específico do Sicredi
   * Usa módulo 11 com pesos 2-9
   */
  calculateSicrediDV(number, year) {
    const nn = leftPad(this.agency, 4, '0') + leftPad(this.posto, 2, '0') + leftPad(this.clientCode, 5, '0') + year + this.byte + number;
    return modulo11(nn);
  }

  /**
   * Gera o campo livre específico do Sicredi
   * Layout: 9 dígitos (nosso número) + 2 dígitos (posto) + 1 dígito (byte) + 4 dígitos (agência) + 5 dígitos (conta) + 1 dígito (DV) + 3 dígitos (zeros)
   * Total: 25 dígitos
   */
  generateFreeField() {
    if (!this.agency || !this.account || !this.posto || !this.clientCode) {
      throw new Error('Agência, conta, posto e código do cliente são obrigatórios para o Sicredi');
    }

    // Remove caracteres não numéricos
    const agency = onlyNumbers(this.agency);
    const account = onlyNumbers(this.account);
    const posto = onlyNumbers(this.posto);
    const clientCode = onlyNumbers(this.clientCode);
    
    // Nosso número com DV (10 dígitos)
    const nossoNumeroComDV = this.generateOurNumber();
    
    // Posto (2 dígitos)
    const postoPadded = leftPad(posto, 2, '0');
    
    // Byte (1 dígito)
    const bytePadded = leftPad(this.byte, 1, '0');
    
    // Agência (4 dígitos)
    const agencyPadded = leftPad(agency, 4, '0');
    
    // Conta (5 dígitos)
    const accountPadded = leftPad(account, 5, '0');

    const clientCodePadded = leftPad(clientCode, 5, '0');
    
    // Monta o campo livre sem DV
    const freeFieldWithoutDV = this.withRegistry + this.wallet + nossoNumeroComDV + agencyPadded + postoPadded + clientCodePadded + '10';
    // Calcula o DV do campo livre
    const freeFieldWithDV= freeFieldWithoutDV + modulo11(freeFieldWithoutDV);
  
    
    // Garante que o campo livre tenha exatamente 25 dígitos
    return freeFieldWithDV;
  }

  /**
   * Valida os dados específicos do Sicredi
   */
  validateSicrediData() {
    const required = ['agency', 'account', 'posto', 'clientCode', 'ourNumber'];
    for (const field of required) {
      if (!this[field]) {
        throw new Error(`Campo obrigatório para Sicredi não informado: ${field}`);
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
    
    // Valida formato do posto (2 dígitos)
    if (onlyNumbers(this.posto).length !== 2) {
      throw new Error('Posto deve ter 2 dígitos');
    }
    
    // Valida formato do código do cliente (5 dígitos)
    if (onlyNumbers(this.clientCode).length !== 5) {
      throw new Error('Código do cliente deve ter 5 dígitos');
    }
    
    // Valida byte (1 dígito)
    if (onlyNumbers(this.byte).length !== 1) {
      throw new Error('Byte deve ter 1 dígito');
    }
    
    // Valida carteira (geralmente '1' para Sicredi)
    const validWallets = ['1', '3'];
    if (!validWallets.includes(this.wallet)) {
      console.warn(`Carteira ${this.wallet} pode não ser válida para o Sicredi`);
    }
  }

  /**
   * Retorna informações específicas do Sicredi
   */
  getSicrediInfo() {
    return {
      bankCode: '748',
      bankName: 'Banco Cooperativo Sicredi S.A.',
      posto: this.posto,
      byte: this.byte,
      clientCode: this.clientCode,
      agency: this.agency,
      account: this.account,
      wallet: this.wallet,
      ourNumber: this.getOurNumber(),
      freeField: this.getFreeField(),
    };
  }

  /**
   * Sobrescreve o método toObject para incluir informações específicas do Sicredi
   */
  toObject() {
    const baseObject = super.toObject();
    return {
      ...baseObject,
      sicredi: this.getSicrediInfo(),
    };
  }
}

module.exports = SicrediBoleto;
