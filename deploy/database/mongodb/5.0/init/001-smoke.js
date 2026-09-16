db = db.getSiblingDB('chiron-horizon');
db.chiron_horizon_smoke.createIndex({ note: 1 });
db.chiron_horizon_smoke.insertOne({ _id: 1, note: 'Chiron Horizon smoke 中文 🚀', nullableValue: null, createdAt: new Date() });
