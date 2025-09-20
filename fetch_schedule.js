const https = require('https');
const xml2js = require('xml2js');
const fs = require('fs');

// Function to fetch RSS feed
function fetchRSS(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

// Function to parse date strings
function parseDate(dateStr) {
  const date = new Date(dateStr);
  return date.toISOString();
}

// Main function
async function generateSchedule() {
  try {
    console.log('Fetching RSS feed...');
    const rssData = await fetchRSS('https://rebelforceradio.libsyn.com/rss');
    
    console.log('Parsing RSS data...');
    const parser = new xml2js.Parser();
    const result = await parser.parseStringPromise(rssData);
    
    // Transform items into schedule format
    const schedule = result.rss.channel[0].item.map(item => ({
      title: item.title[0],
      url: item.enclosure[0].$.url,
      airDate: parseDate(item.pubDate[0]),
      duration: item['itunes:duration'] ? item['itunes:duration'][0] : '00:00:00'
    }));

    // Sort by air date
    schedule.sort((a, b) => new Date(a.airDate) - new Date(b.airDate));

    // Write to file
    console.log('Writing schedule.json...');
    fs.writeFileSync('schedule.json', JSON.stringify(schedule, null, 2));
    console.log('Done! Created schedule.json with', schedule.length, 'episodes');

  } catch (error) {
    console.error('Error:', error);
  }
}

// Install required package if not present
if (!fs.existsSync('node_modules/xml2js')) {
  console.log('Installing required package: xml2js...');
  require('child_process').execSync('npm install xml2js');
}

generateSchedule();