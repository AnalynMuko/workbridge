import { DataTypes } from "sequelize";
import { sequelize } from "./db.js";

export const Notification = sequelize.define("notifications", {
  userId: { type: DataTypes.INTEGER, allowNull: false },
  type: { type: DataTypes.STRING, allowNull: false },
  data: { type: DataTypes.JSON, allowNull: true },
  read: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }
});

export { sequelize };
