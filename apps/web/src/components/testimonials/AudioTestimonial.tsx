type AudioTestimonialProps = {
  /** Audio file under /public (e.g. /testimonials/sarah-k.mp3). Renders nothing when omitted. */
  src?: string;
  /** Written transcript — doubles as indexable text for SEO. */
  transcript?: string;
  name: string;
};

/**
 * Voice-testimonial player with transcript disclosure.
 * Returns null without `src`, so pages stay unchanged until real
 * client recordings (with written consent) are added to the data.
 */
export default function AudioTestimonial({ src, transcript, name }: AudioTestimonialProps) {
  if (!src) return null;

  return (
    <div className="mt-5 border-t border-white/10 pt-4">
      <audio
        controls
        preload="none"
        src={src}
        className="w-full h-9"
        aria-label={`Voice testimonial from ${name}`}
      />
      {transcript && (
        <details className="mt-2 text-xs text-slate-400">
          <summary className="cursor-pointer hover:text-white transition-colors">
            Read transcript
          </summary>
          <p className="mt-2 leading-relaxed">{transcript}</p>
        </details>
      )}
    </div>
  );
}
