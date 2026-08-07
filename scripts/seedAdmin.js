import bcrypt from 'bcryptjs';
import { sequelize } from '../models/db.js';
import { User } from '../models/userModel.js';

async function seed() {
  try {
    await sequelize.sync();
    const email = 'mainadmin123@gmail.com';
    const password = 'mainadmin123';
    let user = await User.findOne({ where: { email } });
    if (!user) {
      const hashed = await bcrypt.hash(password, 10);
      user = await User.create({ name: 'Main Admin', email, password: hashed, isAdmin: true });
      console.log('Admin user created:', email);
    } else {
      user.isAdmin = true;
      await user.save();
      console.log('Existing user marked as admin:', email);
    }
    process.exit(0);
  } catch (err) {
    console.error('Failed to seed admin:', err);
    process.exit(1);
  }
}

seed();
