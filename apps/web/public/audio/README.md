# /public/audio — Client Voice Testimonials

This directory holds opt-in audio testimonial recordings.

## Policy
- All recordings require written consent from the client (see `/legal/terms` § 7).
- Files must be `.mp3` format, ≤ 2 MB, 128 kbps mono.
- Naming convention: `testimonial-{client-slug}.mp3`

## Adding a Recording
1. Obtain signed consent form from the client.
2. Drop the `.mp3` file here.
3. Update the `testimonials` array in `apps/web/src/app/(public)/page.tsx` with:
   ```ts
   { name: 'Client Name', src: '/audio/testimonial-client-slug.mp3', transcript: '...' }
   ```
4. The `<AudioTestimonial>` component renders automatically when `src` is provided.

## Current Files
*(Empty — awaiting first client recording.)*
