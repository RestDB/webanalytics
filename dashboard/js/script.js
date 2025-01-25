import { fetchWithJWT } from './cohoapi.js';
import { normalizeUrl, urlToBrandName } from './utils.js';
import { DOMAIN_LIST, DASHBOARD_TITLE, REALTIME_USERS_INTERVAL } from './config.js';

let realtimeUsersInterval = null; // interval handle for fetching realtime users

function getTimeRange(rangeString) {
    const now = new Date(); // Current local time
    const timezoneOffsetMinutes = now.getTimezoneOffset(); // Local timezone offset in minutes
    const utcNow = new Date(now.getTime() + timezoneOffsetMinutes * 60000); // Current time in UTC

    let start;
    switch (rangeString) {
        case 'day': {
            start = new Date(utcNow.getFullYear(), utcNow.getMonth(), utcNow.getDate()); // Start of today in UTC
            break;
        }
        case 'yesterday': {
            start = new Date(utcNow.getFullYear(), utcNow.getMonth(), utcNow.getDate() - 1);
            utcNow.setTime(new Date(utcNow.getFullYear(), utcNow.getMonth(), utcNow.getDate()).getTime() - 1);
            break;
        }
        case 'last2days': {
            start = new Date(utcNow.getFullYear(), utcNow.getMonth(), utcNow.getDate() - 2);
            break;
        }
        case 'last7days': {
            start = new Date(utcNow.getFullYear(), utcNow.getMonth(), utcNow.getDate() - 7);
            break;
        }
        case 'last30days': {
            start = new Date(utcNow.getFullYear(), utcNow.getMonth(), utcNow.getDate() - 30);
            break;
        }
        case 'last3months': {
            start = new Date(utcNow.getFullYear(), utcNow.getMonth() - 3, utcNow.getDate());
            break;
        }
        case 'lastmonth': {
            const firstDayOfLastMonth = new Date(utcNow.getFullYear(), utcNow.getMonth() - 1, 1);
            const firstDayOfThisMonth = new Date(utcNow.getFullYear(), utcNow.getMonth(), 1);
            start = firstDayOfLastMonth;
            utcNow.setTime(firstDayOfThisMonth.getTime() - 1); // End is the last moment of the last month
            break;
        }
        case 'lastyear': {
            start = new Date(utcNow.getFullYear(), 0, 1);
            break;
        }
        default:
            throw new Error(`Unsupported range string: "${rangeString}"`);
    }

    return {
        start: start.toISOString(),
        end: utcNow.toISOString(),
    };
}

