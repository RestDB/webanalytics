// Helper function to convert URL to brand name
export function urlToBrandName(url) {
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
      'twitter.com': 'X (Twitter)',
      'whatsapp.com': 'WhatsApp',
      'yahoo.com': 'Yahoo',
      'yandex.ru': 'Yandex',
      'youtube.com': 'YouTube',
      't.co': 'X (Twitter)',
      'android-app://com.google.android.gm': 'Gmail (Android)'
    };
  
    for (const [domain, brand] of Object.entries(brandMap)) {
      if (url.includes(domain)) {
        return brand;
      }
    }
    return url.replace('https://', '');
  }

// Helper function to convert URL to page name

export function normalizeUrl(url, domain) {
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