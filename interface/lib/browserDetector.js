const browserDetector = {
  name: 'chrome',
  getApi() {
    return typeof browser !== 'undefined' ? browser : chrome;
  },
  supportsPromises() {
    return typeof browser !== 'undefined';
  }
};
try {
  if (typeof browser !== 'undefined' && browser.runtime) {
    browserDetector.name = 'firefox';
  }
} catch(e) {}
if (navigator.userAgent.includes('Edg/')) {
  browserDetector.name = 'edge';
} else if (navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('Chrome')) {
  browserDetector.name = 'safari';
}
