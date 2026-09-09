import { createElement } from 'react';
import { Platform, View } from 'react-native';
import { WebView } from 'react-native-webview';

/**
 * Show a PDF held in memory as base64.
 *
 * Two renderers, because react-native-webview has no web implementation and
 * throws "React Native WebView does not support this platform" in the browser
 * preview. On web we hand the same data URL to a real <iframe>, which every
 * browser renders natively; react-native-web passes unknown DOM elements
 * through, so createElement is all it takes.
 *
 * Native keeps WebView, where iOS renders a PDF data URL directly.
 */
export default function PdfView({
  base64,
  uri: uriProp,
  backgroundColor,
}: {
  /** PDF bytes, for the builder preview. */
  base64?: string;
  /** Or a URL, for the resume on file (its token-secured storage link). */
  uri?: string;
  backgroundColor: string;
}) {
  const uri = uriProp || `data:application/pdf;base64,${base64 || ''}`;

  if (Platform.OS === 'web') {
    return (
      <View style={{ flex: 1, backgroundColor }}>
        {createElement('iframe', {
          src: uri,
          title: 'Resume PDF',
          style: { width: '100%', height: '100%', border: 'none', display: 'block' },
        })}
      </View>
    );
  }

  return (
    <WebView
      originWhitelist={['*']}
      source={{ uri }}
      style={{ flex: 1, backgroundColor }}
    />
  );
}
