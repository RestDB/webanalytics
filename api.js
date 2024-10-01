import { datastore, aggregation } from 'codehooks-js'
import get from 'lodash/get';
import { formatDuration } from './utils.js';


/*
Aggregated stats
*/
export async function getAggregatedStats(req, res) {
  try {
    const { domain } = req.query;
    const { from, to } = req.params;
    const { fromYear, fromMonth, fromDay, fromHour, toYear, toMonth, toDay, toHour } = parseDateRange(from, to);
    const db = await datastore.open();
    const query = {
      domain,
      timestamp: {
        $gte: `${fromYear}-${fromMonth}-${fromDay}T${fromHour}`,
        $lte: `${toYear}-${toMonth}-${toDay}T${toHour}`
      }
    };
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
    // Initiate page view per
    const pageViewsPerHour = Array(24).fill(0);
    // Initiate page views per day of month, grouped from 01-31
    const pageViewsPerDayOfMonth = Array(31).fill(0);
    // Initiate page views per day of week, grouped from mon-sun
    const pageViewsPerDayOfWeek = Array(7).fill(0);
    // Initiate page views per month, grouped from 01-12
    const pageViewsPerMonth = Array(12).fill(0);
    // Initiate page views per year, grouped from 01-12
    const pageViewsPerYear = Array(12).fill(0);

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
      sessionCounts[item.sessionId] = (sessionCounts[item.sessionId] || 0) + 1;
      // calculate top pages
      if (item.referer) {
        topPages[item.referer] = (topPages[item.referer] || 0) + 1;
      }
      // calculate top referrers
      if (item.via) {
        if (item.via.indexOf('codehooks.io') > 0) {
          item.via = 'Direct';
        }
        item.via = urlToBrandName(item.via);
        topReferers[item.via] = (topReferers[item.via] || 0) + 1;
      }
      // calculate top countries
      if (item.geoCountryName) {
        topCountries[item.geoCountryName] = (topCountries[item.geoCountryName] || 0) + 1;
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
    });

    // Sort all top categories from highest to lowest and limit to top 10
    topPages = Object.fromEntries(
      Object.entries(topPages).sort((a, b) => b[1] - a[1]).slice(0, 10)
    );
    topReferers = Object.fromEntries(
      Object.entries(topReferers).sort((a, b) => b[1] - a[1]).slice(0, 10)
    );
    topCountries = Object.fromEntries(
      Object.entries(topCountries).sort((a, b) => b[1] - a[1]).slice(0, 10)
    );
    topEvents = Object.fromEntries(
      Object.entries(topEvents).sort((a, b) => b[1] - a[1]).slice(0, 10)
    );

    // Calculate average session duration
    const averageSessionDuration = formatDuration(totalSessionDuration / uniqueUsers.size);

    // Calculate bounce rate
    const bouncedSessions = Object.values(sessionCounts).filter(count => count === 1).length;
    const bounceRate = ((bouncedSessions / uniqueUsers.size) * 100).toFixed(2);
    
    // convert topReferers to array of {url: 'url', views: 'views'}
    const topReferersArray = Object.entries(topReferers).map(([url, views]) => ({ url, views }));
    //convert topCountries to array of {country: 'country', views: 'views'}
    const topCountriesArray = Object.entries(topCountries).map(([country, views]) => ({ country, views }));
    //convert topEvents to array of {event: 'event', views: 'views'}
    const topEventsArray = Object.entries(topEvents).map(([event, views]) => ({ event, views }));
    //convert topPages to array of {url: 'url', views: 'views'}
    const topPagesArray = Object.entries(topPages).map(([url, views]) => ({ url, views }));

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
      pageViewsPerMonth
    });

  } catch (error) {
    console.error('Error in getAggregatedStats:', error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

// New global function
function parseDateRange(from, to) {
  const [fromYear, fromMonth, fromDay, fromHour] = from.split('-');
  const [toYear, toMonth, toDay, toHour] = to.split('-');
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
    'twitter.com': 'Twitter',
    'whatsapp.com': 'WhatsApp',
    'yahoo.com': 'Yahoo',
    'yandex.ru': 'Yandex',
    'youtube.com': 'YouTube',
  };

  for (const [domain, brand] of Object.entries(brandMap)) {
    if (url.includes(domain)) {
      return brand;
    }
  }
  return url;
}