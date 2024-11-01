import { datastore, aggregation } from 'codehooks-js'
import get from 'lodash/get';
import { formatDuration } from './utils.js';
import { trackerWorker } from './workers.js';

// Add these constants at the top of the file, after the imports
const CACHE_THRESHOLD_HOURS = 12;
const CACHE_THRESHOLD_MS = CACHE_THRESHOLD_HOURS * 60 * 60 * 1000;

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
    let { domain, query, period } = req.query;
    const { from, to } = req.params;
    if (query) {
      query = JSON.parse(query);
    }
    const stats = await calculateAggregatedStats(from, to, domain, query, period);
    res.json(stats);
  } catch (error) {
    console.error('Error in getAggregatedStats:', error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

export async function calculateAggregatedStats(from, to, domain, inputquery, period) {
  const now = new Date().toISOString();
  const cacheKeyspace = `stats_${domain}`;
  
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
  
  const cursor = db.getMany('traffic', query, {useIndex: 'timestamp', start: from, end: to});

  let uniqueUsers = new Set();
  let totalPageViews = 0;
  let uniqueEvents = new Set();
  let totalPageEvents = 0;
  let totalSessionDuration = 0;
  let sessionCounts = {};
  let sessionStartTimes = {};
  let sessionEndTimes = {};
  let topPages = {};
  let topPagesSession = {}; // New object to track unique sessions per page
  let topReferers = {};
  let topCountries = {};
  let topEvents = {};
  let eventSessions = {}; // New object to track sessions for each event
  let sessionCountries = new Map();
  let geoLocCounts = new Map();
  let desktopSessions = 0;
  let mobileSessions = 0;
  let tabletSessions = 0;
  let processedSessions = new Set();

  let pageViewsInPeriod = {};
  let uniqueSessionsInPeriod = {};
  let uniqueEventsInPeriod = {}; // New object to track unique events per period

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

    // Calculate top pages and unique sessions per page
    if (item.referer) {
      const normalizedReferer = item.referer; // normalizeUrl(item.referer, domain);
      if (!topPages[normalizedReferer]) {
        topPages[normalizedReferer] = { views: 0, sessions: new Set() };
      }
      topPages[normalizedReferer].views++;
      topPages[normalizedReferer].sessions.add(item.sessionId);
    }
    // calculate top referrers
    if (item.via) {
      if (item.via.indexOf(domain) > 0) {
        item.via = 'Direct';
      }
      
      if (!topReferers[item.via]) {
        topReferers[item.via] = { views: 0, sessions: new Set() };
      }
      topReferers[item.via].views++;
      topReferers[item.via].sessions.add(item.sessionId);
    }
    
    // calculate top countries (unique sessions per country)
    if (item.geoCountryName) {
      if (!sessionCountries.has(item.sessionId)) {
        sessionCountries.set(item.sessionId, item.geoCountryName);
        topCountries[item.geoCountryName] = (topCountries[item.geoCountryName] || 0) + 1;
      }
    }
    // calculate top events and track sessions for each event
    if (item.event && item.event !== 'page_exit') {
      if (!topEvents[item.event]) {
        topEvents[item.event] = { views: 0, sessions: new Set() };
      }
      topEvents[item.event].views++;
      topEvents[item.event].sessions.add(item.sessionId);
    }
    // calculate page hits
    let periodKey = `${item.year}-${item.month}-${item.day}T${item.hour}:00`;
    /*
    if (period === 'last30days') {
      periodKey = `${item.year}-${item.month}-${item.day}T${String(item.hour % 6).padStart(2, '0')}:00`;
    } 
    */
    
    if (!pageViewsInPeriod[periodKey]) {
      pageViewsInPeriod[periodKey] = 0;
    }
    pageViewsInPeriod[periodKey]++;

    // Calculate unique sessions per period
    if (!uniqueSessionsInPeriod[periodKey]) {
      uniqueSessionsInPeriod[periodKey] = new Set();
    }
    uniqueSessionsInPeriod[periodKey].add(item.sessionId);

    // Calculate unique events per period
    if (item.event && item.event !== 'page_exit') {
      if (!uniqueEventsInPeriod[periodKey]) {
        uniqueEventsInPeriod[periodKey] = new Set();
      }
      uniqueEventsInPeriod[periodKey].add(item.event);
    }
    
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
      } if (deviceType === 'tablet') {
        tabletSessions++;
      }else {
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
    Object.entries(topPages).sort((a, b) => b[1].views - a[1].views)
  );
  topReferers = Object.fromEntries(
    Object.entries(topReferers).sort((a, b) => b[1].views - a[1].views)
  );
  topCountries = Object.fromEntries(
    Object.entries(topCountries).sort((a, b) => b[1] - a[1])
  );
  topEvents = Object.fromEntries(
    Object.entries(topEvents).sort((a, b) => b[1].views - a[1].views)
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
  
  // Update the topReferersArray creation
  const topReferersArray = Object.entries(topReferers).map(([url, data]) => ({ 
    url, 
    views: data.views, 
    sessions: data.sessions.size 
  }));
  //convert topCountries to array of {country: 'country', views: 'views'}
  const topCountriesArray = Object.entries(topCountries).map(([country, views]) => ({ country, views }));
  //convert topEvents to array of {event: 'event', views: 'views'}
  const topEventsArray = Object.entries(topEvents).map(([event, data]) => ({ 
    event, 
    views: data.views,
    sessions: data.sessions.size,
    conversionRate: `${((data.sessions.size / uniqueUsers.size) * 100).toFixed(2)}%` 
  }));
  //convert topPages to array of {url: 'url', views: 'views', sessions: 'sessions'}
  const topPagesArray = Object.entries(topPages).map(([url, data]) => ({ 
    url, 
    views: data.views, 
    sessions: data.sessions.size 
  }));

  // Sort topPagesArray by views (descending)
  topPagesArray.sort((a, b) => b.views - a.views);

  const geoLocArray = Array.from(geoLocCounts, ([geoloc, count]) => {
    const [lat, lon] = geoloc.split(',');
    return { geoloc: { lat: parseFloat(lat), lon: parseFloat(lon) }, count };
  });

  // Calculate event conversion rates
  const eventConversionRates = Object.entries(topEvents).map(([event, data]) => {
    const sessionsWithEvent = data.sessions.size;
    const conversionRate = ((sessionsWithEvent / uniqueUsers.size) * 100).toFixed(2);
    return { 
      event, 
      views: data.views,
      sessions: sessionsWithEvent,
      conversionRate: `${conversionRate}%` 
    };
  });

  // Sort eventConversionRates by count (descending)
  eventConversionRates.sort((a, b) => b.views - a.views);

  // Convert uniqueSessionsInPeriod from Sets to counts
  const uniqueSessionCounts = Object.fromEntries(
    Object.entries(uniqueSessionsInPeriod).map(([key, set]) => [key, set.size])
  );

  // Convert uniqueEventsInPeriod from Sets to counts
  const uniqueEventCounts = Object.fromEntries(
    Object.entries(uniqueEventsInPeriod).map(([key, set]) => [key, set.size])
  );

  const result = {
    uniqueUsers: uniqueUsers.size,
    totalPageViews,
    uniqueEvents: uniqueEvents.size,
    totalPageEvents,
    averageSessionDuration,
    bounceRate,
    topPages: topPagesArray,
    topReferers: topReferersArray,
    topCountries: topCountriesArray,
    topEvents: eventConversionRates,
    geoLocCounts: geoLocArray,
    deviceTypes: {
      desktop: desktopSessions,
      mobile: mobileSessions,
      tablet: tabletSessions
    },
    pageViewsInPeriod,
    uniqueSessionsInPeriod: uniqueSessionCounts,
    uniqueEventsInPeriod: uniqueEventCounts,
  };

  return result;
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
// Add this function after the existing functions
export async function getActiveUsers(req, res) {
  try {
    const { domain } = req.query;
    const result = await calculateActiveUsers(domain);
    res.json(result);
  } catch (error) {
    console.error('Error in getActiveUsers:', error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

async function calculateActiveUsers(domain) {
  const db = await datastore.open();
  const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000).toISOString();

  const query = {
    domain,
    "timestamp": { $gte: threeMinutesAgo },
    "event": {$not: "page_exit"}
  };
  console.debug('calculateActiveUsers query', query);
  const cursor = db.getMany('traffic', query);
  const activeUsers = new Set();
  const pageViews = {};

  await cursor.forEach((item) => {
    activeUsers.add(item.sessionId);
    if (item.referer) {
      pageViews[item.referer] = (pageViews[item.referer] || 0) + 1;
    }
  });

  const activePages = Object.entries(pageViews)
    .map(([page, count]) => ({ page, count }))
    .sort((a, b) => b.count - a.count);

  return {
    totalActiveUsers: activeUsers.size,
    activePages: activePages
  };
}
