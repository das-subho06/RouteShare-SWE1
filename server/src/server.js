// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const initSockets = require('./sockets');

const authRouter = require('./routes/auth');     
const driverRouter = require('./routes/driver');  
const otpRouter = require('./routes/otp'); 
const ridesRouter = require('./routes/rides');
const driverRatingRouter = require('./routes/driverRating');         
const app = express();

app.use(cors({
  origin: 'http://localhost:8081', 
  credentials: true,
}));
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/driver', driverRouter);
app.use('/api/otp', otpRouter);
app.use('/api/rides', ridesRouter);
app.use('/api/driver-rating', driverRatingRouter); 
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }, 
});

initSockets(io);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));