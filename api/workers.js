import { datastore } from 'codehooks-js'
import UAParser from 'ua-parser-js';
import { countries } from 'countries-list';
import { getCountryFromIP, getDateComponents, aggregateAnalyticsData, extractTopDomain } from './utils.js';
import { updateAnalytics } from './update_analytics.js';
const url = require('url');


export const trackerWorker = async (workerdata, work) => {
    try {
        const db = await datastore.open();
        const rawData = workerdata.body.payload;
        
        const headers = rawData.headers;
        const geo = await getCountryFromIP(headers['x-real-ip']) || {};
        const referrer = rawData.referrer || headers['referer'];
      
        // Parse user-agent string
        const parser = new UAParser(headers['user-agent']);
        const userAgentInfo = parser.getResult();
      
        // Construct a flattened data object
        const data = {
          domain: extractTopDomain(headers['referer']),
          ip: headers['x-real-ip'],
          acceptLanguage: headers['accept-language'],
          userAgent: headers['user-agent'],
          osName: userAgentInfo.os.name,
          osVersion: userAgentInfo.os.version,
          deviceVendor: userAgentInfo.device.vendor,
          deviceModel: userAgentInfo.device.model,
          deviceType: userAgentInfo.device.type,
          browserName: userAgentInfo.browser.name,
          referer: referrer ? referrer.split('?')[0] : undefined,          
          campaign: undefined,
          campaignSource: undefined,
          apiPath: rawData.apiPath,
          originalUrl: rawData.originalUrl,
          params: rawData.params,
          geoCountry: geo.country || 'Unknown',
          geoCountryName: (geo.country && countries[geo.country]?.name) || 'Unknown',
          geoCity: geo.region || 'Unknown',
          geoRegion: geo.region || 'Unknown',
          geoLoc: geo.loc || 'Unknown',
          geoTimezone: geo.timezone || 'Unknown',
          timestamp: rawData.timestamp
        };
        
        // Extract campaign parameters if they exist in the referer
        if (referrer) {
          const refererUrl = new url.URL(referrer);
          const campaignParams = {
            utm_campaign: refererUrl.searchParams.get('utm_campaign'),
            utm_source: refererUrl.searchParams.get('utm_source'),
            rdt_cid: refererUrl.searchParams.get('rdt_cid'),
            // Add more campaign parameters as needed
          };
    
          for (const [key, value] of Object.entries(campaignParams)) {
            if (value) {
              data.campaign = value;
              data.campaignSource = key;
              break;
            }
          }
        }
      
        if (rawData.query) {
          if (rawData.query.r !== 'null') {
            data.via = rawData.query.r;
          }

          // add session id
          if (rawData.query.sid) {
            data.sessionId = rawData.query.sid;
          }

          // add event data
          if (rawData.query.event) {
            data.event = rawData.query.event;
            data.eventData = rawData.query.data;
            
            // Parse eventData if it's a string
            if (typeof data.eventData === 'string') {
              try {
                data.eventData = JSON.parse(data.eventData);
                
                // Check for page_exit event and determine if it's a bounce
                if (data.event === 'page_exit' && data.eventData.sessionDuration) {
                  //data.isBounce = parseInt(data.eventData.sessionDuration, 10) <= 30000;
                }
                
              } catch (error) {
                console.error('Error parsing eventData:', error);
              }
            }
          }
        }
        
        // add date components
        const { year, month, day, hour } = getDateComponents()
        data.year = year
        data.month = month
        data.day = day
        data.hour = hour
      
        console.log('Tracker', data);
        let pageUrl = data.referer;
        if (pageUrl && pageUrl.indexOf('?') > 0) {
          pageUrl = pageUrl.split('?')[0];
        }
        // store traffic data
        await db.insertOne('traffic', data);
        // store raw data
        await db.insertOne('rawdata', { ...rawData });
        // Queue aggregation tasks
        // db.enqueue('UPDATEANALYTICS', { trafficData: data });
       /* 
        await db.enqueue('AGGREGATE', { field: 'user_agent', value: `${data.userAgent}`, domain: data.domain });
        await db.enqueue('AGGREGATE', { field: 'device', value: `${data.osName}, ${data.osVersion}, ${data.deviceVendor}, ${data.deviceModel}, ${data.deviceType}`, domain: data.domain });
        await db.enqueue('AGGREGATE', { field: 'page', value: pageUrl, domain: data.domain });
        
        await db.enqueue('AGGREGATE', { field: 'geo', value: `${data.geoCountryName}, ${data.geoCity}`, domain: data.domain });
        await db.enqueue('AGGREGATE', { field: 'domain', value: data.domain, domain: data.domain });
    
        if (data.via && data.via !== 'null' && data.event !== 'page_exit') {
          await db.enqueue('AGGREGATE', { field: 'referer', value: data.via, domain: data.domain });
        }        
        
        if (data.event) {
          await db.enqueue('AGGREGATE', { field: 'event', value: data.event, domain: data.domain });
        } */
        
        work.end();
    } catch (error) {
        console.error('Error in trackerWorker:', error);
        work.end()
    }
};

export const aggregateWorker = async (workerdata, work) => {
   try {
     const { field, value, history, geoCountry, timestamp, event, eventData, sessionDuration, domain } = workerdata.body.payload;
     
     if (field === 'user') {
         const userData = {
             history: { page: history, geoCountry: geoCountry, timestamp: timestamp, event },
             pageViews: event === 'page_view' ? 1 : 0,
             sessionDuration: sessionDuration ? parseInt(sessionDuration, 10) : 0,
             isBounce: false
         };
 
         if (event === 'page_exit') {
             userData.isBounce = userData.pageViews <= 1 && userData.sessionDuration < 30000; // Consider it a bounce if there's only one page view and session duration is less than 30 seconds
         }
 
         await aggregateAnalyticsData(field, value, userData, domain);
     } else {
         await aggregateAnalyticsData(field, value, null, domain);
     }
     
     work.end();
   } catch (error) {
     console.error('Error in aggregateWorker:', error);
     work.end();
   }
};

export const updateAnalyticsWorker = async (workerdata, work) => {
  const {trafficData} = workerdata.body.payload;
  const db = await datastore.open();    
  const key = `${trafficData.domain}-${trafficData.year}-${trafficData.month}-${trafficData.day}`;
  try {        
    const aggregateData = await db.getOne('aggregate', { key: key });
    const ID = aggregateData._id;
    const updatedAnalytics = updateAnalytics(aggregateData, trafficData);
    delete updatedAnalytics._id;
    console.log('updatedAnalytics', ID, updatedAnalytics.key);
    await db.updateOne('aggregate', {_id: ID}, { $set: updatedAnalytics });
    work.end();
  } catch (error) {
    console.error('Error in updateAnalyticsWorker:', error);
    if (error.message === 'Not found') {
      let emptyAnalyticsData = {
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
      const newAnalytics = updateAnalytics(emptyAnalyticsData, trafficData);
      await db.insertOne('aggregate', { key: key, ...newAnalytics });
    }
    work.end();
  }
}