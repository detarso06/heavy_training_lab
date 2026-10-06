import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

// O YouTube recusa o player embutido sem uma origem (erro 153), então o iframe é carregado
// dentro de uma página HTML com baseUrl próprio em vez de abrir a URL de embed direto.
export function PlayerYoutube({ id }: { id: string }) {
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;height:100%;background:#000}iframe{border:0;width:100%;height:100%}</style></head>
<body><iframe src="https://www.youtube.com/embed/${id}?autoplay=1&playsinline=1&rel=0"
allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></body></html>`;
  return (
    <WebView
      style={styles.player}
      source={{ html, baseUrl: 'https://apptreino.local' }}
      allowsInlineMediaPlayback
      allowsFullscreenVideo
      mediaPlaybackRequiresUserAction={false}
    />
  );
}

const styles = StyleSheet.create({
  player: { flex: 1, backgroundColor: '#000' },
});
