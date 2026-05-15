export type LoadingFeedbackKind = 'manifest' | 'song';

export function loadingFeedbackText(kind: LoadingFeedbackKind, songTitle = '') {
  if (kind === 'manifest') {
    return {
      title: 'Loading song library',
      description: 'Finding available songs and preparing the player.'
    };
  }

  const trimmedTitle = songTitle.trim();

  return {
    title: trimmedTitle ? `Preparing ${trimmedTitle}` : 'Preparing song',
    description: 'Loading metadata, lyrics, stems, and waveforms.'
  };
}
