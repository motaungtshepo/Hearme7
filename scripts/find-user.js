require('dotenv').config();
const mongoose = require('mongoose');

const email = process.argv[2] || 'sarah.therapist@test.com';

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const user = await mongoose.connection.db.collection('users').findOne({
    $or: [{ identifier: email }, { email }],
  });
  console.log(user ? { role: user.role, identifier: user.identifier, email: user.email } : 'NOT FOUND');
  await mongoose.disconnect();
})();
