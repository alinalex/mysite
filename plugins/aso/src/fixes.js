export default {
  'https://main--mysite--alinalex.aem.live/': {
    fixes: [
      {
        targetHTML: '.default-content-wrapper > p > a[href="/"]',
        brokenHTML: '<a href="/" title="">',
        type: 'addAttribute',
        attribute: 'aria-label',
        value: 'Home',
      },
    ],
  },
  'http://localhost:3000/': {
    fixes: [
      {
        targetHTML: '.default-content-wrapper > p > a[href="/"]',
        brokenHTML: '<a href="/" title="">',
        type: 'addAttribute',
        attribute: 'aria-label',
        value: 'Home',
      },
    ],
  },
};
