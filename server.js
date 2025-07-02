const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const TRUV_BASE_URL = 'https://api.truv.com/v1';
const TRUV_CLIENT_ID = process.env.TRUV_CLIENT_ID;
const TRUV_SECRET = process.env.TRUV_SECRET;

function truvAuth() {
  return {
    auth: {
      username: TRUV_CLIENT_ID,
      password: TRUV_SECRET
    }
  };
}

// 1. Create Truv User
app.post('/api/truv-create-user', async (req, res) => {
  try {
    const payload = {
      external_user_id: req.body.user_id,
      first_name: req.body.first_name || "John",
      last_name: req.body.last_name || "Doe",
      email: req.body.email || "borrower@example.com",
    };
    const resp = await axios.post(`${TRUV_BASE_URL}/users/`, payload, truvAuth());
    res.json(resp.data); // { id: ... }
  } catch (err) {
    res.status(500).json({ error: 'Failed to create user', details: err.response?.data });
  }
});

// 2. Get Bridge Token for user
app.post('/api/truv-bridge-token', async (req, res) => {
  try {
    const { user_id } = req.body;
    const payload = {
      product_type: "employment", // or "income"
      tracking_info: "VoE-app-demo"
    };
    const resp = await axios.post(`${TRUV_BASE_URL}/users/${user_id}/tokens/`, payload, truvAuth());
    res.json(resp.data); // { bridge_token: ... }
  } catch (err) {
    res.status(500).json({ error: 'Failed to get bridge token', details: err.response?.data });
  }
});

// 3. Exchange public_token for access_token and link_id
app.post('/api/truv-exchange-public-token', async (req, res) => {
  try {
    const { public_token } = req.body;
    const payload = { public_token };
    const resp = await axios.post(`${TRUV_BASE_URL}/link-access-tokens/`, payload, truvAuth());
    res.json(resp.data); // { access_token, link_id }
  } catch (err) {
    res.status(500).json({ error: 'Failed to exchange token', details: err.response?.data });
  }
});

// 4. Get employment data (by link_id)
app.get('/api/truv-employment/:link_id', async (req, res) => {
  try {
    const { link_id } = req.params;
    const resp = await axios.get(`${TRUV_BASE_URL}/links/${link_id}/employment/verification`, truvAuth());
    res.json(resp.data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch employment data', details: err.response?.data });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend server running on port ${PORT}`));
