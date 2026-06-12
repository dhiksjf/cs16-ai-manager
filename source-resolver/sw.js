const AD_DOMAINS = new Set([
  "doubleclick.net","googlesyndication.com","googleadservices.com",
  "google-analytics.com","googletagmanager.com","googletagservices.com",
  "adservice.google.com","pagead2.googlesyndication.com",
  "pubads.g.doubleclick.net","securepubads.g.doubleclick.net",
  "adserver.com","adtechus.com","adnxs.com","adsrvr.org",
  "criteo.com","criteo.net","rubiconproject.com",
  "casalemedia.com","moatads.com","outbrain.com","taboola.com",
  "scorecardresearch.com","quantserve.com","exelator.com",
  "adsafeprotected.com","bluekai.com","demdex.net",
  "krxd.net","adsymptotic.com","rlcdn.com","mathtag.com",
  "agkn.com","media.net","popads.net","popcash.net",
  "propellerads.com","adsterra.com","exoclick.com","trafficjunky.com",
  "adf.ly","sh.st","clk.im","ouo.io","shorte.st",
  "adserver.adtech.de","adserver.jagran.com","ads.pubmatic.com",
  "creativecdn.com","adform.net","adition.com","yieldmanager.com",
  "yieldmo.com","sharethrough.com","indexww.com","openx.net",
  "contextweb.com","pubmatic.com","sonobi.com","triplelift.com",
  "amazon-adsystem.com","sovrn.com","adservice.org",
  "c3-ads.com","ad-maven.com","clksite.com","adfoc.us",
  "cdn.popads.net","adultadvertising.net","syndication.realgeo.net",
  "bestonlineewallet.com","juicyads.com","adbucks.net",
  "adreactor.com","ero-advertising.com","adcash.com",
  "bidvertiser.com","adbrite.com","adskeeper.co.uk",
  "mgid.com","intellitxt.com","content.ad",
  "adreactor.com","adserver.biz","adultadvertising.net",
  "popup.today","popup.win","myad.click","tracker.win",
  "adxpansion.com","banners.com","adsmania.com",
  "https://srv-2025.com","https://srv-2024.com",
  "https://srv-",".traffic-",".banner-",
  "https://ads.","https://ad.","https://ad1.","https://ad2.",
  "https://cdn.ads","https://cdn.ad","https://static.ads",
  "https://stat.ads","https://tracker.","https://track.",
  "https://click.","https://clk.","https://affiliate.",
  "https://go.","tagmanager","gtm.js","ga.js","analytics.js",
  "fbevents.com","connect.facebook.net","www.facebook.com/tr",
  "bat.bing.com","bat.bing.net",
]);

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(clients.claim()));

self.addEventListener("fetch", (e) => {
  const url = e.request.url.toLowerCase();
  for (const domain of AD_DOMAINS) {
    if (url.includes(domain)) {
      return e.respondWith(new Response("blocked", { status: 200 }));
    }
  }
  e.respondWith(fetch(e.request));
});
