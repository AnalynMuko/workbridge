import { DataTypes } from 'sequelize';
import { sequelize } from './db.js';

export const AuditLog = sequelize.define('audit_logs', {
  actorUserId: { type: DataTypes.INTEGER, allowNull: true },
  action: { type: DataTypes.STRING, allowNull: false },
  targetType: { type: DataTypes.STRING, allowNull: true },
  targetId: { type: DataTypes.INTEGER, allowNull: true },
  details: { type: DataTypes.JSON, allowNull: true }
});

export { sequelize };
