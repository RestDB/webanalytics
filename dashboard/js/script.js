import { fetchWithJWT } from './cohoapi.js';
import { normalizeUrl, urlToBrandName } from './utils.js';
import { DOMAIN_LIST } from './config.js';

export function dashboard() {
    return {
        loading: true,
        realtimeUsers: 6,
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
        graphData: {
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
                const now = new Date();
                //now.setHours(24, 0, 0, 0);
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                today.setHours(24, 0, 0, 0);
                const todayStr = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())).toISOString();
                
                const nowStr = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()+1)).toISOString()

                // Yesterday: [yesterday start of day, yesterday end of day] in UTC
                const yesterday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 1));
                const yesterdayStr = yesterday.toISOString();
                const yesterdayEndStr = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())).toISOString();

                // Two days ago: [two days ago start of day, two days ago end of day] in UTC
                const twoDaysAgo = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 2));
                const twoDaysAgoStr = twoDaysAgo.toISOString();
                const twoDaysAgoEndStr = new Date(Date.UTC(yesterday.getUTCFullYear(), yesterday.getUTCMonth(), yesterday.getUTCDate()) - 1).toISOString();

                // Last 2 days: [two days ago start of day, yesterday end of day] in UTC
                const last2Days = new Date(Date.UTC(yesterday.getUTCFullYear(), yesterday.getUTCMonth(), yesterday.getUTCDate() - 1));
                const last2DaysStr = last2Days.toISOString();
                const last2DaysEndStr = yesterdayStr;

                // Last 7 days: [7 days ago, current time] in UTC
                const last7Days = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 7));
                const last7DaysStr = last7Days.toISOString();

                // Last 30 days: [30 days ago, current time] in UTC
                const last30Days = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 30));
                const last30DaysStr = last30Days.toISOString();

                // Last 3 months: [3 months ago, current time] in UTC
                const last3Months = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 3, today.getUTCDate()));
                const last3MonthsStr = last3Months.toISOString();

                // One year ago: [start of previous year, current time] in UTC
                const oneYearAgo = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
                const oneYearAgoStr = oneYearAgo.toISOString();

                let fromPeriodStr = '';
                let toPeriodStr = '';

                switch (this.period) {
                    case 'day':
                        fromPeriodStr = todayStr;
                        toPeriodStr = nowStr;
                        break;
                    case 'last2days':
                        fromPeriodStr = last2DaysEndStr;
                        toPeriodStr = nowStr;
                        break;
                    case 'last7days':
                        fromPeriodStr = last7DaysStr;
                        toPeriodStr = nowStr;
                        break;
                    case 'last30days':
                        fromPeriodStr = last30DaysStr;
                        toPeriodStr = nowStr;
                        break;
                    case 'last3months':
                        fromPeriodStr = last3MonthsStr;
                        toPeriodStr = nowStr;
                        break;
                    case 'lastmonth':
                        fromPeriodStr = last3MonthsStr;
                        toPeriodStr = nowStr;
                        break;
                    case 'lastyear':
                        fromPeriodStr = oneYearAgoStr;
                        toPeriodStr = nowStr;
                        break;
                }
                // If selectedDomain is null, use the first domain from the domains array
                const domainToUse = this.selectedDomain || this.domains[0];

                // Define the endpoints
                const statsEndpoint = `/api/aggstats/${fromPeriodStr}/${toPeriodStr}?domain=${domainToUse}&query=${JSON.stringify(this.query)}`;
                const aiAssistEndpoint = `/api/aiassist?domain=${domainToUse}`;

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
                this.fetchAIAssistData(aiAssistEndpoint);

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
                        } else {
                            acc.push({
                                url: x.url,
                                brand: brand,
                                views: x.views
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
                        } else {
                            acc.push({
                                originalUrl: x.url,
                                url: normalizedUrl,
                                views: x.views
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
                this.pageViewsInPeriod = statsData.pageViewsInPeriod;
                this.graphData = {
                    labels: Object.keys(this.pageViewsInPeriod).map(date => new Date(date)),
                    data: Object.values(this.pageViewsInPeriod)
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
            const canvas = document.getElementById('traffic-graph');
            if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
                console.error('Traffic graph canvas not found or not a canvas element');
                return;
            }

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                console.error('Unable to get 2D context from canvas');
                return;
            }

            // Destroy the existing chart instance if it exists
            if (this.chartInstance) {
                this.chartInstance.destroy();
            }

            // Create a new chart instance and store it
            this.chartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: this.graphData.labels,
                    datasets: [{
                        label: 'Page Views',
                        data: this.graphData.data,
                        //borderColor: 'rgb(75, 75, 75)',
                        //backgroundColor: 'rgba(0, 0, 128, 0.2)',
                        borderWidth: 1, // Add this line to make the stroke thinner
                        //tension: 0.25,
                        fill: true,
                        pointRadius: 0
                    }]
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
                                parser: (value) => {
                                    const date = new Date(value);
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


            let heatmapLayer = new HeatmapOverlay(cfg);

            let baseLayer = L.tileLayer(
                    'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
                    maxZoom: 20,
                    language: 'en' // Set the language to English
                }
            );

            // Create a new map instance
            this.mapInstance = new L.Map('world_map', {            
                layers: [baseLayer, heatmapLayer],
                center: [51.5074, -0.1278], // Coordinates for London
                zoom: 3, // Adjust this value to set the initial zoom level
                language: 'en' // Set the language to English for the map instance
            });

            // Create a bounds object to adjust the map view based on locations
            const bounds = L.latLngBounds();
            
            
            if (this.geoLocCounts.length > 0) {
                const bounds = L.latLngBounds();
                this.geoLocCounts.forEach((geoData) => {
                    const location = L.latLng(geoData.lat, geoData.lon);
                    bounds.extend(location);

                    // Create the circle
                    L.circle(location, {
                        color: 'black',
                        fillColor: '#30f',
                        fillOpacity: 0.1,
                        radius: 1000
                    }).addTo(this.mapInstance);
                    
                });

                // Fit the map to the bounds of all markers
                //this.mapInstance.fitBounds(bounds);
                heatmapLayer.setData({data: this.geoLocCounts});
                //this.mapInstance.addLayer(heatmapLayer);
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
    }
}

// Initialize the map when the page loads
//document.addEventListener('DOMContentLoaded', initMap);



  // Make the dashboard function available to the global scope
  window.dashboard = dashboard;