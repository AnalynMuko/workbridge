import { DataTypes } from "sequelize";
import { sequelize } from "./db.js";

export const Job = sequelize.define("jobs", {
  userId: { type: DataTypes.INTEGER, allowNull: false },
  title: { type: DataTypes.STRING, allowNull: false },
  position: { type: DataTypes.STRING, allowNull: true },
  category: { type: DataTypes.STRING, allowNull: true },
  description: { type: DataTypes.TEXT, allowNull: true },
  budget: { type: DataTypes.FLOAT, allowNull: true },
  currency: { type: DataTypes.STRING, allowNull: true, defaultValue: 'USD' },
  deadline: { type: DataTypes.DATEONLY, allowNull: true },
  requirements: { type: DataTypes.TEXT, allowNull: true }, // JSON array of requirement labels
  status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'active' },
  proposalsCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  removed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  removedAt: { type: DataTypes.DATE, allowNull: true }
});

export { sequelize };
