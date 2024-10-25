
export function updateAnalytics(existingData, newRecord) {
  // Update unique users
  updateUniqueUsers(existingData, newRecord);

  // Update total page views
  if (newRecord.event !== 'page_exit') {
    existingData.totalPageViews++;
  }

  // Update unique events
  updateUniqueEvents(existingData, newRecord);

  // Update total page events
  if (newRecord.event && newRecord.event !== 'page_exit') {
    existingData.totalPageEvents++;
  }

  // Update average session duration
  updateAverageSessionDuration(existingData, newRecord);

  // Update bounce rate
  // This would require additional logic to determine if it's a bounce

  // Update top pages
  updateTopPages(existingData, newRecord);

  // Update top referers
  updateTopReferers(existingData, newRecord);

  // Update top countries
  updateTopCountries(existingData, newRecord);

  // Update top events
  updateTopEvents(existingData, newRecord);

  // Update geoLocCounts
  updateGeoLocCounts(existingData, newRecord);

  // Update device types
  updateDeviceTypes(existingData, newRecord);

  // Update pageViewsInPeriod
  updatePageViewsInPeriod(existingData, newRecord);

  // Update uniqueSessionsInPeriod
  updateUniqueSessionsInPeriod(existingData, newRecord);

  // Update uniqueEventsInPeriod
  updateUniqueEventsInPeriod(existingData, newRecord);

  return existingData;
}

// Helper functions (to be implemented)
function updateUniqueUsers(existingData, newRecord) {
  if (newRecord.sessionId) {
    const now = new Date(newRecord.timestamp).getTime();
    if (existingData.uniqueUsers[newRecord.sessionId]) {
      // User exists, update duration, check for unsorted observations start and end 
      if (now < existingData.uniqueUsers[newRecord.sessionId].duration.start) {
        existingData.uniqueUsers[newRecord.sessionId].duration.start = now;
        existingData.uniqueUsers[newRecord.sessionId].duration.diff = 0;
      }
      if (now > existingData.uniqueUsers[newRecord.sessionId].duration.end) {
        existingData.uniqueUsers[newRecord.sessionId].duration.end = now;
        existingData.uniqueUsers[newRecord.sessionId].duration.diff = now - existingData.uniqueUsers[newRecord.sessionId].duration.start;        
      } 
      existingData.uniqueUsers[newRecord.sessionId].duration.observations++;
    } else {
      // New user, add new entry
      existingData.uniqueUsers[newRecord.sessionId] = { duration: {start: now, end: now, observations: 1} };
    }
  }
}

function updateUniqueEvents(existingData, newRecord) {
  if (newRecord.event) {
    if (!existingData.uniqueEvents[newRecord.event]) {
      existingData.uniqueEvents[newRecord.event] = 0;
    }
    existingData.uniqueEvents[newRecord.event]++;
  }
}

function updateAverageSessionDuration(existingData, newRecord) {
    // Calculate the total duration across all unique users
    const totalDuration = Object.values(existingData.uniqueUsers).reduce((sum, user) => sum + (user.duration.end - user.duration.start), 0);

    // Calculate the new average
    const uniqueUserCount = Object.keys(existingData.uniqueUsers).length;
    //console.log(`totalDuration: ${totalDuration}, uniqueUserCount: ${uniqueUserCount}`);
    existingData.averageSessionDuration = totalDuration / uniqueUserCount;
}

function updateTopPages(existingData, newRecord) {
  if (newRecord.referer) {
    let pageIndex = existingData.topPages.findIndex(p => p.url === newRecord.referer);
    if (pageIndex !== -1) {
      existingData.topPages[pageIndex].views++;
    } else {
      existingData.topPages.push({ url: newRecord.referer, views: 1 });
    }
  }
}

function updateTopReferers(existingData, newRecord) {
  if (newRecord.via) {
    let refererIndex = existingData.topReferers.findIndex(r => r.url === newRecord.via);
    if (refererIndex !== -1) {
      // Referer already exists, increment views
      existingData.topReferers[refererIndex].views++;
    } else {
      // New referer, add to the list
      existingData.topReferers.push({ url: newRecord.via, views: 1 });
    }
    // Sort topReferers by views in descending order
    existingData.topReferers.sort((a, b) => b.views - a.views);
    // Keep only top N referers (e.g., top 12)
    // existingData.topReferers = existingData.topReferers.slice(0, 12);
  }
}

function updateTopCountries(existingData, newRecord) {
  if (newRecord.geoCountryName) {
    existingData.topCountries[newRecord.geoCountryName] = (existingData.topCountries[newRecord.geoCountryName] || 0) + 1;
  }
}

function updateTopEvents(existingData, newRecord) {
  if (newRecord.event) {
    existingData.topEvents[newRecord.event] = (existingData.topEvents[newRecord.event] || 0) + 1;
  }
}

function updateGeoLocCounts(existingData, newRecord) {
  if (newRecord.geoLoc) {
    existingData.geoLocCounts[newRecord.geoLoc] = (existingData.geoLocCounts[newRecord.geoLoc] || 0) + 1;
  }
}

function updateDeviceTypes(existingData, newRecord) {
  if (newRecord.deviceType) {
    existingData.deviceTypes[newRecord.deviceType] = (existingData.deviceTypes[newRecord.deviceType] || 0) + 1;
  } else {
    existingData.deviceTypes['Desktop'] = (existingData.deviceTypes['Desktop'] || 0) + 1;
  }
}

function updatePageViewsInPeriod(existingData, newRecord) {
  if (newRecord.timestamp && newRecord.event !== 'page_exit') {
    const key = newRecord.timestamp.slice(0, 13) + ':00';
    existingData.pageViewsInPeriod[key] = (existingData.pageViewsInPeriod[key] || 1) + 1;
    /*
    if (!existingData.pageViewsInPeriod[key]) {
      existingData.pageViewsInPeriod[key] = 1;
    } else {
      existingData.pageViewsInPeriod[key]++;
    } */   
  }
}

function updateUniqueSessionsInPeriod(existingData, newRecord) {
  if (newRecord.timestamp && newRecord.event !== 'page_exit') {
    const key = newRecord.timestamp.slice(0, 13) + ':00';
    existingData.uniqueSessionsInPeriod[key] = (existingData.uniqueSessionsInPeriod[key] || 1) + 1;
    /*if (!existingData.uniqueSessionsInPeriod[key]) {
      existingData.uniqueSessionsInPeriod[key] = 1;
    } else {
      existingData.uniqueSessionsInPeriod[key]++;
    } */
  }
}

function updateUniqueEventsInPeriod(existingData, newRecord) {
  if (newRecord.event) {
    existingData.uniqueEventsInPeriod[newRecord.event] = (existingData.uniqueEventsInPeriod[newRecord.event] || 0) + 1;
  }
}
