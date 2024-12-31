import express from 'express';
import cors from 'cors';
import fs from 'fs';
import fetch from 'node-fetch';

const app = express();
const PORT = 3000;

// Enable CORS
app.use(cors());

// Serve static files
app.use(express.static('public'));

// Endpoint to get the current conditions
app.get('/current_conditions', (req, res) => {
  fs.readFile('./public/current_conditions.kml', 'utf-8', (err, data) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to read file' });
    }
    res.send(data);
  });
});

// Fetch and update the file at regular intervals
async function updateFile() {
  console.log('Updating file...');

  try {
    const response = await fetch('https://wateroffice.ec.gc.ca/services/current_conditions/xml/inline?lang=en');
    const data = await response.text();
    fs.writeFile('./public/current_conditions.kml', data, (err) => {
      if (err) {
        console.error('Failed to write file:', err);
      } else {
        console.log('File updated successfully');
      }
    });
  } catch (err) {
    console.error('Error fetching current conditions:', err);
  }
}

// Add a new endpoint to act as a proxy
app.get('/proxy/current_conditions', async (req, res) => {
  try {
    const response = await fetch('https://wateroffice.ec.gc.ca/services/current_conditions/xml/inline?lang=en');
    const data = await response.text();
    res.type('application/xml').send(data);
  } catch (err) {
    console.error('Error fetching current conditions:', err);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

// Update the file every 10 minutes
setInterval(updateFile, 10 * 60 * 1000);

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

updateFile();