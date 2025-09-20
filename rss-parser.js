const axios = require('axios');
const xml2js = require('xml2js');
const fs = require('fs').promises;
const path = require('path');

const RSS_URL = 'https://rebelforceradio.libsyn.com/rss';
const OUTPUT_FILE = path.join(__dirname, 'schedule_rfr.json');

async function parseRSS() {
  try {
    // Fetch RSS feed
    const response = await axios.get(RSS_URL);
    const parser = new xml2js.Parser();
    const result = await parser.parseStringPromise(response.data);

    // Extract episodes from feed
    const episodes = result.rss.channel[0].item.map(item => {
      // Convert duration from HH:MM:SS to seconds
      const durationStr = item['itunes:duration']?.[0] || '00:00:00';
      const [hours, minutes, seconds] = durationStr.split(':').map(Number);
      const duration = (hours * 3600) + (minutes * 60) + seconds;

      // Get the MP3 URL
      const enclosure = item.enclosure?.[0]?.$?.url || '';

      // Get the image URL
      const image = item['itunes:image']?.[0]?.$?.href || result.rss.channel[0]['itunes:image'][0].$.href;

      // Parse the publication date
      const pubDate = new Date(item.pubDate[0]);
      const airDate = pubDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      return {
        url: enclosure,
        duration,
        title: item.title[0],
        airDate,
        image
      };
    });

    // Sort episodes by date (newest first)
    episodes.sort((a, b) => new Date(b.airDate) - new Date(a.airDate));

    // Write to JSON file
    await fs.writeFile(
      'schedule_rfr.json',
      JSON.stringify(episodes, null, 2),
      'utf8'
    );

    console.log(`Successfully wrote ${episodes.length} episodes to schedule_rfr.json`);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// First create package.json if it doesn't exist
const packageJson = {
  "name": "rss-parser",
  "version": "1.0.0",
  "description": "Parse Rebel Force Radio RSS feed",
  "main": "rss-parser.js",
  "dependencies": {
    "axios": "^1.5.0",
    "xml2js": "^0.6.0"
  }
};

async function init() {
  try {
    await fs.access('package.json');
  } catch {
    await fs.writeFile('package.json', JSON.stringify(packageJson, null, 2));
    console.log('Created package.json');
  }
  
  console.log('Installing dependencies...');
  require('child_process').execSync('npm install', { stdio: 'inherit' });
  
  console.log('Parsing RSS feed...');
  await parseRSS();
}

init();