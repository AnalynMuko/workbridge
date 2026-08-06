import { DataTypes } from "sequelize";
import { sequelize } from "./db.js";

export const SocialPost = sequelize.define("social_posts", {
  userId: { type: DataTypes.INTEGER, allowNull: false },
  content: { type: DataTypes.TEXT, allowNull: false },
  image: { type: DataTypes.STRING, allowNull: true }
  ,removed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  removedAt: { type: DataTypes.DATE, allowNull: true }
});

export { sequelize };
