const winston = require('winston');
const path = require('path');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.json()
  ),
  transports: [
    // Usamos path.join para asegurar que apunte a la carpeta 'logs' existente
    new winston.transports.File({ 
        filename: path.join(__dirname, '../logs/error.log'), 
        level: 'error' 
    }),
    new winston.transports.File({ 
        filename: path.join(__dirname, '../logs/combined.log') 
    }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

module.exports = logger;