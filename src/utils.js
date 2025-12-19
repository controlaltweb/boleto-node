// Utility functions for boleto calculations
const path = require('path');
const { BANKS } = require('./banks');

function onlyNumbers(value) {
  return String(value || '').replace(/\D+/g, '');
}

function leftPad(value, length, char) {
  const s = String(value ?? '');
  if (s.length >= length) return s;
  return char.repeat(length - s.length) + s;
}

function modulo10(number) {
  const digits = onlyNumbers(number).split('').reverse();
  let sum = 0;
  let weight = 2;
  for (const d of digits) {
    const n = Number(d) * weight;
    sum += Math.floor(n / 10) + (n % 10);
    weight = weight === 2 ? 1 : 2;
  }
  const mod = sum % 10;
  return mod === 0 ? 0 : 10 - mod;
}

// modulo11 for boleto: factors 2..9 cycling; returns DV with special cases
function modulo11(number, factor = 2, base = 9, x10 = 0, resto10 = 0) {
  let n = onlyNumbers(number);
  let sum = 0;

  for (let i = n.length; i > 0; i--) {
    sum += parseInt(n[i - 1], 10) * factor;
    if (factor === base) {
      factor = 1;
    }
    factor++;
  }

  if (x10 === 0) {
    sum *= 10;
    let digito = sum % 11;
    if (digito === 10) {
      digito = resto10;
    }
    return digito;
  }

  return sum % 11;

}

function amountToBoleto(centAmount) {
  // value with 10 digits, last 2 are cents
  const cents = Number(centAmount || 0);
  return leftPad(String(cents), 10, '0');
}

function dateToFatorVencimento(date) {
  // Factor is days since 2025-02-22
  const base = new Date(Date.UTC(2025, 2, 22));
  const d = new Date(date);
  const utc = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const diffMs = utc - base;
  const days = Math.round(diffMs / (24 * 60 * 60 * 1000));
  return leftPad(String(days), 4, '0');
}

function getCodigoBancoComDv(codigoBanco) {
  // COD_BANCO_CEF = '104', COD_BANCO_AILOS = '085'
  const semX = ['104', '085'];
  const x10 = semX.includes(codigoBanco) ? 0 : 'X';

  const dv = modulo11(codigoBanco, 2, 9, 0);

  return `${codigoBanco}-${dv}`;
}

function getBankInfo(bankCode) {
  const code = String(bankCode || '').padStart(3, '0');
  const info = BANKS[code];
  if (info) return info;
  return { code, name: `Banco ${code}`, logo: null };
}

function getBankLogoPath(bankCode) {
  return path.join(__dirname, 'assets', 'banks', `${leftPad(bankCode, 3, '0')}.png`);
}

module.exports = {
  onlyNumbers,
  leftPad,
  modulo10,
  modulo11,
  amountToBoleto,
  dateToFatorVencimento,
  getBankInfo,
  getBankLogoPath,
  getCodigoBancoComDv
};