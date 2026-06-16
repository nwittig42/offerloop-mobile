import * as ScreenCapture from 'expo-screen-capture';
import { useEffect } from 'react';
import { Platform, Share } from 'react-native';

/**
 * When the user screenshots anywhere in the app, pop the native iOS share
 * sheet so they can fire it straight into the group chat (Sorce's move). The
 * screenshot listener does not hand us the image, so we share a short blurb +
 * the app link; the screenshot itself is already in their camera roll to
 * attach from the same sheet.
 *
 * iOS needs no permission for the listener. Mounted once at the app root.
 */
export function useScreenshotShare() {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = ScreenCapture.addScreenshotListener(() => {
      Share.share({
        message: 'Working my recruiting grind on Offerloop. offerloop.ai',
      }).catch(() => {});
    });
    return () => sub.remove();
  }, []);
}

export default useScreenshotShare;
