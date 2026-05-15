import { describe, expect, it } from 'vitest';
import { loadingFeedbackText } from './loadingFeedback';

describe('loadingFeedbackText', () => {
  it('describes the manifest loading state', () => {
    expect(loadingFeedbackText('manifest')).toEqual({
      title: 'Loading song library',
      description: 'Finding available songs and preparing the player.'
    });
  });

  it('includes the song title while song details load', () => {
    expect(loadingFeedbackText('song', 'Glory Box')).toEqual({
      title: 'Preparing Glory Box',
      description: 'Loading metadata, lyrics, stems, and waveforms.'
    });
  });
});
