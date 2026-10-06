export function PlayerYoutube({ id }: { id: string }) {
  return (
    <iframe
      title="Vídeo do exercício"
      src={`https://www.youtube.com/embed/${id}?autoplay=1&playsinline=1&rel=0`}
      allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
      allowFullScreen
      style={{ border: 0, width: '100%', height: '100%', background: '#000' }}
    />
  );
}
