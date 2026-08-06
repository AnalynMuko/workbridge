import { DataTypes } from "sequelize";
import { sequelize } from "./db.js";

export const Portfolio = sequelize.define("Portfolios", {
  userId: { type: DataTypes.INTEGER, allowNull: false },
  title: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  category: { type: DataTypes.STRING, allowNull: true },
  links: { type: DataTypes.TEXT, allowNull: true }, // comma separated URLs or JSON
  files: { type: DataTypes.TEXT, allowNull: true }, // JSON string of uploaded filenames and types
  featured: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }
});

export { sequelize };
