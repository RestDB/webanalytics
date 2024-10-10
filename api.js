import { datastore, aggregation } from 'codehooks-js'
import get from 'lodash/get';
import { formatDuration } from './utils.js';
import { trackerWorker } from './workers.js';

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
Create stats data via API
*/
export async function createStats(req, res) {
  try {
    const { body } = req;
    const db = await datastore.open();
    await db.insertOne('traffic', body);
    res.status(201).json(body);
  } catch (error) {
    console.error('Error in createStats:', error.message);  
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

/*
Aggregated stats
*/
export async function getAggregatedStats(req, res) {
  try {
    let { domain, query } = req.query;
    const { from, to } = req.params;
    if (query) {
      query = JSON.parse(query);
      console.log('query', query);
    }
    const stats = await calculateAggregatedStats(from, to, domain, query);
    res.json(stats);
  } catch (error) {
    console.error('Error in getAggregatedStats:', error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

async function calculateAggregatedStats(from, to, domain, inputquery) {
  let query = {
    domain,
    timestamp: {
      $gte: from,
      $lte: to
    }
  };
  // merge query with inputquery
  if (inputquery) {
    query = { ...query, ...inputquery };
  }
  const db = await datastore.open();
  const cursor = db.getMany('traffic', query);

  let uniqueUsers = new Set();
  let totalPageViews = 0;
  let uniqueEvents = new Set();
  let totalPageEvents = 0;
  let totalSessionDuration = 0;
  let sessionCounts = {};
  let sessionStartTimes = {};
  let sessionEndTimes = {};
  let topPages = {};
  let topReferers = {};
  let topCountries = {};
  let topEvents = {};
  let sessionCountries = new Map();
  let geoLocCounts = new Map();
  let desktopSessions = 0;
  let mobileSessions = 0;
  let processedSessions = new Set();

  let pageViewsInPeriod = {};

  await cursor.forEach((item) => {
    // Calculate unique users and total page views
    uniqueUsers.add(item.sessionId);
    totalPageViews++;

    // Calculate unique events and total page events
    if (item.event && item.event !== 'page_exit') {
      uniqueEvents.add(item.event);
      totalPageEvents++;
    }

    // Track session start and end times
    if (!sessionStartTimes[item.sessionId] || item.timestamp < sessionStartTimes[item.sessionId]) {
      sessionStartTimes[item.sessionId] = item.timestamp;
    }
    if (!sessionEndTimes[item.sessionId] || item.timestamp > sessionEndTimes[item.sessionId]) {
      sessionEndTimes[item.sessionId] = item.timestamp;
    }

     // count page views per session
     if ((item.event || null) !== 'page_exit') {
      sessionCounts[item.sessionId] = (sessionCounts[item.sessionId] || 0) + 1;
    }

    // Remove the old session duration calculation
    // if (item.event === 'page_exit' && item.eventData && item.eventData.sessionDuration) {
    //   totalSessionDuration += item.eventData.sessionDuration;
    // }

    // Calculate top pages
    if (item.referer) {
      const normalizedReferer = item.referer;//normalizeUrl(item.referer, domain);
      topPages[normalizedReferer] = (topPages[normalizedReferer] || 0) + 1;
    }
    // calculate top referrers
    if (item.via) {
      if (item.via.indexOf(domain) > 0) {
        item.via = 'Direct';
      }
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
    // calculate page hits
    if (!pageViewsInPeriod[`${item.year}-${item.month}-${item.day}T${item.hour}:00`]) {
      pageViewsInPeriod[`${item.year}-${item.month}-${item.day}T${item.hour}:00`] = 0;
    }
    pageViewsInPeriod[`${item.year}-${item.month}-${item.day}T${item.hour}:00`]++;
    
    
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

  
  // Calculate total session duration after processing all items
  for (const sessionId of Object.keys(sessionStartTimes)) {
    const startTime = new Date(sessionStartTimes[sessionId]).getTime();
    const endTime = new Date(sessionEndTimes[sessionId]).getTime();
    const sessionDuration = endTime - startTime;
    //console.log('sess', sessionId, sessionDuration, new Date(sessionStartTimes[sessionId]), new Date(sessionEndTimes[sessionId]));
    if (sessionDuration > 0) {
      
      totalSessionDuration += sessionDuration;
    }
  }

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

  return {
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
    geoLocCounts: geoLocArray,
    deviceTypes: {
      desktop: desktopSessions,
      mobile: mobileSessions
    },
    pageViewsInPeriod
  };
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

