import { DataTypes } from "sequelize";
import { sequelize } from "./db.js";

export const Proposal = sequelize.define("proposals", {
  jobId: { type: DataTypes.INTEGER, allowNull: false },
  freelancerId: { type: DataTypes.INTEGER, allowNull: false },
  message: { type: DataTypes.TEXT, allowNull: true },
  bid: { type: DataTypes.FLOAT, allowNull: true },
  deliveryDays: { type: DataTypes.INTEGER, allowNull: true },
  files: { type: DataTypes.TEXT, allowNull: true }, // JSON array
  requirementFiles: { type: DataTypes.TEXT, allowNull: true }, // JSON array for employer-requested requirement uploads
  status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'Pending' }
});

export { sequelize };
