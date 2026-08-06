import { DataTypes } from 'sequelize';
import { sequelize } from './db.js';

export const PortfolioAccess = sequelize.define('portfolio_accesses', {
  ownerUserId: { type: DataTypes.INTEGER, allowNull: false },
  allowedUserId: { type: DataTypes.INTEGER, allowNull: false },
  expiresAt: { type: DataTypes.DATE, allowNull: true },
  reason: { type: DataTypes.STRING, allowNull: true }
});

export { sequelize };
