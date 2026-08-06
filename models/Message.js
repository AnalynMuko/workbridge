import { DataTypes } from "sequelize";
import { sequelize } from "./db.js";

export const Message = sequelize.define("messages", {
  fromUserId: { type: DataTypes.INTEGER, allowNull: false },
  toUserId: { type: DataTypes.INTEGER, allowNull: false },
  content: { type: DataTypes.TEXT, allowNull: true },
  jobId: { type: DataTypes.INTEGER, allowNull: true },
  media: { type: DataTypes.STRING, allowNull: true },
  mediaType: { type: DataTypes.STRING, allowNull: true },
  read: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }
});

export { sequelize };
