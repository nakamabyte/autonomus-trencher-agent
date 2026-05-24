const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config({ path: 'trencher-core/.env' });

async function checkDeepSeek() {
  try {
    const res = await axios.get('https://api.deepseek.com/user/balance', {
      headers: { 'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}` }
    });
    console.log(res.data);
  } catch (err) {
    console.log('Error:', err.response?.data || err.message);
  }
}
checkDeepSeek();
