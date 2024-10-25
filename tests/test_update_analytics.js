const { updateAnalytics } = require('./api/update_analytics');
const fs = require('fs');
// Sample data array
const filePath = 'testdata.json';
const rawData = fs.readFileSync(filePath, 'utf8');
const sampleData = JSON.parse(rawData);

// Sort sampleData by timestamp
//sampleData.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

// Initial analytics data
let analyticsData = {
  uniqueUsers: {},
  totalPageViews: 0,
  uniqueEvents: {},
  totalPageEvents: 0,
  averageSessionDuration: 0,
  topPages: [],
  topReferers: [],
  topCountries: {},
  topEvents: {},
  geoLocCounts: {},
  deviceTypes: {},
  pageViewsInPeriod: {},
  uniqueSessionsInPeriod: {},
  uniqueEventsInPeriod: {}
};

// Test the updateAnalytics function
console.log("Initial analytics data:", sampleData.length);

sampleData.forEach((record, index) => {
  //console.log(`\nProcessing record ${index + 1}:`);
  analyticsData = updateAnalytics(analyticsData, record);
  //console.log("Updated analytics data:", JSON.stringify(analyticsData, null, 2));
});

console.log("\nFinal analytics data:", JSON.stringify(analyticsData, null, 2));
