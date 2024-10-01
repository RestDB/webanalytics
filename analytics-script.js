export default (host) => `
  // Generate a unique session ID
  function generateSessionId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // Get or create session ID and timestamp
  let sessionData = localStorage.getItem('analyticsSessionData');
  let sessionId;
  if (!sessionData) {
    sessionId = generateSessionId();
  } else {
    sessionData = JSON.parse(sessionData);
    sessionId = generateSessionId(); // Generate a new session ID
  }
  
  // Update session data with current timestamp
  sessionData = {
    sessionId: sessionId,
    timestamp: new Date().toISOString()
  };
  localStorage.setItem('analyticsSessionData', JSON.stringify(sessionData));

  // Function to send tracking pixel
  function sendTrackingPixel(url, eventName = null, eventData = null) {
    const img = new Image();
    let pixelUrl = 'https://${host}/pixel.gif?r=' + encodeURIComponent(url) + '&sid=' + sessionId;
    
    if (eventName) {
      pixelUrl += '&event=' + encodeURIComponent(eventName);
    }
    if (eventData) {
      pixelUrl += '&data=' + encodeURIComponent(JSON.stringify(eventData));
    }
    
    img.src = pixelUrl;
    img.width = 0;
    img.height = 0;
    img.alt = "Page view tracker";
    img.style.display = 'none';
    img.referrerPolicy = "no-referrer-when-downgrade";
    if (document.body) {
      document.body.appendChild(img);
    } else {
      window.addEventListener('DOMContentLoaded', function() {
        document.body.appendChild(img);
      });
    }
  }

  // Function to track URL changes
  function trackUrlChange() {
    sendTrackingPixel(window.location.href);
  }

  // Listen for URL changes
  window.addEventListener('urlchange', trackUrlChange);

  // Listen for hash changes
  window.addEventListener('hashchange', trackUrlChange);

  // Initial page load tracking
  window.addEventListener('DOMContentLoaded', function() {
    // Initial page load tracking
    sendTrackingPixel(document.referrer || null);
  });

  // Function to track custom events
  function trackCustomEvent(eventName, eventData = {}) {
    console.log('Custom event:', eventName, eventData);
    sendTrackingPixel(window.location.href, eventName, eventData);
  }

  // Expose trackCustomEvent to the global scope
  window.trackCustomEvent = trackCustomEvent;

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

  // Function to track page exit
  function trackPageExit() {
    const sessionData = JSON.parse(localStorage.getItem('analyticsSessionData'));
    const sessionStartTime = new Date(sessionData.timestamp);
    const sessionEndTime = new Date();
    const sessionDuration = sessionEndTime - sessionStartTime;
    
    sendTrackingPixel(window.location.href, 'page_exit', { sessionDuration });
  }

  // Listen for page exit
  window.addEventListener('beforeunload', trackPageExit);
`