const path = require('path');
const envFilePath = path.resolve(__dirname, '../.env');
require('dotenv').config({ path: envFilePath });
module.exports = {
  APP_PORT: process.env.APP_PORT,
  DB_HOST: process.env.DB_HOST ,
  DB_PORT: process.env.DB_PORT,
  DB_USER: process.env.DB_USER,
  DB_PASSWORD: process.env.DB_PASSWORD,
  DB_NAME: process.env.DB_NAME,
  DATABASE_URL: process.env.DATABASE_URL,
};
