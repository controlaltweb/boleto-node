const path = require('path');
const fs = require('fs');

// Load from bancos.json and build map by code
function loadBanksFromJson() {
  // Updated to read from src/assets/bancos.json
  const jsonPath = path.join(__dirname, 'assets', 'bancos.json');
  const raw = fs.readFileSync(jsonPath, 'utf8');
  const list = JSON.parse(raw);
  const map = {};
  for (const item of list) {
    const code = String(item.code || '').padStart(3, '0');
    map[code] = {
      code,
      name: item.name || `Banco ${code}`,
      // logos now use COMPE code filenames, e.g., 341.svg
      logo: `${code}.svg`,
    };
  }
  return map;
}

const BANKS = loadBanksFromJson();

module.exports = {
  BANKS,
};


