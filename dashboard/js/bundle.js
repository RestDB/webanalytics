(() => {
  // dashboard/js/cohoapi.js
  async function refreshAccessToken() {
    const response = await fetch("/auth/refreshtoken", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      }
    });
    if (response.ok) {
      const data = await response.json();
      return data;
    } else {
      throw new Error("Failed to refresh token");
    }
  }
  async function fetchWithJWT(url, options = {}) {
    const originalRequestOptions = { ...options };
    options.headers = {
      ...options.headers,
      credentials: "include"
    };
    const response = await fetch(url, options);
    if (response.status === 401) {
      try {
        const newAccessToken = await refreshAccessToken();
        originalRequestOptions.headers = {
          ...originalRequestOptions.headers,
          credentials: "include"
        };
        return fetch(url, originalRequestOptions);
      } catch (error) {
        console.error("Token refresh failed:", error);
        return window.location.href = "/auth/login";
      }
    }
    return response;
  }

  // dashboard/js/utils.js
  function urlToBrandName(url) {
    const brandMap = {
      "Baidu": "baidu\\.com",
      "Bing": "bing\\.com",
      "DuckDuckGo": "duckduckgo\\.com",
      "DevHunt": "devhunt\\.org",
      "Facebook": "facebook\\.com",
      "GitHub": "github\\.com",
      "Google": "google\\.",
      "Instagram": "instagram\\.com",
      "LinkedIn": "linkedin\\.com",
      "Pinterest": "pinterest\\.com",
      "Reddit": "reddit\\.com",
      "Snapchat": "snapchat\\.com",
      "TikTok": "tiktok\\.com",
      "X (Twitter)": "twitter\\.com|https://t\\.co",
      "WhatsApp": "whatsapp\\.com",
      "Yahoo": "yahoo\\.com",
      "Yandex": "yandex\\.ru",
      "YouTube": "youtube\\.com",
      "Gmail (Android)": "android-app://com\\.google\\.android\\.gm"
    };
    for (const [brand, domainPattern] of Object.entries(brandMap)) {
      if (new RegExp(domainPattern).test(url)) {
        return brand;
      }
    }
    return url.replace(/^https?:\/\//, "");
  }
  function normalizeUrl(url, domain) {
    url = url.replace(/^https?:\/\//, "");
    url = url.replace(/^www\./, "");
    url = url.replace(/\/$/, "");
    if (url.startsWith(domain)) {
      url = url.substring(domain.length) || "/";
    }
    return url;
  }

  // dashboard/js/config.js
  var DOMAIN_LIST = ["codehooks.io", "restdb.io"];
  var DASHBOARD_TITLE = "Codehooks Analytics";
  var REALTIME_USERS_INTERVAL = 2e4;

  // dashboard/js/script.js
  var realtimeUsersInterval = null;
  function getTimeRange(rangeString) {
    const now = /* @__PURE__ */ new Date();
    const timezoneOffsetMinutes = now.getTimezoneOffset();
    const utcNow = new Date(now.getTime() + timezoneOffsetMinutes * 6e4);
    let start;
    switch (rangeString) {
      case "day": {
        start = new Date(utcNow.getFullYear(), utcNow.getMonth(), utcNow.getDate());
        break;
      }
      case "yesterday": {
        start = new Date(utcNow.getFullYear(), utcNow.getMonth(), utcNow.getDate() - 1);
        utcNow.setTime(new Date(utcNow.getFullYear(), utcNow.getMonth(), utcNow.getDate()).getTime() - 1);
        break;
      }
      case "last2days": {
        start = new Date(utcNow.getFullYear(), utcNow.getMonth(), utcNow.getDate() - 2);
        break;
      }
      case "last7days": {
        start = new Date(utcNow.getFullYear(), utcNow.getMonth(), utcNow.getDate() - 7);
        break;
      }
      case "last30days": {
        start = new Date(utcNow.getFullYear(), utcNow.getMonth(), utcNow.getDate() - 30);
        break;
      }
      case "last3months": {
        start = new Date(utcNow.getFullYear(), utcNow.getMonth() - 3, utcNow.getDate());
        break;
      }
      case "lastmonth": {
        const firstDayOfLastMonth = new Date(utcNow.getFullYear(), utcNow.getMonth() - 1, 1);
        const firstDayOfThisMonth = new Date(utcNow.getFullYear(), utcNow.getMonth(), 1);
        start = firstDayOfLastMonth;
        utcNow.setTime(firstDayOfThisMonth.getTime() - 1);
        break;
      }
      case "lastyear": {
        start = new Date(utcNow.getFullYear(), 0, 1);
        break;
      }
      default:
        throw new Error(`Unsupported range string: "${rangeString}"`);
    }
    return {
      start: start.toISOString(),
      end: utcNow.toISOString()
    };
  }
  function dashboard() {
    return {
      title: DASHBOARD_TITLE,
      loading: true,
      realtimeUsers: 0,
      period: "day",
      uniqueUsers: 0,
      totalPageViews: 0,
      signups: 0,
      bounceRate: 0,
      averageSessionDuration: { minutes: 0, seconds: 0 },
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
        "lastUpdated": (/* @__PURE__ */ new Date()).toISOString(),
        "ingress": "",
        "recommendations": [],
        "summary": "",
        "key insights": [],
        "data-driven recommendations": [],
        "unusual patterns or anomalies or fun facts": []
      },
      showFullReport: false,
      // Add this line
      // Add methods to update data based on period changes
      async fetchStats() {
        try {
          const timeRange = getTimeRange(this.period);
          const fromPeriodStr = timeRange.start;
          const toPeriodStr = timeRange.end;
          const domainToUse = this.selectedDomain || this.domains[0];
          const statsEndpoint = `/api/aggstats/${fromPeriodStr}/${toPeriodStr}?domain=${domainToUse}&query=${JSON.stringify(this.query)}&period=${this.period}`;
          const statsResponse = await fetchWithJWT(statsEndpoint, {
            headers: {
              "Content-Type": "application/json"
            }
          });
          if (!statsResponse.ok) {
            throw new Error("Failed to fetch stats data");
          }
          const statsData = await statsResponse.json();
          if (realtimeUsersInterval) {
            clearInterval(realtimeUsersInterval);
          }
          this.fetchRealtimeUsers(`/api/activeusers?domain=${domainToUse}`);
          realtimeUsersInterval = setInterval(() => {
            this.fetchRealtimeUsers(`/api/activeusers?domain=${domainToUse}`);
          }, REALTIME_USERS_INTERVAL);
          this.uniqueUsers = statsData.uniqueUsers;
          this.totalPageViews = statsData.totalPageViews;
          this.topReferers = statsData.topReferers.slice(0, 10).reduce((acc, x) => {
            const brand = urlToBrandName(x.url);
            const existingBrand = acc.find((item) => item.brand === brand);
            if (existingBrand) {
              existingBrand.views += x.views;
              existingBrand.sessions += x.sessions;
            } else {
              acc.push({
                url: x.url,
                brand,
                views: x.views,
                sessions: x.sessions
              });
            }
            return acc;
          }, []).sort((a, b) => b.views - a.views).map((x, index) => ({ ...x, index }));
          this.topCountries = statsData.topCountries.slice(0, 10);
          this.topEvents = statsData.topEvents;
          const selectedDomain = this.selectedDomain || this.domains[0];
          this.topPages = statsData.topPages.reduce((acc, x) => {
            const normalizedUrl = normalizeUrl(x.url, selectedDomain);
            const existingPage = acc.find((page) => page.url === normalizedUrl);
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
          }, []).sort((a, b) => b.views - a.views).slice(0, 10);
          this.locations = statsData.locations;
          this.bounceRate = statsData.bounceRate;
          this.averageSessionDuration = statsData.averageSessionDuration;
          this.eventCompletions = statsData.totalPageEvents;
          this.pageViewsInPeriod = this.fillMissingHours(statsData.pageViewsInPeriod);
          this.pageViewsGraphData = {
            labels: Object.keys(this.pageViewsInPeriod).map((date) => /* @__PURE__ */ new Date(date + "Z")),
            data: Object.values(this.pageViewsInPeriod)
          };
          this.uniqueSessionsInPeriod = this.fillMissingHours(statsData.uniqueSessionsInPeriod);
          this.uniqueSessionsGraphData = {
            labels: Object.keys(this.uniqueSessionsInPeriod).map((date) => /* @__PURE__ */ new Date(date + "Z")),
            data: Object.values(this.uniqueSessionsInPeriod)
          };
          this.uniqueEventsInPeriod = this.fillMissingHours(statsData.uniqueEventsInPeriod);
          this.uniqueEventsGraphData = {
            labels: Object.keys(this.uniqueEventsInPeriod).map((date) => /* @__PURE__ */ new Date(date + "Z")),
            data: Object.values(this.uniqueEventsInPeriod)
          };
          this.deviceTypes = statsData.deviceTypes;
          this.geoLocCounts = statsData.geoLocCounts.map((x) => {
            return { lat: x.geoloc.lat, lon: x.geoloc.lon, count: x.count };
          });
        } catch (error) {
          console.error("Error fetching stats:", error);
        }
      },
      async fetchAIAssistData(aiAssistEndpoint) {
        try {
          const aiAssistResponse = await fetchWithJWT(aiAssistEndpoint, {
            headers: {
              "Content-Type": "application/json"
            }
          });
          if (!aiAssistResponse.ok) {
            throw new Error("Failed to fetch AI assist data");
          }
          const aiassistData = await aiAssistResponse.json();
          this.aiassist = aiassistData;
        } catch (error) {
          console.error("Error fetching AI assist data:", error);
        }
      },
      async fetchRealtimeUsers(realtimeUsersEndpoint) {
        try {
          const realtimeUsersResponse = await fetchWithJWT(realtimeUsersEndpoint, {
            headers: {
              "Content-Type": "application/json"
            }
          });
          if (!realtimeUsersResponse.ok) {
            throw new Error("Failed to fetch realtime users data");
          }
          const realtimeUsersData = await realtimeUsersResponse.json();
          this.realtimeUsers = realtimeUsersData.totalActiveUsers;
        } catch (error) {
          console.error("Error fetching realtime users:", error);
        }
      },
      async updateStats() {
        this.loading = true;
        try {
          await this.fetchStats();
          this.initTrafficGraph();
          this.initMap();
        } catch (error) {
          console.error("Error fetching data:", error);
        } finally {
          this.loading = false;
        }
      },
      initTrafficGraph() {
        if (this._initializingGraph) {
          return;
        }
        this._initializingGraph = true;
        if (this._graphInitTimeout) {
          clearTimeout(this._graphInitTimeout);
        }
        this._graphInitTimeout = setTimeout(async () => {
          try {
            const canvas = document.getElementById("traffic-graph");
            if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
              console.error("Traffic graph canvas not found or not a canvas element");
              return;
            }
            if (this.chartInstance) {
              await new Promise((resolve) => {
                try {
                  this.chartInstance.destroy();
                } catch (e) {
                  console.warn("Error destroying previous chart:", e);
                }
                this.chartInstance = null;
                setTimeout(resolve, 100);
              });
            }
            requestAnimationFrame(() => {
              try {
                const ctx = canvas.getContext("2d");
                if (!ctx) {
                  console.error("Unable to get 2D context from canvas");
                  return;
                }
                this.chartInstance = new Chart(ctx, {
                  type: "line",
                  data: {
                    labels: this.pageViewsGraphData.labels,
                    datasets: [
                      {
                        label: "Page Views",
                        data: this.pageViewsGraphData.data,
                        //borderColor: 'rgb(75, 75, 75)',
                        //backgroundColor: 'rgba(0, 0, 128, 0.2)',
                        borderWidth: 1,
                        // Add this line to make the stroke thinner
                        tension: 0.1,
                        fill: true,
                        pointRadius: 0
                      },
                      {
                        label: "Unique Users",
                        data: this.uniqueSessionsGraphData.data,
                        //borderColor: 'rgb(75, 75, 75)',
                        //backgroundColor: 'rgba(0, 0, 128, 0.2)',
                        borderWidth: 1,
                        // Add this line to make the stroke thinner
                        tension: 0.1,
                        fill: true,
                        pointRadius: 0
                      },
                      {
                        label: "Unique Events",
                        data: this.uniqueEventsGraphData.data,
                        borderWidth: 1,
                        // Add this line to make the stroke thinner
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
                        type: "time",
                        time: {
                          unit: this.getTimeUnit(),
                          displayFormats: {
                            hour: "HH:mm",
                            day: "MMM D",
                            week: "MMM D",
                            month: "MMM YYYY"
                          },
                          tooltipFormat: this.getTooltipFormat(),
                          // Add a parser to adjust for local timezone
                          xxparser: (value) => {
                            const date = /* @__PURE__ */ new Date(value + "Z");
                            return new Date(date.getTime() - date.getTimezoneOffset() * 6e4);
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
                console.error("Error creating new chart:", error);
              } finally {
                this._initializingGraph = false;
              }
            });
          } catch (error) {
            console.error("Error in initTrafficGraph:", error);
            this._initializingGraph = false;
          }
        }, 300);
      },
      getTimeUnit() {
        switch (this.period) {
          case "day":
          case "yesterday":
            return "hour";
          case "last7days":
          case "last30days":
            return "day";
          case "last3months":
          case "lastmonth":
            return "week";
          case "lastyear":
            return "month";
          default:
            return "day";
        }
      },
      getTooltipFormat() {
        switch (this.period) {
          case "day":
          case "yesterday":
            return "MMM D, HH:mm";
          case "last7days":
          case "last30days":
          case "last3months":
          case "lastmonth":
            return "MMM D, YYYY";
          case "lastyear":
            return "MMM YYYY";
          default:
            return "MMM D, YYYY";
        }
      },
      initMap() {
        console.log("initMap");
        if (this.mapInstance) {
          this.mapInstance.remove();
        }
        var cfg = {
          // radius should be small ONLY if scaleRadius is true (or small radius is intended)
          "radius": 1,
          "maxOpacity": 0.2,
          // scales the radius based on map zoom
          "scaleRadius": true,
          // if set to false the heatmap uses the global maximum for colorization
          // if activated: uses the data maximum within the current map boundaries
          //   (there will always be a red spot with useLocalExtremas true)
          "useLocalExtrema": false,
          // which field name in your data represents the latitude - default "lat"
          latField: "lat",
          // which field name in your data represents the longitude - default "lng"
          lngField: "lon",
          // which field name in your data represents the data value - default "value"
          valueField: "count"
        };
        let heatmapLayer = new HeatmapOverlay(cfg);
        let baseLayer = L.tileLayer(
          "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
          {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            maxZoom: 20,
            language: "en"
            // Set the language to English
          }
        );
        this.mapInstance = new L.Map("world_map", {
          layers: [baseLayer, heatmapLayer],
          center: [51.5074, -0.1278],
          // Coordinates for London
          zoom: 3,
          // Adjust this value to set the initial zoom level
          language: "en"
          // Set the language to English for the map instance
        });
        const bounds = L.latLngBounds();
        if (this.geoLocCounts.length > 0) {
          this.geoLocCounts.forEach((geoData) => {
            if (typeof geoData.lat === "number" && typeof geoData.lon === "number" && !isNaN(geoData.lat) && !isNaN(geoData.lon)) {
              const location = L.latLng(geoData.lat, geoData.lon);
              bounds.extend(location);
              L.circle(location, {
                color: "black",
                fillColor: "#30f",
                fillOpacity: 0.1,
                radius: 1e3
              }).addTo(this.mapInstance);
            } else {
              console.warn("Invalid coordinates:", geoData);
            }
          });
          if (bounds.isValid()) {
            heatmapLayer.setData({ data: this.geoLocCounts });
            this.mapInstance.fitBounds(bounds);
          }
        }
      },
      init() {
        this.updateStats();
        this.initTrafficGraph();
        this.initMap();
      },
      setPageFilter(field, value) {
        const filterExists = this.filters.some((filter) => filter.field === field && filter.value === value);
        if (!filterExists) {
          this.filters.push({ field, value, key: `${this.filters.length + 1}` });
          console.log(`Setting page filter for: ${field} = ${value}`);
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
        this.filters = this.filters.filter(
          (filter) => filter.field !== filterToRemove.field || filter.value !== filterToRemove.value
        );
        this.query = this.filters.reduce((acc, filter) => {
          acc[filter.field] = filter.value;
          return acc;
        }, {});
        this.updateStats();
      },
      hasAdditionalContent() {
        return this.aiassist.summary || this.aiassist.recommendations && this.aiassist.recommendations.length > 0 || this.aiassist["key insights"] && this.aiassist["key insights"].length > 0 || this.aiassist["data-driven recommendations"] && this.aiassist["data-driven recommendations"].length > 0 || this.aiassist["unusual patterns or anomalies or fun facts"] && this.aiassist["unusual patterns or anomalies or fun facts"].length > 0;
      },
      // Add this new method to the dashboard object
      fillMissingHours(data) {
        const filledData = {};
        const entries = Object.entries(data);
        if (entries.length < 2) return data;
        const startDate = /* @__PURE__ */ new Date(entries[0][0] + "Z");
        const endDate = /* @__PURE__ */ new Date(entries[entries.length - 1][0] + "Z");
        for (let d = new Date(startDate); d <= endDate; d.setHours(d.getHours() + 1)) {
          const key = d.toISOString().slice(0, 13) + ":00";
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
      }
    };
  }
  window.dashboard = dashboard;
})();
