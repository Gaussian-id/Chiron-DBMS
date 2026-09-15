db = db.getSiblingDB('gauss-horizon');
db.gauss_horizon_smoke.createIndex({ note: 1 });
db.gauss_horizon_smoke.insertOne({ _id: 1, note: 'Gauss Horizon smoke 中文 🚀', nullableValue: null, createdAt: new Date() });
