require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../database/models/users');

const LEGACY_INDEXES = ['email_1', 'anonymousName_1', 'licenseNumber_1'];

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const collection = mongoose.connection.db.collection('users');

  for (const indexName of LEGACY_INDEXES) {
    try {
      await collection.dropIndex(indexName);
      console.log(`Dropped legacy index: ${indexName}`);
    } catch (err) {
      if (err.code === 27 || err.codeName === 'IndexNotFound') {
        console.log(`Index not found (skipped): ${indexName}`);
      } else {
        throw err;
      }
    }
  }

  const removed = await collection.deleteMany({
    $or: [{ identifier: null }, { identifier: { $exists: false } }, { identifier: '' }],
  });
  console.log(`Removed ${removed.deletedCount} invalid user document(s)`);

  await User.syncIndexes();
  console.log('Synced indexes:', (await collection.indexes()).map((i) => i.name));

  await mongoose.disconnect();
})();
