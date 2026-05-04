const dotenv = require('dotenv');
dotenv.config();

console.log('--- SURGICORP PROXY CONFIG ---');
console.log('API_URL:', process.env.API_URL);
console.log('------------------------------');

const PROXY_CONFIG = [
  {
    context: [
      "/api",
      "/StockAprobado"
    ],
    target: process.env.API_URL,
    secure: true,
    changeOrigin: true,
    pathRewrite: {
      "^/api-proxy": "" // Mantenido por compatibilidad si se usa accidentalmente
    },
    logLevel: "debug"
  }
];

module.exports = PROXY_CONFIG;
