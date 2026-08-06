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
  // Firebase doesn't require predefined models.
  // Use Firestore directly in controllers or create helper functions here.
  // Collection name: "profile"

  import { DataTypes } from "sequelize";
import { sequelize } from "./db.js";


export const Profile = sequelize.define("profiles", {
  userId: { type: DataTypes.INTEGER, allowNull: false },
  fullname: { type: DataTypes.STRING, allowNull: false },
  birthdate: { type: DataTypes.DATEONLY, allowNull: true },
  gender: { type: DataTypes.STRING, allowNull: true },
  contactNumber: { type: DataTypes.STRING, allowNull: true },
  address: { type: DataTypes.STRING, allowNull: true },
  skills: { type: DataTypes.TEXT, allowNull: true },
  experience: { type: DataTypes.INTEGER, allowNull: true },
  bio: { type: DataTypes.TEXT, allowNull: true },
  idProof: { type: DataTypes.STRING, allowNull: true },
  avatar: { type: DataTypes.STRING, allowNull: true }
});
export { sequelize };