// server/server.js
const express = require('express');
const cors = require('cors');
const connectDB = require('./database');
const app = express();
const port = process.env.PORT || 3030;


connectDB();

app.use(cors());
app.use(express.json({limit: '50mb'}));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

const apiRouter = require('./routes/api');
app.use('/api', apiRouter);

app.listen(port, () => {
  console.log(`Express server running at http://localhost:${port}`);
});

app._router.stack.forEach((layer) => {
  if (layer.route) {
    console.log(layer.route.path); // 打印顶层路由
  } else if (layer.name === 'router') {
    layer.handle.stack.forEach((nestedLayer) => {
      if (nestedLayer.route) {
        console.log(nestedLayer.route.path); // 打印子路由
      }
    });
  }
});
