const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const driverRoutes = require('./routes/driver');
const otpRoutes = require('./routes/otp');
const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/driver', driverRoutes);
app.use('/api/otp', otpRoutes);
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));