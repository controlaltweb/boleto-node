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
function modulo11(number, options) {
  const { base = 9, remainderMode = 'banco' } = options || {};
  const digits = onlyNumbers(number).split('').reverse();
  let weight = 2;
  let sum = 0;
  for (const d of digits) {
    sum += Number(d) * weight;
    weight = weight >= base ? 2 : weight + 1;
  }
  const remainder = sum % 11;
  if (remainderMode === 'banco') {
    const dv = 11 - remainder;
    if (dv === 0 || dv === 10 || dv === 11) return 0; // banking convention
    return dv;
  }
  // generic remainder result
  return remainder;
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

 const dv = modulo11(codigoBanco, { base: 9, remainderMode: 'banco', x10 });

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