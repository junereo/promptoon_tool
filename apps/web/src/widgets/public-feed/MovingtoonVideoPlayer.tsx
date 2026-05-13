import { useEffect, useRef, useState } from 'react';
import { Pause, Play, VolumeMax, VolumeOff } from 'react-coolicons';

export function MovingtoonVideoPlayer({
  className,
  posterUrl,
  title,
  videoUrl
}: {
  className?: string;
  posterUrl?: string | null;
  title: string;
  videoUrl: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);

  useEffect(() => {
    setIsMuted(true);
    setIsPlaying(true);
  }, [videoUrl]);

  function handleTogglePlay() {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    if (!isPlaying) {
      const playResult = video.play();
      setIsPlaying(true);
      void playResult.catch(() => {
        setIsPlaying(false);
      });
      return;
    }

    video.pause();
    setIsPlaying(false);
  }

  function handleToggleMute() {
    const video = videoRef.current;
    const nextMuted = !isMuted;
    if (video) {
      video.muted = nextMuted;
      if (!nextMuted) {
        video.volume = 1;
      }
    }
    setIsMuted(nextMuted);
  }

  const centerControlVisibilityClass = isPlaying
    ? 'pointer-events-none scale-95 opacity-0 focus:pointer-events-auto focus:opacity-100 sm:group-hover:pointer-events-auto sm:group-hover:scale-100 sm:group-hover:opacity-100 sm:group-focus-within:pointer-events-auto sm:group-focus-within:scale-100 sm:group-focus-within:opacity-100'
    : 'opacity-100 scale-100';

  return (
    <div
      className={['group', className].filter(Boolean).join(' ')}
      data-testid="movingtoon-video-player"
      onClick={handleTogglePlay}
    >
      <video
        aria-label={`${title} 영상`}
        autoPlay
        className="h-full w-full object-contain"
        loop
        muted={isMuted}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        playsInline
        poster={posterUrl ?? undefined}
        ref={videoRef}
        src={videoUrl}
      />

      <button
        aria-label={isMuted ? '음소거 해제' : '음소거'}
        className="absolute left-4 top-4 z-30 inline-flex h-11 min-w-11 items-center justify-center gap-2 bg-black/54 px-3 text-white shadow-lg shadow-black/30 backdrop-blur-xl transition duration-200 hover:bg-black/70 focus:outline-none focus:ring-2 focus:ring-white/80 sm:pointer-events-none sm:translate-y-1 sm:opacity-0 sm:group-hover:pointer-events-auto sm:group-hover:translate-y-0 sm:group-hover:opacity-100 sm:group-focus-within:pointer-events-auto sm:group-focus-within:translate-y-0 sm:group-focus-within:opacity-100"
        onClick={(event) => {
          event.stopPropagation();
          handleToggleMute();
        }}
        type="button"
      >
        {isMuted ? <VolumeOff aria-hidden className="h-5 w-5 fill-current" /> : <VolumeMax aria-hidden className="h-5 w-5 fill-current" />}
        <span className="hidden text-xs font-semibold sm:inline">{isMuted ? '음소거 해제' : '음소거'}</span>
      </button>

      <button
        aria-label={isPlaying ? '영상 정지' : '영상 시작'}
        className={[
          'absolute left-1/2 top-1/2 z-30 inline-flex h-24 w-24 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center bg-black/46 text-white shadow-2xl shadow-black/35 backdrop-blur-xl transition duration-200 focus:outline-none focus:ring-2 focus:ring-white/80 motion-reduce:transition-none',
          centerControlVisibilityClass
        ].join(' ')}
        onClick={(event) => {
          event.stopPropagation();
          handleTogglePlay();
        }}
        type="button"
      >
        {isPlaying ? <Pause aria-hidden className="h-10 w-10 fill-current" /> : <Play aria-hidden className="h-10 w-10 fill-current" />}
        <span className="mt-1 text-sm font-semibold">{isPlaying ? '정지' : '시작'}</span>
      </button>
    </div>
  );
}
