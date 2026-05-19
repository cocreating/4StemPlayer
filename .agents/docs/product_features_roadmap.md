# Product Features Roadmap (Stem Player Skills)

This document outlines the proposed product features and technical skills to be implemented directly within the **4Stem Band Player** to improve its capability as a professional-grade music rehearsal and performance tool.

---

## 1. Offline Playback & PWA Support (Service Workers)
* **Goal**: Enable fully offline playback of loaded songs and audio stems.
* **Implementation Details**:
  * Implement a Service Worker to cache the application shell assets.
  * Cache the multi-track song audio stems (`.mp3` files) and pre-generated waveform peak files (`.peaks.json`) using either the browser's **Cache Storage API** or storing raw binary buffers in **IndexedDB**.
  * Auto-detect connection loss and serve cached assets smoothly without interrupting the user.
* **Benefit**: Musicians can play and practice with songs in rehearsal rooms, basements, or live stage venues where internet connection is poor or non-existent.

## 2. Interactive Chord Visualizer & Progression Sync
* **Goal**: Scroll and highlight the chords of the active song section dynamically during playback.
* **Implementation Details**:
  * Read the parsed chord structures already present in `song.json` (under the `chords` key).
  * Design a chord chart viewer component that synchronizes with the active playback time.
  * Highlight the currently playing bar/chord and anticipate upcoming chords using a scrolling UI display.
* **Benefit**: Gives players a clear, real-time visual reference of chord progressions while practicing or jam-sessioning.

## 3. A-B Loop Markers
* **Goal**: Support continuous looping of user-defined sections of the timeline.
* **Implementation Details**:
  * Allow clicking and dragging on the timeline or wavesurfer waveforms to define a selection range (Point A to Point B).
  * Update the `AudioEngine` playhead loops using Web Audio source scheduling so that when the pointer reaches Point B, it instantly jumps back to Point A without audible lag.
  * Provide toggle controls to turn looping on or off.
* **Benefit**: Critical feature for learning complex segments of a song, such as a solo, bridge, or difficult drum fill, by practicing them continuously.

## 4. Web MIDI API Integration (Hardware Controllers)
* **Goal**: Allow control of volume, mutes, solos, and transport functions using physical MIDI devices.
* **Implementation Details**:
  * Utilize the browser's `navigator.requestMIDIAccess()` API.
  * Build a MIDI mapper within the application that listens to incoming Control Change (CC) and Program Change messages.
  * Map physical knobs/faders to stem volumes, and buttons to Play/Stop/Mute/Solo functions.
* **Benefit**: Enables a tactical, real-world mixing experience for bands or live solo performers using hardware MIDI controllers (e.g. Korg nanoKONTROL, Akai LPD8).

## 5. Microphone Input & Sync Recording
* **Goal**: Allow players to sing or play along with the track, mix their input live, and record the results.
* **Implementation Details**:
  * Request microphone/audio input using `navigator.mediaDevices.getUserMedia()`.
  * Route the input stream through the Web Audio graph (allowing real-time monitoring through headphones).
  * Capture both the stem outputs and the microphone input into a `MediaRecorder` instance to export a synced `.webm`/`.wav` recording of their session.
* **Benefit**: Great for self-evaluation, allowing musicians to record their practice sessions and listen back to analyze their performance.
