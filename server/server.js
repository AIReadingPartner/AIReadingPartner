// server/server.js
const express = require('express');
const cors = require('cors');
const connectDB = require('./database');
const app = express();
const port = 3000;


connectDB();

app.use(cors());
app.use(express.json());

const apiRouter = require('./routes/api');
app.use('/api', apiRouter);

app.listen(port, () => {
  console.log(`Express server running at http://localhost:${port}`);
});
