const config = {
  development: {
    API_URL: 'http://localhost:3030/api',
  },
  production: {
    // API_URL: 'https://your-remote-api.com/api',
    API_URL: 'https://aireadingpartner.onrender.com/api'

  },
};

export default config[(process.env.NODE_ENV as 'development' | 'production') || 'development'];
