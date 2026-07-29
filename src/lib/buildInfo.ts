import * as Updates from 'expo-updates';

/**
 * The version stamp shown in Profile > Settings so anyone testing the staging
 * app can see exactly which OTA they are running.
 *
 * BUMP OTA_VERSION AND REWRITE OTA_NOTES ON EVERY `eas update` PUBLISH.
 * Both parallel dev sessions share this counter: whoever publishes next takes
 * the next number and says what shipped. If the number on the phone matches
 * the number in the publish message, you are testing the right build.
 */
export const OTA_VERSION = 'staging v11';
export const OTA_NOTES = 'StoreKit 1 fallback: SK2 fails with error 5 on ad hoc builds, SK1 purchases work on internal distribution';

/** e.g. "staging v3 · a1b2c3d4". The id suffix is the EAS update id, absent
 *  when running the embedded bundle (fresh install before the first OTA) or
 *  in local dev. */
export function otaStamp(): string {
  const id = Updates.updateId ? Updates.updateId.slice(0, 8) : 'embedded';
  return `${OTA_VERSION} · ${id}`;
}