export function dashboard() {
    return {
        title: DASHBOARD_TITLE,
        loading: true,
        realtimeUsers: 0,
        period: 'day',
        uniqueUsers: 0,
        totalPageViews: 0,
        signups: 0,
        bounceRate: 0.0,
        averageSessionDuration: {minutes: 0, seconds: 0},                    
        eventCompletions: 0,
        topPages: [],
        topReferers: [],
        topCountries: [],
        topEvents: [],
        geoLocCounts: [],
        pageViewsGraphData: {
            labels: [],
            data: []
        },        
        uniqueSessionsGraphData: {
            labels: [],
            data: []
        },
        uniqueEventsGraphData: {
            labels: [],
            data: []
        },
        deviceTypes: {
            desktop: 0,
            mobile: 0
        },
        pageViewsInPeriod: [],
        domains: DOMAIN_LIST,
        selectedDomain: DOMAIN_LIST[0],
        query: {},
        filters: [],
        aiassist: {
            "lastUpdated": new Date().toISOString(),
            "ingress": "",
            "recommendations": [],
            "summary": "",
            "key insights": [],
            "data-driven recommendations": [],
            "unusual patterns or anomalies or fun facts": []
        },
        showFullReport: false,  // Add this line
        // Add methods to update data based on period changes

        async fetchStats() {
            try {
                // Get time range using the existing function
                const timeRange = getTimeRange(this.period);
                const fromPeriodStr = timeRange.start;
                const toPeriodStr = timeRange.end;

                // If selectedDomain is null, use the first domain from the domains array
                const domainToUse = this.selectedDomain || this.domains[0];

                // Define the endpoints
                const statsEndpoint = `/api/aggstats/${fromPeriodStr}/${toPeriodStr}?domain=${domainToUse}&query=${JSON.stringify(this.query)}&period=${this.period}`;
                
                // Fetch stats data
                const statsResponse = await fetchWithJWT(statsEndpoint, {
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                if (!statsResponse.ok) {
                    throw new Error('Failed to fetch stats data');
                }

                const statsData = await statsResponse.json();

                // Fetch AI assist data asynchronously
                //this.fetchAIAssistData(`/api/aiassist?domain=${domainToUse}`);

                // Fetch realtime users asynchronously
                if (realtimeUsersInterval) {
                    clearInterval(realtimeUsersInterval);
                }
                // Run fetchRealtimeUsers immediately
                this.fetchRealtimeUsers(`/api/activeusers?domain=${domainToUse}`);
                // Then set up the interval to run every 10 seconds
                realtimeUsersInterval = setInterval(() => {
                    this.fetchRealtimeUsers(`/api/activeusers?domain=${domainToUse}`);
                }, REALTIME_USERS_INTERVAL);

                // Update the component state with stats data
                this.uniqueUsers = statsData.uniqueUsers;
                this.totalPageViews = statsData.totalPageViews;
                // top referrers (Brands) sorted by views
                this.topReferers = statsData.topReferers
                    .slice(0, 10)
                    .reduce((acc, x) => {
                        const brand = urlToBrandName(x.url);
                        const existingBrand = acc.find(item => item.brand === brand);
                        
                        if (existingBrand) {
                            existingBrand.views += x.views;
                            existingBrand.sessions += x.sessions;
                        } else {
                            acc.push({
                                url: x.url,
                                brand: brand,
                                views: x.views,
                                sessions: x.sessions
                            });
                        }
                        
                        return acc;
                    }, [])
                    .sort((a, b) => b.views - a.views)
                    .map((x, index) => ({ ...x, index }));
                this.topCountries = statsData.topCountries.slice(0, 10);
                this.topEvents = statsData.topEvents;
                // Store the selected domain in a local variable
                const selectedDomain = this.selectedDomain || this.domains[0];
                // top pages sorted by views
                this.topPages = statsData.topPages                
                    .reduce((acc, x) => {
                        const normalizedUrl = normalizeUrl(x.url, selectedDomain);
                        const existingPage = acc.find(page => page.url === normalizedUrl);
                        
                        if (existingPage) {
                            existingPage.views += x.views;
                            existingPage.sessions += x.sessions;
                        } else {
                            acc.push({
                                originalUrl: x.url,
                                url: normalizedUrl,
                                views: x.views,
                                sessions: x.sessions
                            });
                        }
                        
                        return acc;
                    }, [])
                    .sort((a, b) => b.views - a.views)
                    .slice(0, 10);
                
                this.locations = statsData.locations;
                //this.signups = statsData.signups;
                this.bounceRate = statsData.bounceRate;
                this.averageSessionDuration = statsData.averageSessionDuration;
                this.eventCompletions = statsData.totalPageEvents;
                this.pageViewsInPeriod = this.fillMissingHours(statsData.pageViewsInPeriod);
                
                this.pageViewsGraphData = {
                    labels: Object.keys(this.pageViewsInPeriod).map(date => new Date(date + 'Z')),
                    data: Object.values(this.pageViewsInPeriod)
                };
                this.uniqueSessionsInPeriod = this.fillMissingHours(statsData.uniqueSessionsInPeriod);
                this.uniqueSessionsGraphData = {
                    labels: Object.keys(this.uniqueSessionsInPeriod).map(date => new Date(date + 'Z')),
                    data: Object.values(this.uniqueSessionsInPeriod)
                }
                this.uniqueEventsInPeriod = this.fillMissingHours(statsData.uniqueEventsInPeriod);
                this.uniqueEventsGraphData = {
                    labels: Object.keys(this.uniqueEventsInPeriod).map(date => new Date(date + 'Z')),
                    data: Object.values(this.uniqueEventsInPeriod)
                };
                this.deviceTypes = statsData.deviceTypes;
                this.geoLocCounts = statsData.geoLocCounts.map(x => {return {lat: x.geoloc.lat, lon: x.geoloc.lon, count: x.count}});
            } catch (error) {
                console.error('Error fetching stats:', error);
                // Handle error (e.g., show error message to user)
            }
        },

        async fetchAIAssistData(aiAssistEndpoint) {
            try {
                const aiAssistResponse = await fetchWithJWT(aiAssistEndpoint, {
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                if (!aiAssistResponse.ok) {
                    throw new Error('Failed to fetch AI assist data');
                }

                const aiassistData = await aiAssistResponse.json();

                // Update the component state
                this.aiassist = aiassistData;
            } catch (error) {
                console.error('Error fetching AI assist data:', error);
                // Handle error (e.g., show error message to user)
            }
        },

        async fetchRealtimeUsers(realtimeUsersEndpoint) {
            try {
                const realtimeUsersResponse = await fetchWithJWT(realtimeUsersEndpoint, {
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                if (!realtimeUsersResponse.ok) {
                    throw new Error('Failed to fetch realtime users data');
                }

                const realtimeUsersData = await realtimeUsersResponse.json();

                // Update the component state
                this.realtimeUsers = realtimeUsersData.totalActiveUsers;

            } catch (error) {
                console.error('Error fetching realtime users:', error);
            }
            // poll for realtime users using the interval from config
        },

        async updateStats() {
            this.loading = true;
            try {                
                await this.fetchStats();
                this.initTrafficGraph();
                this.initMap();
            } catch (error) {
                console.error('Error fetching data:', error);
            } finally {
                this.loading = false;
            }
        },

        initTrafficGraph() {
            // Track if initialization is in progress
            if (this._initializingGraph) {
                return;
            }
            this._initializingGraph = true;

            // Add debounce/delay to ensure previous chart is fully destroyed
            if (this._graphInitTimeout) {
                clearTimeout(this._graphInitTimeout);
            }

            this._graphInitTimeout = setTimeout(async () => {
                try {
                    // Wait for canvas to be available
                    const canvas = document.getElementById('traffic-graph');
                    if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
                        console.error('Traffic graph canvas not found or not a canvas element');
                        return;
                    }

                    // Safely destroy the existing chart instance
                    if (this.chartInstance) {
                        await new Promise(resolve => {
                            try {
                                this.chartInstance.destroy();
                            } catch (e) {
                                console.warn('Error destroying previous chart:', e);
                            }
                            this.chartInstance = null;
                            setTimeout(resolve, 100); // Small delay to ensure cleanup
                        });
                    }

                    // Create new chart in next animation frame
                    requestAnimationFrame(() => {
                        try {
                            const ctx = canvas.getContext('2d');
                            if (!ctx) {
                                console.error('Unable to get 2D context from canvas');
                                return;
                            }

                            this.chartInstance = new Chart(ctx, {
                                type: 'line',
                                data: {
                                    labels: this.pageViewsGraphData.labels,
                                    datasets: [{
                                        label: 'Page Views',
                                        data: this.pageViewsGraphData.data,
                                        //borderColor: 'rgb(75, 75, 75)',
                                        //backgroundColor: 'rgba(0, 0, 128, 0.2)',
                                        borderWidth: 1, // Add this line to make the stroke thinner
                                        tension: 0.1,
                                        fill: true,
                                        pointRadius: 0
                                    }, 
                                    {
                                        label: 'Unique Users',
                                        data: this.uniqueSessionsGraphData.data,
                                        //borderColor: 'rgb(75, 75, 75)',
                                        //backgroundColor: 'rgba(0, 0, 128, 0.2)',
                                        borderWidth: 1, // Add this line to make the stroke thinner
                                        tension: 0.1,
                                        fill: true,
                                        pointRadius: 0
                                    },
                                    {
                                        label: 'Unique Events',
                                        data: this.uniqueEventsGraphData.data,
                                        borderWidth: 1, // Add this line to make the stroke thinner
                                        tension: 0.1,
                                        fill: true,
                                        pointRadius: 0
                                    }
                                ]
                                },
                                options: {
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    scales: {
                                        x: {
                                            type: 'time',
                                            time: {
                                                unit: this.getTimeUnit(),
                                                displayFormats: {
                                                    hour: 'HH:mm',
                                                    day: 'MMM D',
                                                    week: 'MMM D',
                                                    month: 'MMM YYYY'
                                                },
                                                tooltipFormat: this.getTooltipFormat(),
                                                // Add a parser to adjust for local timezone
                                                xxparser: (value) => {
                                                    const date = new Date(value + 'Z');
                                                    return new Date(date.getTime() - date.getTimezoneOffset() * 60000);
                                                }
                                            },
                                            title: {
                                                display: true,
                                                text: this.period
                                            }
                                        },
                                        y: {
                                            beginAtZero: true
                                        }
                                    }
                                }
                            });
                        } catch (error) {
                            console.error('Error creating new chart:', error);
                        } finally {
                            this._initializingGraph = false;
                        }
                    });
                } catch (error) {
                    console.error('Error in initTrafficGraph:', error);
                    this._initializingGraph = false;
                }
            }, 300); // Add a delay to ensure DOM is ready
        },

        getTimeUnit() {
            switch (this.period) {
                case 'day':
                case 'yesterday':
                    return 'hour';
                case 'last7days':
                case 'last30days':
                    return 'day';
                case 'last3months':
                case 'lastmonth':
                    return 'week';
                case 'lastyear':
                    return 'month';
                default:
                    return 'day';
            }
        },

        getTooltipFormat() {
            switch (this.period) {
                case 'day':
                case 'yesterday':
                    return 'MMM D, HH:mm';
                case 'last7days':
                case 'last30days':
                case 'last3months':
                case 'lastmonth':
                    return 'MMM D, YYYY';
                case 'lastyear':
                    return 'MMM YYYY';
                default:
                    return 'MMM D, YYYY';
            }
        },

        initMap() {
            console.log('initMap');
            // Check if the map instance already exists
            if (this.mapInstance) {
                // If it exists, remove the existing map
                this.mapInstance.remove();
            }

            var cfg = {
                // radius should be small ONLY if scaleRadius is true (or small radius is intended)
                "radius": 1,
                "maxOpacity": .20,
                // scales the radius based on map zoom
                "scaleRadius": true,
                // if set to false the heatmap uses the global maximum for colorization
                // if activated: uses the data maximum within the current map boundaries
                //   (there will always be a red spot with useLocalExtremas true)
                "useLocalExtrema": false,
                // which field name in your data represents the latitude - default "lat"
                latField: 'lat',
                // which field name in your data represents the longitude - default "lng"
                lngField: 'lon',
                // which field name in your data represents the data value - default "value"
                valueField: 'count'
            };


            //let heatmapLayer = new HeatmapOverlay(cfg);

            let baseLayer = L.tileLayer(
                    'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
                    maxZoom: 20,
                    language: 'en' // Set the language to English
                }
            );

            // Create a new map instance
            this.mapInstance = new L.Map('world_map', {            
                layers: [baseLayer],
                center: [51.5074, -0.1278], // Coordinates for London
                zoom: 3, // Adjust this value to set the initial zoom level
                language: 'en' // Set the language to English for the map instance
            });

            // Create a bounds object to adjust the map view based on locations
            const bounds = L.latLngBounds();
            
            // Calculate max count once before the loop
            const maxCount = Math.max(...this.geoLocCounts.map(loc => loc.count));
            
            this.geoLocCounts.forEach((geoData) => {
                // Check if lat and lon are valid numbers
                if (typeof geoData.lat === 'number' && typeof geoData.lon === 'number' && !isNaN(geoData.lat) && !isNaN(geoData.lon)) {
                    const location = L.latLng(geoData.lat, geoData.lon);
                    bounds.extend(location);

                    // Calculate color intensity based on pre-calculated maxCount
                    const intensity = Math.min(1, geoData.count / maxCount);
                    const red = Math.floor(255 * intensity);
                    
                    // Create the circle with dynamic color
                    L.circle(location, {
                        color: `rgb(${red}, 0, 0)`,
                        fillColor: `rgb(${red}, 0, 0)`,
                        fillOpacity: 0.2,
                        radius: 1000 + (geoData.count * 100)
                    })
                    .bindTooltip(geoData.count.toString(), {
                        permanent: true,
                        direction: 'center',
                        opacity: 1,
                        className: 'location-count-label transparent-tooltip'
                    })
                    .bindPopup(`<strong>Visitors:</strong> ${geoData.count}`)
                    .addTo(this.mapInstance);
                } else {
                    console.warn('Invalid coordinates:', geoData);
                }
            });
            
            // Only fit bounds if there are valid locations
            if (bounds.isValid()) {
                //heatmapLayer.setData({data: this.geoLocCounts});
                this.mapInstance.fitBounds(bounds);
            }
        },

        init() {
            this.updateStats();
            this.initTrafficGraph();
            this.initMap();
        },        

        setPageFilter(field, value) {
            // Check if the field-value pair already exists in the filters array
            const filterExists = this.filters.some(filter => filter.field === field && filter.value === value);

            if (!filterExists) {
                this.filters.push({field: field, value: value, key: `${this.filters.length+1}`});
                // Implement the logic to filter data for the clicked page
                console.log(`Setting page filter for: ${field} = ${value}`);
                // You might want to update your data or UI based on this filter
                // For example, you could update your stats to show only data for this page
                // set query to all field and value in the filters array
                this.query = this.filters.reduce((acc, filter) => {
                    acc[filter.field] = filter.value;
                    return acc;
                }, {});
                this.updateStats();
            } else {
                console.log(`Filter for ${field} = ${value} already exists`);
            }
        },

        removeFilter(filterToRemove) {
            this.filters = this.filters.filter(filter => 
                filter.field !== filterToRemove.field || filter.value !== filterToRemove.value
            );
            this.query = this.filters.reduce((acc, filter) => {
                acc[filter.field] = filter.value;
                return acc;
            }, {});
            this.updateStats();
        },

        hasAdditionalContent() {
            return this.aiassist.summary || 
                   (this.aiassist.recommendations && this.aiassist.recommendations.length > 0) ||
                   (this.aiassist['key insights'] && this.aiassist['key insights'].length > 0) ||
                   (this.aiassist['data-driven recommendations'] && this.aiassist['data-driven recommendations'].length > 0) ||
                   (this.aiassist['unusual patterns or anomalies or fun facts'] && this.aiassist['unusual patterns or anomalies or fun facts'].length > 0);
        },

        // Add this new method to the dashboard object
        fillMissingHours(data) {
            const filledData = {};
            const entries = Object.entries(data);
            
            if (entries.length < 2) return data;

            const startDate = new Date(entries[0][0]+'Z');
            const endDate = new Date(entries[entries.length - 1][0]+'Z');

            for (let d = new Date(startDate); d <= endDate; d.setHours(d.getHours() + 1)) {
                const key = d.toISOString().slice(0, 13) + ':00';
                filledData[key] = data[key] || 0;
            }

            return filledData;
        },

        // Add this new method
        setSelectedDomain(domain) {
            this.selectedDomain = domain;
            this.resetFiltersAndQuery();
            this.updateStats();
        },

        // Add this new method
        resetFiltersAndQuery() {
            this.filters = [];
            this.query = {};
        },
    }
}

// Initialize the map when the page loads
//document.addEventListener('DOMContentLoaded', initMap);



  // Make the dashboard function available to the global scope
  window.dashboard = dashboard;








