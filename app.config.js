// Dynamic config layered on top of app.json so we can ship a side-by-side
// "staging" variant that installs alongside the production app on the same phone.
//
// Production build (default): bundle id ai.offerloop.app, name "Offerloop",
//   scheme "offerloop" — unchanged from app.json.
// Staging build (APP_VARIANT=preview, set in eas.json's preview profile):
//   bundle id ai.offerloop.app.preview, name "Offerloop Staging",
//   scheme "offerloopstaging" — a distinct app, distinct icon slot, distinct
//   keychain, so both can live on one device at once.
//
// Expo passes the parsed app.json in as `config`; we spread it and override
// only the variant-specific fields, so nothing else about the app changes.

const IS_PREVIEW = process.env.APP_VARIANT === 'preview';

module.exports = ({ config }) => ({
  ...config,
  name: IS_PREVIEW ? 'Offerloop Staging' : config.name,
  scheme: IS_PREVIEW ? 'offerloopstaging' : config.scheme,
  ios: {
    ...config.ios,
    bundleIdentifier: IS_PREVIEW ? 'ai.offerloop.app.preview' : config.ios.bundleIdentifier,
  },
});
