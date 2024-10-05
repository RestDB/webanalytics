import { datastore, aggregation } from 'codehooks-js'
import get from 'lodash/get';
import { formatDuration } from './utils.js';

// Add this function at the top of the file or in a utility module
function normalizeUrl(url, domain) {
  // Remove protocol (http:// or https://)
  url = url.replace(/^https?:\/\//, '');
  
  // Remove www. if present
  url = url.replace(/^www\./, '');
  
  // Remove trailing slash if present
  url = url.replace(/\/$/, '');
  
  // If the URL starts with the domain, keep only the path
  if (url.startsWith(domain)) {
    url = url.substring(domain.length) || '/';
  }
  
  return url;
}

/*
Aggregated stats
*/
export async function getAggregatedStats(req, res) {
  try {
    const { domain } = req.query;
    const { from, to } = req.params;
    
    const query = {
      domain,
      timestamp: {
        $gte: from,
        $lte: to
      }
    };
    const db = await datastore.open();
    const cursor = db.getMany('traffic', query);

    let uniqueUsers = new Set();
    let totalPageViews = 0;
    let uniqueEvents = new Set();
    let totalPageEvents = 0;
    let totalSessionDuration = 0;
    let sessionCounts = {};
    let topPages = {};
    let topReferers = {};
    let topCountries = {};
    let topEvents = {};
    let sessionCountries = new Map();
    let sessionGeoLocs = new Map(); // Add this line to declare sessionGeoLocs
    let geoLocCounts = new Map(); // Add this line to count similar geolocations
    let desktopSessions = 0;
    let mobileSessions = 0;
    let unknownDeviceSessions = 0;
    let processedSessions = new Set();

    let pageViewsPerHour = new Array(24).fill(0);
    let pageViewsPerDayOfWeek = new Array(7).fill(0);
    let pageViewsPerDayOfMonth = new Array(31).fill(0);
    let pageViewsPerMonth = new Array(12).fill(0);

    await cursor.forEach((item) => {
      // Calculate unique users and total page views
      uniqueUsers.add(item.sessionId);
      totalPageViews++;

      // Calculate unique events and total page events
      if (item.event && item.event !== 'page_exit') {
        uniqueEvents.add(item.event);
        totalPageEvents++;
      }

      // Calculate session duration and count page views per session
      if (item.event === 'page_exit' && item.eventData && item.eventData.sessionDuration) {
        totalSessionDuration += item.eventData.sessionDuration;
      }
      // count page views per session
      if ((item.event || null) !== 'page_exit') {
        sessionCounts[item.sessionId] = (sessionCounts[item.sessionId] || 0) + 1;
      }
      // calculate top pages
      if (item.referer) {
        const normalizedReferer = normalizeUrl(item.referer, domain);
        topPages[normalizedReferer] = (topPages[normalizedReferer] || 0) + 1;
      }
      // calculate top referrers
      if (item.via) {
        if (item.via.indexOf(domain) > 0) {
          item.via = 'Direct';
        }
        item.via = urlToBrandName(item.via);
        topReferers[item.via] = (topReferers[item.via] || 0) + 1;
      }
      // calculate top countries (unique sessions per country)
      if (item.geoCountryName) {
        if (!sessionCountries.has(item.sessionId)) {
          sessionCountries.set(item.sessionId, item.geoCountryName);
          topCountries[item.geoCountryName] = (topCountries[item.geoCountryName] || 0) + 1;
        }
      }
      // calculate top events
      if (item.event && item.event !== 'page_exit') {
        topEvents[item.event] = (topEvents[item.event] || 0) + 1;
      }
      // calculate page views per hour
      const hour = parseInt(item.hour);
      pageViewsPerHour[hour]++; 
      // calculate page views per day
      const dayOfWeek = new Date(item.timestamp).getDay();
      pageViewsPerDayOfWeek[dayOfWeek]++;
      // calculate page views per month
      const dayOfMonth = parseInt(item.day)-1;
      pageViewsPerDayOfMonth[dayOfMonth]++;
      // calculate page views per year
      const month = parseInt(item.month)-1;
      pageViewsPerMonth[month]++;
      // caclulate unique geolocations, and count for each geolocation, "geoLoc": "1.2897,103.8501", 
      if (item.geoLoc) {
        const [latitude, longitude] = item.geoLoc.split(',');
        const geoLocKey = `${parseFloat(latitude).toFixed(4)},${parseFloat(longitude).toFixed(4)}`;
        geoLocCounts.set(geoLocKey, (geoLocCounts.get(geoLocKey) || 0) + 1);
      } 
      // Count desktop and mobile sessions
      if (!processedSessions.has(item.sessionId)) {
        const deviceType = (item.deviceType || '').toLowerCase();
        
        if (deviceType === 'mobile') {
          mobileSessions++;
        } else {
          desktopSessions++;
        }
        processedSessions.add(item.sessionId);
      } 
    });

    // Sort all top categories from highest to lowest and limit to top 10
    topPages = Object.fromEntries(
      Object.entries(topPages).sort((a, b) => b[1] - a[1])
    );
    topReferers = Object.fromEntries(
      Object.entries(topReferers).sort((a, b) => b[1] - a[1])
    );
    topCountries = Object.fromEntries(
      Object.entries(topCountries).sort((a, b) => b[1] - a[1])
    );
    topEvents = Object.fromEntries(
      Object.entries(topEvents).sort((a, b) => b[1] - a[1])
    );

    // Calculate average session duration
    const averageSessionDuration = uniqueUsers.size > 0
      ? formatDuration(totalSessionDuration / uniqueUsers.size)
      : { hours: "0", minutes: "0", seconds: "0" };

    // Calculate bounce rate
    const bouncedSessions = Object.values(sessionCounts).filter(count => count === 1).length;
    const bounceRate = uniqueUsers.size > 0
      ? ((bouncedSessions / uniqueUsers.size) * 100).toFixed(2)
      : "0.00";
    
    // convert topReferers to array of {url: 'url', views: 'views'}
    const topReferersArray = Object.entries(topReferers).map(([url, views]) => ({ url, views }));
    //convert topCountries to array of {country: 'country', views: 'views'}
    const topCountriesArray = Object.entries(topCountries).map(([country, views]) => ({ country, views }));
    //convert topEvents to array of {event: 'event', views: 'views'}
    const topEventsArray = Object.entries(topEvents).map(([event, views]) => ({ event, views }));
    //convert topPages to array of {url: 'url', views: 'views'}
    const topPagesArray = Object.entries(topPages).map(([url, views]) => ({ url, views }));

    const geoLocArray = Array.from(geoLocCounts, ([geoloc, count]) => {
      const [lat, lon] = geoloc.split(',');
      return { geoloc: { lat: parseFloat(lat), lon: parseFloat(lon) }, count };
    });

    res.json({
      uniqueUsers: uniqueUsers.size,
      totalPageViews,
      uniqueEvents: uniqueEvents.size,
      totalPageEvents,
      averageSessionDuration,
      bounceRate,
      topPages: topPagesArray,
      topReferers: topReferersArray,
      topCountries: topCountriesArray,
      topEvents: topEventsArray,
      pageViewsPerHour,
      pageViewsPerDayOfWeek,
      pageViewsPerDayOfMonth,
      pageViewsPerMonth,
      sessionGeoLocs,
      geoLocCounts: geoLocArray,
      deviceTypes: {
        desktop: desktopSessions,
        mobile: mobileSessions
      }
    });

  } catch (error) {
    console.error('Error in getAggregatedStats:', error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

// New global function
function parseDateRange(from, to) {
  // from and to are in ISO format: YYYY-MM-DDThh:mm:ss
  const [fromDate, fromTime] = from.split('T');
  const [fromYear, fromMonth, fromDay] = fromDate.split('-');
  const fromHour = fromTime.split(':')[0];

  const [toDate, toTime] = to.split('T');
  const [toYear, toMonth, toDay] = toDate.split('-');
  const toHour = toTime.split(':')[0];

  return { fromYear, fromMonth, fromDay, fromHour, toYear, toMonth, toDay, toHour };
}

// New function to convert URL to brand name
function urlToBrandName(url) {
  const brandMap = {
    'baidu.com': 'Baidu',
    'bing.com': 'Bing',
    'duckduckgo.com': 'DuckDuckGo',
    'devhunt.org': 'DevHunt',
    'facebook.com': 'Facebook',
    'github.com': 'GitHub',
    'google.com': 'Google',
    'instagram.com': 'Instagram',
    'linkedin.com': 'LinkedIn',
    'pinterest.com': 'Pinterest',
    'reddit.com': 'Reddit',
    'snapchat.com': 'Snapchat',
    'tiktok.com': 'TikTok',
    'twitter.com': 'X (Twitter)',
    'whatsapp.com': 'WhatsApp',
    'yahoo.com': 'Yahoo',
    'yandex.ru': 'Yandex',
    'youtube.com': 'YouTube',
    't.co': 'X (Twitter)',
    'android-app://com.google.android.gm': 'Gmail (Android)'
  };

  for (const [domain, brand] of Object.entries(brandMap)) {
    if (url.includes(domain)) {
      return brand;
    }
  }
  return url.replace('https://', '');
}