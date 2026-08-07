
      /*
    MIT License
    
    Copyright (c) 2025 Christian I. Cabrera || XianFire Framework
    Mindoro State University - Philippines

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in all
    copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
    SOFTWARE.
    */
    
import { Sequelize } from "sequelize";

const databaseUrl = process.env.DATABASE_URL || "";
const inferredDbDialect = databaseUrl.startsWith("postgres://") || databaseUrl.startsWith("postgresql://")
  ? "postgres"
  : databaseUrl.startsWith("mysql://")
  ? "mysql"
  : null;
const dbDialect = process.env.DB_DIALECT || inferredDbDialect || "mysql";
const dbName = process.env.DB_NAME || "plshey";
const dbUser = process.env.DB_USER || "root";
const dbPass = process.env.DB_PASS || "";
const dbHost = process.env.DB_HOST || "localhost";
const dbPort = process.env.DB_PORT
  ? Number(process.env.DB_PORT)
  : dbDialect === "postgres"
  ? 5432
  : 3306;

const dialectOptions = {
  connectTimeout: 10000
};

if (dbDialect === "postgres") {
  dialectOptions.ssl = { rejectUnauthorized: false };
}

const connectionOptions = {
  host: dbHost,
  port: dbPort,
  dialect: dbDialect,
  dialectOptions
};

export const sequelize = databaseUrl
  ? new Sequelize(databaseUrl, { dialect: dbDialect, dialectOptions })
  : new Sequelize(dbName, dbUser, dbPass, connectionOptions);