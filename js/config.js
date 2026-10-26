// ============================================================
// CALLWELL SITE SETTINGS: edit this file, and only this file,
// to change your phone number, booking link, email, or prices.
// main.js reads these values and writes them into the page.
// ============================================================

export const CONFIG = {
  // What visitors SEE on the button, formatted for humans.
  demoNumberDisplay: '[DEMO NUMBER]', // e.g. '(619) 555-0123'

  // What the phone DIALS. Use +1 then 10 digits, no spaces or dashes.
  demoNumberDial: '[DEMO NUMBER]', // e.g. '+16195550123'

  // Where "Book a demo" goes (Cal.com, Calendly, Google Form, etc).
  bookingUrl: '[BOOKING LINK]', // e.g. 'https://cal.com/callwell/demo'

  email: '[EMAIL]', // e.g. 'hello@callwell.com'

  // Prices are plain numbers. The page formats them as dollars.
  price: {
    monthly: 149,
    setup: 299,
  },
};
