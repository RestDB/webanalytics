/*
* Web analytics template
*/
import { app, datastore } from 'codehooks-js'
import fetch from 'node-fetch';
import lodash from 'lodash';
import maphtml from './pages/map.html';
import UAParser from 'ua-parser-js';

/*
* Public routes
*/
app.auth('/script.js', (req, res, next) => next())
app.auth('/pixel.gif', (req, res, next) => next())
app.auth('/map', (req, res, next) => next())

/* 
Send a tracker script to client
*/
app.get('/script.js', async (req, res) => {
  const scriptString = "<img src=\"https://youthful-watershed-23b6.codehooks.io/pixel.gif?r='+encodeURIComponent(document.referrer || null)+'\" width=\"0\" height=\"0\" alt=\"Page view tracker\" referrerpolicy=\"no-referrer-when-downgrade\"/>";
  const spaNavString = "<img src=\"https://youthful-watershed-23b6.codehooks.io/pixel.gif?r='+encodeURIComponent(window.location.href || null)+'\" width=\"0\" height=\"0\" alt=\"Page view tracker\" referrerpolicy=\"no-referrer-when-downgrade\"/>";
  // send script to client
  res.set('Content-Type', 'application/javascript');
  res.send(`document.write('${scriptString}'); 
  (function(history) {
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function(state, title, url) {
        const result = originalPushState.apply(history, arguments);
        window.dispatchEvent(new Event('urlchange'));
        return result;
    };

    history.replaceState = function(state, title, url) {
        const result = originalReplaceState.apply(history, arguments);
        window.dispatchEvent(new Event('urlchange'));
        return result;
    };
  })(window.history);

  // Function to track URL changes
  function trackUrlChange() {
    console.log('URL changed to:', window.location.href);
    document.body.insertAdjacentHTML('beforeend', '${spaNavString}');
  }

  // Listen for URL changes
  window.addEventListener('urlchange', trackUrlChange);

  // Listen for hash changes
  window.addEventListener('hashchange', trackUrlChange);

  // Listen for clicks on hash links
  document.addEventListener('click', function(e) {
    const target = e.target.closest('a');
    if (target && target.hash && target.origin + target.pathname === window.location.origin + window.location.pathname) {
      trackUrlChange();
    }
  });
`);
});

/* 
Send a tracking pixel
*/
app.get('/pixel.gif', async (req, res) => {
  // send requestpayloadto worker queue
  const db = await datastore.open();
  db.enqueue('TRACKER', { ...req });

  // Create a 1x1 transparent GIF, send to client
  const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
  res.set('Content-Type', 'image/gif');
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.write(pixel, 'buffer');
  res.end();
});

/* 
Get Country from IP 
*/
async function getCountryFromIP(ip) {
  try {
    const db = await datastore.open();
    // check if we have cached the result
    const cachedIp = await db.get(`ip-${ip}`)
    if (cachedIp) {
      console.debug('Cached IP', cachedIp)
      return JSON.parse(cachedIp)
    }
    const apiToken = '506fec00701249'
    const requestOptions = {
      method: "GET",
      redirect: "follow"
    };
    const URL = `https://ipinfo.io/${ip}?token=${apiToken}`
    const response = await fetch(URL, requestOptions)
    const data = await response.json()
    // cache the result
    db.set(`ip-${ip}`, JSON.stringify(data))
    return data
  } catch (error) {
    console.error(error)
    return null
  }
}

/*
* Aggregate analytics data
*/
async function aggregateAnalyticsData(field, value) {
  const db = await datastore.open()
  const { year, month, day, hour } = getDateComponents()
  //console.log('Aggregating data for', year, month, day, hour, second);
  const meterQuery = {
    "year": year,
    "month": month,
    "day": day,
    "hour": hour,
    "metric": field
  };
  meterQuery[field] = value

  const updates = {
    $set: {
      "year": year,
      "month": month,
      "day": day,
      "hour": hour,
      "metric": field
    },
    $inc: { count: 1 }
  };
  updates['$set'][field] = value
  //console.log('Aggregating data', meterQuery, updates)
  const result = await db.updateOne('analytics', meterQuery, updates, { upsert: true })
  //console.log('Aggregated data result', result)
  return result
}

function getDateComponents() {
  const date = new Date()
  return {
    year: date.getUTCFullYear().toString(),
    month: (date.getUTCMonth() + 1).toString().padStart(2, '0'),
    day: date.getUTCDate().toString().padStart(2, '0'),
    hour: date.getUTCHours().toString().padStart(2, '0'),
    second: date.getUTCSeconds().toString().padStart(2, '0')
  }
}

/*
* Tracker worker, stores data in database
*/
app.worker('TRACKER', async (workerdata, work) => {
  const db = await datastore.open();
  const rawData = workerdata.body.payload;
  
  const headers = rawData.headers;
  const geo = await getCountryFromIP(headers['x-real-ip']);

  // Parse user-agent string
  const parser = new UAParser(headers['user-agent']);
  const userAgentInfo = parser.getResult();

  // Construct a flattened data object
  const data = {
    ip: headers['x-real-ip'],
    accept: headers['accept'],
    acceptLanguage: headers['accept-language'],
    userAgent: headers['user-agent'],
    osName: userAgentInfo.os.name || "unknown",
    osVersion: userAgentInfo.os.version || "unknown",
    deviceVendor: userAgentInfo.device.vendor || "unknown",
    deviceModel: userAgentInfo.device.model || "unknown",
    deviceType: userAgentInfo.device.type || "unknown",
    referer: headers['referer'],
    apiPath: rawData.apiPath,
    originalUrl: rawData.originalUrl,
    params: rawData.params,
    geoCountry: geo.country,
    geoCity: geo.city,
    geoRegion: geo.region,
    geoLoc: geo.loc,
    geoTimezone: geo.timezone,
    timestamp: new Date().toISOString()
  };

  // Add 'via' field if data.query exists and data.query.r is not 'null'
  if (rawData.query && rawData.query.r !== 'null') {
    data.via = rawData.query.r;
  }
  // add date components
  const { year, month, day, hour } = getDateComponents()
  data.year = year
  data.month = month
  data.day = day
  data.hour = hour

  console.log('Tracker', data);
  let pageUrl = data.referer;
  if (pageUrl.indexOf('?') > 0) {
    pageUrl = pageUrl.split('?')[0];
  }
  await db.insertOne('traffic', data);
  await aggregateAnalyticsData('page', pageUrl);
  await aggregateAnalyticsData('city', data.geoCity);
  await aggregateAnalyticsData('country', data.geoCountry);
  if (data.via && data.via !== 'null') {
    await aggregateAnalyticsData('via', data.via);
  }
  work.end();
})

/*
  Web map page
*/
app.get('/map', async (req, res) => {
  const locations = [];
  const conn = await datastore.open();
  const stream = conn.getMany('traffic', {})
  stream.on('data', (data) => {
    // lat: 24.6408, lng:46.7728, count: 3
    const latLng = data.geoLoc.split(',').map(Number);
    locations.push({      
      lat: latLng[0], lng:latLng[1], count: 1
    });
  }).on('end', () => {
    const tpl = lodash.template(maphtml)
    res.set('Content-Type', 'text/html');
    res.send(tpl({ locations: JSON.stringify({data: locations}) }))
  })
});

/*
Serve static assets
*/
app.static({route: '/assets', directory: '/pages'})

// bind to serverless runtime
export default app.init(async () => {
  console.log('I run on deploy once')
  const db = await datastore.open()
  // await db.createCollection('analytics')
  //await db.createCollection('traffic')
});
